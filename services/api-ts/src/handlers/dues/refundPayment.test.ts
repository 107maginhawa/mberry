import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { refundPayment } from './refundPayment';
import { DuesRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  receiptNumber: 'ORG-2025-000001',
  amount: 10000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
  recordedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeAllocations = [
  { id: 'alloc-1', paymentId: 'pay-1', fundId: 'fund-1', amount: 6000, isReversal: false },
  { id: 'alloc-2', paymentId: 'pay-1', fundId: 'fund-2', amount: 4000, isReversal: false },
];

// ─── Tests ──────────────────────────────────────────────

describe('refundPayment', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('full refund updates status to refunded', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => fakeAllocations,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: {},
    });

    const response = await refundPayment(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('refunded');
    expect(response.body.data.refundedAmount).toBe(10000);
  });

  test('partial refund updates status to partially_refunded', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => fakeAllocations,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: { amount: 5000 },
    });

    const response = await refundPayment(ctx);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('partially_refunded');
    expect(response.body.data.refundedAmount).toBe(5000);
  });

  test('throws NotFoundError for non-existent payment', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });

    const ctx = makeCtx({
      _params: { id: 'pay-nonexistent' },
      _body: {},
    });

    await expect(refundPayment(ctx)).rejects.toThrow('Payment not found');
  });

  test('throws ValidationError when refund exceeds remaining refundable', async () => {
    const partiallyRefunded = { ...fakePayment, refundedAmount: 8000 };
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => partiallyRefunded,
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: { amount: 5000 }, // only 2000 remaining
    });

    await expect(refundPayment(ctx)).rejects.toThrow('Refund cannot exceed 2000 cents');
  });

  test('creates reversal fund allocations proportional to refund', async () => {
    let capturedReversals: any[] = [];
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => fakeAllocations,
      createFundAllocations: async (allocs: any) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: { amount: 5000 }, // 50% refund
    });

    await refundPayment(ctx);
    expect(capturedReversals).toHaveLength(2);
    expect(capturedReversals[0].isReversal).toBe(true);
    expect(capturedReversals[0].amount).toBe(-3000); // 50% of 6000
    expect(capturedReversals[1].amount).toBe(-2000); // 50% of 4000
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { id: 'pay-1' },
      _body: {},
    });

    // session.user.id is accessed for updatedBy
    await expect(refundPayment(ctx)).rejects.toThrow();
  });
});
