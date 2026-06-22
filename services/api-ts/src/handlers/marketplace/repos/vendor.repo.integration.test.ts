/**
 * VendorRepository — real-Postgres integration coverage (createScratch harness).
 *
 * Drives the actual Drizzle repo (filters, org-scoping, FSM transitions)
 * against an isolated scratch schema copied `LIKE public.* INCLUDING ALL`, so
 * the live column types / NOT NULL / defaults / CHECKs are reproduced faithfully
 * and the suite is parallel-safe with zero cross-file mock bleed. FKs are dropped
 * by `LIKE`, so vendor rows seed directly without standing up org/person parents.
 *
 * Migrated (W3 marketplace S1) off the prior transaction-rollback-on-`public`
 * harness + the brittle capturePristine/restorePristine prototype-mock
 * restoration machinery — createScratch isolates the schema with the genuine
 * prototype, so no restoration is needed.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ConflictError, NotFoundError } from '@/core/errors';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { VendorRepository } from './vendor.repo';
import type { NewVendor } from './marketplace.schema';

let H: ScratchDb;
beforeAll(async () => {
  H = await createScratch(['vendor', 'marketplace_listing', 'marketplace_order']);
});
afterAll(async () => {
  await H?.teardown();
});

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

describe('VendorRepository (real-PG / createScratch)', () => {
  test('createOne round-trips: default status applied, org persisted, version=1', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const orgId = crypto.randomUUID();
    // omit verificationStatus → DB default 'pending' must apply
    const v = await repo.createOne(newVendor(orgId, { verificationStatus: undefined }));

    const { rows } = await H.scopedPool.query(
      `SELECT verification_status, organization_id, version FROM "${H.schema}".vendor WHERE id = $1`,
      [v.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].verification_status).toBe('pending');
    expect(rows[0].organization_id).toBe(orgId);
    expect(rows[0].version).toBe(1);
  });

  test('buildWhereConditions: filters by org, category, status, email + org-scoping isolation', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const orgA = crypto.randomUUID();
    const orgB = crypto.randomUUID();
    const uniqueEmail = `a-${crypto.randomUUID()}@x.test`;
    const a = await repo.createOne(newVendor(orgA, { category: 'emr', contactEmail: uniqueEmail }));
    await repo.createOne(newVendor(orgA, { category: 'supplies', verificationStatus: 'verified' }));
    await repo.createOne(newVendor(orgB, { category: 'emr' })); // foreign org

    // undefined filters → no conditions branch
    expect(await repo.findMany()).not.toBeUndefined();

    // org-scoping: orgA sees only its 2 rows on real PG, never orgB's
    const orgAList = await repo.findMany({ organizationId: orgA });
    expect(orgAList.length).toBe(2);
    expect(orgAList.every((v) => v.organizationId === orgA)).toBe(true);
    expect(orgAList.some((v) => v.organizationId === orgB)).toBe(false);

    // category + status + email branches
    expect((await repo.findMany({ organizationId: orgA, category: 'emr' })).length).toBe(1);
    expect((await repo.findMany({ organizationId: orgA, verificationStatus: 'verified' })).length).toBe(1);
    expect((await repo.findMany({ contactEmail: uniqueEmail })).length).toBe(1);
    expect((await repo.findOne({ organizationId: orgA, category: 'emr' }))?.id).toBe(a.id);
  });

  test('findVerifiedVendors returns only verified for the org', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    const verified = await repo.findVerifiedVendors(org);
    expect(verified.length).toBe(1);
    expect(verified[0]!.verificationStatus).toBe('verified');
  });

  test('verifyVendor: pending→verified sets verifiedAt/By; NotFound when missing', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await repo.createOne(newVendor(org));
    const admin = crypto.randomUUID();
    const verified = await repo.verifyVendor(v.id, admin);
    expect(verified.verificationStatus).toBe('verified');
    expect(verified.verifiedBy).toBe(admin);
    expect(verified.verifiedAt).not.toBeNull();
    await expect(repo.verifyVendor(crypto.randomUUID(), admin)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('verifyVendor rejects invalid FSM transition (rejected→verified)', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const v = await repo.createOne(newVendor(org, { verificationStatus: 'rejected' }));
    await expect(repo.verifyVendor(v.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
  });

  test('suspendVendor: verified→suspended; invalid from pending throws', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    expect((await repo.suspendVendor(ver.id, crypto.randomUUID())).verificationStatus).toBe('suspended');

    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    await expect(repo.suspendVendor(pend.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.suspendVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });

  test('rejectVendor: pending→rejected; verified cannot be rejected', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    expect((await repo.rejectVendor(pend.id, crypto.randomUUID())).verificationStatus).toBe('rejected');

    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await expect(repo.rejectVendor(ver.id, crypto.randomUUID())).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.rejectVendor(crypto.randomUUID(), crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});

/**
 * Slice 2 (W3 marketplace) — Vendor FSM (BR-38 verification lifecycle) proven at
 * the SQL boundary. Slice 1 asserted the repo *return value*; here we read the
 * persisted row back via `H.scopedPool` so the transition is proven on disk
 * (real enum value + actually-stamped timestamp), and we prove the
 * `vendor_status` enum column type itself rejects garbage (22P02) — the enum is
 * enforced by the live column type copied via `LIKE ... INCLUDING ALL`, not just
 * the Drizzle/TS type.
 */
