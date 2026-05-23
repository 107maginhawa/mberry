import { describe, test, expect, afterEach, mock } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { fakeEvent as createFakeEvent } from '@/test-utils/factories';
import { EventRepository } from '../association:operations/repos/events.repo';
import { MerchantAccountRepository } from '@/handlers/billing/repos/billing.repo';

// Mock requirePosition to always pass (officer check tested elsewhere)
mock.module('@/utils/officer-check', () => ({
  requirePosition: async () => null,
}));

const { publishEvent } = await import('../association:operations/publishEvent');

const paidDraft = createFakeEvent({
  id: 'evt-paid-draft',
  organizationId: 'org-1',
  status: 'draft',
  registrationFee: 50000,
});

const freeDraft = createFakeEvent({
  id: 'evt-free-draft',
  organizationId: 'org-1',
  status: 'draft',
  registrationFee: 0,
});

describe('[W2A] Publish Guard — Stripe onboarding check', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('blocks publishing paid event without Stripe account', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => paidDraft,
    });
    stubRepo(MerchantAccountRepository, {
      findMany: async () => [],
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-paid-draft' },
      _valid: { param: { eventId: 'evt-paid-draft' } },
    });

    await expect(publishEvent(ctx as any)).rejects.toThrow('billing');
  });

  test('allows publishing free event without Stripe', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => freeDraft,
      publish: async () => ({ ...freeDraft, status: 'published', publishedAt: new Date() }),
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-free-draft' },
      _valid: { param: { eventId: 'evt-free-draft' } },
    });

    const response = await publishEvent(ctx as any);
    expect(response.status).toBe(200);
  });

  test('allows publishing paid event with Stripe account', async () => {
    mocks = stubRepo(EventRepository, {
      findOneById: async () => paidDraft,
      publish: async () => ({ ...paidDraft, status: 'published', publishedAt: new Date() }),
    });
    stubRepo(MerchantAccountRepository, {
      findMany: async () => [{ id: 'ma-1', metadata: { stripeAccountId: 'acct_test_123' } }],
    });

    const ctx = makeCtx({
      _params: { eventId: 'evt-paid-draft' },
      _valid: { param: { eventId: 'evt-paid-draft' } },
    });

    const response = await publishEvent(ctx as any);
    expect(response.status).toBe(200);
  });
});
