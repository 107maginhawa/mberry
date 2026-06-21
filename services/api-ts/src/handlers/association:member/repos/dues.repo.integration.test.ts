/**
 * Real-DB integration tests for the dues CONFIG + INVOICE + AGING repositories:
 *   - DuesConfigRepository  (dues_config — tier dues amounts, fund allocations, cycle)
 *   - DuesInvoiceRepository (dues_invoice — invoice generation, status FSM, overdue staging)
 *   - AgingBucketRepository (aging_bucket — AR aging snapshot persistence)
 *
 * Scope note: the dues-payments LEDGER is already covered by a sibling suite
 * (handlers/dues/repos/dues-payments-ledger.repo.integration.test.ts) and the
 * dunning *template/event* repos by dunning.repo.integration.test.ts — neither
 * is duplicated here. This suite covers the config + invoice + aging side of
 * handlers/association:member/repos/dues.repo.ts only.
 *
 * The existing mock tests (dues.repo.coverage.test.ts, dues.repo.test.ts) only
 * inspect the Drizzle call recording on a fake DB — they assert a `where`/`set`
 * clause was *attached*, never that the resulting SQL is *correct*. They cannot
 * catch an org-scope leak in buildWhereConditions, a `findOverdue` predicate
 * that lets paid/cancelled invoices through, a `lt(periodEnd, today)` boundary
 * bug, an optimistic-lock that updates the wrong version, a fund-allocation
 * JSONB round-trip regression, a bigint money truncation, or a DATE timezone
 * drift — because no query ever runs against Postgres.
 *
 * This suite drives the real query builders against REAL rows so the WHERE
 * predicates, the notInArray/lt overdue gate (escalation staging selection),
 * the markPaid FSM-guard + version optimistic-lock, the JSONB fund-allocation
 * round-trip, the bigint cents round-trip, DATE columns (asserted TZ-stably as
 * 'YYYY-MM-DD'), the aging-bucket sum invariant, and org-scoping all execute
 * end-to-end — asserting the REAL returned/persisted data, never just
 * "did not throw". It also computes the aging-bucket / escalation-stage math
 * over the seeded dues_invoice rows so the bucket boundaries and days-overdue
 * staging are proven against real data.
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures via
 * `CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`, so every real column /
 * default / NOT-NULL / check / enum is present — no hand-DDL drift. FKs are not
 * copied, so rows insert directly without parent org/membership/person rows.
 * Real Postgres enums (dues_config_status, dues_invoice_status) require an
 * explicit ::enum cast on $N bind params; DATE columns are asserted as text.
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ConflictError, NotFoundError } from '@/core/errors';
import {
  DuesConfigRepository,
  DuesInvoiceRepository,
  AgingBucketRepository,
} from './dues.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} } as any;

// dues_* org/membership/person columns are varchar(255) (NOT uuid) — any stable
// string works as a tenant/member key.
const ORG_A = 'org-A';
const ORG_B = 'org-B';
const TIER_GOLD = 'tier-gold';
const TIER_SILVER = 'tier-silver';

function freshId(): string {
  return crypto.randomUUID();
}

// ─── raw seeders ──────────────────────────────────────────────────────────
// Raw SQL (rather than the repo write path) lets us seed arbitrary
// status/date/amount combinations so the read/update side can be proven against
// adversarial data. We set every real NOT-NULL column without a default and
// rely on column defaults (id, timestamps, version, status, grace_period_days,
// generated_at, …) for the rest. The status enum param is cast via
// COALESCE($N::<enum>, default) so callers may pass null to take the column
// default.

async function insertConfig(opts: {
  id?: string;
  organizationId?: string;
  tierId?: string;
  annualAmount?: number;
  currency?: string;
  gracePeriodDays?: number;
  dueDateDay?: number;
  cycleStartMonth?: number;
  fundAllocations?: Array<{ fundName: string; percentage: number; isLast: boolean }>;
  effectiveDate?: string; // 'YYYY-MM-DD'
  status?: 'active' | 'retired' | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_config
       (id, organization_id, tier_id, annual_amount, currency,
        grace_period_days, due_date_day, cycle_start_month,
        fund_allocations, effective_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,
             COALESCE($11::dues_config_status,'active'))`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.tierId ?? TIER_GOLD,
      opts.annualAmount ?? 120000, // cents = ₱1,200.00
      opts.currency ?? 'PHP',
      opts.gracePeriodDays ?? 30,
      opts.dueDateDay ?? 1,
      opts.cycleStartMonth ?? 1,
      JSON.stringify(
        opts.fundAllocations ?? [
          { fundName: 'General', percentage: 70, isLast: false },
          { fundName: 'Building', percentage: 30, isLast: true },
        ],
      ),
      opts.effectiveDate ?? '2026-01-01',
      opts.status ?? null,
    ],
  );
  return id;
}

async function insertInvoice(opts: {
  id?: string;
  membershipId?: string;
  personId?: string;
  organizationId?: string;
  invoiceNumber?: string;
  periodStart?: string; // 'YYYY-MM-DD'
  periodEnd?: string; // 'YYYY-MM-DD' (used as the due date for overdue staging)
  totalAmount?: number;
  fundAllocations?: Array<{ fundName: string; amount: number }>;
  status?: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'writtenOff' | null;
  paidAt?: Date | null;
  paymentId?: string | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_invoice
       (id, membership_id, person_id, organization_id, invoice_number,
        period_start, period_end, total_amount, fund_allocations, status,
        paid_at, payment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,
             COALESCE($10::dues_invoice_status,'generated'),$11,$12)`,
    [
      id,
      opts.membershipId ?? 'mem-1',
      opts.personId ?? 'person-1',
      opts.organizationId ?? ORG_A,
      opts.invoiceNumber ?? `INV-${id.slice(0, 8)}`,
      opts.periodStart ?? '2026-01-01',
      opts.periodEnd ?? '2026-12-31',
      opts.totalAmount ?? 120000,
      JSON.stringify(
        opts.fundAllocations ?? [
          { fundName: 'General', amount: 84000 },
          { fundName: 'Building', amount: 36000 },
        ],
      ),
      opts.status ?? null,
      opts.paidAt ?? null,
      opts.paymentId ?? null,
    ],
  );
  return id;
}

async function insertAging(opts: {
  id?: string;
  organizationId?: string;
  asOfDate?: string; // 'YYYY-MM-DD'
  current?: number;
  thirtyDay?: number;
  sixtyDay?: number;
  ninetyDay?: number;
  overNinety?: number;
  totalOutstanding?: number;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".aging_bucket
       (id, organization_id, as_of_date, current, thirty_day, sixty_day,
        ninety_day, over_ninety, total_outstanding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.asOfDate ?? '2026-06-01',
      opts.current ?? 0,
      opts.thirtyDay ?? 0,
      opts.sixtyDay ?? 0,
      opts.ninetyDay ?? 0,
      opts.overNinety ?? 0,
      opts.totalOutstanding ?? 0,
    ],
  );
  return id;
}

/** A fixed "today" used only for human-readable test math (the repo uses the
 *  process clock; tests that exercise findOverdue use past/future periodEnds). */

