/**
 * getNationalChapterDetail — REAL-PG suppression + aggregation (B4 platformadmin S3).
 *
 * The existing mock test (national-endpoints.test.ts:102, stubRepo) proves the
 * handler's branches at 100% line — but every number is asserted against a
 * hand-fed snap() stub. This suite upgrades that to REAL-PG: a persisted
 * chapter_snapshot row read back through DashboardRepository.getChapterSnapshot,
 * a real national_dashboard_access grant resolved through resolveAssociationAccess,
 * and the organizationName resolved through real getOrgNames against a seeded
 * organization row. It proves the suppression-zeroing privacy guarantee
 * (M14-R2), the cents/pct/compliance math, the assoc-scoped 404 branch, and the
 * audit-ctx contract against actual Postgres rows — not a stub.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { makeCtx } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { getNationalChapterDetail } from './getNationalChapterDetail';

const ASSOC_A = '11111111-1111-1111-1111-111111111111';
const ASSOC_B = '22222222-2222-2222-2222-222222222222';
const ORG_BIG = '33333333-3333-3333-3333-333333333333';
const ORG_TINY = '44444444-4444-4444-4444-444444444444';
const OFFICER_ID = '55555555-5555-5555-5555-555555555555';
const GRANTER_ID = '66666666-6666-6666-6666-666666666666';
const MONTH = '2026-05';

let H: ScratchDb;

async function seedOrg(id: string, name: string, associationId: string, slug: string): Promise<void> {
  await H.scopedPool.query(
    `INSERT INTO "${H.schema}".organization (id, association_id, name, slug, org_type, status)
     VALUES ($1, $2, $3, $4, 'chapter', 'active')`,
    [id, associationId, name, slug],
  );
}

beforeAll(async () => {
  H = await createScratch(['chapter_snapshot', 'national_dashboard_access', 'organization']);
  if (!H.dbReachable) return;

  const repo = new DashboardRepository(H.db as never);

  await seedOrg(ORG_BIG, 'Big Chapter', ASSOC_A, 'big-chapter');
  await seedOrg(ORG_TINY, 'Tiny Chapter', ASSOC_A, 'tiny-chapter');

  // Above-suppression snapshot (100 members).
  await repo.createChapterSnapshot({
    orgId: ORG_BIG,
    associationId: ASSOC_A,
    snapshotMonth: MONTH,
    totalMembers: 100,
    activeMembers: 80,
    graceMembers: 10,
    lapsedMembers: 7,
    suspendedMembers: 3,
    cpdComplianceRate: '0.9',
    totalCollected: '5000',
    collectionRate: '0.85',
    activityCount90d: 12,
  });

  // Below-suppression snapshot (4 members < SMALL_CHAPTER_THRESHOLD of 5).
  await repo.createChapterSnapshot({
    orgId: ORG_TINY,
    associationId: ASSOC_A,
    snapshotMonth: MONTH,
    totalMembers: 4,
    activeMembers: 3,
    graceMembers: 1,
    lapsedMembers: 0,
    suspendedMembers: 0,
    cpdComplianceRate: '0.5',
    totalCollected: '999',
    collectionRate: '0.99',
    activityCount90d: 7,
  });

  // National officer grant scoped to association A only (BR-36).
  await repo.grantNationalAccess({
    associationId: ASSOC_A,
    memberId: OFFICER_ID,
    grantedBy: GRANTER_ID,
  });
});

afterAll(async () => {
  await H?.teardown();
});

const officer = { id: OFFICER_ID, role: 'officer' };

describe('getNationalChapterDetail — real-PG above-suppression aggregation', () => {
  test('reads a persisted snapshot back and computes the drill-down math', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({
      user: officer,
      database: H.db,
      _params: { organizationId: ORG_BIG },
      _query: { associationId: ASSOC_A, snapshotMonth: MONTH },
    });

    const res: any = await getNationalChapterDetail(ctx);
    expect(res.status).toBe(200);
    const d = res.body.data;

    // organizationName resolved via real getOrgNames against the seeded org row.
    expect(d.organizationName).toBe('Big Chapter');
    expect(d.totalMembers).toBe(100);
    expect(d.isSuppressed).toBe(false);

    // member status breakdown straight from the persisted columns.
    expect(d.memberStatusBreakdown).toEqual({ active: 80, grace: 10, lapsed: 7, suspended: 3 });
    expect(d.activeMembers).toBe(80);

    // compliant = round(cpdRate * totalMembers) = round(0.9 * 100) = 90.
    expect(d.creditComplianceBreakdown.compliant).toBe(90);
    expect(d.creditComplianceBreakdown.nonCompliant).toBe(10);
    expect(d.creditComplianceBreakdown.exempt).toBe(0);
    expect(d.creditCompliance).toBeCloseTo(90); // cpdRate * 100

    // collectionRate = 0.85 * 100 = 85.
    expect(d.collectionRate).toBeCloseTo(85);

    // totalRevenueCents = toCents(5000) = 500000.
    expect(d.totalRevenueCents).toBe(500000);

    // eventCount from activity_count_90d.
    expect(d.eventCount).toBe(12);
    expect(d.snapshotMonth).toBe(MONTH);
  });

  test('audit-ctx contract: auditResourceId === organizationId', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({
      user: officer,
      database: H.db,
      _params: { organizationId: ORG_BIG },
      _query: { associationId: ASSOC_A, snapshotMonth: MONTH },
    });
    await getNationalChapterDetail(ctx);
    expect(ctx.get('auditResourceId')).toBe(ORG_BIG);
    expect(ctx.get('auditDescription')).toContain(ORG_BIG);
    expect(ctx.get('auditDetails')).toEqual({ associationId: ASSOC_A, snapshotMonth: MONTH });
  });
});

describe('getNationalChapterDetail — real-PG suppression zeroing (M14-R2)', () => {
  test('a below-threshold chapter zeroes EVERY suppressed field', async () => {
    if (!H.dbReachable) return;
    const ctx = makeCtx({
      user: officer,
      database: H.db,
      _params: { organizationId: ORG_TINY },
      _query: { associationId: ASSOC_A, snapshotMonth: MONTH },
    });

    const res: any = await getNationalChapterDetail(ctx);
    expect(res.status).toBe(200);
    const d = res.body.data;

    // totalMembers is NOT suppressed (it's the size signal itself), but the trip fires.
    expect(d.totalMembers).toBe(4);
    expect(d.isSuppressed).toBe(true);

    // Every member-level field zeroed despite real non-zero persisted values.
    expect(d.activeMembers).toBe(0);
    expect(d.activePercentage).toBe(0);
    expect(d.collectionRate).toBe(0);
    expect(d.totalRevenueCents).toBe(0);
    expect(d.creditCompliance).toBe(0);
    expect(d.eventCount).toBe(0);
    expect(d.memberStatusBreakdown).toEqual({ active: 0, grace: 0, lapsed: 0, suspended: 0 });
    expect(d.creditComplianceBreakdown).toEqual({ compliant: 0, nonCompliant: 0, exempt: 0 });
  });
});

describe('getNationalChapterDetail — assoc-scoped 404 on real rows', () => {
  test('snapshot under association A is invisible to an A-scoped query for a B caller path', async () => {
    if (!H.dbReachable) return;
    // The snapshot lives under association A. Query it scoped to association B
    // (as a platform admin who passes B explicitly) → getChapterSnapshot's
    // assoc-scoped WHERE returns undefined → NotFoundError('Chapter').
    const pa = { id: GRANTER_ID, role: 'platform_admin' };
    const ctx = makeCtx({
      user: pa,
      database: H.db,
      _params: { organizationId: ORG_BIG },
      _query: { associationId: ASSOC_B, snapshotMonth: MONTH },
    });

    await expect(getNationalChapterDetail(ctx)).rejects.toThrow('Chapter');
  });

  test('direct getChapterSnapshot returns undefined for the wrong association', async () => {
    if (!H.dbReachable) return;
    const repo = new DashboardRepository(H.db as never);
    const wrong = await repo.getChapterSnapshot(ORG_BIG, MONTH, ASSOC_B);
    expect(wrong).toBeUndefined();
    const right = await repo.getChapterSnapshot(ORG_BIG, MONTH, ASSOC_A);
    expect(right?.totalMembers).toBe(100);
  });
});
