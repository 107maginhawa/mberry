/**
 * Real-PG integration tests for the membership-domain ComplianceRepository.
 *
 * The existing mock suite (compliance.repo.coverage.test.ts) feeds scripted rows
 * to a fake `db.execute()`. It proves the JS mapping/aggregation glue but never
 * runs a single statement against Postgres, so it cannot catch:
 *   - a wrong WHERE on the `compliance_standings` matview (org-scope leak),
 *   - a busted COUNT / COUNT(*) FILTER tally in getOrgSummary,
 *   - a broken `compliance_percent ASC` ordering or LIMIT/OFFSET pagination,
 *   - the matview's own SUM/FILTER/category math, the active+verified gate,
 *     the required_credits default (60) vs org_cpd_config override, or the
 *     compliant / at_risk / non_compliant threshold buckets,
 *   - REFRESH MATERIALIZED VIEW CONCURRENTLY actually executing.
 *
 * This suite drives the real SQL end-to-end. `compliance_standings` is a
 * MATERIALIZED VIEW, so `createScratch` (which `LIKE`-copies plain tables)
 * cannot reproduce it. We therefore LIKE-copy its two source tables
 * (`credit_entry`, `org_cpd_config`) and recreate the matview VERBATIM from
 * migration 0075 inside the scratch schema, then seed `credit_entry`, REFRESH,
 * and assert the REAL rows the repo returns — including the matview-derived
 * aggregates, not just "no throw".
 *
 * Requires a migrated public schema (local dev DB / CI ci-migrate). If Postgres
 * is unreachable the suite skips cleanly rather than false-failing.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ComplianceRepository } from './compliance.repo';
import { createScratch, type ScratchDb } from '@/test-utils/pg-scratch';

let H: ScratchDb;

function freshId(): string {
  return crypto.randomUUID();
}

// A cycle window the matview ignores for grouping (it has no cycle filter), but
// credit_entry requires NOT-NULL cycle_start/cycle_end, so seed something sane.
const CYCLE_START = new Date('2026-01-01T00:00:00.000Z');
const CYCLE_END = new Date('2026-12-31T23:59:59.000Z');

/**
 * The matview definition copied VERBATIM from migration 0075_wise_shaman.sql
 * (which itself recreated it unchanged from 0070). References are unqualified so
 * they resolve against the scratch search_path. The UNIQUE INDEX is required for
 * REFRESH ... CONCURRENTLY (exercised by ComplianceRepository.refresh()).
 */
const MATVIEW_SQL = `
CREATE MATERIALIZED VIEW compliance_standings AS
SELECT ce.person_id,ce.organization_id,COALESCE(SUM(ce.credit_amount),0) AS total_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='General'),0) AS general_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Major'),0) AS major_credits,
COALESCE(SUM(ce.credit_amount) FILTER (WHERE ce.category='Self-Directed'),0) AS sdl_credits,
COUNT(*) AS entry_count,COALESCE(occ.required_credits,60) AS required_credits,
COALESCE(occ.sdl_cap_percent,40) AS sdl_cap_percent,
CASE WHEN COALESCE(occ.required_credits,60)=0 THEN 100 ELSE LEAST(ROUND((COALESCE(SUM(ce.credit_amount),0)::numeric/COALESCE(occ.required_credits,60))*100,1),100) END AS compliance_percent,
CASE WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60) THEN 'compliant' WHEN COALESCE(SUM(ce.credit_amount),0)>=COALESCE(occ.required_credits,60)*0.6 THEN 'at_risk' ELSE 'non_compliant' END AS compliance_status,
MAX(ce.updated_at) AS last_credit_at
FROM credit_entry ce LEFT JOIN org_cpd_config occ ON occ.organization_id=ce.organization_id WHERE ce.status='active' AND ce.verification_status='verified' GROUP BY ce.person_id,ce.organization_id,occ.required_credits,occ.sdl_cap_percent`;

/**
 * Insert a credit_entry row directly via raw SQL. Raw inserts (not the repo) let
 * us seed arbitrary status / verification_status / category / credit_amount /
 * updated_at combinations so the matview gates and aggregates can be proven
 * against adversarial data. We set every NOT-NULL column without a default
 * (person_id, organization_id, type, activity_name, activity_date,
 * credit_amount, cycle_start, cycle_end, verification_status) and let defaults
 * cover the rest (id, created_at, updated_at, version, status). We override
 * updated_at explicitly since the matview reads MAX(updated_at) as last_credit_at.
 */