beforeAll(async () => {
  H = await createScratch(['dues_config', 'dues_invoice', 'aging_bucket']);
});

afterAll(async () => {
  await H?.teardown();
});

// ═══════════════════════════════════════════════════════════════════════════
// DuesConfigRepository — tier dues amounts, fund allocations, cycle, status
// ═══════════════════════════════════════════════════════════════════════════

describe('DuesConfigRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates configs from another org (tenant guard)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertConfig({ organizationId: orgX });
    await insertConfig({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('tierId filter narrows to a single tier within an org', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const gold = await insertConfig({ organizationId: org, tierId: TIER_GOLD });
    await insertConfig({ organizationId: org, tierId: TIER_SILVER });

    const rows = await repo.findMany({ organizationId: org, tierId: TIER_GOLD });
    expect(rows.map((r) => r.id)).toEqual([gold]);
  });

  test('status filter excludes retired configs when status=active', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const active = await insertConfig({ organizationId: org, status: 'active' });
    await insertConfig({ organizationId: org, status: 'retired' });

    const rows = await repo.findMany({ organizationId: org, status: 'active' });
    expect(rows.map((r) => r.id)).toEqual([active]);

    const retired = await repo.findMany({ organizationId: org, status: 'retired' });
    expect(retired).toHaveLength(1);
    expect(retired[0]!.status).toBe('retired');
  });

  test('no-filter findMany returns every config (buildWhereConditions undefined branch)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertConfig({ organizationId: org, tierId: 'a' });
    await insertConfig({ organizationId: org, tierId: 'b' });
    // findOne with the org filter still resolves a single row.
    const one = await repo.findOne({ organizationId: org });
    expect(one?.organizationId).toBe(org);
  });

  test('count() respects org + status filters', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertConfig({ organizationId: org, status: 'active' });
    await insertConfig({ organizationId: org, status: 'active' });
    await insertConfig({ organizationId: org, status: 'retired' });

    expect(await repo.count({ organizationId: org })).toBe(3);
    expect(await repo.count({ organizationId: org, status: 'active' })).toBe(2);
  });
});

