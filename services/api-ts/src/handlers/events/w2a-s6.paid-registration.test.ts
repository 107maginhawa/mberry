import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { registerAndPayForEvent } from '@/handlers/association:operations/registerAndPayForEvent';
import { EventRepository, EventRegistrationRepository } from '@/handlers/association:operations/repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

const paidEvent = createFakeEvent({
  id: 'event-paid-1',
  organizationId: 'org-1',
  title: 'Paid CPD Seminar',
  registrationFee: 50000, // 500 PHP
  currency: 'PHP',
  capacity: 100,
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
});

const freeEvent = createFakeEvent({
  id: 'event-free-1',
  organizationId: 'org-1',
  title: 'Free Event',
  registrationFee: 0,
  status: 'published',
  startDate: new Date('2026-06-01'),
  endDate: new Date('2026-06-02'),
});

const fakeMerchant = {
  id: 'merchant-1',
  organizationId: 'org-1',
  active: true,
  metadata: { stripeAccountId: 'acct_test_123', onboardingComplete: true },
};

const fakeBilling = {
  createPaymentIntent: async () => ({
    paymentIntentId: 'pi_test_123',
    clientSecret: '',
    status: 'pending',
    checkoutUrl: 'https://checkout.stripe.com/test',
  }),
};

describe('[W2A-S6] Paid Event Registration', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates Stripe Checkout session for paid event', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => paidEvent,
    });
    stubRepo(EventRegistrationRepository, {
      count: async () => 5,
      createOne: async (data: any) => ({ id: 'reg-1', ...data }),
    });
    stubRepo(MerchantAccountRepository, {
      findMany: async () => [fakeMerchant],
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'event-paid-1' },
      billing: fakeBilling,
    });

    const response = await registerAndPayForEvent(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.checkoutUrl).toBe('https://checkout.stripe.com/test');
    expect(response.body.data.registrationId).toBe('reg-1');
  });

  test('rejects free event', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => freeEvent,
    });

    const ctx = makeCtx({
      _params: { eventId: 'event-free-1' },
      billing: fakeBilling,
    });

    await expect(registerAndPayForEvent(ctx)).rejects.toThrow('free event');
  });

  test('rejects when at capacity', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => paidEvent,
    });
    stubRepo(EventRegistrationRepository, {
      count: async () => 100, // At capacity
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'event-paid-1' },
      billing: fakeBilling,
    });

    await expect(registerAndPayForEvent(ctx)).rejects.toThrow('capacity');
  });

  test('rejects when no merchant account', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => paidEvent,
    });
    stubRepo(EventRegistrationRepository, {
      count: async () => 5,
    });
    stubRepo(MerchantAccountRepository, {
      findMany: async () => [],
    });
    stubRepo(MembershipRepository, {
      findByPersonAndOrg: async () => ({ status: 'active' }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'event-paid-1' },
      billing: fakeBilling,
    });

    await expect(registerAndPayForEvent(ctx)).rejects.toThrow('billing');
  });
});
