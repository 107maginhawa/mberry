/**
 * Real-DB integration tests for the membership-domain SpecialAssessmentRepository.
 *
 * The existing sibling suite (special-assessments.repo.coverage.test.ts) is a
 * mock-DB test: it only inspects the Drizzle chain the repo builds and scripts
 * each query's result. It can never prove the SQL is *correct* — it cannot catch
 * a busted org filter, a wrong ORDER BY, a broken status default, a NULL-invoice
 * branch in the metrics math, the `id IN (...)` paid-invoice join, or persisted
 * column state, because no query ever runs against Postgres.
 *
 * This suite drives the real query builders against REAL rows so the WHERE
 * predicates, ordering, org-scoping, target allocation, status transitions,
 * invoice generation and the collection-metrics SUM/COUNT math all execute
 * end-to-end. It asserts the REAL returned data AND the persisted row state read
 * back out of Postgres — never merely "did not throw".
 *
 * Target: handlers/association:member/repos/special-assessments.repo.ts
 *   SpecialAssessmentRepository:
 *     - create / findById / findByIdAndOrg / listByOrg
 *     - update / softDelete / setStatus
 *     - addTargets / getTargets / getTargetPersonIds
 *     - findTargetByAssessmentAndPerson
 *     - updateTargetInvoice / markTargetWithInvoice
 *     - getCollectionMetrics (no-targets, missing-assessment, NULL-invoice,
 *       paid-invoice IN(...) join, pending/total amount math)
 *     - createInvoiceForTarget
 *     - getActiveOrgMemberPersonIds (active-only + org-scoped)
 *
 * Isolation: the shared `createScratch` harness stands up a per-suite scratch
 * schema by COPYING the real public table structures
 * (`CREATE TABLE … (LIKE public.<t> INCLUDING ALL)`), so every real
 * column/default/check is present — no hand-DDL drift. FKs are not copied, so
 * rows insert directly without parent org/person/tier rows. search_path is
 * pinned via the libpq startup option (no pool-churn race).
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { SpecialAssessmentRepository } from './special-assessments.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

function freshId(): string {
  return crypto.randomUUID();
}

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/**
 * Insert a special_assessment row directly via raw SQL and return its id. Raw
 * SQL lets us seed arbitrary status / amount / org / createdAt combinations the
 * repo write-path wouldn't normally produce, so the read-side filters and
 * ordering can be proven against adversarial data.
 *
 * Required NOT-NULL columns with no default: organization_id, name, amount,
 * due_date. currency/applies_to/status carry defaults.
 */
