/**
 * getNationalDashboard — characterization tests
 *
 * Path: GET /admin/national/:associationId
 * Auth: platform_admin OR designated national officer (BR-36)
 * M14-R2: Small chapters (<5 members) are suppressed into combined entry
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { getNationalDashboard } from './getNationalDashboard';

const fakeAggregate = {
  totalMembers: 100,
  activeMembers: 80,
  collectionRate: 85,
  cpdComplianceRate: 70,
};

const fakeSnapshot = {
  orgId: 'org-1',
  chapterName: 'Manila Chapter',
  totalMembers: 50,
  activeMembers: 40,
  graceMembers: 5,
  lapsedMembers: 3,
  suspendedMembers: 2,
  collectionRate: '85',
  totalCollected: '50000',
  totalExpected: '58823',
  cpdComplianceRate: '70',
  avgCreditsPerMember: '12',
  activityCount90d: 10,
};

describe('getNationalDashboard (characterization)', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      listChapterSnapshots: async () => [fakeSnapshot],
      getAssociationAggregate: async () => fakeAggregate,
      getOrgNames: async () => new Map([['org-1', 'Manila Chapter']]),
    });
  });

  afterEach(() => {
    restoreRepo(DashboardRepository);
  });

  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { associationId: 'assoc-1' } });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 when non-admin non-officer user accesses', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => false,
      listChapterSnapshots: async () => [],
      getAssociationAggregate: async () => fakeAggregate,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _params: { associationId: 'assoc-1' },
    });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 with dashboard data for platform admin', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      _params: { associationId: 'assoc-1' },
    });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data?.associationId).toBe('assoc-1');
    expect(body?.data?.chapters).toBeDefined();
    expect(body?.data?.aggregate).toBeDefined();
  });

  test('returns 200 for designated national officer', async () => {
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'member' },
      _params: { associationId: 'assoc-1' },
    });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(200);
  });

  test('M14-R2: small chapters (<5 members) are combined', async () => {
    restoreRepo(DashboardRepository);
    const smallSnapshot = { ...fakeSnapshot, orgId: 'org-small', totalMembers: 3, activeMembers: 2 };
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      listChapterSnapshots: async () => [smallSnapshot],
      getAssociationAggregate: async () => fakeAggregate,
      getOrgNames: async () => new Map([['org-small', 'Tiny Chapter']]),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      _params: { associationId: 'assoc-1' },
    });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(200);
    const chapters = (res as any).body?.data?.chapters ?? [];
    // Small chapter should be combined into 'small-chapters-combined'
    expect(chapters.some((c: any) => c.orgId === 'small-chapters-combined')).toBe(true);
    expect(chapters.some((c: any) => c.orgId === 'org-small')).toBe(false);
  });

  test('snapshotMonth defaults to current month when not provided', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'super' },
      _params: { associationId: 'assoc-1' },
    });
    const res = await getNationalDashboard(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data?.snapshotMonth).toMatch(/^\d{4}-\d{2}$/);
  });
});
