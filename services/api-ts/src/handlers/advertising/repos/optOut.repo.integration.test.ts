/**
 * MemberAdOptOutRepository — real-Postgres integration coverage.
 *
 * Exercises filter branches (org, person), isOptedOut, idempotent optOut
 * (dedup — second call is a no-op) and optIn (delete-if-present + no-op when
 * absent), plus org-scoping isolation. Transaction-rollback harness; skips
 * cleanly without DATABASE_URL / unmigrated schema.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { MemberAdOptOutRepository } from './optOut.repo';

const DATABASE_URL = process.env['DATABASE_URL'];
const SKIP = !DATABASE_URL;
const ROLLBACK = '__optout_repo_rollback__';

/**
 * Sibling handler tests mock repo prototype methods and never restore them;
 * bun loads+runs files sequentially so an import-time snapshot would capture
 * the mocks. Fresh-import (cache-busted) the repo in beforeAll to recover
 * pristine implementations, then reinstate them before each test. Order-proof.
 */
const BASE_METHODS = ['createOne', 'findMany', 'findOne', 'deleteOneById'] as const;
let restorePristine: () => void = () => {};
async function capturePristine(): Promise<void> {
  const fresh = await import(`./optOut.repo?pristine=${Date.now()}`);
  const FreshRepo = fresh.MemberAdOptOutRepository as typeof MemberAdOptOutRepository;
  const freshBase = Object.getPrototypeOf(FreshRepo.prototype);
  restorePristine = () => {
    for (const k of BASE_METHODS) {
      delete (MemberAdOptOutRepository.prototype as any)[k];
      (DatabaseRepository.prototype as any)[k] = (freshBase as any)[k];
    }
    (MemberAdOptOutRepository.prototype as any).isOptedOut = FreshRepo.prototype.isOptedOut;
    (MemberAdOptOutRepository.prototype as any).optOut = FreshRepo.prototype.optOut;
    (MemberAdOptOutRepository.prototype as any).optIn = FreshRepo.prototype.optIn;
    (MemberAdOptOutRepository.prototype as any).buildWhereConditions = (FreshRepo.prototype as any).buildWhereConditions;
  };
}

async function inTx(
  db: DatabaseInstance,
  body: (repo: MemberAdOptOutRepository) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await body(new MemberAdOptOutRepository(tx as never));
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    if ((e as Error).message === ROLLBACK) return;
    if (/relation .* does not exist/i.test((e as Error).message)) {
      console.log('Skipping optOut.repo DB test: schema not migrated');
      return;
    }
    throw e;
  }
}

describe('MemberAdOptOutRepository (real-PG)', () => {
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

  test('optOut is idempotent (dedup) and isOptedOut reflects state', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const person = crypto.randomUUID();
      expect(await repo.isOptedOut(org, person)).toBe(false);

      await repo.optOut(org, person);
      expect(await repo.isOptedOut(org, person)).toBe(true);
      expect((await repo.findMany({ organizationId: org })).length).toBe(1);

      // Second opt-out is a no-op — still exactly one row (dedup).
      await repo.optOut(org, person, crypto.randomUUID());
      expect((await repo.findMany({ organizationId: org })).length).toBe(1);
    });
  });

  test('optIn deletes the opt-out row; no-op when none exists', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const org = crypto.randomUUID();
      const person = crypto.randomUUID();

      // No-op path: opt-in when not opted out throws nothing, leaves no row.
      await repo.optIn(org, person);
      expect(await repo.isOptedOut(org, person)).toBe(false);

      await repo.optOut(org, person);
      await repo.optIn(org, person);
      expect(await repo.isOptedOut(org, person)).toBe(false);
      expect((await repo.findMany({ organizationId: org })).length).toBe(0);
    });
  });

  test('filters + org-scoping isolation (org / person branches)', async () => {
    if (SKIP || !db) return;
    await inTx(db, async (repo) => {
      const orgA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const personShared = crypto.randomUUID();
      await repo.optOut(orgA, personShared);
      await repo.optOut(orgA, crypto.randomUUID());
      await repo.optOut(orgB, personShared); // foreign org, same person

      expect(await repo.findMany()).not.toBeUndefined(); // undefined-filter branch

      // org-scoping: orgA sees 2; the orgB row for the same person never leaks.
      expect((await repo.findMany({ organizationId: orgA })).length).toBe(2);
      expect((await repo.findMany({ personId: personShared })).length).toBe(2);
      expect((await repo.findMany({ organizationId: orgA, personId: personShared })).length).toBe(1);
      // person opted out in orgA but isOptedOut is org-scoped — false for a 3rd org.
      expect(await repo.isOptedOut(crypto.randomUUID(), personShared)).toBe(false);
    });
  });
});