async function insertAssessment(opts: {
  id?: string;
  organizationId?: string;
  name?: string;
  amount?: number;
  dueDate?: string;
  status?: 'draft' | 'active' | 'closed';
  appliesTo?: 'all' | 'selected';
  currency?: string;
  createdAt?: Date;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".special_assessment
       (id, organization_id, name, amount, due_date, status, applies_to, currency, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)`,
    [
      id,
      opts.organizationId ?? ORG_A,
      opts.name ?? 'Building Levy',
      opts.amount ?? 100,
      opts.dueDate ?? '2026-12-31',
      opts.status ?? 'draft',
      opts.appliesTo ?? 'all',
      opts.currency ?? 'PHP',
      opts.createdAt ?? new Date(),
    ],
  );
  return id;
}

/**
 * Insert a special_assessment_target row directly. Required NOT-NULL columns:
 * assessment_id, person_id. target_status defaults to 'pending', invoice_id is
 * nullable.
 */
async function insertTarget(opts: {
  id?: string;
  assessmentId: string;
  personId: string;
  invoiceId?: string | null;
  status?: 'pending' | 'paid';
}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".special_assessment_target
       (id, assessment_id, person_id, invoice_id, target_status)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, opts.assessmentId, opts.personId, opts.invoiceId ?? null, opts.status ?? 'pending'],
  );
  return id;
}

/**
 * Insert a dues_invoice row directly (needed for the paid-invoice metrics
 * branch). Required NOT-NULL columns with no default: membership_id, person_id,
 * organization_id, invoice_number, period_start, period_end, total_amount,
 * fund_allocations. status defaults to 'generated'.
 */
async function insertInvoice(opts: {
  id?: string;
  status?: 'generated' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'writtenOff';
  totalAmount?: number;
  organizationId?: string;
  personId?: string;
} = {}): Promise<string> {
  const id = opts.id ?? freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".dues_invoice
       (id, membership_id, person_id, organization_id, invoice_number,
        period_start, period_end, total_amount, fund_allocations, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
    [
      id,
      freshId(),
      opts.personId ?? freshId(),
      opts.organizationId ?? ORG_A,
      `INV-${id.slice(0, 8)}`,
      '2026-01-01',
      '2026-12-31',
      opts.totalAmount ?? 100,
      JSON.stringify([{ fundName: 'General', amount: opts.totalAmount ?? 100 }]),
      opts.status ?? 'generated',
    ],
  );
  return id;
}

/** Insert a membership row directly (for getActiveOrgMemberPersonIds). */
async function insertMembership(opts: {
  organizationId: string;
  personId: string;
  status?: string;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".membership
       (id, organization_id, person_id, tier_id, start_date, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [freshId(), opts.organizationId, opts.personId, freshId(), '2026-01-01', opts.status ?? 'active'],
  );
}

beforeAll(async () => {
  H = await createScratch([
    'special_assessment',
    'special_assessment_target',
    'dues_invoice',
    'membership',
  ]);
});

afterAll(async () => {
  await H?.teardown();
});

// ─── create ───────────────────────────────────────────────────────────────

describe('SpecialAssessmentRepository.create (real DB)', () => {
  test('persists the row with defaults and is read back from Postgres', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const created = await repo.create({
      organizationId: ORG_A,
      name: 'Anniversary Levy',
      amount: 25000,
      dueDate: '2026-06-30',
    } as any);

    expect(created.name).toBe('Anniversary Levy');
    expect(created.amount).toBe(25000);
    // Column defaults fire on a real INSERT — proves they exist in the LIKE copy.
    expect(created.status).toBe('draft');
    expect(created.appliesTo).toBe('all');
    expect(created.currency).toBe('PHP');

    // Read straight back out of Postgres — not the RETURNING row.
    const { rows } = await H.scopedPool.query(
      `SELECT name, amount, status, currency FROM "${H.schema}".special_assessment WHERE id = $1`,
      [created.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Anniversary Levy');
    expect(Number(rows[0].amount)).toBe(25000);
    expect(rows[0].status).toBe('draft');
  });
});

// ─── findById / findByIdAndOrg ──────────────────────────────────────────────

describe('SpecialAssessmentRepository.findById / findByIdAndOrg (real DB)', () => {
  test('findById returns the row, null when absent', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ name: 'Levy X', amount: 700 });

    const found = await repo.findById(id);
    expect(found?.id).toBe(id);
    expect(found?.name).toBe('Levy X');
    expect(found?.amount).toBe(700);

    expect(await repo.findById(freshId())).toBeNull();
  });

  test('findByIdAndOrg enforces org scoping — wrong org returns null', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ organizationId: ORG_A, name: 'Org-A Levy' });

    const ok = await repo.findByIdAndOrg(id, ORG_A);
    expect(ok?.id).toBe(id);

    // Right id, wrong org → cross-tenant guard returns null.
    expect(await repo.findByIdAndOrg(id, ORG_B)).toBeNull();
  });
});

// ─── listByOrg ──────────────────────────────────────────────────────────────

describe('SpecialAssessmentRepository.listByOrg (real DB)', () => {
  test('returns only this org rows, newest first (createdAt desc)', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const org = freshId();
    const otherOrg = freshId();

    const oldest = await insertAssessment({ organizationId: org, name: 'oldest', createdAt: new Date('2026-01-01T00:00:00Z') });
    const middle = await insertAssessment({ organizationId: org, name: 'middle', createdAt: new Date('2026-02-01T00:00:00Z') });
    const newest = await insertAssessment({ organizationId: org, name: 'newest', createdAt: new Date('2026-03-01T00:00:00Z') });
    // A different org's row must NOT appear.
    await insertAssessment({ organizationId: otherOrg, name: 'foreign', createdAt: new Date('2026-04-01T00:00:00Z') });

    const rows = await repo.listByOrg(org);
    expect(rows.map(r => r.id)).toEqual([newest, middle, oldest]);
    expect(rows.every(r => r.organizationId === org)).toBe(true);
  });

  test('returns empty array for an org with no assessments', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    expect(await repo.listByOrg(freshId())).toEqual([]);
  });
});

// ─── update ─────────────────────────────────────────────────────────────────

describe('SpecialAssessmentRepository.update (real DB)', () => {
  test('mutates allowed fields, bumps updatedAt, persists; null when id missing', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ name: 'Before', amount: 100, createdAt: new Date('2026-01-01T00:00:00Z') });
    const before = await repo.findById(id);

    const updated = await repo.update(id, { name: 'After', amount: 555, description: 'note', appliesTo: 'selected' });
    expect(updated?.name).toBe('After');
    expect(updated?.amount).toBe(555);
    expect(updated?.description).toBe('note');
    expect(updated?.appliesTo).toBe('selected');
    // updatedAt advanced past the seeded createdAt.
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(new Date(before!.updatedAt).getTime());

    // Read back from Postgres to confirm persistence.
    const { rows } = await H.scopedPool.query(
      `SELECT name, amount, applies_to FROM "${H.schema}".special_assessment WHERE id = $1`,
      [id],
    );
    expect(rows[0].name).toBe('After');
    expect(Number(rows[0].amount)).toBe(555);
    expect(rows[0].applies_to).toBe('selected');

    expect(await repo.update(freshId(), { name: 'ghost' })).toBeNull();
  });
});

// ─── softDelete / setStatus (status transitions) ────────────────────────────

describe('SpecialAssessmentRepository.softDelete / setStatus (real DB)', () => {
  test('softDelete flips status to closed and persists; null when missing', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ status: 'active' });

    const closed = await repo.softDelete(id);
    expect(closed?.status).toBe('closed');

    const { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".special_assessment WHERE id = $1`,
      [id],
    );
    expect(rows[0].status).toBe('closed');

    expect(await repo.softDelete(freshId())).toBeNull();
  });

  test('setStatus moves draft → active → closed, each persisted', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ status: 'draft' });

    expect((await repo.setStatus(id, 'active'))?.status).toBe('active');
    let { rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".special_assessment WHERE id = $1`, [id]);
    expect(rows[0].status).toBe('active');

    expect((await repo.setStatus(id, 'closed'))?.status).toBe('closed');
    ({ rows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".special_assessment WHERE id = $1`, [id]));
    expect(rows[0].status).toBe('closed');

    expect(await repo.setStatus(freshId(), 'active')).toBeNull();
  });
});

