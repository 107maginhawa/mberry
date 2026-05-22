import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMerchantAccount as createFakeMerchantAccount } from '@/test-utils/factories';
import { MerchantAccountRepository } from './repos/billing.repo';
import { getMerchantAccount } from './getMerchantAccount';
import { NotFoundError, ForbiddenError } from '@/core/errors';

const MERCHANT_USER_ID = 'merch-user-1';
const MA_ID = 'ma-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const fakeMerchantAccount = createFakeMerchantAccount({
  id: MA_ID, person: MERCHANT_USER_ID, stripeAccountId: 'acct_test',
  metadata: { stripeAccountId: 'acct_test' },
  status: 'active', createdAt: new Date(), updatedAt: new Date(),
});

describe('getMerchantAccount', () => {
  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, { findOneById: async () => fakeMerchantAccount });
  });

  afterEach(() => {
    restoreRepo(MerchantAccountRepository);
  });

  test('returns 200 when owner views their merchant account', async () => {
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', { _params: { merchantAccount: MA_ID } });
    const res = await getMerchantAccount(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.id).toBe(MA_ID);
  });

  test('returns 200 for internal expand requests (no auth check)', async () => {
    // isInternalExpand bypasses auth
    const ctx = makeBillingCtx('any-user', 'user', { isInternalExpand: true, _params: { merchantAccount: MA_ID } });
    const res = await getMerchantAccount(ctx);
    expect(res.status).toBe(200);
  });

  test('throws NotFoundError when merchant account not found', async () => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, { findOneById: async () => null });
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', { _params: { merchantAccount: 'nonexistent' } });
    await expect(getMerchantAccount(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when non-owner non-admin accesses account', async () => {
    const ctx = makeBillingCtx('other-user', 'user', { _params: { merchantAccount: MA_ID } });
    await expect(getMerchantAccount(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
