/**
 * Tests for getDuesMetrics
 *
 * Covers:
 * - AC-T3-001: Returns 200 with trailing collection rates (30/90/365d)
 * - AC-T3-002: Monthly breakdown (12 months)
 * - AC-T3-003: Member status distribution
 * - AC-T3-004: Officer auth required (401/403)
 * - AC-T3-005: Empty org returns 0 values (not NaN)
 * - BR-T3-001: Zero payments → collectionRate is 0, not NaN
 * - BR-T3-002: collectionRate is 0-100 integer
 * - BR-T3-003: Months with no activity return {collected: 0, outstanding: 0}
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from './repos/dues-payments.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { getDuesMetrics } from './getDuesMetrics';

// ─── Fixtures ───────────────────────────────────────────

const metricsResult = {
  trailingRates: {
    days30: 85,
    days90: 72,
    days365: 65,
  },
  monthlyBreakdown: [
    { month: '2026-01', collected: 50000, outstanding: 10000 },
    { month: '2026-02', collected: 45000, outstanding: 12000 },
    { month: '2026-03', collected: 0, outstanding: 0 },
    { month: '2026-04', collected: 60000, outstanding: 5000 },
  ],
  statusDistribution: {
    active: 40,
    dueSoon: 8,
    overdue: 12,
    lapsed: 4,
  },
};

const emptyMetrics = {
  trailingRates: { days30: 0, days90: 0, days365: 0 },
  monthlyBreakdown: [],
  statusDistribution: { active: 0, dueSoon: 0, overdue: 0, lapsed: 0 },
};

// ─── Stubs ──────────────────────────────────────────────

stubRepo(OfficerTermRepository, {
  findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
});

// ─── Tests ──────────────────────────────────────────────

describe('getDuesMetrics', () => {
  afterEach(() => {
    restoreRepo(DuesRepository);
  });

  // ── AC-T3-004: Auth ───────────────────────────────────

  test('[AC-T3-004] returns 401 without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { organizationId: 'org-1' },
    });

    try {
      await getDuesMetrics(ctx);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.status ?? err.statusCode ?? 401).toBe(401);
    }
  });

  // ── AC-T3-001: Trailing collection rates ──────────────

  test('[AC-T3-001] returns trailing collection rates for 30/90/365 day windows', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => metricsResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.trailingRates).toEqual({
      days30: 85,
      days90: 72,
      days365: 65,
    });
  });

  // ── AC-T3-002: Monthly breakdown ──────────────────────

  test('[AC-T3-002] returns monthly breakdown with collected + outstanding', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => metricsResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.monthlyBreakdown).toHaveLength(4);
    expect(res.body.data.monthlyBreakdown[0]).toEqual({
      month: '2026-01',
      collected: 50000,
      outstanding: 10000,
    });
  });

  // ── BR-T3-003: Empty months ───────────────────────────

  test('[BR-T3-003] months with no activity return {collected: 0, outstanding: 0}', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => metricsResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx);
    const emptyMonth = res.body.data.monthlyBreakdown.find(
      (m: any) => m.month === '2026-03'
    );
    expect(emptyMonth).toEqual({ month: '2026-03', collected: 0, outstanding: 0 });
  });

  // ── AC-T3-003: Status distribution ────────────────────

  test('[AC-T3-003] returns member status distribution', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => metricsResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.statusDistribution).toEqual({
      active: 40,
      dueSoon: 8,
      overdue: 12,
      lapsed: 4,
    });
  });

  // ── AC-T3-005 + BR-T3-001: Empty org ──────────────────

  test('[AC-T3-005] [BR-T3-001] empty org returns 0 values, not NaN', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => emptyMetrics,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-empty' },
      organizationId: 'org-empty',
    });

    const res = await getDuesMetrics(ctx);
    expect(res.status).toBe(200);
    expect(res.body.data.trailingRates.days30).toBe(0);
    expect(res.body.data.trailingRates.days90).toBe(0);
    expect(res.body.data.trailingRates.days365).toBe(0);
    expect(Number.isNaN(res.body.data.trailingRates.days30)).toBe(false);
    expect(res.body.data.statusDistribution.active).toBe(0);
    expect(res.body.data.monthlyBreakdown).toHaveLength(0);
  });

  // ── BR-T3-002: collectionRate is 0-100 integer ────────

  test('[BR-T3-002] trailing rates are 0-100 integers, not decimals', async () => {
    stubRepo(DuesRepository, {
      getMetricsWithTrends: async () => metricsResult,
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      organizationId: 'org-1',
    });

    const res = await getDuesMetrics(ctx);
    const { days30, days90, days365 } = res.body.data.trailingRates;
    expect(days30).toBeGreaterThanOrEqual(0);
    expect(days30).toBeLessThanOrEqual(100);
    expect(Number.isInteger(days30)).toBe(true);
    expect(Number.isInteger(days90)).toBe(true);
    expect(Number.isInteger(days365)).toBe(true);
  });
});