// ─── addTargets / getTargets / getTargetPersonIds ───────────────────────────

describe('SpecialAssessmentRepository target allocation (real DB)', () => {
  test('addTargets persists one row per person with default pending status', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const assessmentId = await insertAssessment();
    const p1 = freshId();
    const p2 = freshId();

    const inserted = await repo.addTargets(assessmentId, [p1, p2]);
    expect(inserted).toHaveLength(2);
    expect(inserted.every(t => t.assessmentId === assessmentId)).toBe(true);
    // target_status default fires on real INSERT.
    expect(inserted.every(t => t.status === 'pending')).toBe(true);
    expect(inserted.every(t => t.invoiceId === null)).toBe(true);

    const { rows } = await H.scopedPool.query(
      `SELECT person_id, target_status FROM "${H.schema}".special_assessment_target WHERE assessment_id = $1 ORDER BY person_id`,
      [assessmentId],
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(r => r.person_id))).toEqual(new Set([p1, p2]));
    expect(rows.every(r => r.target_status === 'pending')).toBe(true);
  });

  test('addTargets with empty personIds short-circuits — no rows written', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const assessmentId = await insertAssessment();
    const r = await repo.addTargets(assessmentId, []);
    expect(r).toEqual([]);
    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".special_assessment_target WHERE assessment_id = $1`,
      [assessmentId],
    );
    expect(rows[0].n).toBe(0);
  });

  test('getTargets returns only this assessment\'s targets; getTargetPersonIds maps to person ids', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const mine = await insertAssessment();
    const other = await insertAssessment();
    const a = freshId();
    const b = freshId();
    await insertTarget({ assessmentId: mine, personId: a });
    await insertTarget({ assessmentId: mine, personId: b });
    // belongs to a different assessment — must be excluded.
    await insertTarget({ assessmentId: other, personId: freshId() });

    const targets = await repo.getTargets(mine);
    expect(targets).toHaveLength(2);
    expect(targets.every(t => t.assessmentId === mine)).toBe(true);

    const personIds = await repo.getTargetPersonIds(mine);
    expect(new Set(personIds)).toEqual(new Set([a, b]));

    expect(await repo.getTargets(freshId())).toEqual([]);
    expect(await repo.getTargetPersonIds(freshId())).toEqual([]);
  });
});

