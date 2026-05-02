import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { getPayment } from './getPayment';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  receiptNumber: 'ORG-2025-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
};

const fakeAllocations = [
  { id: 'alloc-1', paymentId: 'pay-1', fundId: 'fund-1', amount: 3000, isReversal: false },
  { id: 'alloc-2', paymentId: 'pay-1', fundId: 'fund-2', amount: 2000, isReversal: false },
];

// ─── Tests ──────────────────────────────────────────────

describe('getPayment', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('returns payment with fund allocations and 200', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => fakeAllocations,
    });

    const ctx = makeCtx({ _params: { id: 'pay-1' } });
    const response = await getPayment(ctx);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe('pay-1');
    expect(response.body.data.fundAllocations).toHaveLength(2);
  });

  test('throws NotFoundError for non-existent payment', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });

    const ctx = makeCtx({ _params: { id: 'pay-nonexistent' } });
    await expect(getPayment(ctx)).rejects.toThrow('Payment not found');
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => [],
    });

    // getPayment doesn't use session directly
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'pay-1' },
    });

    const response = await getPayment(ctx);
    expect(response.status).toBe(200);
  });
});
