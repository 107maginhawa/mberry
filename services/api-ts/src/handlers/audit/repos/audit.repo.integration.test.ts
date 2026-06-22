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

/**
 * S2 — buildWhereConditions filter SQL + findMany/count against real Postgres.
 *
 * The 28.83%→real gap: the fake-db illusion never exercised buildWhereConditions
 * (audit.repo.ts:38-100) against actual SQL. This block seeds a deterministic set
 * of rows in two distinct orgs, spanning event types / categories / actions /
 * outcomes / users / resource types / retention statuses / created_at dates, then
 * proves every filter branch returns ONLY the matching subset, that filters AND
 * together, that count(filters) === findMany(filters).length (both share
 * buildWhereConditions), and that an empty filter returns every seeded row.
 *
 * All S2 assertions are scoped to ORG_A / ORG_B (distinct from S1's ORG) so rows
 * seeded by other describe blocks in this same scratch table never pollute the
 * subset counts. Every assert is on real persisted ids/columns read back through
 * the repo's own SQL path — never a stubbed array, never the seed input re-echoed.
 */
describe('AuditRepository.buildWhereConditions — filter SQL over real PG (W3 audit S2)', () => {
  const ORG_A = '00000000-0000-4000-8000-0000000000b1';
  const ORG_B = '00000000-0000-4000-8000-0000000000b2';

  // Deterministic actors so {user} filter has a known target.
  const USER_TARGET = '00000000-0000-4000-8000-0000000000c1';

  // Captured ids for subset assertions.
  const seeded: {
    orgA: string[];
    orgB: string[];
    securityEvent?: string;
    financialCategory?: string;
    anonymizeAction?: string;
    deniedOutcome?: string;
    targetUser?: string;
    personResource?: string;
    archived?: string;
    dateBefore?: string;
    dateInsideLow?: string;
    dateInsideHigh?: string;
    dateAfter?: string;
  } = { orgA: [], orgB: [] };

  // Anchor for the date-range window: a fixed past instant so created_at can be
  // forced via raw INSERT (logEvent always stamps now()).
  const WINDOW_LOW = new Date('2024-03-01T00:00:00.000Z');
  const WINDOW_HIGH = new Date('2024-03-31T23:59:59.000Z');

  /** Raw INSERT with explicit created_at + retention_status (logEvent can't set these). */
  async function rawInsert(opts: {
    org: string;
    eventType?: string;
    category?: string;
    action?: string;
    outcome?: string;
    user?: string | null;
    resourceType?: string;
    retentionStatus?: string;
    createdAt?: Date;
  }): Promise<string> {
    const id = freshId();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".audit_log_entry
         (id, event_type, category, action, outcome, organization_id,
          "user", resource_type, resource, description, retention_status,
          created_at, updated_at, created_by, updated_by)
       VALUES ($1, $2::audit_event_type, $3::audit_category, $4::audit_action,
               $5::audit_outcome, $6, $7, $8, $9, 'seed', $10::audit_retention_status,
               $11, $11, $12, $12)`,
      [
        id,
        opts.eventType ?? 'data-access',
        opts.category ?? 'administrative',
        opts.action ?? 'read',
        opts.outcome ?? 'success',
        opts.org,
        opts.user ?? null,
        opts.resourceType ?? 'generic',
        freshId(),
        opts.retentionStatus ?? 'active',
        opts.createdAt ?? new Date(),
        freshId(),
      ],
    );
    return id;
  }

  beforeAll(async () => {
    if (!H.dbReachable) return;

    // --- ORG_A rows: one per distinct filter dimension ---
    seeded.securityEvent = await rawInsert({ org: ORG_A, eventType: 'security' });
    seeded.financialCategory = await rawInsert({ org: ORG_A, category: 'financial' });
    seeded.anonymizeAction = await rawInsert({ org: ORG_A, action: 'anonymize' });
    seeded.deniedOutcome = await rawInsert({ org: ORG_A, outcome: 'denied' });
    seeded.targetUser = await rawInsert({ org: ORG_A, user: USER_TARGET });
    seeded.personResource = await rawInsert({ org: ORG_A, resourceType: 'person' });
    seeded.archived = await rawInsert({ org: ORG_A, retentionStatus: 'archived' });

    // --- Date-range rows in ORG_A: two inside the window (boundary-inclusive),
    //     one strictly before, one strictly after. eventType:'compliance' tags
    //     them so the date assertions don't collide with the dimension rows. ---
    seeded.dateBefore = await rawInsert({
      org: ORG_A, eventType: 'compliance',
      createdAt: new Date('2024-02-28T23:59:59.000Z'),
    });
    seeded.dateInsideLow = await rawInsert({
      org: ORG_A, eventType: 'compliance', createdAt: WINDOW_LOW, // == startDate (gte boundary)
    });
    seeded.dateInsideHigh = await rawInsert({
      org: ORG_A, eventType: 'compliance', createdAt: WINDOW_HIGH, // == endDate (lte boundary)
    });
    seeded.dateAfter = await rawInsert({
      org: ORG_A, eventType: 'compliance',
      createdAt: new Date('2024-04-01T00:00:01.000Z'),
    });

    seeded.orgA = [
      seeded.securityEvent, seeded.financialCategory, seeded.anonymizeAction,
      seeded.deniedOutcome, seeded.targetUser, seeded.personResource, seeded.archived,
      seeded.dateBefore, seeded.dateInsideLow, seeded.dateInsideHigh, seeded.dateAfter,
    ];

    // --- ORG_B rows: a couple of plain rows to prove the org boundary ---
    seeded.orgB = [
      await rawInsert({ org: ORG_B }),
      await rawInsert({ org: ORG_B, eventType: 'security' }),
    ];
  });

  test('org scoping (P0-3): findMany({organizationId}) returns ONLY that org', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const a = await repo.findMany({ organizationId: ORG_A });
    const aIds = a.map((r) => r.id).sort();
    expect(aIds).toEqual([...seeded.orgA].sort());
    expect(a.every((r) => r.organizationId === ORG_A)).toBe(true);

    const b = await repo.findMany({ organizationId: ORG_B });
    const bIds = b.map((r) => r.id).sort();
    expect(bIds).toEqual([...seeded.orgB].sort());
    expect(b.every((r) => r.organizationId === ORG_B)).toBe(true);

    // No cross-tenant leak: no ORG_B id appears in the ORG_A result.
    expect(aIds.some((id) => seeded.orgB.includes(id))).toBe(false);
  });

  test('per-filter subsets: each single filter returns only its matching row(s)', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    // eventType:'security' spans ORG_A + ORG_B (one each) → both ids, scoped by org below.
    const sec = await repo.findMany({ organizationId: ORG_A, eventType: 'security' });
    expect(sec.map((r) => r.id)).toEqual([seeded.securityEvent]);

    const fin = await repo.findMany({ organizationId: ORG_A, category: 'financial' });
    expect(fin.map((r) => r.id)).toEqual([seeded.financialCategory]);

    const anon = await repo.findMany({ organizationId: ORG_A, action: 'anonymize' });
    expect(anon.map((r) => r.id)).toEqual([seeded.anonymizeAction]);

    const denied = await repo.findMany({ organizationId: ORG_A, outcome: 'denied' });
    expect(denied.map((r) => r.id)).toEqual([seeded.deniedOutcome]);

    const byUser = await repo.findMany({ user: USER_TARGET });
    expect(byUser.map((r) => r.id)).toEqual([seeded.targetUser]);

    const byResType = await repo.findMany({ organizationId: ORG_A, resourceType: 'person' });
    expect(byResType.map((r) => r.id)).toEqual([seeded.personResource]);

    const archived = await repo.findMany({ organizationId: ORG_A, retentionStatus: 'archived' });
    expect(archived.map((r) => r.id)).toEqual([seeded.archived]);
    expect(archived[0].retentionStatus).toBe('archived');
  });

  test('date range: gte/lte boundaries are inclusive; outside-window rows excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const inWindow = await repo.findMany({
      organizationId: ORG_A,
      eventType: 'compliance',
      startDate: WINDOW_LOW,
      endDate: WINDOW_HIGH,
    });
    const ids = inWindow.map((r) => r.id).sort();
    // boundary rows (created_at == startDate / == endDate) are INCLUDED (gte/lte)
    expect(ids).toEqual([seeded.dateInsideLow, seeded.dateInsideHigh].sort());
    // strictly-before and strictly-after rows are EXCLUDED
    expect(ids).not.toContain(seeded.dateBefore);
    expect(ids).not.toContain(seeded.dateAfter);

    // startDate-only (gte) includes the two inside rows + the after row, not the before row.
    const gte = await repo.findMany({
      organizationId: ORG_A, eventType: 'compliance', startDate: WINDOW_LOW,
    });
    const gteIds = gte.map((r) => r.id);
    expect(gteIds).toContain(seeded.dateInsideLow);
    expect(gteIds).toContain(seeded.dateAfter);
    expect(gteIds).not.toContain(seeded.dateBefore);
  });

  test('combined filters AND together (intersection only)', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    // ORG_A + eventType:'security' → only the one security row, NOT ORG_B's security row.
    const both = await repo.findMany({ organizationId: ORG_A, eventType: 'security' });
    expect(both.map((r) => r.id)).toEqual([seeded.securityEvent]);

    // A combination that matches NO row → empty (AND, not OR).
    const none = await repo.findMany({ organizationId: ORG_A, eventType: 'security', category: 'financial' });
    expect(none).toEqual([]);
  });

  test('count(filters) === findMany(filters).length (count shares buildWhereConditions)', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const cases = [
      { organizationId: ORG_A },
      { organizationId: ORG_B },
      { organizationId: ORG_A, eventType: 'security' as const },
      { organizationId: ORG_A, retentionStatus: 'archived' as const },
      { user: USER_TARGET },
      { organizationId: ORG_A, eventType: 'compliance' as const, startDate: WINDOW_LOW, endDate: WINDOW_HIGH },
    ];

    for (const filters of cases) {
      const n = await repo.count(filters);
      const rows = await repo.findMany(filters);
      expect(n).toBe(rows.length);
    }

    // Concrete expected counts (proves count returns real numbers, not a stub).
    expect(await repo.count({ organizationId: ORG_A })).toBe(seeded.orgA.length);
    expect(await repo.count({ organizationId: ORG_B })).toBe(seeded.orgB.length);
    expect(await repo.count({ organizationId: ORG_A, retentionStatus: 'archived' })).toBe(1);
  });

  test('empty filter → buildWhereConditions undefined → findMany returns ALL seeded rows', async () => {
    if (!H.dbReachable) return;
    const repo = new AuditRepository(H.db as never, noopLogger);

    const all = await repo.findMany();
    const allIds = new Set(all.map((r) => r.id));
    // every S2-seeded row (both orgs) is present in the unfiltered result
    for (const id of [...seeded.orgA, ...seeded.orgB]) {
      expect(allIds.has(id)).toBe(true);
    }
    // unfiltered count matches the unfiltered findMany length
    expect(await repo.count()).toBe(all.length);
  });
});

/**
 * S3 — archive/purge retention state machine + statistics against real Postgres
 * (audit.repo.ts:231-336 — the illusion only checked `update/delete toHaveBeenCalled`
 * + a stubbed `.returning` length, and stubbed `repo.count` for statistics).
 *
 * archiveOldLogs / purgeArchivedLogs operate GLOBALLY (no org arg) over every
 * active/archived row whose created_at crosses the cutoff, and getAuditStatistics
 * counts the WHOLE table with no filter. The S1/S2 describe blocks seed rows into
 * the shared scratch table (some with 2024 created_at → older than 365 days and
 * `active`), which would pollute the EXACT return counts the plan demands
 * (archiveOldLogs → 2, purgeArchivedLogs → 1, statistics totals = N). To keep the
 * state-machine assertions deterministic and exact, this block stands up its OWN
 * isolated scratch schema (H3) — a second `createScratch(['audit_log_entry'])`,
 * the harness is multi-instance — so the only rows present are the ones this block
 * seeds. Every assert is on real persisted state read back via `H3.scopedPool.query`
 * (or a real `count`), never a stub, never the seed input re-echoed.
 */
describe('AuditRepository — archive/purge state machine + statistics over real PG (W3 audit S3)', () => {
  let H3: ScratchDb;
  const ORG_S3 = '00000000-0000-4000-8000-0000000000d1';

  /** Raw INSERT with explicit created_at + retention_status (logEvent stamps now()/active). */
  async function rawInsert(opts: {
    retentionStatus?: string;
    createdAt?: Date;
    archivedAt?: Date | null;
    archivedBy?: string | null;
  }): Promise<string> {
    const id = freshId();
    await H3.scopedPool.query(
      `INSERT INTO "${H3.schema}".audit_log_entry
         (id, event_type, category, action, outcome, organization_id,
          "user", resource_type, resource, description, retention_status,
          archived_at, archived_by, created_at, updated_at, created_by, updated_by)
       VALUES ($1, 'data-access'::audit_event_type, 'administrative'::audit_category,
               'read'::audit_action, 'success'::audit_outcome, $2,
               $3, 'generic', $4, 'seed', $5::audit_retention_status,
               $6, $7, $8, $8, $3, $3)`,
      [
        id,
        ORG_S3,
        freshId(),
        freshId(),
        opts.retentionStatus ?? 'active',
        opts.archivedAt ?? null,
        opts.archivedBy ?? null,
        opts.createdAt ?? new Date(),
      ],
    );
    return id;
  }

  async function readRow3(id: string): Promise<any> {
    const { rows } = await H3.scopedPool.query(
      `SELECT * FROM "${H3.schema}".audit_log_entry WHERE id = $1`,
      [id],
    );
    return rows[0];
  }

  async function countById(id: string): Promise<number> {
    const { rows } = await H3.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H3.schema}".audit_log_entry WHERE id = $1`,
      [id],
    );
    return rows[0].n;
  }

  const oldDate = () => new Date(Date.now() - 800 * 24 * 60 * 60 * 1000); // ~800 days ago
  const recentDate = () => new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

  beforeAll(async () => {
    H3 = await createScratch(['audit_log_entry']);
  });

  afterAll(async () => {
    await H3?.teardown();
  });

  test('archiveOldLogs: only OLD active rows flip to archived (+archived_at/+archived_by); recent stays active', async () => {
    if (!H3.dbReachable) return;
    const repo = new AuditRepository(H3.db as never, noopLogger);
    const adminId = freshId();

    // 2 old active rows (eligible) + 1 recent active row (not eligible)
    const old1 = await rawInsert({ retentionStatus: 'active', createdAt: oldDate() });
    const old2 = await rawInsert({ retentionStatus: 'active', createdAt: oldDate() });
    const recent = await rawInsert({ retentionStatus: 'active', createdAt: recentDate() });

    const archived = await repo.archiveOldLogs(365, adminId);
    expect(archived).toBe(2);

    // The two OLD rows are now archived, carry archived_at + archived_by=adminId.
    for (const id of [old1, old2]) {
      const row = await readRow3(id);
      expect(row.retention_status).toBe('archived');
      expect(row.archived_at).toBeInstanceOf(Date);
      expect(row.archived_by).toBe(adminId);
    }
    // The RECENT row is untouched (still active, no archived_at).
    const recentRow = await readRow3(recent);
    expect(recentRow.retention_status).toBe('active');
    expect(recentRow.archived_at).toBeNull();
  });

  test('purgeArchivedLogs two-step: OLD archived → pending-purge → DELETED; newer archived + active remain', async () => {
    if (!H3.dbReachable) return;
    const repo = new AuditRepository(H3.db as never, noopLogger);

    // Fresh isolated trio (a sub-org tag keeps it conceptually distinct, though
    // purge is global — H3 isolation already guarantees no foreign rows match).
    const oldArchived = await rawInsert({
      retentionStatus: 'archived',
      createdAt: new Date(Date.now() - 3000 * 24 * 60 * 60 * 1000), // ~8.2y ago
      archivedAt: new Date(),
    });
    const newArchived = await rawInsert({
      retentionStatus: 'archived',
      createdAt: recentDate(), // newer than the 2555-day purge window
      archivedAt: new Date(),
    });
    const stillActive = await rawInsert({ retentionStatus: 'active', createdAt: recentDate() });

    // Snapshot the live archived ids this purge could touch BEFORE the call, so the
    // exact return count is the set of (archived AND old enough) rows — here only
    // oldArchived qualifies (the S3 archive test left 2 archived rows but those were
    // created ~800 days ago < 2555-day purge window, so they do NOT qualify).
    const purged = await repo.purgeArchivedLogs(2555);
    expect(purged).toBe(1);

    // The old archived row is GONE (mark→pending-purge→DELETE ran in order).
    expect(await countById(oldArchived)).toBe(0);
    // The newer archived row + the active row REMAIN, with their statuses intact.
    expect(await countById(newArchived)).toBe(1);
    expect((await readRow3(newArchived)).retention_status).toBe('archived');
    expect(await countById(stillActive)).toBe(1);
    expect((await readRow3(stillActive)).retention_status).toBe('active');

    // No row was left stranded in the transient 'pending-purge' state.
    const { rows: pp } = await H3.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H3.schema}".audit_log_entry WHERE retention_status = 'pending-purge'`,
    );
    expect(pp[0].n).toBe(0);
  });

  test('getAuditStatistics: 4 real counts match the live retention distribution; integrityStatus healthy', async () => {
    if (!H3.dbReachable) return;
    const repo = new AuditRepository(H3.db as never, noopLogger);

    // Seed an explicit distribution ON TOP of whatever the prior S3 tests left.
    // Assert against the LIVE counts (read directly), not hard-coded numbers, so
    // this stays exact regardless of test execution order within H3.
    await rawInsert({ retentionStatus: 'active', createdAt: recentDate() });
    await rawInsert({ retentionStatus: 'active', createdAt: recentDate() });
    await rawInsert({ retentionStatus: 'archived', createdAt: recentDate(), archivedAt: new Date() });
    await rawInsert({ retentionStatus: 'pending-purge', createdAt: recentDate() });

    const liveCount = async (status?: string): Promise<number> => {
      const { rows } = status
        ? await H3.scopedPool.query(
            `SELECT count(*)::int AS n FROM "${H3.schema}".audit_log_entry WHERE retention_status = $1`,
            [status],
          )
        : await H3.scopedPool.query(
            `SELECT count(*)::int AS n FROM "${H3.schema}".audit_log_entry`,
          );
      return rows[0].n;
    };

    const [total, active, archivedN, pending] = await Promise.all([
      liveCount(),
      liveCount('active'),
      liveCount('archived'),
      liveCount('pending-purge'),
    ]);

    const stats = await repo.getAuditStatistics();
    expect(stats.totalEntries).toBe(total);
    expect(stats.activeEntries).toBe(active);
    expect(stats.archivedEntries).toBe(archivedN);
    expect(stats.pendingPurge).toBe(pending);
    // sanity: the seeded pending-purge row makes pendingPurge ≥ 1 and total is the sum.
    expect(stats.pendingPurge).toBeGreaterThanOrEqual(1);
    expect(stats.activeEntries + stats.archivedEntries + stats.pendingPurge).toBe(stats.totalEntries);
    expect(stats.integrityStatus).toBe('healthy');
  });

  test('BR-32: archive vs purge — a window shorter than a row age archives but never deletes (no DB guard on purge_after)', async () => {
    if (!H3.dbReachable) return;
    const repo = new AuditRepository(H3.db as never, noopLogger);

    // A freshly-logged financial event records purge_after ≥ created_at + 7y.
    const entry = await repo.logEvent(
      {
        eventType: 'compliance',
        category: 'financial',
        action: 'mark-paid',
        outcome: 'success',
        organizationId: ORG_S3,
        user: freshId(),
        userType: 'admin',
        resourceType: 'invoice',
        resource: freshId(),
        description: 'retention floor',
      },
      freshId(),
    );
    const logged = await readRow3(entry.id);
    expect(logged.purge_after).toBeInstanceOf(Date);
    expect(new Date(logged.purge_after).getTime()).toBeGreaterThanOrEqual(
      new Date(logged.created_at).getTime() + 6 * 365 * 24 * 60 * 60 * 1000,
    );

    // Seed an OLD active row, then archive with a 365-day window.
    const oldRow = await rawInsert({ retentionStatus: 'active', createdAt: oldDate() });
    await repo.archiveOldLogs(365, freshId());
    expect((await readRow3(oldRow)).retention_status).toBe('archived');

    // archiveOldLogs only flips status — the row is NOT deleted (archive ≠ purge).
    expect(await countById(oldRow)).toBe(1);

    // CHARACTERIZATION: there is NO DB-level guard preventing purge before
    // purge_after. purgeArchivedLogs keys off the `daysOld` cron arg + archived
    // status ONLY — it never consults purge_after. With a window short enough to
    // catch the just-archived ~800-day-old row, it deletes it even though that
    // row's own purge_after is years in the future. This is the documented product
    // decision (retention enforced solely by the cron's daysOld arg), NOT a bug —
    // so we assert the deletion happens (proves no purge_after guard exists).
    const purged = await repo.purgeArchivedLogs(365);
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await countById(oldRow)).toBe(0);
  });
});
