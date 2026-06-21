/**
 * Real-PG integration tests for the dues PAYMENT-LEDGER surface of DuesRepository.
 *
 * The canonical repo lives at handlers/dues/repos/dues-payments.repo.ts (the
 * file at handlers/association:member/repos/dues-payments.repo.ts is a thin
 * re-export of it). A sibling suite — dues-repos.integration.test.ts — already
 * has REAL-PG coverage for a slice of this repo using its own hand-written DDL:
 *   getNextReceiptSequence, updatePaymentStatus (valid/invalid/terminal +
 *   reason capture), getConfig, createPayment+getPayment round-trip,
 *   listPayments (org/person/status filter + pagination), computeTrailingRates,
 *   plus the whole PaymentTokenRepository.
 *
 * This suite covers the payment-ledger / settlement methods that sibling DOES
 * NOT exercise, all against REAL Postgres rows via the SHARED pg-scratch harness
 * (CREATE TABLE … LIKE public.<t> INCLUDING ALL — every real column/default/check
 * is present, so a forgotten column can't pass against a thinner fake table):
 *
 *   - getOrgReceiptPrefix          (org slug → receipt prefix; missing-org 'ORG' fallback)
 *   - getPaymentForUpdate          (SELECT … FOR UPDATE lock-and-read, inside a tx)
 *   - updatePaymentFields          (field-only update; NO status-history row, NO
 *                                   state-machine assert — the PAY-EXT-409 fix path)
 *   - findRecentPaymentForPerson   (concurrent-payment guard: time window + org/person scope + ordering)
 *   - createFundAllocations / getFundAllocations (fund-split ledger persistence; empty no-op)
 *   - listPayments                 (method filter, paidAt date range, paidAt DESC ordering,
 *                                   leftJoin null-person shaping) — branches the sibling skips
 *   - getDashboardStats            (conditional-aggregate ledger math + collectionRate + org scope)
 *   - updatePaymentStatus          (multi-hop submitted→underReview→confirmed→completed history
 *                                   accumulation + rejectionReason capture) — extends sibling coverage
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly (`if (!H.dbReachable) return`).
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { DuesRepository } from './dues-payments.repo';
import { ConflictError } from '@/core/errors';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

// uuid NOT NULL columns need real UUIDs (no FK rows required — LIKE drops FKs).
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const PERSON_1 = '00000000-0000-4000-8000-0000000000c1';
const PERSON_2 = '00000000-0000-4000-8000-0000000000c2';
const OFFICER = '00000000-0000-4000-8000-0000000000d1';

function freshId(): string {
  return crypto.randomUUID();
}

/**
 * Insert an organization row directly. organization.association_id, name, slug,
 * org_type are NOT NULL with no default (status defaults to 'trial'); the rest
 * come from baseEntityFields defaults. getOrgReceiptPrefix only reads slug.
 *
 * org_type is the REAL public enum ('chapter','society','national','clinic') —
 * the harness copies it via LIKE … INCLUDING ALL, so the value must be a valid
 * member. 'national' is used. It is an inline SQL string literal (not a bound
 * $N param), so Postgres auto-casts it to org_type without an explicit ::cast.
 */