// ─── findTargetByAssessmentAndPerson ────────────────────────────────────────

describe('SpecialAssessmentRepository.findTargetByAssessmentAndPerson (real DB)', () => {
  test('returns the matching target, null on no match', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const assessmentId = await insertAssessment();
    const person = freshId();
    const targetId = await insertTarget({ assessmentId, personId: person });
    // A target for a different person on the same assessment must not be returned.
    await insertTarget({ assessmentId, personId: freshId() });

    const found = await repo.findTargetByAssessmentAndPerson(assessmentId, person);
    expect(found?.id).toBe(targetId);
    expect(found?.personId).toBe(person);

    expect(await repo.findTargetByAssessmentAndPerson(assessmentId, freshId())).toBeNull();
    expect(await repo.findTargetByAssessmentAndPerson(freshId(), person)).toBeNull();
  });
});

// ─── updateTargetInvoice / markTargetWithInvoice ────────────────────────────

describe('SpecialAssessmentRepository target invoice linkage (real DB)', () => {
  test('updateTargetInvoice sets invoice_id AND flips status to paid', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const assessmentId = await insertAssessment();
    const targetId = await insertTarget({ assessmentId, personId: freshId(), status: 'pending' });
    const invoiceId = freshId();

    const updated = await repo.updateTargetInvoice(targetId, invoiceId);
    expect(updated?.invoiceId).toBe(invoiceId);
    expect(updated?.status).toBe('paid');

    const { rows } = await H.scopedPool.query(
      `SELECT invoice_id, target_status FROM "${H.schema}".special_assessment_target WHERE id = $1`,
      [targetId],
    );
    expect(rows[0].invoice_id).toBe(invoiceId);
    expect(rows[0].target_status).toBe('paid');

    expect(await repo.updateTargetInvoice(freshId(), invoiceId)).toBeNull();
  });

  test('markTargetWithInvoice sets invoice_id by (assessment, person) WITHOUT flipping status', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const assessmentId = await insertAssessment();
    const person = freshId();
    const targetId = await insertTarget({ assessmentId, personId: person, status: 'pending' });
    const invoiceId = freshId();

    const updated = await repo.markTargetWithInvoice(assessmentId, person, invoiceId);
    expect(updated?.invoiceId).toBe(invoiceId);
    // status is intentionally left untouched here (unlike updateTargetInvoice).
    expect(updated?.status).toBe('pending');

    const { rows } = await H.scopedPool.query(
      `SELECT invoice_id, target_status FROM "${H.schema}".special_assessment_target WHERE id = $1`,
      [targetId],
    );
    expect(rows[0].invoice_id).toBe(invoiceId);
    expect(rows[0].target_status).toBe('pending');

    expect(await repo.markTargetWithInvoice(assessmentId, freshId(), invoiceId)).toBeNull();
  });
});

// ─── getCollectionMetrics ───────────────────────────────────────────────────

