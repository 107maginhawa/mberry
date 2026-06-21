/**
 * Real-PG integration suite for SuppressionRepository on `createScratch` (B3 email S6).
 *
 * CONSOLIDATES + EXTENDS the lone genuine real-PG email file. The existing
 * suppression.repo.integration.test.ts stands up the table via HAND-WRITTEN DDL
 * (reason modelled as `text`, a partial column set). This suite uses the canonical
 * `createScratch(['email_suppression'])` (CREATE TABLE … LIKE public.email_suppression
 * INCLUDING ALL) so the scratch table is SCHEMA-FAITHFUL: the real
 * `suppression_reason` enum, the live NOT-NULL set (organization_id), and the
 * `email_suppression_org_email_unique` constraint are copied verbatim — a column
 * the author forgot to declare can't pass against a thinner fake.
 *
 * Reproduces the prior contract (hard_bounce persist+read, idempotent duplicate
 * keeps FIRST reason via swallowed 23505, complaint, cross-tenant isolation,
 * listByOrg org-scope) PLUS new asserts the hand-DDL file never made:
 *   - org_id 23502 — email_suppression is the ONLY email table with org_id NOT NULL;
 *     a raw INSERT omitting organization_id fires Postgres 23502 (the real-schema
 *     invariant, only observable because LIKE copies the NOT-NULL flag).
 *   - reason-aware lookup locks the EXACT string 'unsubscribe' (BR-57 dependency:
 *     the send-pipeline override at email.ts:567-569 keys on this literal).
 *   - deleteByIdForOrg cross-tenant delete guard (T-25-02): orgB returns null and
 *     deletes nothing; the orgA row is still present.
 *
 * Guards `if (!H.dbReachable) return;` and tears down in afterAll. Runs in the
 * DB-backed ci-migrate lane. The old hand-DDL file is left in place (finalize
 * decides removal after measuring — no coverage loss here).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { SuppressionRepository } from './suppression.repo';

const ORG_A = '00000000-0000-4000-8000-00000000a001';
const ORG_B = '00000000-0000-4000-8000-00000000b001';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['email_suppression']);
});

afterAll(async () => {
  await H?.teardown();
});

function repo() {
  return new SuppressionRepository(H.db as never);
}

function freshEmail(tag: string): string {
  return `${tag}-${crypto.randomUUID()}@example.test`;
}

// ─── Reproduced contract (now schema-faithful via LIKE, not hand-DDL) ─────────

describe('SuppressionRepository on createScratch — BR-55 hard_bounce (real PG)', () => {
  test('persists a hard_bounce suppression and reads it back with the exact reason', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('bounce');

    expect(await r.isSuppressed(email, ORG_A)).toBe(false);

    await r.addSuppression({ orgId: ORG_A, email, reason: 'hard_bounce' });

    expect(await r.getSuppressionReason(email, ORG_A)).toBe('hard_bounce');
    expect(await r.isSuppressed(email, ORG_A)).toBe(true);

    // The persisted row really carries the enum value (read back raw).
    const { rows } = await H.scopedPool.query(
      `SELECT reason FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('hard_bounce');
  });

  test('a duplicate add for the same org+email is an idempotent no-op (keeps FIRST reason, 23505 swallowed)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('dup');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'hard_bounce' });
    // Second add must NOT throw on the (org,email) unique constraint.
    await r.addSuppression({ orgId: ORG_A, email, reason: 'manual' });

    // First reason retained — the no-op does not overwrite — and exactly one row.
    expect(await r.getSuppressionReason(email, ORG_A)).toBe('hard_bounce');
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe('SuppressionRepository on createScratch — BR-56 complaint + tenant isolation (real PG)', () => {
  test('persists a complaint suppression with reason complaint', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('complaint');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'complaint' });

    expect(await r.getSuppressionReason(email, ORG_A)).toBe('complaint');
  });

  test('suppression is strictly org-scoped — a complaint in org A does NOT suppress the same address in org B', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('shared');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'complaint' });

    expect(await r.isSuppressed(email, ORG_A)).toBe(true);
    expect(await r.isSuppressed(email, ORG_B)).toBe(false);
    expect(await r.getSuppressionReason(email, ORG_B)).toBeNull();
  });

  test('listByOrg returns only the calling org’s suppressions', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const aEmail = freshEmail('list-a');
    const bEmail = freshEmail('list-b');

    await r.addSuppression({ orgId: ORG_A, email: aEmail, reason: 'complaint' });
    await r.addSuppression({ orgId: ORG_B, email: bEmail, reason: 'hard_bounce' });

    const aList = await r.listByOrg(ORG_A);
    const aEmails = aList.data.map((row) => row.email);
    expect(aEmails).toContain(aEmail);
    expect(aEmails).not.toContain(bEmail);
  });
});

// ─── NEW: org_id NOT NULL invariant (23502) — only email table with it ────────

describe('SuppressionRepository on createScratch — org_id 23502 invariant (real PG)', () => {
  test('raw INSERT omitting organization_id fires Postgres 23502 (the sole email org_id NOT-NULL surface)', async () => {
    if (!H.dbReachable) return;
    let code: string | undefined;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".email_suppression (email, reason) VALUES ($1, $2::suppression_reason)`,
        [freshEmail('no-org'), 'manual'],
      );
    } catch (e) {
      code =
        (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
    }
    expect(code).toBe('23502');
  });

  test('positive: a raw INSERT WITH organization_id succeeds and the uuid reads back', async () => {
    if (!H.dbReachable) return;
    const email = freshEmail('with-org');
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".email_suppression (organization_id, email, reason) VALUES ($1, $2, $3::suppression_reason)`,
      [ORG_A, email, 'manual'],
    );
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".email_suppression WHERE email=$1`,
      [email],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(ORG_A);
  });
});

// ─── NEW: reason-aware lookup locks the exact string (BR-57 dependency) ───────

describe('SuppressionRepository on createScratch — reason-aware lookup (BR-57)', () => {
  test("getSuppressionReason returns exactly 'unsubscribe' (the literal the send-pipeline override keys on, not a boolean)", async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('unsub');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'unsubscribe' });

    const reason = await r.getSuppressionReason(email, ORG_A);
    expect(reason).toBe('unsubscribe');
    // Strictly the enum string, never coerced to a truthy boolean.
    expect(typeof reason).toBe('string');
  });
});

// ─── NEW: deleteByIdForOrg cross-tenant delete guard (T-25-02) ────────────────

describe('SuppressionRepository on createScratch — delete + cross-tenant guard (real PG)', () => {
  test('removeSuppression deletes the org+email row (read-back count=0)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('remove');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'manual' });
    await r.removeSuppression(ORG_A, email);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    expect(rows[0].n).toBe(0);
  });

  test('deleteByIdForOrg returns the removed row for the owning org', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('del-own');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'manual' });
    const { rows: idRows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    const id = idRows[0].id as string;

    const removed = await r.deleteByIdForOrg(id, ORG_A);
    expect(removed).not.toBeNull();
    expect(removed?.email).toBe(email);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_suppression WHERE id=$1`,
      [id],
    );
    expect(rows[0].n).toBe(0);
  });

  test('deleteByIdForOrg from a DIFFERENT org returns null and deletes NOTHING (the orgA row survives)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const email = freshEmail('del-cross');

    await r.addSuppression({ orgId: ORG_A, email, reason: 'manual' });
    const { rows: idRows } = await H.scopedPool.query(
      `SELECT id FROM "${H.schema}".email_suppression WHERE organization_id=$1 AND email=$2`,
      [ORG_A, email],
    );
    const id = idRows[0].id as string;

    // orgB attempts to delete orgA's row by id.
    const result = await r.deleteByIdForOrg(id, ORG_B);
    expect(result).toBeNull();

    // The orgA row is STILL present — cross-tenant delete was a true no-op.
    const { rows } = await H.scopedPool.query(
      `SELECT organization_id FROM "${H.schema}".email_suppression WHERE id=$1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].organization_id).toBe(ORG_A);
  });
});
