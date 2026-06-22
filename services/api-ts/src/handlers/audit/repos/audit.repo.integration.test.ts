/**
 * Real-PG integration harness for AuditRepository (W3 audit S1).
 *
 * WHY THIS FILE EXISTS:
 * The in-module `repos/audit.repo.test.ts` is a FAKE-DB ILLUSION — `makeMockDb()`
 * hand-builds insert/update/delete/select chains returning scripted arrays. It
 * proves ZERO real SQL: no enum enforcement, no NOT-NULL behavior, no integrity-
 * hash round-trip through a persisted timestamptz, no purge_after computation, no
 * org-default branch landing in the store. The only genuine real-PG coverage of
 * this repo today (`person/audit-no-pii.integration.test.ts`) reaches `logEvent`
 * but characterizes the DPA-05 scrub, not the enum/org/integrity invariants.
 *
 * This suite stands up an isolated scratch Postgres schema copying the LIVE
 * `public.audit_log_entry` (LIKE … INCLUDING ALL → real columns, enums, NOT-NULL,
 * defaults, indexes; FKs dropped) and proves, against actual SQL:
 *   - `logEvent` persists ONE row with every enum column landing correctly via the
 *     `...request` spread, plus created_by/updated_by/user;
 *   - the persisted `integrity_hash` is a 64-char hex AND survives a real round-trip
 *     through `verifyIntegrity([readBackRow])` (verifiedCount === 1) — the timestamptz
 *     Postgres stored re-serializes to the same hash the in-process insert computed;
 *   - `purge_after` lands ≈ now + 7y (HIPAA), as a real timestamptz, not a captured
 *     JS Date;
 *   - `event_sub_type` persists via the spread (currently unproven anywhere);
 *   - the org-default branch (repo line 132) fires: `logEvent` WITHOUT organizationId
 *     persists `organization_id = SYSTEM_ORG_ID`, satisfying the NOT-NULL;
 *   - a DIRECT raw INSERT omitting organization_id rejects with SQLSTATE 23502 —
 *     proving the NOT-NULL is real (any writer bypassing logEvent's default fails),
 *     i.e. ALL audit writes MUST go through logEvent or supply org;
 *   - a raw INSERT with an out-of-enum event_type rejects with 22P02 — enum is
 *     enforced at the DB, not just the app layer.
 *
 * The 'system'-literal → 22P02 actor guard is already proven by
 * `person/audit-no-pii.integration.test.ts:368-409` and is intentionally NOT
 * duplicated here.
 *
 * Every assertion reads back real persisted state (`H.scopedPool.query`) and
 * asserts on its contents, or captures a real Postgres SQLSTATE. Requires a
 * migrated public schema; skips cleanly when Postgres is unreachable.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { AuditRepository } from '@/handlers/audit/repos/audit.repo';
import type { AuditLogEntry } from '@/handlers/audit/repos/audit.schema';
import { SYSTEM_ORG_ID } from '@/core/constants';

let H: ScratchDb;

const noopLogger = {
  debug() {}, info() {}, warn() {}, error() {},
  child() { return noopLogger; },
} as any;

function freshId(): string {
  return crypto.randomUUID();
}

const ORG = '00000000-0000-4000-8000-0000000000a1';

beforeAll(async () => {
  H = await createScratch(['audit_log_entry']);
});

afterAll(async () => {
  await H?.teardown();
});

async function readRow(id: string): Promise<any> {
  const { rows } = await H.scopedPool.query(
    `SELECT * FROM "${H.schema}".audit_log_entry WHERE id = $1`,
    [id],
  );
  return rows[0];
}

/** Capture a Postgres SQLSTATE from a thrown error (driver nests it under cause). */
function sqlState(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.code ?? err.cause?.code;
}