async function insertOrg(opts: { id?: string; slug?: string; name?: string } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, slug, org_type)
     VALUES ($1, $2, $3, $4, 'national')
     ON CONFLICT (id) DO NOTHING`,
    [id, freshId(), opts.name ?? 'Acme Dental Assoc', opts.slug ?? `acme-${id.slice(0, 8)}`],
  );
  return id;
}

/** Insert a person row directly. person.first_name is NOT NULL (no default). */
async function insertPerson(opts: { id?: string; firstName?: string; lastName?: string | null } = {}): Promise<string> {
  const id = opts.id ?? freshId();
  const lastName = 'lastName' in opts ? opts.lastName ?? null : 'Doe';
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".person (id, first_name, last_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, opts.firstName ?? 'Jane', lastName],
  );
  return id;
}

/**
 * Insert a dues_payment row directly via raw SQL. Raw SQL (not the repo) lets us
 * seed arbitrary status/method/amount/paid_at/created_at combinations the write
 * path would not normally produce, so the read-side filters and aggregates can
 * be proven against adversarial data. NOT-NULL no-default cols: organization_id,
 * person_id, receipt_number, amount, payment_method (status defaults 'pending').
 */
async function insertPayment(opts: {
  id?: string;
  organizationId?: string;
  personId?: string;
  receiptNumber?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  paidAt?: Date | null;
  createdAt?: Date;
  invoiceId?: string | null;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  // payment_method / status are the REAL public enums (dues_payment_method,
  // dues_payment_status), copied by LIKE … INCLUDING ALL. A bound $N param binds
  // as text, so Postgres needs an explicit ::enum cast (a bound param does NOT
  // auto-cast the way an inline string literal does).
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_payment
       (id, organization_id, person_id, invoice_id, receipt_number, amount, currency,
        payment_method, status, paid_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'PHP',$7::dues_payment_method,$8::dues_payment_status,$9,$10)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.personId ?? PERSON_1,
      opts.invoiceId ?? null,
      opts.receiptNumber ?? `R-${freshId()}`,
      opts.amount ?? 10000,
      opts.paymentMethod ?? 'cash',
      opts.status ?? 'pending',
      opts.paidAt === undefined ? new Date() : opts.paidAt,
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

/** Insert a dues_fund row and return its id. NOT-NULL no-default: organization_id, name, percentage. */
async function insertFund(opts: { organizationId?: string; name?: string; percentage?: string } = {}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_fund (id, organization_id, name, percentage)
     VALUES ($1,$2,$3,$4)`,
    [id, opts.organizationId ?? ORG_A, opts.name ?? 'General Fund', opts.percentage ?? '100.00'],
  );
  return id;
}

beforeAll(async () => {
  H = await createScratch([
    'dues_payment',
    'dues_payment_status_history',
    'dues_fund',
    'dues_fund_allocation',
    'dues_receipt_counter',
    'organization',
    'person',
  ]);
  if (!H.dbReachable) return;
  await insertOrg({ id: ORG_A, slug: 'acme' });
  await insertOrg({ id: ORG_B, slug: 'beta' });
  await insertPerson({ id: PERSON_1, firstName: 'Jane', lastName: 'Doe' });
  await insertPerson({ id: PERSON_2, firstName: 'Solo', lastName: null });
  await insertPerson({ id: OFFICER, firstName: 'Ofc', lastName: 'Treasurer' });
});

afterAll(async () => {
  await H?.teardown();
});

// ─── getOrgReceiptPrefix (slug → prefix) ──────────────────────────────────

describe('DuesRepository.getOrgReceiptPrefix (real DB)', () => {
  test('derives an uppercase alphanumeric prefix from the org slug', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'manila-dental' });
    // buildReceiptPrefix uppercases, strips non-alnum, caps at 8 chars → 'MANILADE'.
    expect(await repo.getOrgReceiptPrefix(org)).toBe('MANILADE');
  });

  test('falls back to ORG when the organization row is missing (no slug)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    // No organization row for this id → slug is undefined → 'ORG' fallback.
    expect(await repo.getOrgReceiptPrefix(freshId())).toBe('ORG');
  });

  test('scopes the slug read to the requested org (no cross-org leak)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const orgX = await insertOrg({ slug: 'x---' });   // all non-alnum after first char → 'X'
    const orgY = await insertOrg({ slug: 'yankee' });
    expect(await repo.getOrgReceiptPrefix(orgX)).toBe('X');
    expect(await repo.getOrgReceiptPrefix(orgY)).toBe('YANKEE');
  });
});

// ─── getPaymentForUpdate (lock-and-read) ──────────────────────────────────

describe('DuesRepository.getPaymentForUpdate (real DB)', () => {
  test('returns the locked payment row inside a transaction', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ amount: 77000, status: 'completed', paymentMethod: 'gcash' });

    const locked = await (H.db as any).transaction(async (txDb: any) => {
      const txRepo = new DuesRepository(txDb);
      return txRepo.getPaymentForUpdate(id);
    });

    expect(locked?.id).toBe(id);
    expect(locked?.amount).toBe(77000);
    expect(locked?.status).toBe('completed');
    expect(locked?.paymentMethod).toBe('gcash');
    // refunded_amount carries its column default of 0 — the over-refund cap baseline.
    expect(locked?.refundedAmount).toBe(0);
  });

  test('returns undefined for an unknown payment id', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const got = await (H.db as any).transaction(async (txDb: any) =>
      new DuesRepository(txDb).getPaymentForUpdate(freshId()),
    );
    expect(got).toBeUndefined();
  });
});