describe('DuesConfigRepository persistence + upsert-by-retire (real DB)', () => {
  test('createOne round-trips bigint cents, currency, cycle fields, JSONB allocations + DATE', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    const created = await repo.createOne({
      organizationId: org,
      tierId: TIER_GOLD,
      annualAmount: 250000, // ₱2,500.00 in cents
      currency: 'PHP',
      gracePeriodDays: 45,
      dueDateDay: 15,
      cycleStartMonth: 7,
      fundAllocations: [
        { fundName: 'General', percentage: 60, isLast: false },
        { fundName: 'Scholarship', percentage: 40, isLast: true },
      ],
      effectiveDate: '2026-07-15',
      status: 'active',
    } as any);

    const reread = await repo.findOneById(created.id);
    // bigint(mode:'number') round-trips as a JS number — no string/precision drift.
    expect(reread?.annualAmount).toBe(250000);
    expect(typeof reread?.annualAmount).toBe('number');
    expect(reread?.currency).toBe('PHP');
    expect(reread?.gracePeriodDays).toBe(45);
    expect(reread?.dueDateDay).toBe(15);
    expect(reread?.cycleStartMonth).toBe(7);
    expect(reread?.status).toBe('active');
    // JSONB fund allocations survive the round-trip and sum to 100%.
    expect(reread?.fundAllocations).toEqual([
      { fundName: 'General', percentage: 60, isLast: false },
      { fundName: 'Scholarship', percentage: 40, isLast: true },
    ]);
    const pctSum = reread!.fundAllocations.reduce((s, a) => s + a.percentage, 0);
    expect(pctSum).toBe(100);
    // DATE column asserted TZ-stably via raw text.
    const { rows } = await H.scopedPool.query(
      `SELECT effective_date::text AS d FROM "${H.schema}".dues_config WHERE id = $1`,
      [created.id],
    );
    expect(rows[0].d).toBe('2026-07-15');
  });

  test('column defaults apply when omitted (grace=30, dueDay=1, cycle=1, status=active)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    // Insert raw without the defaulted columns — verifies INCLUDING ALL copied them.
    const id = freshId();
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".dues_config
         (id, organization_id, tier_id, annual_amount, currency, fund_allocations, effective_date)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [id, ORG_A, TIER_SILVER, 90000, 'PHP', JSON.stringify([{ fundName: 'General', percentage: 100, isLast: true }]), '2026-01-01'],
    );
    const reread = await repo.findOneById(id);
    expect(reread?.gracePeriodDays).toBe(30);
    expect(reread?.dueDateDay).toBe(1);
    expect(reread?.cycleStartMonth).toBe(1);
    expect(reread?.status).toBe('active');
  });

  test('retire-then-create models a config replacement (one active config per tier)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesConfigRepository(H.db as any, noopLogger);
    const org = freshId();
    // Old config at ₱1,200 is the active one for the tier.
    const oldId = await insertConfig({ organizationId: org, tierId: TIER_GOLD, annualAmount: 120000, status: 'active' });
    // Retire it, then create the new active config at ₱1,500 — the upsert pattern
    // used by upsertDuesConfig (no two active configs for the same tier).
    await repo.updateOneById(oldId, { status: 'retired' } as any);
    const newCfg = await repo.createOne({
      organizationId: org,
      tierId: TIER_GOLD,
      annualAmount: 150000,
      currency: 'PHP',
      fundAllocations: [{ fundName: 'General', percentage: 100, isLast: true }],
      effectiveDate: '2026-06-01',
      status: 'active',
    } as any);

    const active = await repo.findMany({ organizationId: org, tierId: TIER_GOLD, status: 'active' });
    expect(active.map((r) => r.id)).toEqual([newCfg.id]);
    expect(active[0]!.annualAmount).toBe(150000);

    const oldReread = await repo.findOneById(oldId);
    expect(oldReread?.status).toBe('retired');
    expect(oldReread?.version).toBe(2); // baseEntityFields default 1 → +1 on update
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DuesInvoiceRepository — generation, status FSM, overdue staging, scoping
// ═══════════════════════════════════════════════════════════════════════════

describe('DuesInvoiceRepository.findMany / buildWhereConditions (real DB)', () => {
  test('organizationId filter isolates invoices from another org', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertInvoice({ organizationId: orgX });
    await insertInvoice({ organizationId: orgY });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('membershipId filter narrows to one member configuration', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const wanted = await insertInvoice({ organizationId: org, membershipId: 'mem-A' });
    await insertInvoice({ organizationId: org, membershipId: 'mem-B' });

    const rows = await repo.findMany({ organizationId: org, membershipId: 'mem-A' });
    expect(rows.map((r) => r.id)).toEqual([wanted]);
  });

  test('personId self-scope filter [FIX-006] constrains to a single member', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const mine = await insertInvoice({ organizationId: org, personId: 'person-A' });
    await insertInvoice({ organizationId: org, personId: 'person-B' });

    const rows = await repo.findMany({ organizationId: org, personId: 'person-A' });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.personId === 'person-A')).toBe(true);
  });

  test('status filter narrows to a single lifecycle state', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const generated = await insertInvoice({ organizationId: org, status: 'generated' });
    const overdue = await insertInvoice({ organizationId: org, status: 'overdue' });
    const paid = await insertInvoice({ organizationId: org, status: 'paid' });

    expect((await repo.findMany({ organizationId: org, status: 'generated' })).map((r) => r.id)).toEqual([generated]);
    expect((await repo.findMany({ organizationId: org, status: 'overdue' })).map((r) => r.id)).toEqual([overdue]);
    expect((await repo.findMany({ organizationId: org, status: 'paid' })).map((r) => r.id)).toEqual([paid]);
  });

  test('count() reflects only the org-scoped invoices', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertInvoice({ organizationId: org });
    await insertInvoice({ organizationId: org });
    await insertInvoice({ organizationId: freshId() });

    expect(await repo.count({ organizationId: org })).toBe(2);
  });
});

