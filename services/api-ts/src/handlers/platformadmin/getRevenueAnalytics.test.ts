/**
 * getRevenueAnalytics — characterization tests
 *
 * Path: GET /admin/analytics/revenue
 * Auth: platformAdmin guard required (D-02 fixed).
 * Uses db.execute(sql`...`) directly.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getRevenueAnalytics } from './getRevenueAnalytics';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const FAKE_PLATFORM_ADMIN = { userId: 'admin-1', role: 'super' };

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

  // D-02 FIXED: guard now rejects non-platformAdmin users with 403
  test('returns 403 for authenticated user without platformAdmin role', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'member-1', role: 'member' },
      database: makeRevenueDb(fakeRevenueRow),
      logger: FAKE_LOGGER,
      // platformAdmin intentionally absent
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(403);
  });

  // Positive case: platformAdmin CAN access
  test('returns 200 with revenue metrics for platformAdmin user', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
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
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
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
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: { execute: () => { throw new Error('DB error'); } },
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    expect(res.status).toBe(500);
  });

  test('arr is 12x mrr', async () => {
    const ctx = makeRevenueCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: FAKE_PLATFORM_ADMIN,
      database: makeRevenueDb(fakeRevenueRow),
      logger: FAKE_LOGGER,
    });
    const res = await getRevenueAnalytics(ctx);
    const body = (res as any).body;
    expect(body?.data?.arr).toBe(body?.data?.mrr * 12);
  });
});