describe('VendorRepository FSM @ SQL boundary (W3 S2 / BR-38)', () => {
  async function readVendor(id: string) {
    const { rows } = await H.scopedPool.query(
      `SELECT verification_status, verified_by, verified_at, updated_by
         FROM "${H.schema}".vendor WHERE id = $1`,
      [id],
    );
    return rows[0] as
      | { verification_status: string; verified_by: string | null; verified_at: Date | null; updated_by: string | null }
      | undefined;
  }

  test('verifyVendor stamps verified_by/verified_at on the persisted row (pending→verified)', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const admin = crypto.randomUUID();
    const v = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));

    await repo.verifyVendor(v.id, admin);

    const row = await readVendor(v.id);
    expect(row).toBeDefined();
    expect(row!.verification_status).toBe('verified');
    expect(row!.verified_by).toBe(admin);
    expect(row!.verified_at).not.toBeNull();
    expect(row!.verified_at).toBeInstanceOf(Date);
  });

  test('suspendVendor persists suspended (verified→suspended); suspend on pending → ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const by = crypto.randomUUID();

    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await repo.suspendVendor(ver.id, by);
    const sRow = await readVendor(ver.id);
    expect(sRow!.verification_status).toBe('suspended');
    expect(sRow!.updated_by).toBe(by);

    // pending → suspended is NOT a valid edge (pending→[verified,rejected])
    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    await expect(repo.suspendVendor(pend.id, by)).rejects.toBeInstanceOf(ConflictError);
    const pRow = await readVendor(pend.id);
    expect(pRow!.verification_status).toBe('pending'); // rolled forward into nothing — still pending on disk
  });

  test('rejectVendor persists rejected (pending→rejected, terminal); reject on verified → ConflictError, row unchanged', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const org = crypto.randomUUID();
    const by = crypto.randomUUID();

    const pend = await repo.createOne(newVendor(org, { verificationStatus: 'pending' }));
    await repo.rejectVendor(pend.id, by);
    const rRow = await readVendor(pend.id);
    expect(rRow!.verification_status).toBe('rejected');

    // verified → rejected is NOT a valid edge (verified→[suspended])
    const ver = await repo.createOne(newVendor(org, { verificationStatus: 'verified' }));
    await expect(repo.rejectVendor(ver.id, by)).rejects.toBeInstanceOf(ConflictError);
    const vRow = await readVendor(ver.id);
    expect(vRow!.verification_status).toBe('verified'); // unchanged on disk
  });

  test('every FSM method NotFoundError on a random uuid (no row written)', async () => {
    if (!H.dbReachable) return;
    const repo = new VendorRepository(H.db as never);
    const by = crypto.randomUUID();
    await expect(repo.verifyVendor(crypto.randomUUID(), by)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.suspendVendor(crypto.randomUUID(), by)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.rejectVendor(crypto.randomUUID(), by)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('vendor_status enum column rejects a bogus value at the SQL boundary (22P02)', async () => {
    if (!H.dbReachable) return;
    // Raw insert bypassing Drizzle's TS type — the live column type (vendor_status
    // enum, copied by LIKE INCLUDING ALL) must reject 'bogus' with invalid_text_representation.
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".vendor
           (organization_id, company_name, category, description, contact_email, verification_status, created_by, updated_by)
         VALUES ($1, 'Bogus Co', 'supplies', 'd', 'b@x.test', 'bogus', $2, $2)`,
        [crypto.randomUUID(), crypto.randomUUID()],
      );
      throw new Error('expected enum insert to fail');
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code
        ?? (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('22P02');
  });
});