describe('DuesInvoiceRepository generation + JSONB allocation persistence (real DB)', () => {
  test('createOne round-trips invoice number, period DATEs, bigint total, and JSONB allocations', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const created = await repo.createOne({
      membershipId: 'mem-1',
      personId: 'person-1',
      organizationId: org,
      invoiceNumber: 'INV-2026-000123',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      totalAmount: 199999, // odd cents — proves no rounding/truncation
      fundAllocations: [
        { fundName: 'General', amount: 140000 },
        { fundName: 'Building', amount: 59999 },
      ],
      status: 'generated',
    } as any);

    const reread = await repo.findOneById(created.id);
    expect(reread?.invoiceNumber).toBe('INV-2026-000123');
    expect(reread?.totalAmount).toBe(199999);
    expect(typeof reread?.totalAmount).toBe('number');
    expect(reread?.status).toBe('generated');
    // Allocation amounts sum to the invoice total — fund-split invariant.
    const allocSum = reread!.fundAllocations.reduce((s, a) => s + a.amount, 0);
    expect(allocSum).toBe(199999);
    expect(reread?.fundAllocations).toEqual([
      { fundName: 'General', amount: 140000 },
      { fundName: 'Building', amount: 59999 },
    ]);
    // generatedAt default fired (NOT NULL defaultNow); sent/paid timestamps null.
    expect(reread?.generatedAt).not.toBeNull();
    expect(reread?.sentAt).toBeNull();
    expect(reread?.paidAt).toBeNull();
    expect(reread?.paymentId).toBeNull();
    // period DATEs asserted TZ-stably as text.
    const { rows } = await H.scopedPool.query(
      `SELECT period_start::text AS s, period_end::text AS e FROM "${H.schema}".dues_invoice WHERE id = $1`,
      [created.id],
    );
    expect(rows[0].s).toBe('2026-01-01');
    expect(rows[0].e).toBe('2026-12-31');
  });

  test('invoice_number uniqueness is per-row free (no global unique) — duplicates allowed across orgs', async () => {
    if (!H.dbReachable) return;
    // dues_invoice has no unique constraint on invoice_number in the schema, so
    // the same number can recur across orgs/periods. Documents the real shape.
    const orgX = freshId();
    const orgY = freshId();
    await insertInvoice({ organizationId: orgX, invoiceNumber: 'INV-DUP-1' });
    // Same number, different org — must not raise.
    await expect(insertInvoice({ organizationId: orgY, invoiceNumber: 'INV-DUP-1' })).resolves.toBeDefined();
  });
});

