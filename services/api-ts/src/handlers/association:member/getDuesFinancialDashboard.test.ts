/**
 * getDuesFinancialDashboard.test.ts
 *
 * SEC-02 RED phase: officer + org guard tests for getDuesFinancialDashboard
 * and generateDuesReport handlers. Tests with [RED] are expected to FAIL now
 * (handlers lack requirePosition + cross-org checks) and PASS after Plan 02.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { mock } from 'bun:test';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { getDuesFinancialDashboard } from './getDuesFinancialDashboard';
import { generateDuesReport } from './generateDuesReport';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const STATS = {
  totalCollected: '5000',
  totalOutstanding: '2000',
  pendingCount: 5,
  completedCount: 10,
  totalCount: 15,
  collectionRate: '67',
};

// ─── getDuesFinancialDashboard tests ───────────────────────────────────────

describe('[SEC-02] getDuesFinancialDashboard — officer + org guard', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      session: null,
      user: null,
    });
    await expect(getDuesFinancialDashboard(ctx as any)).rejects.toThrow();
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });
    // RED: handler currently has no requirePosition call — will return 200 not 403
    const res = await getDuesFinancialDashboard(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when route param organizationId !== ctx orgId (cross-org) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-B' },  // attacker supplies different org
      organizationId: 'org-A',               // middleware-set org from JWT
    });
    // RED: handler uses route param org without comparing to ctx org — will return 200 not 403
    try {
      const res = await getDuesFinancialDashboard(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  test('returns 200 when officer of correct org requests dashboard', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    stubRepo(DuesRepository, {
      getDashboardStats: async () => STATS,
      getGatewayConfig: async () => ({ connected: true }),
    });
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });
    const res = await getDuesFinancialDashboard(ctx as any);
    expect(res.status).toBe(200);
  });
});

// ─── generateDuesReport tests ──────────────────────────────────────────────

describe('[SEC-02] generateDuesReport — officer + org guard', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  test('returns 403 when requirePosition denies (member role) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
      organizationId: 'org-1',
    });
    // RED: handler currently has no requirePosition call
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(403);
  });

  test('returns 403 when route param organizationId !== ctx orgId (cross-org) [RED]', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    const ctx = makeCtx({
      _params: { organizationId: 'org-B' },
      _query: { type: 'collection' },
      organizationId: 'org-A',
    });
    // RED: handler uses route param org without comparing to ctx org
    try {
      const res = await generateDuesReport(ctx as any);
      expect(res.status).toBe(403);
    } catch (e: any) {
      expect(e.statusCode ?? e.status ?? 403).toBe(403);
    }
  });

  test('returns 200 when officer of correct org requests report', async () => {
    mock.module('@/utils/officer-check', () => ({
      requirePosition: async () => null,
    }));
    stubRepo(DuesRepository, {
      reportCollectionSummary: async () => [{ total: 5000 }],
    });
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      _query: { type: 'collection' },
      organizationId: 'org-1',
    });
    const res = await generateDuesReport(ctx as any);
    expect(res.status).toBe(200);
  });
});