// ─── updatePaymentFields (PAY-EXT-409 field-only update) ──────────────────

describe('DuesRepository.updatePaymentFields (real DB)', () => {
  test('persists side fields WITHOUT changing status and WITHOUT a history row', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ status: 'completed' });

    const updated = await repo.updatePaymentFields(id, {
      membershipExtendedFrom: '2026-01-01',
      membershipExtendedTo: '2026-12-31',
    } as any);

    // Status is untouched (no completed→completed assert that would 409).
    expect(updated.status).toBe('completed');
    expect(updated.membershipExtendedFrom).toBe('2026-01-01');
    expect(updated.membershipExtendedTo).toBe('2026-12-31');

    // Read back from Postgres confirms persistence.
    const reread = await repo.getPayment(id);
    expect(reread?.membershipExtendedTo).toBe('2026-12-31');

    // Crucially, NO status-history row is appended for a field-only update.
    const hist = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".dues_payment_status_history WHERE payment_id = $1`,
      [id],
    );
    expect(hist.rows[0].c).toBe(0);
  });

  test('bumps updated_at while leaving amount/method intact', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ amount: 50000, paymentMethod: 'bankTransfer', status: 'completed' });
    const before = await repo.getPayment(id);

    const updated = await repo.updatePaymentFields(id, { referenceNumber: 'REF-9001' } as any);
    expect(updated.referenceNumber).toBe('REF-9001');
    expect(updated.amount).toBe(50000);
    expect(updated.paymentMethod).toBe('bankTransfer');
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime());
  });
});

// ─── findRecentPaymentForPerson (concurrent-payment guard) ────────────────

describe('DuesRepository.findRecentPaymentForPerson (real DB)', () => {
  test('returns the most recent in-window payment for the org+person', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'recent-org' });
    const person = await insertPerson();
    const older = await insertPayment({
      organizationId: org, personId: person, createdAt: new Date(Date.now() - 60_000),
    });
    const newer = await insertPayment({
      organizationId: org, personId: person, createdAt: new Date(Date.now() - 10_000),
    });

    const recent = await repo.findRecentPaymentForPerson(org, person);
    // ordered by created_at DESC, limit 1 → the newer row.
    expect(recent?.id).toBe(newer);
    expect(recent?.id).not.toBe(older);
  });

  test('returns undefined when the latest payment is older than the window', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'stale-org' });
    const person = await insertPerson();
    // 10 minutes ago — outside the default 5-minute window.
    await insertPayment({ organizationId: org, personId: person, createdAt: new Date(Date.now() - 10 * 60_000) });

    expect(await repo.findRecentPaymentForPerson(org, person)).toBeUndefined();
    // A widened window (15 min) now catches it.
    expect(await repo.findRecentPaymentForPerson(org, person, 15)).toBeDefined();
  });

  test('scopes to the org+person — another org or another person is excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'scope-org' });
    const otherOrg = await insertOrg({ slug: 'other-org' });
    const person = await insertPerson();
    const otherPerson = await insertPerson();
    const now = new Date(Date.now() - 5_000);
    await insertPayment({ organizationId: otherOrg, personId: person, createdAt: now });     // wrong org
    await insertPayment({ organizationId: org, personId: otherPerson, createdAt: now });     // wrong person

    // No matching (org, person) recent payment.
    expect(await repo.findRecentPaymentForPerson(org, person)).toBeUndefined();
  });
});

// ─── createFundAllocations / getFundAllocations (fund-split ledger) ───────

