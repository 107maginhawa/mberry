/**
 * Tests for registerAndPayForEvent handler
 *
 * Covers:
 * - Event must exist and be paid
 * - Capacity check
 * - Merchant account required with Stripe onboarding
 * - Successful registration + Stripe Checkout session creation
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

beforeEach(() => {
  restoreRepo(EventRepository);
  restoreRepo(EventRegistrationRepository);
  restoreRepo(MerchantAccountRepository);
  restoreRepo(MembershipRepository);
});

const paidEvent = {
  id: 'evt-1',
  title: 'Annual Conference',
  organizationId: 'org-1',
  registrationFee: 5000,
  currency: 'PHP',
  capacity: 100,
  status: 'published',
};

const mockBilling = {
  createPaymentIntent: async () => ({ checkoutUrl: 'https://checkout.stripe.com/pay' }),
};

function makeEventCtx(overrides: Record<string, any> = {}) {
  return makeCtx({
    _params: { eventId: 'evt-1' },
    billing: mockBilling,
    ...overrides,
  });
}

function setupHappyPath() {
  stubRepo(EventRepository, {
    findOneById: async () => paidEvent,
  });
  stubRepo(EventRegistrationRepository, {
    count: async () => 10,
    createOne: async (data: any) => ({ id: 'reg-1', ...data }),
  });
  stubRepo(MerchantAccountRepository, {
    findMany: async () => [
      { id: 'merch-1', metadata: { stripeAccountId: 'acct_test123' } },
    ],
  });
  // Stub membership check to return active
  stubRepo(MembershipRepository, {
    findByPersonAndOrg: async () => ({ status: 'active' }),
  });
}

describe('registerAndPayForEvent', () => {
  test('throws NotFoundError when event does not exist', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    stubRepo(EventRepository, { findOneById: async () => null });

    const ctx = makeEventCtx();
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow(/not found/i);
  });

  test('throws BusinessLogicError for free events', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    stubRepo(EventRepository, {
      findOneById: async () => ({ ...paidEvent, registrationFee: 0 }),
    });

    const ctx = makeEventCtx();
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow(/free event/i);
  });

  test('throws BusinessLogicError when event is at capacity', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    stubRepo(EventRepository, { findOneById: async () => paidEvent });
    stubRepo(EventRegistrationRepository, { count: async () => 100 });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeEventCtx();
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow(/capacity/i);
  });

  test('throws BusinessLogicError when no merchant account', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    stubRepo(EventRepository, { findOneById: async () => paidEvent });
    stubRepo(EventRegistrationRepository, { count: async () => 10 });
    stubRepo(MerchantAccountRepository, { findMany: async () => [] });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeEventCtx();
    await expect(registerAndPayForEvent(ctx)).rejects.toThrow(/not set up billing/i);
  });

  test('returns 201 with checkoutUrl and registrationId on success', async () => {
    const { registerAndPayForEvent } = await import('./registerAndPayForEvent');
    setupHappyPath();

    const ctx = makeEventCtx();
    const response = await registerAndPayForEvent(ctx);
    expect((response as any).status).toBe(201);
    expect((response as any).body.data.checkoutUrl).toBe('https://checkout.stripe.com/pay');
    expect((response as any).body.data.registrationId).toBe('reg-1');
  });
});
