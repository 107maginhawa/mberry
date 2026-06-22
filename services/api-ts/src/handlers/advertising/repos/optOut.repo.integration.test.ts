/**
 * MemberAdOptOutRepository — real-Postgres integration coverage (createScratch).
 *
 * Exercises filter branches (org, person), isOptedOut, idempotent optOut
 * (dedup — second call is a no-op) and optIn (delete-if-present + no-op when
 * absent), plus org-scoping isolation.
 *
 * Migrated off the shared-`public` transaction-rollback harness onto an isolated
 * `createScratch` schema; the `capturePristine`/`restorePristine` prototype-restore
 * hack is gone (per-schema pool removes the cross-file `mock()` pollution it worked
 * around). Skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { MemberAdOptOutRepository } from './optOut.repo';

describe('MemberAdOptOutRepository (real-PG, createScratch)', () => {
  let H: ScratchDb;
  beforeAll(async () => {
    H = await createScratch(['member_ad_opt_out']);
  });
  afterAll(async () => {
    await H?.teardown();
  });

  test('optOut is idempotent (dedup) and isOptedOut reflects state', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
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

  test('optIn deletes the opt-out row; no-op when none exists', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
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

  test('filters + org-scoping isolation (org / person branches)', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
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
