/**
 * VendorRepository — real-Postgres integration coverage.
 *
 * Drives the actual Drizzle repo (filters, org-scoping, FSM transitions)
 * against a live engine inside a transaction that is always rolled back, so
 * it leaves no residue. Mirrors the harness in
 * communication.repo.list-stats.test.ts. Skips cleanly without DATABASE_URL
 * or when the schema is unmigrated.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, NotFoundError } from '@/core/errors';
import { DatabaseRepository } from '@/core/database.repo';
import { VendorRepository } from './vendor.repo';
import type { NewVendor } from './marketplace.schema';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__vendor_repo_rollback__';

/**
 * `listing-order.test.ts` sorts before this file and mocks Vendor FSM methods
 * (verifyVendor/suspendVendor/rejectVendor) without restoring them, so a plain
 * import-time snapshot would capture mocks under a full-suite run. Capture the
 * genuine implementations: prefer the live prototype when it is still pristine
 * (repos-only runs — keeps coverage attributed to vendor.repo.ts), and fall
 * back to a cache-busted fresh import for any method a prior file already
 * mocked (full-suite correctness). Reinstated before each test.
 */
const BASE_METHODS = ['createOne', 'findMany', 'findOne', 'findOneById', 'updateOneById'] as const;
const OWN_METHODS = [
  'verifyVendor', 'suspendVendor', 'rejectVendor', 'findVerifiedVendors', 'buildWhereConditions',
] as const;
const pristineBase: Record<string, any> = {};
const pristineOwn: Record<string, any> = {};
async function capturePristine(): Promise<void> {
  // A method bound to a `mock()` has a `.mock` marker; treat those as polluted.
  const isMock = (fn: any) => !!fn && typeof fn === 'function' && 'mock' in fn;
  let fresh: typeof VendorRepository | null = null;
  const ensureFresh = async () => {
    if (!fresh) {
      const m = await import(`./vendor.repo?pristine=${Date.now()}`);
      fresh = m.VendorRepository as typeof VendorRepository;
    }
    return fresh;
  };
  for (const k of BASE_METHODS) {
    const live = (DatabaseRepository.prototype as any)[k];
    pristineBase[k] = isMock(live)
      ? Object.getPrototypeOf((await ensureFresh()).prototype)[k]
      : live;
  }
  for (const k of OWN_METHODS) {
    const live = (VendorRepository.prototype as any)[k];
    pristineOwn[k] = isMock(live) ? ((await ensureFresh()).prototype as any)[k] : live;
  }
}
function restorePristine(): void {
  for (const k of BASE_METHODS) {
    delete (VendorRepository.prototype as any)[k];
    (DatabaseRepository.prototype as any)[k] = pristineBase[k];
  }
  for (const k of OWN_METHODS) (VendorRepository.prototype as any)[k] = pristineOwn[k];
}

function newVendor(orgId: string, overrides: Partial<NewVendor> = {}): NewVendor {
  return {
    organizationId: orgId,
    companyName: 'Acme Medical',
    category: 'supplies',
    description: 'Medical supplies vendor',
    verificationStatus: 'pending',
    contactEmail: `vendor-${crypto.randomUUID()}@acme.test`,
    createdBy: crypto.randomUUID(),
    updatedBy: crypto.randomUUID(),
    ...overrides,
  } as NewVendor;
}

/** Run body in a tx that always rolls back. Skips if schema unmigrated. */
async function inTx(
  db: DatabaseInstance,
  body: (repo: VendorRepository) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await body(new VendorRepository(tx as never));
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping vendor.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('VendorRepository (real-PG)', () => {
  let db: DatabaseInstance | null = null;
  beforeAll(async () => {
    if (SKIP) return;
    const { createDatabase } = await import('@/core/database');
    db = createDatabase({ url: DATABASE_URL! });
    await capturePristine();
  });
  beforeEach(() => restorePristine());
  afterAll(async () => {
    if (db) {
      const { closeDatabaseConnection } = await import('@/core/database');
      await closeDatabaseConnection(db);
    }
  });

  test('buildWhereConditions: filters by org, category, status, email + org-scoping isolation', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const orgA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const uniqueEmail = `a-${crypto.randomUUID()}@x.test`;
      const a = await repo.createOne(newVendor(orgA, { category: 'emr', contactEmail: uniqueEmail }));
      await repo.createOne(newVendor(orgA, { category: 'supplies', verificationStatus: 'verified' }));
      await repo.createOne(newVendor(orgB, { category: 'emr' })); // foreign org

      // undefined filters → no conditions branch
      expect(await repo.findMany()).not.toBeUndefined();

      // org-scoping: orgA sees only its 2, never orgB's row
      const orgAList = await repo.findMany({ organizationId: orgA });
      expect(orgAList.length).toBe(2);
      expect(orgAList.every((v) => v.organizationId === orgA)).toBe(true);

      // category + status + email branches
      expect((await repo.findMany({ organizationId: orgA, category: 'emr' })).length).toBe(1);
      expect((await repo.findMany({ organizationId: orgA, verificationStatus: 'verified' })).length).toBe(1);
      expect((await repo.findMany({ contactEmail: uniqueEmail })).length).toBe(1);
      expect((await repo.findOne({ organizationId: orgA, category: 'emr' }))?.id).toBe(a.id);
    });
  });

  test('findVerifiedVendors returns only verified for the org', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
      await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
      const verified = await repo.findVerifiedVendors(org);
      expect(verified.length).toBe(1);
      expect(verified[0]!.verificationStatus).toBe('verified');
    });
  });

  test('verifyVendor: pending→verified sets verifiedAt/By; NotFound when missing', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const v = await repo.createOne(newVendor(org));
      const admin = crypto.randomUUID();
      const verified = await repo.verifyVendor(v.id, admin);
      expect(verified.verificationStatus).toBe('verified');
      expect(verified.verifiedBy).toBe(admin);
      expect(verified.verifiedAt).not.toBeNull();
      await expect(repo.verifyVendor(crypto.randomUUID(), admin)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test('verifyVendor rejects invalid FSM transition (rejected→verified)', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const v = await repo.createOne(newVendor(org, { verificationStatus: 'rejected' }));
      await expect(repo.verifyVendor(v.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test('suspendVendor: verified→suspended; invalid from pending throws', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
      expect((await repo.suspendVendor(ver.id, crypto.randomUUID())).verificationStatus).toBe('suspended');

      const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
      await expect(repo.suspendVendor(pend.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
      await expect(repo.suspendVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test('rejectVendor: pending→rejected; verified cannot be rejected', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
      expect((await repo.rejectVendor(pend.id, crypto.randomUUID())).verificationStatus).toBe('rejected');

      const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
      await expect(repo.rejectVendor(ver.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
      await expect(repo.rejectVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