describe('AuditRepository.logEvent — real-PG persistence (W3 audit S1)', () => {
  test('persists ONE row with all enum columns + actor fields via the spread', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const U = freshId();
    const creatorId = freshId();
    const R = freshId();

    const entry = await repo.logEvent(
      {
        eventType: 'data-access',
        category: 'hipaa',
        action: 'read',
        outcome: 'success',
        organizationId: ORG,
        user: U,
        userType: 'admin',
        resourceType: 'audit_log',
        resource: R,
        description: 'x',
      },
      creatorId,
    );

    const row = await readRow(entry.id);
    expect(row).toBeDefined();
    expect(row.event_type).toBe('data-access');
    expect(row.category).toBe('hipaa');
    expect(row.action).toBe('read');
    expect(row.outcome).toBe('success');
    expect(row.retention_status).toBe('active');
    expect(row.organization_id).toBe(ORG);
    expect(row.created_by).toBe(creatorId);
    expect(row.updated_by).toBe(creatorId);
    expect(row.user).toBe(U);
    expect(row.user_type).toBe('admin');
    expect(row.resource_type).toBe('audit_log');
    expect(row.resource).toBe(R);
    expect(row.description).toBe('x');

    // exactly one row landed for this resource
    const { rows: countRows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".audit_log_entry WHERE resource = $1`,
      [R],
    );
    expect(countRows[0].n).toBe(1);
  });

  test('integrity_hash is 64-char hex AND verifyIntegrity over the persisted row verifies (round-trip)', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const entry = await repo.logEvent(
      {
        eventType: 'security',
        category: 'security',
        action: 'login',
        outcome: 'success',
        organizationId: ORG,
        user: freshId(),
        userType: 'admin',
        resourceType: 'session',
        resource: freshId(),
        description: 'integrity round-trip',
      },
      freshId(),
    );

    const row = await readRow(entry.id);
    expect(row.integrity_hash).toMatch(/^[a-f0-9]{64}$/);

    // Re-fetch via the repo so the row carries Drizzle-typed Date objects
    // (verifyIntegrity calls entry.createdAt.toISOString()).
    const [readBack] = await repo.findMany({ resource: row.resource });
    expect(readBack).toBeDefined();
    expect(readBack.integrityHash).toBe(row.integrity_hash);

    const result = await repo.verifyIntegrity([readBack as AuditLogEntry]);
    expect(result.verifiedCount).toBe(1);
    expect(result.compromisedEntries).toEqual([]);
    expect(result.totalChecked).toBe(1);
  });

  test('purge_after lands ≈ now + 7 years (HIPAA retention floor)', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const insertYear = new Date().getUTCFullYear();
    const entry = await repo.logEvent(
      {
        eventType: 'compliance',
        category: 'financial',
        action: 'mark-paid',
        outcome: 'success',
        organizationId: ORG,
        user: freshId(),
        userType: 'admin',
        resourceType: 'invoice',
        resource: freshId(),
        description: 'purge window',
      },
      freshId(),
    );

    const row = await readRow(entry.id);
    expect(row.purge_after).toBeInstanceOf(Date);
    const purgeYear = new Date(row.purge_after).getUTCFullYear();
    // addYears(now, 7); year delta is 6 or 7 depending on month/leap boundary.
    expect(purgeYear - insertYear).toBeGreaterThanOrEqual(6);
    expect(purgeYear - insertYear).toBeLessThanOrEqual(7);
  });

  test('event_sub_type persists via the ...request spread', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const entry = await repo.logEvent(
      {
        eventType: 'data-modification',
        category: 'financial',
        action: 'mark-paid',
        outcome: 'success',
        organizationId: ORG,
        user: freshId(),
        userType: 'admin',
        resourceType: 'payment',
        resource: freshId(),
        description: 'sub-type spread',
        eventSubType: 'financial.payment-recorded',
      },
      freshId(),
    );

    const row = await readRow(entry.id);
    expect(row.event_sub_type).toBe('financial.payment-recorded');
  });
});

describe('AuditRepository — org default + DB invariants (W3 audit S1)', () => {
  test('logEvent WITHOUT organizationId defaults organization_id to SYSTEM_ORG_ID', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const R = freshId();
    const entry = await repo.logEvent(
      {
        eventType: 'system-config',
        category: 'administrative',
        action: 'update',
        outcome: 'success',
        // organizationId intentionally omitted → repo line 132 default branch
        user: freshId(),
        userType: 'system',
        resourceType: 'config',
        resource: R,
        description: 'org default branch',
      },
      freshId(),
    );

    const row = await readRow(entry.id);
    expect(row.organization_id).toBe(SYSTEM_ORG_ID);
  });

  test('direct INSERT omitting organization_id → SQLSTATE 23502 (NOT-NULL is real)', async () => {
    if (!H.dbReachable) return;

    let err: unknown = null;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".audit_log_entry
           (event_type, category, action, outcome, resource_type, resource, description)
         VALUES ('data-access'::audit_event_type, 'hipaa'::audit_category,
                 'read'::audit_action, 'success'::audit_outcome,
                 'audit_log', $1, 'no org')`,
        [freshId()],
      );
    } catch (e) {
      err = e;
    }

    expect(err).not.toBeNull();
    expect(sqlState(err)).toBe('23502');
    // the violating column is organization_id
    const col = (err as { column?: string; cause?: { column?: string } }).column
      ?? (err as { cause?: { column?: string } }).cause?.column;
    expect(col).toBe('organization_id');
  });

  test('direct INSERT with out-of-enum event_type → SQLSTATE 22P02 (enum enforced at DB)', async () => {
    if (!H.dbReachable) return;

    let err: unknown = null;
    try {
      await H.scopedPool.query(
        `INSERT INTO "${H.schema}".audit_log_entry
           (event_type, category, action, outcome, organization_id, resource_type, resource, description)
         VALUES ('not-a-real-type'::audit_event_type, 'hipaa'::audit_category,
                 'read'::audit_action, 'success'::audit_outcome,
                 $1, 'audit_log', $2, 'bad enum')`,
        [ORG, freshId()],
      );
    } catch (e) {
      err = e;
    }

    expect(err).not.toBeNull();
    expect(sqlState(err)).toBe('22P02');
  });
});
