/**
 * Additional branch coverage for onboardMerchantAccount.
 *
 * The base test file (onboardMerchantAccount.test.ts) covers:
 *   - 200 happy path (has stripeAccountId)
 *   - NotFoundError
 *   - ForbiddenError
 *
 * This file adds:
 *   - inactive merchant account → BusinessLogicError
 *   - already onboarded + dashboardUrl → returns dashboard URL
 *   - already onboarded + no dashboardUrl → still returns fresh onboarding URL
 *   - missing stripeAccountId → creates Stripe Connect account + returns 200
 *   - missing stripeAccountId + person not found → NotFoundError
 *   - billing throws "not configured" → ExternalServiceError (configure)
 *   - billing throws generic error → ExternalServiceError (onboard)
 *   - response metadata shape (stripeAccountId, requiresOnboarding, onboardingComplete)
 *   - audit context set correctly
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import {
  fakeMerchantAccount as createFakeMerchantAccount,
  fakePerson as createFakePerson,
} from '@/test-utils/factories';
import { MerchantAccountRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { onboardMerchantAccount } from './onboardMerchantAccount';
import {
  BusinessLogicError,
  NotFoundError,
  ExternalServiceError,
} from '@/core/errors';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const OWNER_ID = 'owner-1';
const MA_ID = 'ma-branch-1';

const fakeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: function () { return fakeLogger; },
};

function makeBillingCtx(userId: string, billing: object, extraOverrides: Record<string, any> = {}) {
  return makeCtx({
    user: { id: userId, role: 'provider' },
    session: { id: 's-1', userId, user: { id: userId, role: 'provider' } },
    logger: fakeLogger,
    billing,
    _params: { merchantAccount: MA_ID },
    _body: { refreshUrl: 'https://app.com/refresh', returnUrl: 'https://app.com/return' },
    ...extraOverrides,
  });
}

const baseMerchantAccount = createFakeMerchantAccount({
  id: MA_ID,
  person: OWNER_ID,
  active: true,
  status: 'active',
  metadata: { stripeAccountId: 'acct_existing' },
});

const fakePerson = createFakePerson({
  id: OWNER_ID,
  email: 'owner@example.com',
  contactInfo: { email: 'owner@example.com' },
  primaryAddress: { country: 'PH' },
});

const baseBilling = {
  createConnectAccount: async () => ({
    accountId: 'acct_new',
    onboardingUrl: 'https://stripe.com/connect/new',
  }),
  getConnectAccountStatus: async () => ({
    status: 'pending',
    onboardingComplete: false,
    dashboardUrl: null,
  }),
  generateOnboardingLink: async () => ({ onboardingUrl: 'https://stripe.com/onboard/link' }),
};

beforeEach(() => {
  stubRepo(MerchantAccountRepository, {
    findOneById: async () => baseMerchantAccount,
    updateOneById: async () => baseMerchantAccount,
  });
  stubRepo(PersonRepository, { findOneById: async () => fakePerson });
});

afterEach(() => {
  restoreRepo(MerchantAccountRepository);
  restoreRepo(PersonRepository);
});

// ─── Inactive account ─────────────────────────────────────────────────────────

describe('onboardMerchantAccount — inactive account', () => {
  test('throws BusinessLogicError when merchant account is not active', async () => {
    restoreRepo(MerchantAccountRepository);
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => createFakeMerchantAccount({
        id: MA_ID,
        person: OWNER_ID,
        active: false,
        status: 'inactive',
        metadata: { stripeAccountId: 'acct_inactive' },
      }),
      updateOneById: async () => {},
    });

    const ctx = makeBillingCtx(OWNER_ID, baseBilling);
    await expect(onboardMerchantAccount(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});

// ─── Already onboarded ───────────────────────────────────────────────────────

describe('onboardMerchantAccount — already onboarded', () => {
  test('returns dashboard URL when onboardingComplete=true and dashboardUrl present', async () => {
    const billingWithDashboard = {
      ...baseBilling,
      getConnectAccountStatus: async () => ({
        status: 'active',
        onboardingComplete: true,
        dashboardUrl: 'https://stripe.com/dashboard/acct_existing',
      }),
    };

    const ctx = makeBillingCtx(OWNER_ID, billingWithDashboard);
    const res = await onboardMerchantAccount(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.onboardingUrl).toBe('https://stripe.com/dashboard/acct_existing');
    expect(body.metadata?.onboardingComplete).toBe(true);
    expect(body.metadata?.alreadyComplete).toBe(true);
    expect(body.metadata?.isDashboard).toBe(true);
  });

  test('returns fresh onboarding link when onboardingComplete=true but no dashboardUrl', async () => {
    const billingNoDash = {
      ...baseBilling,
      getConnectAccountStatus: async () => ({
        status: 'active',
        onboardingComplete: true,
        dashboardUrl: null,
      }),
      generateOnboardingLink: async () => ({ onboardingUrl: 'https://stripe.com/relink' }),
    };

    const ctx = makeBillingCtx(OWNER_ID, billingNoDash);
    const res = await onboardMerchantAccount(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.onboardingUrl).toBe('https://stripe.com/relink');
  });

  test('response metadata.requiresOnboarding is false when onboardingComplete', async () => {
    const billingComplete = {
      ...baseBilling,
      getConnectAccountStatus: async () => ({
        status: 'active',
        onboardingComplete: true,
        dashboardUrl: null,
      }),
    };

    const ctx = makeBillingCtx(OWNER_ID, billingComplete);
    const res = await onboardMerchantAccount(ctx);
    expect((res as any).body.metadata?.requiresOnboarding).toBe(false);
  });

  test('response metadata.requiresOnboarding is true when not yet complete', async () => {
    const ctx = makeBillingCtx(OWNER_ID, baseBilling); // onboardingComplete: false
    const res = await onboardMerchantAccount(ctx);
    expect((res as any).body.metadata?.requiresOnboarding).toBe(true);
  });
});

// ─── Missing stripeAccountId (late creation) ─────────────────────────────────

describe('onboardMerchantAccount — missing stripeAccountId', () => {
  beforeEach(() => {
    restoreRepo(MerchantAccountRepository);
    restoreRepo(PersonRepository);
    // Merchant account without stripeAccountId in metadata
    stubRepo(MerchantAccountRepository, {
      findOneById: async () => createFakeMerchantAccount({
        id: MA_ID,
        person: OWNER_ID,
        active: true,
        status: 'active',
        metadata: {}, // no stripeAccountId
      }),
      updateOneById: async () => {},
    });
    stubRepo(PersonRepository, { findOneById: async () => fakePerson });
  });

  test('calls billing.createConnectAccount and returns 200 with new stripe account URL', async () => {
    let createConnectCalled = false;
    const billingWithCreate = {
      ...baseBilling,
      createConnectAccount: async (opts: any) => {
        createConnectCalled = true;
        expect(opts.email).toBe('owner@example.com');
        return { accountId: 'acct_brand_new', onboardingUrl: 'https://stripe.com/connect/new' };
      },
    };

    const ctx = makeBillingCtx(OWNER_ID, billingWithCreate);
    const res = await onboardMerchantAccount(ctx);
    expect(res.status).toBe(200);
    expect(createConnectCalled).toBe(true);
  });

  test('throws NotFoundError when person record missing', async () => {
    restoreRepo(PersonRepository);
    stubRepo(PersonRepository, { findOneById: async () => null });

    const ctx = makeBillingCtx(OWNER_ID, baseBilling);
    await expect(onboardMerchantAccount(ctx)).rejects.toBeInstanceOf(NotFoundError);
  });

  test('passes country from person.primaryAddress to createConnectAccount', async () => {
    let capturedCountry: string | undefined;
    const billingCapture = {
      ...baseBilling,
      createConnectAccount: async (opts: any) => {
        capturedCountry = opts.country;
        return { accountId: 'acct_c', onboardingUrl: 'https://stripe.com/c' };
      },
    };

    const ctx = makeBillingCtx(OWNER_ID, billingCapture);
    await onboardMerchantAccount(ctx);
    expect(capturedCountry).toBe('PH');
  });
});

// ─── Response metadata shape ──────────────────────────────────────────────────

describe('onboardMerchantAccount — response metadata shape', () => {
  test('response includes stripeAccountId in metadata', async () => {
    const ctx = makeBillingCtx(OWNER_ID, baseBilling);
    const res = await onboardMerchantAccount(ctx);
    expect((res as any).body.metadata?.stripeAccountId).toBe('acct_existing');
  });

  test('response metadata.stripeAccountStatus matches billing.getConnectAccountStatus', async () => {
    const billingPending = {
      ...baseBilling,
      getConnectAccountStatus: async () => ({
        status: 'pending',
        onboardingComplete: false,
        dashboardUrl: null,
      }),
    };
    const ctx = makeBillingCtx(OWNER_ID, billingPending);
    const res = await onboardMerchantAccount(ctx);
    expect((res as any).body.metadata?.stripeAccountStatus).toBe('pending');
  });
});

// ─── Audit context ────────────────────────────────────────────────────────────

describe('onboardMerchantAccount — audit context', () => {
  test('sets auditResourceId to merchantAccountId', async () => {
    const ctx = makeBillingCtx(OWNER_ID, baseBilling) as any;
    const setCalls: Record<string, any> = {};
    ctx.set = (key: string, val: any) => { setCalls[key] = val; };

    await onboardMerchantAccount(ctx);

    expect(setCalls['auditResourceId']).toBe(MA_ID);
  });

  test('sets auditDetails with stripeAccountId and onboardingComplete', async () => {
    const ctx = makeBillingCtx(OWNER_ID, baseBilling) as any;
    const setCalls: Record<string, any> = {};
    ctx.set = (key: string, val: any) => { setCalls[key] = val; };

    await onboardMerchantAccount(ctx);

    expect(setCalls['auditDetails']?.stripeAccountId).toBe('acct_existing');
    expect(typeof setCalls['auditDetails']?.onboardingComplete).toBe('boolean');
  });
});

// ─── Error propagation ────────────────────────────────────────────────────────

describe('onboardMerchantAccount — error propagation', () => {
  test('throws ExternalServiceError when billing throws "not configured" message', async () => {
    const billingNotConfigured = {
      ...baseBilling,
      getConnectAccountStatus: async () => { throw new Error('Stripe not configured'); },
    };
    const ctx = makeBillingCtx(OWNER_ID, billingNotConfigured);
    try {
      await onboardMerchantAccount(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ExternalServiceError);
      expect(e.message).toMatch(/not configured/i);
    }
  });

  test('throws ExternalServiceError with STRIPE_ONBOARDING_ERROR for generic billing failure', async () => {
    const billingBroken = {
      ...baseBilling,
      generateOnboardingLink: async () => { throw new Error('Stripe API unavailable'); },
    };
    const ctx = makeBillingCtx(OWNER_ID, billingBroken);
    try {
      await onboardMerchantAccount(ctx);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e).toBeInstanceOf(ExternalServiceError);
    }
  });

  test('re-throws BusinessLogicError as-is (not wrapped)', async () => {
    const billingThrowsBusiness = {
      ...baseBilling,
      getConnectAccountStatus: async () => {
        throw new BusinessLogicError('Custom rule violation', 'CUSTOM_CODE');
      },
    };
    const ctx = makeBillingCtx(OWNER_ID, billingThrowsBusiness);
    await expect(onboardMerchantAccount(ctx)).rejects.toBeInstanceOf(BusinessLogicError);
  });
});