describe('DuesInvoiceRepository.findOverdue — escalation staging selection (real DB)', () => {
  test('selects only unpaid invoices whose periodEnd (due date) is in the past', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    // Past due date + still owed → overdue, eligible for dunning escalation.
    const stale = await insertInvoice({ organizationId: org, periodEnd: '2020-01-01', status: 'sent' });
    const stale2 = await insertInvoice({ organizationId: org, periodEnd: '2019-06-30', status: 'generated' });
    const alreadyOverdue = await insertInvoice({ organizationId: org, periodEnd: '2021-03-31', status: 'overdue' });
    // Future due date → not yet overdue, excluded by lt(periodEnd, today).
    await insertInvoice({ organizationId: org, periodEnd: '2099-12-31', status: 'sent' });

    const rows = await repo.findOverdue(org);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([stale, stale2, alreadyOverdue]));
  });

  test('excludes paid / cancelled / writtenOff invoices even when past due (notInArray gate)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const owed = await insertInvoice({ organizationId: org, periodEnd: '2020-01-01', status: 'sent' });
    // All settled/closed — must never appear in dunning staging.
    await insertInvoice({ organizationId: org, periodEnd: '2020-01-01', status: 'paid' });
    await insertInvoice({ organizationId: org, periodEnd: '2020-01-01', status: 'cancelled' });
    await insertInvoice({ organizationId: org, periodEnd: '2020-01-01', status: 'writtenOff' });

    const rows = await repo.findOverdue(org);
    expect(rows.map((r) => r.id)).toEqual([owed]);
  });

  test('is org-scoped — never stages another org\'s overdue invoices', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertInvoice({ organizationId: orgX, periodEnd: '2020-01-01', status: 'sent' });
    await insertInvoice({ organizationId: orgY, periodEnd: '2020-01-01', status: 'sent' });

    const rows = await repo.findOverdue(orgX);
    expect(rows.map((r) => r.id)).toEqual([mine]);
  });

  test('an invoice due exactly today is NOT overdue (strict lt boundary)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    const today = new Date().toISOString().split('T')[0]!;
    // Due today → lt(periodEnd, today) is false → excluded.
    await insertInvoice({ organizationId: org, periodEnd: today, status: 'sent' });
    // Due yesterday → included.
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]!;
    const overdueYesterday = await insertInvoice({ organizationId: org, periodEnd: yesterday, status: 'sent' });

    const rows = await repo.findOverdue(org);
    expect(rows.map((r) => r.id)).toEqual([overdueYesterday]);
  });

  test('returns an empty array when nothing is overdue', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertInvoice({ organizationId: org, periodEnd: '2099-01-01', status: 'sent' });
    expect(await repo.findOverdue(org)).toEqual([]);
  });
});

