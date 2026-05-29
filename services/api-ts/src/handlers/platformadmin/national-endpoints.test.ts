/**
 * M14 National Dashboard — granular endpoint handler tests (Wave 14).
 *
 * Covers the three endpoints added to close the missing-endpoint P1s plus the
 * DashboardExported domain event:
 *   - listNationalChapters       (GET /admin/national/chapters)
 *   - getNationalChapterDetail   (GET /admin/national/chapters/{organizationId})
 *   - getPlatformSummary         (GET /admin/national/platform)
 *   - dashboard.exported event   (exportNationalDashboard)
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { listNationalChapters } from './listNationalChapters';
import { getNationalChapterDetail } from './getNationalChapterDetail';
import { getPlatformSummary } from './getPlatformSummary';
import { exportNationalDashboard } from '@/handlers/association:operations/exportNationalDashboard';
import { domainEvents } from '@/core/domain-events';

function snap(overrides: Record<string, any> = {}) {
  return {
    orgId: 'org-1',
    associationId: 'assoc-1',
    snapshotMonth: '2026-05',
    totalMembers: 100,
    activeMembers: 80,
    graceMembers: 10,
    lapsedMembers: 7,
    suspendedMembers: 3,
    collectionRate: 0.85,
    totalCollected: 5000,
    totalExpected: 6000,
    cpdComplianceRate: 0.9,
    avgCreditsPerMember: 12,
    activityCount90d: 5,
    ...overrides,
  };
}

const PA = { id: 'admin-1', role: 'platform_admin' };
const OFFICER = { id: 'officer-1', role: 'member' };

describe('listNationalChapters', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      getOrgNames: async () => new Map([['org-1', 'Big Chapter'], ['org-2', 'Tiny Chapter']]),
      isDesignatedNationalOfficer: async () => true,
      getOfficerAssociationIds: async () => ['assoc-1'],
      listChapterSnapshots: async () => [
        snap({ orgId: 'org-1', totalMembers: 100 }),
        snap({ orgId: 'org-2', totalMembers: 3, activeMembers: 2, totalCollected: 100 }),
      ],
    });
  });
  afterEach(() => restoreRepo(DashboardRepository));

  test('401 without session', async () => {
    const ctx = makeCtx({ user: null, session: null, _query: { associationId: 'assoc-1' } });
    expect(listNationalChapters(ctx)).rejects.toThrow();
  });

  test('platform admin must supply associationId', async () => {
    const ctx = makeCtx({ user: PA, _query: {} });
    expect(listNationalChapters(ctx)).rejects.toThrow(/associationId/);
  });

  test('returns mapped chapter rows for platform admin', async () => {
    const ctx = makeCtx({ user: PA, _query: { associationId: 'assoc-1' } });
    const res: any = await listNationalChapters(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const big = res.body.data.find((c: any) => c.organizationId === 'org-1');
    expect(big.organizationName).toBe('Big Chapter');
    expect(big.collectionRate).toBeCloseTo(85);
    expect(big.totalRevenueCents).toBe(500000);
    expect(res.body.meta.total).toBe(2);
  });

  test('suppresses chapters with <5 members (M14-R2)', async () => {
    const ctx = makeCtx({ user: PA, _query: { associationId: 'assoc-1' } });
    const res: any = await listNationalChapters(ctx);
    const tiny = res.body.data.find((c: any) => c.organizationId === 'org-2');
    expect(tiny.isSuppressed).toBe(true);
    expect(tiny.collectionRate).toBe(0);
    expect(tiny.activeMembers).toBe(0);
  });

  test('national officer with single grant infers associationId', async () => {
    const ctx = makeCtx({ user: OFFICER, _query: {} });
    const res: any = await listNationalChapters(ctx);
    expect(res.status).toBe(200);
  });

  test('sorts ascending by totalMembers when requested', async () => {
    const ctx = makeCtx({ user: PA, _query: { associationId: 'assoc-1', sort: 'totalMembers' } });
    const res: any = await listNationalChapters(ctx);
    expect(res.body.data[0].organizationId).toBe('org-2'); // smaller first
  });
});

describe('getNationalChapterDetail', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      getOrgNames: async () => new Map([['org-1', 'Big Chapter']]),
      isDesignatedNationalOfficer: async () => true,
      getOfficerAssociationIds: async () => ['assoc-1'],
      getChapterSnapshot: async () => snap(),
    });
  });
  afterEach(() => restoreRepo(DashboardRepository));

  test('404 when snapshot missing', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      getOrgNames: async () => new Map(),
      isDesignatedNationalOfficer: async () => true,
      getChapterSnapshot: async () => undefined,
    });
    const ctx = makeCtx({ user: PA, _params: { organizationId: 'org-x' }, _query: { associationId: 'assoc-1' } });
    expect(getNationalChapterDetail(ctx)).rejects.toThrow();
  });

  test('returns drill-down with breakdowns', async () => {
    const ctx = makeCtx({ user: PA, _params: { organizationId: 'org-1' }, _query: { associationId: 'assoc-1' } });
    const res: any = await getNationalChapterDetail(ctx);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.memberStatusBreakdown).toEqual({ active: 80, grace: 10, lapsed: 7, suspended: 3 });
    expect(d.creditComplianceBreakdown.compliant).toBe(90);
    expect(d.creditComplianceBreakdown.nonCompliant).toBe(10);
    expect(d.collectionRate).toBeCloseTo(85);
  });
});

describe('getPlatformSummary', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      getOrgNames: async () => new Map([['assoc-1', 'National A'], ['assoc-2', 'National B']]),
      listAssociationIdsForMonth: async () => ['assoc-1', 'assoc-2'],
      getAssociationAggregate: async (associationId: string) => ({
        associationId,
        snapshotMonth: '2026-05',
        chapterCount: 2,
        totalMembers: associationId === 'assoc-1' ? 300 : 100,
        activeMembers: 200,
        graceMembers: 0,
        lapsedMembers: 0,
        suspendedMembers: 0,
        collectionRate: 0.8,
        totalCollected: 1000,
        totalExpected: 1250,
        cpdComplianceRate: 0.75,
        avgCreditsPerMember: 10,
        totalActivityCount90d: 9,
      }),
    });
  });
  afterEach(() => restoreRepo(DashboardRepository));

  test('403 for non-platform-admin', async () => {
    const ctx = makeCtx({ user: OFFICER, _query: {} });
    expect(getPlatformSummary(ctx)).rejects.toThrow();
  });

  test('returns per-association rows sorted by totalMembers desc', async () => {
    const ctx = makeCtx({ user: PA, _query: {} });
    const res: any = await getPlatformSummary(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].associationId).toBe('assoc-1'); // 300 > 100
    expect(res.body.data[0].collectionRate).toBeCloseTo(80);
    expect(res.body.data[0].totalRevenueCents).toBe(100000);
  });
});

describe('exportNationalDashboard — dashboard.exported event', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      listChapterSnapshots: async () => [snap()],
      createExportLog: async () => ({ id: 'export-1' }),
    });
  });
  afterEach(() => restoreRepo(DashboardRepository));

  test('emits dashboard.exported with associationId, format, exportedBy', async () => {
    const received: any[] = [];
    const listener = (payload: any) => { received.push(payload); };
    domainEvents.on('dashboard.exported', listener);

    const ctx = makeCtx({
      user: PA,
      _params: { associationId: 'assoc-1' },
      _body: { snapshotMonth: '2026-05', format: 'csv' },
    });
    await exportNationalDashboard(ctx);
    // emit is fire-and-forget; allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 0));

    domainEvents.off('dashboard.exported', listener);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      exportId: 'export-1',
      associationId: 'assoc-1',
      format: 'csv',
      exportedBy: 'admin-1',
    });
  });
});