describe('DuesRepository.fund allocations (real DB)', () => {
  test('persists fund splits for a payment and reads them back', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'alloc-org' });
    const paymentId = await insertPayment({ organizationId: org, amount: 10000, status: 'completed' });
    const fundA = await insertFund({ organizationId: org, name: 'National', percentage: '70.00' });
    const fundB = await insertFund({ organizationId: org, name: 'Chapter', percentage: '30.00' });

    await repo.createFundAllocations([
      { organizationId: org, paymentId, fundId: fundA, amount: 7000 } as any,
      { organizationId: org, paymentId, fundId: fundB, amount: 3000 } as any,
    ]);

    const rows = await repo.getFundAllocations(paymentId);
    expect(rows).toHaveLength(2);
    const byFund = new Map(rows.map((r) => [r.fundId, r.amount]));
    expect(byFund.get(fundA)).toBe(7000);
    expect(byFund.get(fundB)).toBe(3000);
    // Splits sum to the payment amount — the BR-06 allocation invariant.
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(10000);
    // Default is_reversal is false (forward allocation).
    expect(rows.every((r) => r.isReversal === false)).toBe(true);
  });

  test('createFundAllocations([]) is a no-op — inserts nothing', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const paymentId = await insertPayment({ status: 'completed' });

    await repo.createFundAllocations([]);
    expect(await repo.getFundAllocations(paymentId)).toEqual([]);
  });

  test('getFundAllocations is scoped to the requested payment', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'alloc-scope' });
    const fund = await insertFund({ organizationId: org });
    const payA = await insertPayment({ organizationId: org, status: 'completed' });
    const payB = await insertPayment({ organizationId: org, status: 'completed' });
    await repo.createFundAllocations([{ organizationId: org, paymentId: payA, fundId: fund, amount: 500 } as any]);
    await repo.createFundAllocations([{ organizationId: org, paymentId: payB, fundId: fund, amount: 999 } as any]);

    const rowsA = await repo.getFundAllocations(payA);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]!.amount).toBe(500);
  });
});

// ─── listPayments — filter/ordering/shaping branches sibling skips ────────

describe('DuesRepository.listPayments method/date/ordering (real DB)', () => {
  test('method filter narrows to one payment method', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'method-org' });
    const person = await insertPerson();
    const cash = await insertPayment({ organizationId: org, personId: person, paymentMethod: 'cash', status: 'completed' });
    await insertPayment({ organizationId: org, personId: person, paymentMethod: 'gcash', status: 'completed' });
    await insertPayment({ organizationId: org, personId: person, paymentMethod: 'check', status: 'completed' });

    const res = await repo.listPayments({ organizationId: org, method: 'cash' });
    expect(res.total).toBe(1);
    expect(res.data.map((r) => r.id)).toEqual([cash]);
    expect(res.data[0]!.paymentMethod).toBe('cash');
  });

  test('fromDate/toDate restrict to the paid_at window', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'date-org' });
    const person = await insertPerson();
    const inWindow = await insertPayment({
      organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-06-15T00:00:00Z'),
    });
    await insertPayment({ organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-01-01T00:00:00Z') });
    await insertPayment({ organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-12-31T00:00:00Z') });

    const res = await repo.listPayments({
      organizationId: org,
      fromDate: new Date('2026-06-01T00:00:00Z'),
      toDate: new Date('2026-06-30T00:00:00Z'),
    });
    expect(res.data.map((r) => r.id)).toEqual([inWindow]);
    expect(res.total).toBe(1);
  });

  test('orders by paid_at DESC (most recent first)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'order-org' });
    const person = await insertPerson();
    const first = await insertPayment({ organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-03-01T00:00:00Z') });
    const second = await insertPayment({ organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-06-01T00:00:00Z') });
    const third = await insertPayment({ organizationId: org, personId: person, status: 'completed', paidAt: new Date('2026-09-01T00:00:00Z') });

    const res = await repo.listPayments({ organizationId: org });
    expect(res.data.map((r) => r.id)).toEqual([third, second, first]);
  });

  test('leftJoin shapes person=null when the joined person row is absent', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'orphan-org' });
    // person_id points at a person that was never seeded (FKs not copied by LIKE).
    const orphanPerson = freshId();
    await insertPayment({ organizationId: org, personId: orphanPerson, status: 'completed' });

    const res = await repo.listPayments({ organizationId: org });
    expect(res.total).toBe(1);
    // personFirstName is null → shaped as person: null (not an object).
    expect(res.data[0]!.person).toBeNull();
  });
});

// ─── getDashboardStats — conditional-aggregate ledger math ────────────────

