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

  // ── REAL BUG (W3 S3): member_ad_opt_out has no unique(organization_id, person_id).
  // optOut() is findOne-then-createOne (TOCTOU): concurrent calls both pass the
  // findOne guard and insert TWO rows for the same (org, person). The fix is a
  // DB unique index (migration 0082) + ON CONFLICT DO NOTHING upsert. Until then
  // the DB has no backstop and the concurrent-dup test exposes the defect.
  test('DB enforces uniqueness on (org, person) — a duplicate raw insert raises 23505', async () => {
    if (!H.dbReachable) return;
    const org = crypto.randomUUID();
    const person = crypto.randomUUID();

    const insert = () =>
      H.scopedPool.query(
        `INSERT INTO "${H.schema}".member_ad_opt_out (organization_id, person_id, created_by, updated_by)
         VALUES ($1, $2, $2, $2)`,
        [org, person]
      );

    await insert();
    // The second insert for the same (org, person) must be rejected by the DB.
    // Before migration 0082 there is no unique constraint → this SUCCEEDS (two
    // rows, RED). After 0082 it raises unique_violation 23505 (GREEN).
    let code: string | undefined;
    try {
      await insert();
    } catch (e) {
      code = (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('23505');

    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".member_ad_opt_out WHERE organization_id=$1 AND person_id=$2`,
      [org, person]
    );
    expect(rows.length).toBe(1);
  });

  test('repo.optOut is idempotent under the DB unique constraint (ON CONFLICT swallows 23505)', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
    const org = crypto.randomUUID();
    const person = crypto.randomUUID();

    // Concurrent opt-outs both pass the in-app findOne guard; the DB unique index
    // is the real backstop. With ON CONFLICT DO NOTHING the loser is a no-op, not
    // an uncaught 23505 — exactly one row, no rejection bubbles out.
    const results = await Promise.allSettled([repo.optOut(org, person), repo.optOut(org, person)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".member_ad_opt_out WHERE organization_id=$1 AND person_id=$2`,
      [org, person]
    );
    expect(rows.length).toBe(1);
    expect(await repo.isOptedOut(org, person)).toBe(true);
  });

  // optIn() deletes only existing.id (the first found). If a duplicate ever exists
  // (the race above), opt-in leaves a straggler and the member silently stays
  // opted-OUT. The fix deletes ALL matching (org, person) rows.
  test('optIn removes ALL opt-out rows for (org, person) — no straggler left behind', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
    const org = crypto.randomUUID();
    const person = crypto.randomUUID();

    // Simulate the pre-fix race outcome: two duplicate rows for the same
    // (org, person). Post-migration the unique index forbids that, so drop it
    // inside this isolated scratch schema to seed the legacy-corrupt state and
    // prove optIn's delete-ALL behavior cleans it up (not just the first row).
    await H.scopedPool.query(
      `DROP INDEX IF EXISTS "${H.schema}".member_ad_opt_out_organization_id_person_id_idx1`
    );
    for (let i = 0; i < 2; i++) {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".member_ad_opt_out (organization_id, person_id, created_by, updated_by)
         VALUES ($1, $2, $2, $2)`,
        [org, person]
      );
    }
    const before = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".member_ad_opt_out WHERE organization_id=$1 AND person_id=$2`,
      [org, person]
    );
    expect(before.rows.length).toBe(2);

    await repo.optIn(org, person);

    const after = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".member_ad_opt_out WHERE organization_id=$1 AND person_id=$2`,
      [org, person]
    );
    expect(after.rows.length).toBe(0);
    expect(await repo.isOptedOut(org, person)).toBe(false);

    // Restore the unique index so sibling tests sharing this scratch schema keep
    // the ON CONFLICT backstop.
    await H.scopedPool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS member_ad_opt_out_organization_id_person_id_idx1
       ON "${H.schema}".member_ad_opt_out (organization_id, person_id)`
    );
  });

  // Positive characterization — the happy-path lifecycle is unchanged by the fix.
  test('single optOut then optIn leaves 0 rows and isOptedOut false', async () => {
    if (!H.dbReachable) return;
    const repo = new MemberAdOptOutRepository(H.db as never);
    const org = crypto.randomUUID();
    const person = crypto.randomUUID();

    await repo.optOut(org, person);
    expect(await repo.isOptedOut(org, person)).toBe(true);
    await repo.optIn(org, person);
    expect(await repo.isOptedOut(org, person)).toBe(false);
    const { rows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".member_ad_opt_out WHERE organization_id=$1 AND person_id=$2`,
      [org, person]
    );
    expect(rows.length).toBe(0);
  });
});
