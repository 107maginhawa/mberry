import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeMerchantAccount as createFakeMerchantAccount, fakePerson as createFakePerson } from '@/test-utils/factories';
import { MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { onboardMerchantAccount } from './onboardMerchantAccount';
import { NotFoundError, ForbiddenError } from '@/core/errors';
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns

const MERCHANT_USER_ID = 'merch-user-1';
const MA_ID = 'ma-1';

const fakeLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function makeBillingCtx(userId: string, role: string, extraOverrides: Record<string, any> = {}) {
  const user = { id: userId, role };
  return makeCtx({ user, session: { id: 's-1', userId, user }, logger: fakeLogger, ...extraOverrides });
}

const fakeMerchantAccount = createFakeMerchantAccount({
  id: MA_ID, person: MERCHANT_USER_ID, stripeAccountId: 'acct_test',
  active: true, status: 'active',
  metadata: { stripeAccountId: 'acct_test' },
  createdAt: new Date(), updatedAt: new Date(),
});

const fakePerson = createFakePerson({ id: MERCHANT_USER_ID, email: 'merch@example.com' });
const fakeBilling = {
  createAccountLink: async () => ({ url: 'https://stripe.com/onboard' }),
  getConnectAccountStatus: async () => ({ status: 'pending', onboardingComplete: false, dashboardUrl: null }),
  generateOnboardingLink: async () => ({ onboardingUrl: 'https://stripe.com/onboard' }),
};

describe('onboardMerchantAccount', () => {
  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => fakeMerchantAccount,
      updateOneById: async () => fakeMerchantAccount,
    });
    stubRepo(PersonRepository, { findOneById: async () => fakePerson });
  });

  afterEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('returns 200 with onboarding URL for owner', async () => {
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', {
      billing: fakeBilling,
      _params: { merchantAccount: MA_ID },
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });
    const res = await onboardMerchantAccount(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body?.onboardingUrl).toBeDefined();
  });

  test('throws NotFoundError when merchant account not found', async () => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, { findOneById: async () => null });
    const ctx = makeBillingCtx(MERCHANT_USER_ID, 'provider', {
      billing: fakeBilling,
      _params: { merchantAccount: 'nonexistent' },
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });
    await expect(onboardMerchantAccount(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('throws ForbiddenError when user is not the account owner', async () => {
    const ctx = makeBillingCtx('other-user', 'user', {
      billing: fakeBilling,
      _params: { merchantAccount: MA_ID },
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });
    await expect(onboardMerchantAccount(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// Observability: structured log fields (Wave 4.5)
// ---------------------------------------------------------------------------

describe('onboardMerchantAccount — observability: structured log fields', () => {
  /**
   * Make a capturing logger with .child() support (returns new logger with merged bindings).
   */
  function makeCapturingLogger(calls: any[]) {
    function makeChild(inherited: Record<string, any>) {
      return {
        debug: (obj: any, msg?: string) => calls.push({ level: 'debug', ...inherited, ...obj, msg }),
        info:  (obj: any, msg?: string) => calls.push({ level: 'info',  ...inherited, ...obj, msg }),
        warn:  (obj: any, msg?: string) => calls.push({ level: 'warn',  ...inherited, ...obj, msg }),
        error: (obj: any, msg?: string) => calls.push({ level: 'error', ...inherited, ...obj, msg }),
        child: (bindings: Record<string, any>) => makeChild({ ...inherited, ...bindings }),
      };
    }
    return makeChild({});
  }

  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => fakeMerchantAccount,
      updateOneById: async () => fakeMerchantAccount,
    });
    stubRepo(PersonRepository, { findOneById: async () => fakePerson });
  });

  afterEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
  });

  test('all log calls carry traceId and module fields', async () => {
    const calls: any[] = [];
    const ctx = makeCtx({
      user: { id: MERCHANT_USER_ID, role: 'provider' },
      session: { id: 's-1', userId: MERCHANT_USER_ID, user: { id: MERCHANT_USER_ID, role: 'provider' } },
      logger: makeCapturingLogger(calls),
      requestId: 'trace-obs-001',
      billing: fakeBilling,
      _params: { merchantAccount: MA_ID },
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });

    await onboardMerchantAccount(ctx);

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.traceId).toBe('trace-obs-001');
      expect(call.module).toBe('billing');
    }
  });

  test('start log includes action field', async () => {
    const calls: any[] = [];
    const ctx = makeCtx({
      user: { id: MERCHANT_USER_ID, role: 'provider' },
      session: { id: 's-1', userId: MERCHANT_USER_ID, user: { id: MERCHANT_USER_ID, role: 'provider' } },
      logger: makeCapturingLogger(calls),
      requestId: 'trace-obs-002',
      billing: fakeBilling,
      _params: { merchantAccount: MA_ID },
      _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    });

    await onboardMerchantAccount(ctx);

    const startLog = calls.find(c => c.action === 'onboardMerchantAccount.start');
    expect(startLog).toBeDefined();
    expect(startLog.merchantAccountId).toBe(MA_ID);
    expect(startLog.userId).toBe(MERCHANT_USER_ID);
  });
});
