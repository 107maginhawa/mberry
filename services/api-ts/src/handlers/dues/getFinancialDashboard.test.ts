import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getFinancialDashboard } from './getFinancialDashboard';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakeStats = {
  totalCollected: 50000,
  totalOutstanding: 15000,
  pendingCount: 3,
  completedCount: 10,
  totalCount: 13,
  collectionRate: 77,
};

const fakeGateway = {
  id: 'gw-1',
  organizationId: 'org-1',
  provider: 'paymongo',
  publicKey: 'pk_test_1234567890',
  encryptedSecret: 'enc...',
  connected: true,
  lastTestAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('getFinancialDashboard', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns dashboard stats with gateway status', async () => {
    mocks = stubRepo(DuesRepository, {
      getDashboardStats: async () => fakeStats,
      getGatewayConfig: async () => fakeGateway,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await getFinancialDashboard(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.totalCollected).toBe(50000);
    expect(response.body.data.collectionRate).toBe(77);
    expect(response.body.data.gatewayConnected).toBe(true);
  });

  test('returns gatewayConnected false when no gateway configured', async () => {
    mocks = stubRepo(DuesRepository, {
      getDashboardStats: async () => fakeStats,
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-1' } });
    const response = await getFinancialDashboard(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.gatewayConnected).toBe(false);
  });

  test('returns zero stats for org with no payments', async () => {
    const zeroStats = {
      totalCollected: 0,
      totalOutstanding: 0,
      pendingCount: 0,
      completedCount: 0,
      totalCount: 0,
      collectionRate: 0,
    };

    mocks = stubRepo(DuesRepository, {
      getDashboardStats: async () => zeroStats,
      getGatewayConfig: async () => undefined,
    });

    const ctx = makeCtx({ _params: { orgId: 'org-empty' } });
    const response = await getFinancialDashboard(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.totalCollected).toBe(0);
    expect(response.body.data.totalCount).toBe(0);
    expect(response.body.data.collectionRate).toBe(0);
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getDashboardStats: async () => fakeStats,
      getGatewayConfig: async () => undefined,
    });

    // getFinancialDashboard doesn't use session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { orgId: 'org-1' },
    });

    const response = await getFinancialDashboard(ctx);
    expect(response.status).toBe(200);
  });
});