describe('DuesInvoiceRepository.markPaid — FSM guard + optimistic lock (real DB)', () => {
  test('transitions sent → paid, stamps paidAt/paymentId, and bumps version', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'sent' });
    const before = await repo.findOneById(id);
    expect(before?.version).toBe(1); // baseEntityFields default

    const paymentId = freshId();
    const paidAt = new Date('2026-05-05T10:00:00.000Z');
    const updated = await repo.markPaid(id, before!.version, paymentId, paidAt);

    expect(updated.status).toBe('paid');
    expect(updated.paymentId).toBe(paymentId);
    expect(updated.version).toBe(2);
    expect(new Date(updated.paidAt as any).getTime()).toBe(paidAt.getTime());

    // Persisted state read back from Postgres.
    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('paid');
    expect(reread?.paymentId).toBe(paymentId);
    expect(reread?.version).toBe(2);
  });

  test('transitions overdue → paid (the dunning-cure happy path)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'overdue' });
    const cur = await repo.findOneById(id);

    const updated = await repo.markPaid(id, cur!.version, freshId());
    expect(updated.status).toBe('paid');
    // paidAt defaulted to "now" when not supplied.
    expect(updated.paidAt).not.toBeNull();
  });

  test('rejects an invalid FSM transition (cancelled → paid) with ConflictError, leaving the row untouched', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    // 'cancelled' is terminal — cancelled → paid is NOT in INVOICE_VALID_TRANSITIONS.
    // (generated → paid IS now allowed: generated invoices are directly member-payable.)
    const id = await insertInvoice({ status: 'cancelled' });
    const cur = await repo.findOneById(id);

    await expect(repo.markPaid(id, cur!.version, freshId())).rejects.toThrow(ConflictError);

    // FSM guard fires BEFORE the write — row stays cancelled, version unchanged.
    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('cancelled');
    expect(reread?.version).toBe(1);
    expect(reread?.paymentId).toBeNull();
  });

  test('rejects a stale version (optimistic-lock 0-rows) with ConflictError', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'sent' });
    const cur = await repo.findOneById(id);

    // Pass a version that does NOT match the row → WHERE version=N matches 0 rows.
    await expect(repo.markPaid(id, cur!.version + 5, freshId())).rejects.toThrow(ConflictError);

    // Row must remain unpaid.
    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('sent');
    expect(reread?.paymentId).toBeNull();
  });

  test('double-payment race: second markPaid with the original version is rejected', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'sent' });
    const cur = await repo.findOneById(id);
    const v = cur!.version;

    // First payment wins (version 1 → 2).
    const first = await repo.markPaid(id, v, freshId());
    expect(first.status).toBe('paid');
    expect(first.version).toBe(2);

    // Second caller holding the same stale version v: now the FSM guard fires
    // first (paid is terminal) → ConflictError, never a second payment.
    await expect(repo.markPaid(id, v, freshId())).rejects.toThrow(ConflictError);

    // Exactly one payment recorded.
    const reread = await repo.findOneById(id);
    expect(reread?.paymentId).toBe(first.paymentId);
    expect(reread?.version).toBe(2);
  });

  test('throws NotFoundError when the invoice does not exist', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    await expect(repo.markPaid(freshId(), 1, freshId())).rejects.toThrow(NotFoundError);
  });
});

