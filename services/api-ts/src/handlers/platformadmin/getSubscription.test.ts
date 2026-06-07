/**
 * getSubscription — characterization tests
 *
 * Path: GET /admin/subscriptions/:id
 * Auth: session + platformAdmin required
 * Direct Drizzle select with joins.
 */
import { describe, test, expect } from 'bun:test';
import { makeCtx } from '@/test-utils/make-ctx';
import { getSubscription } from './getSubscription';

const FAKE_LOGGER = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

const fakeSub = {
  id: 'sub-1',
  organizationId: 'org-1',
  organizationName: 'Manila Chapter',
  organizationSlug: 'manila-chapter',
  organizationContactEmail: 'admin@manila.org',
  pricingTierId: 'tier-1',
  tierName: 'Standard',
  tierSlug: 'standard',
  tierMonthlyPrice: 5000,
  tierAnnualPrice: 50000,
  tierCurrency: 'PHP',
  tierMaxMembers: 500,
  tierFeatures: ['feature-a'],
  status: 'active',
  billingCycle: 'monthly',
  currentPeriodStart: new Date('2025-01-01'),
  currentPeriodEnd: new Date('2025-02-01'),
  trialEndsAt: null,
  cancelledAt: null,
  cancelReason: null,
  stripeSubscriptionId: 'stripe-sub-1',
  stripeCustomerId: 'stripe-cust-1',
  lastStripeEventId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeSubDb(row: any) {
  const chain: any = {
    leftJoin: () => chain,
    where: () => ({ limit: async () => row ? [row] : [] }),
  };
  return {
    select: () => ({ from: () => chain }),
  };
}

describe('getSubscription (characterization)', () => {
  test('returns 401 without session', async () => {
    const ctx = makeCtx({ session: null, user: null, _params: { id: 'sub-1' } });
    const res = await getSubscription(ctx);
    expect(res.status).toBe(401);
  });

  test('returns 403 without platformAdmin', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'member' },
      _params: { id: 'sub-1' },
    });
    const res = await getSubscription(ctx);
    expect(res.status).toBe(403);
  });

  test('returns 404 when subscription not found', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { id: 'nonexistent' },
      database: makeSubDb(null),
      logger: FAKE_LOGGER,
    });
    const res = await getSubscription(ctx);
    expect(res.status).toBe(404);
  });

  test('returns 200 with subscription data including daysRemaining', async () => {
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { id: 'sub-1' },
      database: makeSubDb(fakeSub),
      logger: FAKE_LOGGER,
    });
    const res = await getSubscription(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body?.data?.id).toBe('sub-1');
    expect(typeof body?.data?.daysRemaining).toBe('number');
  });

  test('daysRemaining is 0 for past currentPeriodEnd (floors at zero)', async () => {
    // Characterization: Math.max(0,...) floors at 0 for expired subscriptions
    const expiredSub = { ...fakeSub, currentPeriodEnd: new Date('2020-01-01') };
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'platform_admin' },
      platformAdmin: { id: 'pa-1', role: 'super' },
      _params: { id: 'sub-1' },
      database: makeSubDb(expiredSub),
      logger: FAKE_LOGGER,
    });
    const res = await getSubscription(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.data?.daysRemaining).toBe(0);
  });
});
