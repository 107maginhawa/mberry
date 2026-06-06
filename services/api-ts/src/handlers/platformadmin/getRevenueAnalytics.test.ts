/**
 * getRevenueAnalytics — characterization tests
 *
 * Path: GET /admin/analytics/revenue
 * Auth: session required (no explicit admin guard — DEFECT noted)
 * Uses db.execute(sql`...`) directly.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getRevenueAnalytics } from './getRevenueAnalytics';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const fakeRevenueRow = {
  total_collected: '500000',
  paying_org_count: '12',
  avg_payment: '41666',
};

function makeRevenueCtx(overrides: Record<string, any> = {}) {
  const ctx = makeCtx(overrides);
  (ctx.req as any).url = 'http://localhost:7213/admin/analytics/revenue';
  return ctx;
}

function makeRevenueDb(row: any) {
  return {
    execute: async () => ({ rows: [row] }),
  };
}

describe('getRevenueAnalytics (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeRevenueCtx({ session: null, user: null });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 200 with revenue metrics for authenticated user', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      database: makeRevenueDb(fakeRevenueRow),
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data?.mrr).toBeDefined();
    expect(body?.data?.arr).toBeDefined();
    expect(body?.data?.currency).toBe('PHP');
  });

  test('returns 200 with zero values when no payments found', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      database: makeRevenueDb({ total_collected: '0', paying_org_count: '0', avg_payment: '0' }),
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data?.totalCollected).toBe(0);
    expect(body?.data?.payingOrgCount).toBe(0);
  });

  test('returns 500 on DB error', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      database: { execute: () => { throw new Error('DB error'); } },
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(500);
  });

  test('arr is 12x mrr', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      database: makeRevenueDb(fakeRevenueRow),
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    const body = (res as any).body;
    expect(body?.data?.arr).toBe(body?.data?.mrr * 12);
  });

  // DEFECT: no explicit platform admin check — any authenticated user can access revenue analytics
  // This is a potential access-control gap. Logged for Wave 1.5 review.
  test.skip('DEFECT: returns 403 for non-admin user (currently returns 200)', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'member-1', role: 'member' },
      database: makeRevenueDb(fakeRevenueRow),
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(403);
  });
});