describe('DuesRepository.getDashboardStats (real DB)', () => {
  test('sums collected vs outstanding, counts, and computes collectionRate', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'dash-org' });
    const person = await insertPerson();
    // 3 completed (collected), 1 pending (outstanding) → rate = 3/4 = 75%.
    await insertPayment({ organizationId: org, personId: person, amount: 1000, status: 'completed' });
    await insertPayment({ organizationId: org, personId: person, amount: 2000, status: 'completed' });
    await insertPayment({ organizationId: org, personId: person, amount: 3000, status: 'completed' });
    await insertPayment({ organizationId: org, personId: person, amount: 5000, status: 'pending' });

    const stats = await repo.getDashboardStats(org);
    expect(stats.totalCollected).toBe(6000);  // completed only
    expect(stats.totalOutstanding).toBe(5000); // pending only
    expect(stats.completedCount).toBe(3);
    expect(stats.pendingCount).toBe(1);
    expect(stats.totalCount).toBe(4);
    expect(stats.collectionRate).toBe(75);     // round(3/4 * 100)
  });

  test('empty org → zeros and a 0 collectionRate (no divide-by-zero)', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'dash-empty' });
    const stats = await repo.getDashboardStats(org);
    expect(stats).toEqual({
      totalCollected: 0,
      totalOutstanding: 0,
      pendingCount: 0,
      completedCount: 0,
      totalCount: 0,
      collectionRate: 0,
    });
  });

  test('is scoped to the org — another org\'s payments do not leak in', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const org = await insertOrg({ slug: 'dash-scope' });
    const other = await insertOrg({ slug: 'dash-other' });
    await insertPayment({ organizationId: org, amount: 1000, status: 'completed' });
    await insertPayment({ organizationId: other, amount: 99999, status: 'completed' });

    const stats = await repo.getDashboardStats(org);
    expect(stats.totalCollected).toBe(1000);
    expect(stats.totalCount).toBe(1);
  });
});

// ─── updatePaymentStatus — multi-hop history + reason accumulation ────────
// Extends the sibling's single-hop coverage: walks the full
// submitted→underReview→confirmed→completed chain and asserts EVERY transition
// appends an ordered history row, then drives the rejection branch.

describe('DuesRepository.updatePaymentStatus multi-hop (real DB)', () => {
  test('each valid hop appends an ordered status-history row', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ status: 'submitted', organizationId: ORG_A, personId: PERSON_1 });

    await repo.updatePaymentStatus(id, 'submitted', 'underReview', undefined, OFFICER);
    await repo.updatePaymentStatus(id, 'underReview', 'confirmed', undefined, OFFICER);
    const final = await repo.updatePaymentStatus(id, 'confirmed', 'completed', { paidAt: new Date() }, OFFICER);
    expect(final.status).toBe('completed');

    const hist = await H.scopedPool.query(
      `SELECT from_status, to_status FROM "${H.schema}".dues_payment_status_history
       WHERE payment_id = $1 ORDER BY changed_at ASC, version ASC`,
      [id],
    );
    expect(hist.rows.map((r: any) => [r.from_status, r.to_status])).toEqual([
      ['submitted', 'underReview'],
      ['underReview', 'confirmed'],
      ['confirmed', 'completed'],
    ]);
  });

  test('rejection captures rejectionReason into the history row', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ status: 'submitted', organizationId: ORG_A, personId: PERSON_1 });

    await repo.updatePaymentStatus(
      id, 'submitted', 'rejected',
      { rejectionReason: 'blurry proof of payment' }, OFFICER,
    );

    const hist = await H.scopedPool.query(
      `SELECT to_status, reason, changed_by FROM "${H.schema}".dues_payment_status_history
       WHERE payment_id = $1 ORDER BY changed_at DESC LIMIT 1`,
      [id],
    );
    expect(hist.rows[0].to_status).toBe('rejected');
    expect(hist.rows[0].reason).toBe('blurry proof of payment');
    expect(hist.rows[0].changed_by).toBe(OFFICER);
  });

  test('an illegal hop out of the submitted-review chain throws and writes no row', async () => {
    if (!H.dbReachable) return;
    const repo = new DuesRepository(H.db as any);
    const id = await insertPayment({ status: 'submitted', organizationId: ORG_A, personId: PERSON_1 });

    // submitted → completed is NOT allowed (must pass through underReview/confirmed).
    await expect(repo.updatePaymentStatus(id, 'submitted', 'completed')).rejects.toBeInstanceOf(ConflictError);

    const reread = await repo.getPayment(id);
    expect(reread?.status).toBe('submitted');
    const hist = await H.scopedPool.query(
      `SELECT count(*)::int AS c FROM "${H.schema}".dues_payment_status_history WHERE payment_id = $1`,
      [id],
    );
    expect(hist.rows[0].c).toBe(0);
  });
});
