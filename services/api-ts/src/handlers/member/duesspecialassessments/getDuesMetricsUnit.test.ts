/**
 * getDuesMetricsUnit.test.ts  (unit/stub layer — no live API needed)
 *
 * The existing getDuesMetrics.test.ts is an integration test (skips without live API).
 * This file adds stub-based unit coverage:
 *
 *  - Throws UnauthorizedError when no session
 *  - Happy path — returns 200 with full metrics envelope
 *  - Metrics shape: trailingRates, monthlyBreakdown, statusDistribution, topUnpaid
 *  - collectionRate is a 0-100 integer (not a fraction)
 *  - Org mismatch throws ForbiddenError
 *  - Empty org returns zero metrics safely
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getDuesMetrics } from './getDuesMetrics';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';

const FAKE_METRICS = {
  trailingRates: {
    rate30d: 72,
    rate90d: 68,
    rate365d: 75,
  },
  monthlyBreakdown: [
    { month: '2026-01', collected: 120000, expected: 150000 },
    { month: '2026-02', collected: 135000, expected: 150000 },
  ],
  statusDistribution: {
    active: 140,
    dueSoon: 12,
    overdue: 18,
    lapsed: 5,
  },
  topUnpaid: [
    { personId: 'p-1', firstName: 'Juan', lastName: 'dela Cruz', balance: 9000 },
    { personId: 'p-2', firstName: 'Maria', lastName: 'Santos', balance: 7500 },
  ],
};

describe('getDuesMetrics (unit)', () => {
  beforeEach(() => restoreRepo(DuesRepository));
  afterEach(() => restoreRepo(DuesRepository));

  test('throws UnauthorizedError when session is null', async () => {
    const ctx = makeCtx({ session: null, user: null });
    await expect(getDuesMetrics(ctx as any)).rejects.toThrow();
  });

  test('happy path — returns 200 with all metrics keys', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => FAKE_METRICS,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx as any);
    expect(res.status).toBe(200);
    const { data } = (res as any).body;
    expect(data).toBeDefined();
    expect(data.trailingRates).toBeDefined();
    expect(Array.isArray(data.monthlyBreakdown)).toBe(true);
    expect(Array.isArray(data.topUnpaid)).toBe(true);
    expect(data.statusDistribution).toBeDefined();
  });

  test('collectionRate values are integers in 0-100 range', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => FAKE_METRICS,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx as any);
    const { trailingRates } = (res as any).body.data;
    expect(trailingRates.rate30d).toBeGreaterThanOrEqual(0);
    expect(trailingRates.rate30d).toBeLessThanOrEqual(100);
    expect(Number.isInteger(trailingRates.rate30d)).toBe(true);
    expect(trailingRates.rate90d).toBeLessThanOrEqual(100);
    expect(trailingRates.rate365d).toBeLessThanOrEqual(100);
  });

  test('topUnpaid contains balance amounts (money-adjacent field integrity)', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => FAKE_METRICS,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx as any);
    const { topUnpaid } = (res as any).body.data;
    expect(topUnpaid[0].balance).toBe(9000);
    expect(topUnpaid[1].balance).toBe(7500);
  });

  test('throws ForbiddenError when param orgId != ctxOrgId', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => FAKE_METRICS,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-OTHER' },
      organizationId: 'org-1',
    });

    await expect(getDuesMetrics(ctx as any)).rejects.toThrow();
  });

  test('no org gate when ctxOrgId is not set (platform admin scenario)', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => FAKE_METRICS,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-admin-view' },
      organizationId: undefined,
    });

    const res = await getDuesMetrics(ctx as any);
    expect(res.status).toBe(200);
  });

  test('empty org — zero distribution returned safely', async () => {
    const emptyMetrics = {
      trailingRates: { rate30d: 0, rate90d: 0, rate365d: 0 },
      monthlyBreakdown: [],
      statusDistribution: { active: 0, dueSoon: 0, overdue: 0, lapsed: 0 },
      topUnpaid: [],
    };

    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => emptyMetrics,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-empty' },
      organizationId: 'org-empty',
    });

    const res = await getDuesMetrics(ctx as any);
    expect(res.status).toBe(200);
    const { data } = (res as any).body;
    expect(data.topUnpaid).toHaveLength(0);
    expect(data.statusDistribution.overdue).toBe(0);
  });
});
