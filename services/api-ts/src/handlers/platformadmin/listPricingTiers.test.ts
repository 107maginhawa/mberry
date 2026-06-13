/**
 * listPricingTiers — characterization tests (AHA FIX-002 backfill)
 *
 * Path: GET /admin/pricing
 * Access: platformAdmin only. Returns tiers (with a subscriberCount subquery)
 * ordered by sortOrder then name.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listPricingTiers } from './listPricingTiers';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };
const ADMIN = { id: 'pa-1', userId: 'admin-1', role: 'super' };

function makeDb(rows: any[]) {
  return {
    select: () => ({ from: () => ({ orderBy: async () => rows }) }),
  };
}

const tier = {
  id: 'tier-1',
  name: 'Pro',
  slug: 'pro',
  monthlyPrice: 1000,
  annualPrice: 10000,
  currency: 'PHP',
  maxMembers: 500,
  trialDays: 14,
  features: [],
  isActive: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  subscriberCount: 3,
};

describe('listPricingTiers (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    const res = await listPricingTiers(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' } });
    const res = await listPricingTiers(ctx);
    expect(res.status).toBe(403);
  });

  test('admin gets tiers with subscriberCount', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      database: makeDb([tier]),
      logger: FAKE_LOGGER,
    });
    const res = await listPricingTiers(ctx);
    expect(res.status ?? 200).toBe(200);
    const data = (res as any).body?.data;
    expect(data[0].id).toBe('tier-1');
    expect(data[0].subscriberCount).toBe(3);
  });

  test('returns an empty list cleanly', async () => {
    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'platform_admin' },
      platformAdmin: ADMIN,
      database: makeDb([]),
      logger: FAKE_LOGGER,
    });
    const res = await listPricingTiers(ctx);
    expect((res as any).body?.data).toEqual([]);
  });
});