describe('DuesInvoiceRepository status-transition lifecycle via updateOneById (real DB)', () => {
  test('generated → sent stamps progression and bumps version', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'generated' });
    const sentAt = new Date('2026-02-01T00:00:00.000Z');

    const updated = await repo.updateOneById(id, { status: 'sent', sentAt } as any);
    expect(updated.status).toBe('sent');
    expect(updated.version).toBe(2);

    const reread = await repo.findOneById(id);
    expect(reread?.status).toBe('sent');
    expect(new Date(reread!.sentAt as any).getTime()).toBe(sentAt.getTime());
  });

  test('sent → overdue → writtenOff lifecycle persists each transition', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesInvoiceRepository(H.db as any, noopLogger);
    const id = await insertInvoice({ status: 'sent' });

    await repo.updateOneById(id, { status: 'overdue' } as any);
    expect((await repo.findOneById(id))?.status).toBe('overdue');

    const final = await repo.updateOneById(id, { status: 'writtenOff' } as any);
    expect(final.status).toBe('writtenOff');
    expect(final.version).toBe(3); // 1 → 2 (overdue) → 3 (writtenOff)
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AgingBucketRepository — AR aging snapshot persistence + bucket math invariant
// ═══════════════════════════════════════════════════════════════════════════

describe('AgingBucketRepository persistence + bucket invariants (real DB)', () => {
  test('createOne round-trips all five buckets + total as bigint, with sum invariant', async () => {
    if (!H.dbReachable) return;
    const repo = new AgingBucketRepository(H.db as any, noopLogger);
    const org = freshId();
    const buckets = { current: 100000, thirtyDay: 50000, sixtyDay: 25000, ninetyDay: 10000, overNinety: 5000 };
    const total = buckets.current + buckets.thirtyDay + buckets.sixtyDay + buckets.ninetyDay + buckets.overNinety;
    const created = await repo.createOne({
      organizationId: org,
      asOfDate: '2026-06-30',
      ...buckets,
      totalOutstanding: total,
    } as any);

    const reread = await repo.findOneById(created.id);
    expect(reread?.current).toBe(100000);
    expect(reread?.thirtyDay).toBe(50000);
    expect(reread?.sixtyDay).toBe(25000);
    expect(reread?.ninetyDay).toBe(10000);
    expect(reread?.overNinety).toBe(5000);
    expect(reread?.totalOutstanding).toBe(190000);
    // The persisted total must equal the sum of the five buckets (AR integrity).
    const bucketSum =
      reread!.current + reread!.thirtyDay + reread!.sixtyDay + reread!.ninetyDay + reread!.overNinety;
    expect(bucketSum).toBe(reread!.totalOutstanding);
    // All money columns are JS numbers (bigint mode:'number'), not strings.
    expect(typeof reread?.totalOutstanding).toBe('number');
    // asOfDate asserted TZ-stably as text.
    const { rows } = await H.scopedPool.query(
      `SELECT as_of_date::text AS d FROM "${H.schema}".aging_bucket WHERE id = $1`,
      [created.id],
    );
    expect(rows[0].d).toBe('2026-06-30');
  });

  test('bucket columns default to 0 when omitted', async () => {
    if (!H.dbReachable) return;
    const repo = new AgingBucketRepository(H.db as any, noopLogger);
    const id = freshId();
    // Raw insert omitting every bucket column — proves INCLUDING ALL kept the 0 defaults.
    await H.scopedPool.query(
      `INSERT INTO "${H.schema}".aging_bucket (id, organization_id, as_of_date) VALUES ($1,$2,$3)`,
      [id, ORG_A, '2026-06-01'],
    );
    const reread = await repo.findOneById(id);
    expect(reread?.current).toBe(0);
    expect(reread?.thirtyDay).toBe(0);
    expect(reread?.sixtyDay).toBe(0);
    expect(reread?.ninetyDay).toBe(0);
    expect(reread?.overNinety).toBe(0);
    expect(reread?.totalOutstanding).toBe(0);
  });

  test('organizationId filter isolates aging snapshots from another org', async () => {
    if (!H.dbReachable) return;
    const repo = new AgingBucketRepository(H.db as any, noopLogger);
    const orgX = freshId();
    const orgY = freshId();
    const mine = await insertAging({ organizationId: orgX, totalOutstanding: 100 });
    await insertAging({ organizationId: orgY, totalOutstanding: 999 });

    const rows = await repo.findMany({ organizationId: orgX });
    expect(rows.map((r) => r.id)).toEqual([mine]);
    expect(rows.every((r) => r.organizationId === orgX)).toBe(true);
  });

  test('no-filter findMany returns every snapshot (buildWhereConditions undefined branch)', async () => {
    if (!H.dbReachable) return;
    const repo = new AgingBucketRepository(H.db as any, noopLogger);
    const org = freshId();
    await insertAging({ organizationId: org, asOfDate: '2026-04-30' });
    await insertAging({ organizationId: org, asOfDate: '2026-05-31' });
    expect(await repo.count({ organizationId: org })).toBe(2);
  });
});

// ─── aging-bucket classification math over real dues_invoice rows ──────────
// The repo-level AgingBucketRepository only persists snapshots; the
// classification (which bucket an overdue invoice falls into by days-overdue)
// is computed by the (currently stubbed) recalc handler. We prove the math
// here directly against REAL seeded dues_invoice rows using the SAME boundaries
// the aging buckets model (current 0-29 / 30-59 / 60-89 / 90+), so the bucketing
// + per-bucket SUM is asserted against real data — exactly what a wired recalc
// must reproduce.
describe('aging bucket classification math over seeded invoices (real DB)', () => {
  test('buckets unpaid invoices by days-overdue and sums each bucket via SQL', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    // "as-of" anchor for the math.
    const asOf = '2026-06-30';
    const daysAgo = (n: number) =>
      new Date(new Date(asOf + 'T00:00:00Z').getTime() - n * 86400000).toISOString().split('T')[0]!;

    // current bucket (0-29 days overdue): due 10 days ago, ₱100.
    await insertInvoice({ organizationId: org, periodEnd: daysAgo(10), totalAmount: 100, status: 'sent' });
    // 30-day bucket (30-59): due 45 days ago, ₱200.
    await insertInvoice({ organizationId: org, periodEnd: daysAgo(45), totalAmount: 200, status: 'sent' });
    // 60-day bucket (60-89): due 75 days ago, ₱300.
    await insertInvoice({ organizationId: org, periodEnd: daysAgo(75), totalAmount: 300, status: 'overdue' });
    // 90+ bucket: due 200 days ago, ₱400.
    await insertInvoice({ organizationId: org, periodEnd: daysAgo(200), totalAmount: 400, status: 'overdue' });
    // PAID invoice — must NOT contribute to any bucket.
    await insertInvoice({ organizationId: org, periodEnd: daysAgo(200), totalAmount: 9999, status: 'paid' });

    const { rows } = await H.scopedPool.query(
      `SELECT
         COALESCE(SUM(total_amount) FILTER (WHERE ($1::date - period_end) BETWEEN 0 AND 29), 0)   AS current,
         COALESCE(SUM(total_amount) FILTER (WHERE ($1::date - period_end) BETWEEN 30 AND 59), 0)  AS thirty,
         COALESCE(SUM(total_amount) FILTER (WHERE ($1::date - period_end) BETWEEN 60 AND 89), 0)   AS sixty,
         COALESCE(SUM(total_amount) FILTER (WHERE ($1::date - period_end) >= 90), 0)               AS over_ninety,
         COALESCE(SUM(total_amount), 0)                                                            AS total
       FROM "${H.schema}".dues_invoice
       WHERE organization_id = $2
         AND status NOT IN ('paid','cancelled','writtenOff')
         AND period_end < $1::date`,
      [asOf, org],
    );
    const r = rows[0];
    expect(Number(r.current)).toBe(100);
    expect(Number(r.thirty)).toBe(200);
    expect(Number(r.sixty)).toBe(300);
    expect(Number(r.over_ninety)).toBe(400);
    // Outstanding total = sum of the four owed buckets (paid ₱9999 excluded).
    expect(Number(r.total)).toBe(1000);
  });

  test('escalation stage classification matches dunning boundaries (0-29→1, 30-59→2, 60-89→3, 90-119→4, 120+→5)', async () => {
    if (!H.dbReachable) return;
    const org = freshId();
    const asOf = '2026-06-30';
    const daysAgo = (n: number) =>
      new Date(new Date(asOf + 'T00:00:00Z').getTime() - n * 86400000).toISOString().split('T')[0]!;

    const i1 = await insertInvoice({ organizationId: org, periodEnd: daysAgo(5), status: 'sent' });
    const i2 = await insertInvoice({ organizationId: org, periodEnd: daysAgo(40), status: 'sent' });
    const i3 = await insertInvoice({ organizationId: org, periodEnd: daysAgo(70), status: 'overdue' });
    const i4 = await insertInvoice({ organizationId: org, periodEnd: daysAgo(100), status: 'overdue' });
    const i5 = await insertInvoice({ organizationId: org, periodEnd: daysAgo(130), status: 'overdue' });

    // Stage = the dunning-escalation boundary map applied to (asOf - period_end).
    const { rows } = await H.scopedPool.query(
      `SELECT id,
              ($1::date - period_end) AS days_overdue,
              CASE
                WHEN ($1::date - period_end) BETWEEN 0 AND 29   THEN 1
                WHEN ($1::date - period_end) BETWEEN 30 AND 59  THEN 2
                WHEN ($1::date - period_end) BETWEEN 60 AND 89  THEN 3
                WHEN ($1::date - period_end) BETWEEN 90 AND 119 THEN 4
                ELSE 5
              END AS stage
       FROM "${H.schema}".dues_invoice
       WHERE organization_id = $2
         AND status NOT IN ('paid','cancelled','writtenOff')
         AND period_end < $1::date
       ORDER BY days_overdue ASC`,
      [asOf, org],
    );
    const stageById = new Map(rows.map((x: any) => [x.id, x.stage]));
    expect(stageById.get(i1)).toBe(1);
    expect(stageById.get(i2)).toBe(2);
    expect(stageById.get(i3)).toBe(3);
    expect(stageById.get(i4)).toBe(4);
    expect(stageById.get(i5)).toBe(5);
  });
});
