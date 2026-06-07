/**
 * listSubscriptions — characterization tests
 *
 * Path: GET /admin/subscriptions
 * Auth: session + platformAdmin required
 * Direct Drizzle select (no repo class).
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { listSubscriptions } from './listSubscriptions';

const fakeSub = {
  id: 'sub-1',
  organizationId: 'org-1',
  organizationName: 'Manila Chapter',
  pricingTierId: 'tier-1',
  tierName: 'Standard',
  tierSlug: 'standard',
  status: 'active',
  billingCycle: 'monthly',
  currentPeriodStart: new Date('2025-01-01'),
  currentPeriodEnd: new Date('2025-02-01'),
  trialEndsAt: null,
  cancelledAt: null,
  cancelReason: null,
  stripeSubscriptionId: 'stripe-sub-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function makeSubDb(rows: any[]) {
  const chain: any = {
    leftJoin: () => chain,
    where: () => ({ orderBy: async () => rows }),
  };
  return {
    select: () => ({ from: () => chain }),
  };
}

describe('listSubscriptions (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({ user: { id: 'user-1', role: 'member' } });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 200 with subscriptions for platform admin', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      database: makeSubDb([fakeSub]), logger: FAKE_LOGGER,
    });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data).toBeDefined();
    expect(Array.isArray(body?.data)).toBe(true);
    expect(body?.data[0]?.id).toBe('sub-1');
  });

  test('returns 200 with empty list when no subscriptions', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      database: makeSubDb([]), logger: FAKE_LOGGER,
    });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data).toHaveLength(0);
  });

  test('returns 400 for invalid status filter', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      database: makeSubDb([]), logger: FAKE_LOGGER,
      _query: { status: 'invalid_status' },
    });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(400);
  });

  test('computes slaStatus expired when currentPeriodEnd is in the past', async () => {
    const expiredSub = { ...fakeSub, currentPeriodEnd: new Date('2020-01-01') };
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      database: makeSubDb([expiredSub]),
      logger: FAKE_LOGGER,
    });
    const res = await listSubscriptions(ctx);
    expect(res.status).toBe(200);
    const row = (res as any).body?.data?.[0];
    expect(row?.slaStatus).toBe('expired');
  });
});
