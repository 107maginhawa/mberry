/**
 * getPlatformSummary — characterization tests
 *
 * Path: GET /admin/national/platform
 * Auth: platform_admin only (M14-R1)
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DashboardRepository } from './repos/dashboard.repo';
import { getPlatformSummary } from './getPlatformSummary';

const fakeAggregate = {
  totalMembers: 100,
  activeMembers: 80,
  collectionRate: 85,
  totalCollected: 50000,
  totalExpected: 58823,
  cpdComplianceRate: 70,
  avgCreditsPerMember: 12,
  totalActivityCount90d: 200,
};

describe('getPlatformSummary (characterization)', () => {
  beforeEach(() => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      listAssociationIdsForMonth: async () => ['assoc-1', 'assoc-2'],
      getOrgNames: async () => new Map([['assoc-1', 'PDA'], ['assoc-2', 'PMA']]),
      getAssociationAggregate: async () => fakeAggregate,
    });
  });

  afterEach(() => {
    restoreRepo(DashboardRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(getPlatformSummary(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-platform-admin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' } });
    await expect(getPlatformSummary(ctx)).rejects.toThrow();
  });

  test('returns 200 with platform summary for platform_admin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'platform_admin' } });
    const res = await getPlatformSummary(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data).toBeDefined();
  });

  test('returns 200 for super admin role', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'super' } });
    const res = await getPlatformSummary(ctx);
    expect(res.status).toBe(200);
  });

  test('returns empty associations array when none found for month', async () => {
    restoreRepo(DashboardRepository);
    stubRepo(DashboardRepository, {
      listAssociationIdsForMonth: async () => [],
      getOrgNames: async () => new Map(),
      getAssociationAggregate: async () => fakeAggregate,
    });
    const ctx = makeCtx({ user: { id: 'user-1', role: 'platform_admin' } });
    const res = await getPlatformSummary(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    // data is the page array (list of association summaries)
    expect(Array.isArray(body?.data)).toBe(true);
    expect(body?.data).toHaveLength(0);
  });
});
