/**
 * Tests for billing-onboarding flow.
 *
 * The flow imports four generated SDK calls. We replace the generated module
 * with mock.module() before importing the subject so all branches are exercisable.
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { SdkError } from '../client';

// -------------------------------------------------------------------
// Shared mock function references
// -------------------------------------------------------------------

const mockGetMerchantAccount = mock(async (_opts: unknown) => ({ data: null }));
const mockCreateMerchantAccount = mock(async (_opts: unknown) => ({ data: {} }));
const mockOnboardMerchantAccount = mock(async (_opts: unknown) => ({
  data: { onboardingUrl: 'https://connect.stripe.com/onboard' },
}));
const mockGetMerchantDashboard = mock(async (_opts: unknown) => ({
  data: { dashboardUrl: 'https://dashboard.stripe.com', expiresAt: new Date() },
}));

mock.module('../generated/sdk.gen', () => ({
  getMerchantAccount: mockGetMerchantAccount,
  createMerchantAccount: mockCreateMerchantAccount,
  onboardMerchantAccount: mockOnboardMerchantAccount,
  getMerchantDashboard: mockGetMerchantDashboard,
}));

// -------------------------------------------------------------------
// Subject under test
// -------------------------------------------------------------------

import {
  startBillingOnboarding,
  getMyMerchantAccount,
  isOnboardingComplete,
  canAccessDashboard,
  getAccountSetupStatus,
} from './billing-onboarding';
import type { MerchantAccount } from '../generated/types.gen';

// -------------------------------------------------------------------
// Test helpers
// -------------------------------------------------------------------

const BASE_ACCOUNT: MerchantAccount = {
  id: 'acct-001',
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  person: 'person-001',
  metadata: null,
};

const ARGS = {
  refreshUrl: 'https://app.example.com/billing/refresh',
  returnUrl: 'https://app.example.com/billing/return',
};

function makeAccount(metadata: Record<string, unknown> | null = null): MerchantAccount {
  return { ...BASE_ACCOUNT, metadata };
}

// -------------------------------------------------------------------
// Pure helper function tests
// -------------------------------------------------------------------

describe('isOnboardingComplete', () => {
  test('returns false for null account', () => {
    expect(isOnboardingComplete(null)).toBe(false);
  });

  test('returns false when metadata is null', () => {
    expect(isOnboardingComplete(makeAccount(null))).toBe(false);
  });

  test('returns false when onboardingComplete is false', () => {
    expect(isOnboardingComplete(makeAccount({ onboardingComplete: false }))).toBe(false);
  });

  test('returns true when onboardingComplete is true', () => {
    expect(isOnboardingComplete(makeAccount({ onboardingComplete: true }))).toBe(true);
  });
});

describe('canAccessDashboard', () => {
  test('returns false for null account', () => {
    expect(canAccessDashboard(null)).toBe(false);
  });

  test('returns false when dashboardAccessEnabled is false', () => {
    expect(canAccessDashboard(makeAccount({ dashboardAccessEnabled: false }))).toBe(false);
  });

  test('returns true when dashboardAccessEnabled is true', () => {
    expect(canAccessDashboard(makeAccount({ dashboardAccessEnabled: true }))).toBe(true);
  });
});

describe('getAccountSetupStatus', () => {
  test('returns "none" for null account', () => {
    expect(getAccountSetupStatus(null)).toBe('none');
  });

  test('returns "incomplete" when onboarding is not complete', () => {
    expect(getAccountSetupStatus(makeAccount({ onboardingComplete: false }))).toBe('incomplete');
  });

  test('returns "complete" when onboarding is done', () => {
    expect(getAccountSetupStatus(makeAccount({ onboardingComplete: true }))).toBe('complete');
  });
});

// -------------------------------------------------------------------
// getMyMerchantAccount
// -------------------------------------------------------------------

describe('getMyMerchantAccount', () => {
  beforeEach(() => {
    mockGetMerchantAccount.mockClear();
  });

  test('returns the account when API responds with 200', async () => {
    const account = makeAccount({ onboardingComplete: false });
    mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({ data: account }));

    const result = await getMyMerchantAccount();
    expect(result).toBe(account);
  });

  test('returns null on 404 SdkError', async () => {
    mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
      throw new SdkError({ status: 404 });
    });

    const result = await getMyMerchantAccount();
    expect(result).toBeNull();
  });

  test('re-throws non-404 SdkErrors', async () => {
    mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
      throw new SdkError({ status: 500 });
    });

    await expect(getMyMerchantAccount()).rejects.toBeInstanceOf(SdkError);
  });

  test('re-throws generic errors', async () => {
    mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
      throw new Error('network failure');
    });

    await expect(getMyMerchantAccount()).rejects.toThrow('network failure');
  });
});

// -------------------------------------------------------------------
// startBillingOnboarding — branching logic
// -------------------------------------------------------------------

describe('startBillingOnboarding', () => {
  beforeEach(() => {
    mockGetMerchantAccount.mockClear();
    mockCreateMerchantAccount.mockClear();
    mockOnboardMerchantAccount.mockClear();
    mockGetMerchantDashboard.mockClear();
  });

  // Branch 1: no existing account → create
  describe('create branch (no existing account)', () => {
    beforeEach(() => {
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 404 });
      });
    });

    test('returns step "create"', async () => {
      const newAccount = makeAccount({ stripeAccountId: 'acct_stripe' });
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: newAccount,
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.step).toBe('create');
    });

    test('returns the newly created account', async () => {
      const newAccount = makeAccount({ stripeAccountId: 'acct_stripe' });
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: newAccount,
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.account).toBe(newAccount);
    });

    test('url is returnUrl when stripeAccountId is set', async () => {
      const newAccount = makeAccount({ stripeAccountId: 'acct_stripe_123' });
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: newAccount,
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.url).toBe(ARGS.returnUrl);
    });

    test('url is refreshUrl when stripeAccountId is absent', async () => {
      const newAccount = makeAccount({});
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: newAccount,
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.url).toBe(ARGS.refreshUrl);
    });

    test('does not call onboard or dashboard', async () => {
      const newAccount = makeAccount({ stripeAccountId: 'acct_stripe' });
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: newAccount,
      }));

      await startBillingOnboarding(ARGS);
      expect(mockOnboardMerchantAccount).not.toHaveBeenCalled();
      expect(mockGetMerchantDashboard).not.toHaveBeenCalled();
    });
  });

  // Branch 2: existing account, not complete → continue
  describe('continue branch (onboarding incomplete)', () => {
    beforeEach(() => {
      const incompleteAccount = makeAccount({ onboardingComplete: false });
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: incompleteAccount,
      }));
    });

    test('returns step "continue"', async () => {
      mockOnboardMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: { onboardingUrl: 'https://connect.stripe.com/continue' },
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.step).toBe('continue');
    });

    test('url is the onboardingUrl from the link response', async () => {
      const url = 'https://connect.stripe.com/specific-onboard-link';
      mockOnboardMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: { onboardingUrl: url },
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.url).toBe(url);
    });

    test('returns the existing account', async () => {
      const incompleteAccount = makeAccount({ onboardingComplete: false });
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: incompleteAccount,
      }));
      mockOnboardMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: { onboardingUrl: 'https://connect.stripe.com/continue' },
      }));

      const result = await startBillingOnboarding(ARGS);
      expect(result.account).toEqual(incompleteAccount);
    });

    test('does not call create or dashboard', async () => {
      mockOnboardMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: { onboardingUrl: 'https://connect.stripe.com/continue' },
      }));

      await startBillingOnboarding(ARGS);
      expect(mockCreateMerchantAccount).not.toHaveBeenCalled();
      expect(mockGetMerchantDashboard).not.toHaveBeenCalled();
    });
  });

  // Branch 3: existing account, complete → dashboard
  describe('dashboard branch (onboarding complete)', () => {
    beforeEach(() => {
      const completeAccount = makeAccount({ onboardingComplete: true });
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: completeAccount,
      }));
      mockGetMerchantDashboard.mockImplementation(async (_opts: unknown) => ({
        data: {
          dashboardUrl: 'https://dashboard.stripe.com/acct_stripe',
          expiresAt: new Date('2030-01-01'),
        },
      }));
    });

    test('returns step "dashboard"', async () => {
      const result = await startBillingOnboarding(ARGS);
      expect(result.step).toBe('dashboard');
    });

    test('url is the dashboard URL', async () => {
      const result = await startBillingOnboarding(ARGS);
      expect(result.url).toBe('https://dashboard.stripe.com/acct_stripe');
    });

    test('does not call create or onboard', async () => {
      await startBillingOnboarding(ARGS);
      expect(mockCreateMerchantAccount).not.toHaveBeenCalled();
      expect(mockOnboardMerchantAccount).not.toHaveBeenCalled();
    });
  });

  // Error propagation
  describe('error handling', () => {
    test('propagates SdkError from getMyMerchantAccount when not 404', async () => {
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 403 });
      });

      await expect(startBillingOnboarding(ARGS)).rejects.toBeInstanceOf(SdkError);
    });

    test('propagates SdkError from createMerchantAccount', async () => {
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 404 });
      });
      mockCreateMerchantAccount.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 422, message: 'Invalid data' });
      });

      await expect(startBillingOnboarding(ARGS)).rejects.toBeInstanceOf(SdkError);
    });

    test('propagates SdkError from onboardMerchantAccount', async () => {
      const incompleteAccount = makeAccount({ onboardingComplete: false });
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: incompleteAccount,
      }));
      mockOnboardMerchantAccount.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 500 });
      });

      await expect(startBillingOnboarding(ARGS)).rejects.toBeInstanceOf(SdkError);
    });

    test('propagates SdkError from getMerchantDashboard', async () => {
      const completeAccount = makeAccount({ onboardingComplete: true });
      mockGetMerchantAccount.mockImplementation(async (_opts: unknown) => ({
        data: completeAccount,
      }));
      mockGetMerchantDashboard.mockImplementation(async (_opts: unknown) => {
        throw new SdkError({ status: 503 });
      });

      await expect(startBillingOnboarding(ARGS)).rejects.toBeInstanceOf(SdkError);
    });
  });
});