describe('SpecialAssessmentRepository.getCollectionMetrics (real DB)', () => {
  test('returns null when the assessment does not exist', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    expect(await repo.getCollectionMetrics(freshId())).toBeNull();
  });

  test('zero targets → all-zero metrics', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ amount: 500 });
    const m = await repo.getCollectionMetrics(id);
    expect(m).toEqual({
      totalTargets: 0,
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      totalAmount: 0,
    });
  });

  test('targets without invoices count as pending only (no paid-invoice query result)', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ amount: 200 });
    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: null });
    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: null });

    const m = await repo.getCollectionMetrics(id);
    expect(m).toEqual({
      totalTargets: 2,
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 2,
      pendingAmount: 400, // 2 * 200
      totalAmount: 400,
    });
  });

  test('counts only PAID invoices via the id IN (...) join; mixed paid/unpaid/no-invoice math', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const id = await insertAssessment({ amount: 100 });

    // Two paid invoices, one generated (unpaid) invoice, one target with no invoice.
    const paid1 = await insertInvoice({ status: 'paid' });
    const paid2 = await insertInvoice({ status: 'paid' });
    const unpaid = await insertInvoice({ status: 'generated' });

    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: paid1 });
    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: paid2 });
    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: unpaid });
    await insertTarget({ assessmentId: id, personId: freshId(), invoiceId: null });

    const m = await repo.getCollectionMetrics(id);
    // 4 targets; 2 have PAID invoices.
    expect(m).toEqual({
      totalTargets: 4,
      paidCount: 2,
      paidAmount: 200,   // 2 * 100
      pendingCount: 2,   // 4 - 2
      pendingAmount: 200, // 2 * 100
      totalAmount: 400,   // 4 * 100
    });
  });

  test('a paid invoice for an UNRELATED assessment is not counted', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const mine = await insertAssessment({ amount: 100 });
    const other = await insertAssessment({ amount: 100 });

    const otherPaid = await insertInvoice({ status: 'paid' });
    // The paid invoice belongs to a target on the OTHER assessment.
    await insertTarget({ assessmentId: other, personId: freshId(), invoiceId: otherPaid });
    // My assessment has a single unpaid target.
    await insertTarget({ assessmentId: mine, personId: freshId(), invoiceId: null });

    const m = await repo.getCollectionMetrics(mine);
    expect(m).toEqual({
      totalTargets: 1,
      paidCount: 0,
      paidAmount: 0,
      pendingCount: 1,
      pendingAmount: 100,
      totalAmount: 100,
    });
  });
});

// ─── createInvoiceForTarget ─────────────────────────────────────────────────

describe('SpecialAssessmentRepository.createInvoiceForTarget (real DB)', () => {
  test('inserts a generated dues_invoice and persists fund allocations', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const personId = freshId();
    const membershipId = freshId();

    const invoice = await repo.createInvoiceForTarget({
      personId,
      organizationId: ORG_A,
      totalAmount: 1500,
      currency: 'PHP',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      invoiceNumber: 'SA-INV-001',
      fundAllocations: [{ fundName: 'General', amount: 1500 }],
      membershipId,
    });

    expect(invoice.invoiceNumber).toBe('SA-INV-001');
    expect(invoice.status).toBe('generated');
    expect(invoice.totalAmount).toBe(1500);
    expect(invoice.personId).toBe(personId);

    const { rows } = await H.scopedPool.query(
      `SELECT invoice_number, status, total_amount, fund_allocations, person_id, membership_id
         FROM "${H.schema}".dues_invoice WHERE id = $1`,
      [invoice.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].invoice_number).toBe('SA-INV-001');
    expect(rows[0].status).toBe('generated');
    expect(Number(rows[0].total_amount)).toBe(1500);
    expect(rows[0].person_id).toBe(personId);
    expect(rows[0].membership_id).toBe(membershipId);
    expect(rows[0].fund_allocations).toEqual([{ fundName: 'General', amount: 1500 }]);
  });
});

// ─── getActiveOrgMemberPersonIds ────────────────────────────────────────────

describe('SpecialAssessmentRepository.getActiveOrgMemberPersonIds (real DB)', () => {
  test('returns active members of the org only — excludes other statuses and other orgs', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const org = freshId();
    const otherOrg = freshId();
    const active1 = freshId();
    const active2 = freshId();
    const lapsed = freshId();
    const foreign = freshId();

    await insertMembership({ organizationId: org, personId: active1, status: 'active' });
    await insertMembership({ organizationId: org, personId: active2, status: 'active' });
    // Non-active status in the same org → excluded.
    await insertMembership({ organizationId: org, personId: lapsed, status: 'lapsed' });
    // Active but in a different org → excluded by org filter.
    await insertMembership({ organizationId: otherOrg, personId: foreign, status: 'active' });

    const ids = await repo.getActiveOrgMemberPersonIds(org);
    expect(new Set(ids)).toEqual(new Set([active1, active2]));
  });

  test('returns empty array for an org with no active members', async () => {
    if (!H.dbReachable) return;
    const repo = new SpecialAssessmentRepository(H.db as any);
    const org = freshId();
    await insertMembership({ organizationId: org, personId: freshId(), status: 'suspended' });
    expect(await repo.getActiveOrgMemberPersonIds(org)).toEqual([]);
  });
});
