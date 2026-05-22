import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMerchantAccount as createFakeMerchantAccount } from '@/test-utils/factories';
import { MerchantAccountRepository } from './repos/billing.repo';
import { getMerchantDashboard } from './getMerchantDashboard';
import { NotFoundError, ForbiddenError } from '@/core/errors';

const MERCHANT_USER_ID = 'merch-user-1';
const MA_ID = 'ma-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const activeMerchantAccount = createFakeMerchantAccount({
  id: MA_ID, person: MERCHANT_USER_ID, stripeAccountId: 'acct_test',
  status: 'active', metadata: { stripeAccountId: 'acct_test' },
  createdAt: new Date(), updatedAt: new Date(),
});

const fakeBilling = {
  getAccountStatus: async () => ({ dashboardUrl: 'https://connect.stripe.com/dashboard', chargesEnabled: true }),
  getConnectAccountStatus: async () => ({
    status: 'active', onboardingComplete: true,
    dashboardUrl: 'https://connect.stripe.com/dashboard',
    chargesEnabled: true, payoutsEnabled: true,
  }),
};

describe('getMerchantDashboard', () => {
  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, { findOneById: async () => activeMerchantAccount });
  });

  afterEach(() => {
    restoreRepo(MerchantAccountRepository);
  });

  test('returns 200 with dashboard URL for account owner', async () => {
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', { billing: fakeBilling, _params: { merchantAccount: MA_ID } });
    const res = await getMerchantDashboard(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.dashboardUrl).toBeDefined();
  });

  test('throws NotFoundError when merchant account not found', async () => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, { findOneById: async () => null });
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', { billing: fakeBilling, _params: { merchantAccount: 'nonexistent' } });
    await expect(getMerchantDashboard(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not the account owner', async () => {
    const ctx = makeBillingCtx('other-user', 'user', { billing: fakeBilling, _params: { merchantAccount: MA_ID } });
    await expect(getMerchantDashboard(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