async function insertCredit(opts: {
  personId: string;
  organizationId: string;
  type?: 'auto' | 'manual';
  activityDate?: Date;
  creditAmount?: number;
  category?: 'General' | 'Major' | 'Self-Directed' | null;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  status?: 'active' | 'voided' | 'disputed';
  updatedAt?: Date;
}): Promise<string> {
  const id = freshId();
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".credit_entry
       (id, person_id, organization_id, type, activity_name, activity_date,
        credit_amount, cycle_start, cycle_end, category, verification_status, status, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      opts.personId,
      opts.organizationId,
      opts.type ?? 'manual',
      'Activity',
      opts.activityDate ?? new Date('2026-06-01T00:00:00.000Z'),
      opts.creditAmount ?? 1,
      CYCLE_START,
      CYCLE_END,
      'category' in opts ? opts.category : 'General',
      opts.verificationStatus ?? 'verified',
      opts.status ?? 'active',
      opts.updatedAt ?? new Date('2026-06-01T00:00:00.000Z'),
    ],
  );
  return id;
}

/** Insert an org_cpd_config row so required_credits / sdl_cap_percent override defaults. */
async function insertCpdConfig(opts: {
  organizationId: string;
  requiredCredits: number;
  sdlCapPercent?: number;
}): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".org_cpd_config
       (id, organization_id, required_credits, sdl_cap_percent)
     VALUES ($1,$2,$3,$4)`,
    [freshId(), opts.organizationId, opts.requiredCredits, opts.sdlCapPercent ?? 40],
  );
}

/** Plain (non-concurrent) refresh — used to (re)populate the matview after seeding. */
async function refreshMatview(): Promise<void> {
  await H.scopedPool.query(`REFRESH MATERIALIZED VIEW "${H.schema}".compliance_standings`);
}

beforeAll(async () => {
  H = await createScratch(['credit_entry', 'org_cpd_config']);
  if (!H.dbReachable) return;
  // Build the matview from its real definition inside the scratch schema.
  await H.scopedPool.query(MATVIEW_SQL);
  await H.scopedPool.query(
    `CREATE UNIQUE INDEX idx_compliance_standings_pk ON compliance_standings (person_id,organization_id)`,
  );
});

afterAll(async () => {
  await H?.teardown();
});

// ─── getByOrganization (count + ordered, paginated, mapped standings) ─────────

describe('ComplianceRepository.getByOrganization (real DB)', () => {
  test('returns total count + standings scoped to one org, ordered by compliance_percent ASC', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const otherOrg = freshId();
    const high = freshId(); // 60/60 = 100% compliant
    const low = freshId(); // 6/60 = 10% non_compliant
    const mid = freshId(); // 40/60 = 66.7% at_risk

    await insertCredit({ personId: high, organizationId: org, creditAmount: 60 });
    await insertCredit({ personId: low, organizationId: org, creditAmount: 6 });
    await insertCredit({ personId: mid, organizationId: org, creditAmount: 40 });
    // Another org's member must not appear and must not inflate the count.
    await insertCredit({ personId: freshId(), organizationId: otherOrg, creditAmount: 99 });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    expect(r.total).toBe(3);
    // ORDER BY compliance_percent ASC → low (10) < mid (66.7) < high (100).
    expect(r.data.map((d) => d.personId)).toEqual([low, mid, high]);
    expect(r.data.every((d) => d.organizationId === org)).toBe(true);

    // Aggregate + threshold math read back through the matview.
    const lowRow = r.data[0]!;
    expect(lowRow.totalCredits).toBe(6);
    expect(lowRow.compliancePercent).toBe(10);
    expect(lowRow.complianceStatus).toBe('non_compliant');
    expect(lowRow.requiredCredits).toBe(60); // default, no org_cpd_config row
    expect(lowRow.entryCount).toBe(1);

    const midRow = r.data[1]!;
    expect(midRow.compliancePercent).toBe(66.7); // ROUND((40/60)*100,1)
    expect(midRow.complianceStatus).toBe('at_risk'); // >= 60*0.6 (36)

    const highRow = r.data[2]!;
    expect(highRow.compliancePercent).toBe(100);
    expect(highRow.complianceStatus).toBe('compliant');
  });

  test('status filter narrows the result set AND the count', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const compliantPerson = freshId();
    const nonCompliantA = freshId();
    const nonCompliantB = freshId();
    await insertCredit({ personId: compliantPerson, organizationId: org, creditAmount: 60 });
    await insertCredit({ personId: nonCompliantA, organizationId: org, creditAmount: 1 });
    await insertCredit({ personId: nonCompliantB, organizationId: org, creditAmount: 2 });
    await refreshMatview();

    const r = await repo.getByOrganization(org, { status: 'non_compliant' });
    expect(r.total).toBe(2);
    expect(new Set(r.data.map((d) => d.personId))).toEqual(
      new Set([nonCompliantA, nonCompliantB]),
    );
    expect(r.data.every((d) => d.complianceStatus === 'non_compliant')).toBe(true);

    const compliant = await repo.getByOrganization(org, { status: 'compliant' });
    expect(compliant.total).toBe(1);
    expect(compliant.data[0]!.personId).toBe(compliantPerson);
  });

  test('limit + offset paginate while total reflects the full filtered set', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    // 4 members, distinct compliance_percent so ASC ordering is deterministic.
    const p10 = freshId(); // 6/60 = 10%
    const p20 = freshId(); // 12/60 = 20%
    const p30 = freshId(); // 18/60 = 30%
    const p40 = freshId(); // 24/60 = 40%
    await insertCredit({ personId: p10, organizationId: org, creditAmount: 6 });
    await insertCredit({ personId: p20, organizationId: org, creditAmount: 12 });
    await insertCredit({ personId: p30, organizationId: org, creditAmount: 18 });
    await insertCredit({ personId: p40, organizationId: org, creditAmount: 24 });
    await refreshMatview();

    const page1 = await repo.getByOrganization(org, { limit: 2, offset: 0 });
    expect(page1.total).toBe(4); // count ignores LIMIT/OFFSET
    expect(page1.data.map((d) => d.personId)).toEqual([p10, p20]);

    const page2 = await repo.getByOrganization(org, { limit: 2, offset: 2 });
    expect(page2.total).toBe(4);
    expect(page2.data.map((d) => d.personId)).toEqual([p30, p40]);
  });

  test('only active+verified credits feed the standing; voided/pending/rejected excluded', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const person = freshId();
    await insertCredit({ personId: person, organizationId: org, creditAmount: 10, status: 'active', verificationStatus: 'verified' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 100, status: 'voided', verificationStatus: 'verified' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 100, status: 'active', verificationStatus: 'pending' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 100, status: 'active', verificationStatus: 'rejected' });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    expect(r.total).toBe(1);
    expect(r.data[0]!.totalCredits).toBe(10); // only the active+verified 10 counted
    expect(r.data[0]!.entryCount).toBe(1);
  });

  test('a person whose only credits are non-qualifying does not appear at all', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const ghost = freshId();
    await insertCredit({ personId: ghost, organizationId: org, creditAmount: 50, status: 'voided' });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    expect(r.total).toBe(0);
    expect(r.data).toEqual([]);
  });

  test('category FILTER buckets (general/major/sdl) sum independently; uncategorized excluded from all three', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const person = freshId();
    await insertCredit({ personId: person, organizationId: org, creditAmount: 3, category: 'General' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 2, category: 'General' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 4, category: 'Major' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 1, category: 'Self-Directed' });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 5, category: null });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    const row = r.data[0]!;
    expect(row.generalCredits).toBe(5); // 3 + 2
    expect(row.majorCredits).toBe(4);
    expect(row.sdlCredits).toBe(1);
    // total includes the uncategorized 5: 3+2+4+1+5 = 15.
    expect(row.totalCredits).toBe(15);
    // General+Major+SDL = 10, leaving 5 unbucketed → total > sum of buckets.
    expect(row.generalCredits + row.majorCredits + row.sdlCredits).toBe(10);
  });

  test('org_cpd_config override drives required_credits + the compliance threshold', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const person = freshId();
    // 20 credits against a 20-credit requirement → exactly compliant (100%).
    await insertCpdConfig({ organizationId: org, requiredCredits: 20, sdlCapPercent: 25 });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 20 });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    const row = r.data[0]!;
    expect(row.requiredCredits).toBe(20); // override, not the default 60
    expect(row.sdlCapPercent).toBe(25);
    expect(row.compliancePercent).toBe(100);
    expect(row.complianceStatus).toBe('compliant'); // 20 >= 20

    // The SAME 20 credits under the DEFAULT 60-credit rule (no org_cpd_config
    // row) fall below 60*0.6 = 36, so they read as non_compliant — proving the
    // config LEFT JOIN actually changed the threshold, not just the label.
    const defaultOrg = freshId();
    await insertCredit({ personId: freshId(), organizationId: defaultOrg, creditAmount: 20 });
    await refreshMatview();
    const def = await repo.getByOrganization(defaultOrg);
    expect(def.data[0]!.requiredCredits).toBe(60);
    expect(def.data[0]!.complianceStatus).toBe('non_compliant'); // 20 < 36
    expect(def.data[0]!.compliancePercent).toBe(33.3); // ROUND((20/60)*100,1)
  });

  test('last_credit_at maps from MAX(updated_at) across the person\'s entries; fractional credits preserved', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const person = freshId();
    const oldest = new Date('2026-02-01T00:00:00.000Z');
    const newest = new Date('2026-08-15T00:00:00.000Z');
    await insertCredit({ personId: person, organizationId: org, creditAmount: 1.5, updatedAt: oldest });
    await insertCredit({ personId: person, organizationId: org, creditAmount: 2.5, updatedAt: newest });
    await refreshMatview();

    const r = await repo.getByOrganization(org);
    const row = r.data[0]!;
    // float8 half-credit math survives the matview SUM.
    expect(row.totalCredits).toBe(4);
    expect(row.lastCreditAt).toBeInstanceOf(Date);
    expect(row.lastCreditAt!.getTime()).toBe(newest.getTime());
  });

  test('empty org → total 0 and empty data array', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const r = await repo.getByOrganization(freshId());
    expect(r.total).toBe(0);
    expect(r.data).toEqual([]);
  });
});

// ─── getOrgSummary (FILTER tallies + complianceRate math) ─────────────────────

describe('ComplianceRepository.getOrgSummary (real DB)', () => {
  test('tallies members by status and computes the rounded compliance rate', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    // 2 compliant (>=60), 1 at_risk (>=36 & <60), 1 non_compliant (<36).
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 60 });
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 70 });
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 40 });
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 5 });
    // Different org member must not leak into the tallies.
    await insertCredit({ personId: freshId(), organizationId: freshId(), creditAmount: 100 });
    await refreshMatview();

    const s = await repo.getOrgSummary(org);
    expect(s.totalMembers).toBe(4);
    expect(s.compliant).toBe(2);
    expect(s.atRisk).toBe(1);
    expect(s.nonCompliant).toBe(1);
    // round(2/4 * 100) = 50.
    expect(s.complianceRate).toBe(50);
  });

  test('compliance rate rounds to nearest integer', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    // 1 compliant of 3 → 33.33% → rounds to 33.
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 60 });
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 1 });
    await insertCredit({ personId: freshId(), organizationId: org, creditAmount: 2 });
    await refreshMatview();

    const s = await repo.getOrgSummary(org);
    expect(s.totalMembers).toBe(3);
    expect(s.compliant).toBe(1);
    expect(s.complianceRate).toBe(33); // Math.round(33.33)
  });

  test('zero members → complianceRate 0 (no divide-by-zero)', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const s = await repo.getOrgSummary(freshId());
    expect(s).toEqual({
      totalMembers: 0,
      compliant: 0,
      atRisk: 0,
      nonCompliant: 0,
      complianceRate: 0,
    });
  });
});

// ─── refresh (REFRESH MATERIALIZED VIEW CONCURRENTLY) ─────────────────────────

describe('ComplianceRepository.refresh (real DB)', () => {
  test('CONCURRENTLY refresh re-materializes new active+verified credits into standings', async () => {
    if (!H.dbReachable) return;
    const repo = new ComplianceRepository(H.db as any);
    const org = freshId();
    const person = freshId();

    // Seed + populate so the matview is non-empty (CONCURRENTLY requires a prior
    // populate and the unique index, both present).
    await insertCredit({ personId: person, organizationId: org, creditAmount: 10 });
    await refreshMatview();
    let r = await repo.getByOrganization(org);
    expect(r.data[0]!.totalCredits).toBe(10);

    // Add more credits, then refresh THROUGH the repo (CONCURRENTLY path).
    await insertCredit({ personId: person, organizationId: org, creditAmount: 5 });
    await repo.refresh();

    r = await repo.getByOrganization(org);
    expect(r.data[0]!.totalCredits).toBe(15); // refresh picked up the new row
    expect(r.data[0]!.entryCount).toBe(2);
  });
});
