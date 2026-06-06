/**
 * listNationalChapters — characterization tests
 *
 * Path: GET /admin/national/:associationId/chapters
 * Auth: platform_admin OR designated national officer (BR-36)
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { listNationalChapters } from './listNationalChapters';

const fakeSnapshot = {
  orgId: 'org-1',
  chapterName: 'Manila Chapter',
  snapshotMonth: '2025-01',
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

describe('listNationalChapters (characterization)', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      getOfficerAssociationIds: async () => ['assoc-1'],
      listChapterSnapshots: async () => [fakeSnapshot],
      getOrgNames: async () => new Map([['org-1', 'Manila Chapter']]),
    });
  });

  afterEach(() => {
    restoreRepo(DashboardRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _query: { associationId: 'assoc-1' } });
    await expect(listNationalChapters(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError when non-admin non-officer user accesses', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => false,
      getOfficerAssociationIds: async () => [],
      listChapterSnapshots: async () => [],
      getOrgNames: async () => new Map(),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _query: { associationId: 'assoc-1' },
    });
    await expect(listNationalChapters(ctx)).rejects.toThrow();
  });

  test('returns 200 with chapters list for platform admin', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      _query: { associationId: 'assoc-1' },
    });
    const res = await listNationalChapters(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data).toBeDefined();
    expect(Array.isArray(body?.data)).toBe(true);
  });

  test('returns 200 with empty chapters when no snapshots', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      isDesignatedNationalOfficer: async () => true,
      getOfficerAssociationIds: async () => ['assoc-1'],
      listChapterSnapshots: async () => [],
      getOrgNames: async () => new Map(),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      _query: { associationId: 'assoc-1' },
    });
    const res = await listNationalChapters(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(0);
  });

  test('returns 200 for designated national officer with explicit associationId', async () => {
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'member' },
      _query: { associationId: 'assoc-1' },
    });
    const res = await listNationalChapters(ctx);
    expect(res.status).toBe(200);
  });
});
