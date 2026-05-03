// Business Rules: [BR-08]
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

describe('refundPayment [BR-08]', () => {
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

  // ─── [BR-08] Gap tests from BR text ──────────────────

  test('[BR-08] cannot refund already fully refunded payment', async () => {
    const fullyRefunded = { ...fakePayment, refundedAmount: 10000, status: 'refunded' };
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fullyRefunded,
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: { amount: 1000 },
    });

    // max refundable = 10000 - 10000 = 0, so 1000 > 0 → error
    await expect(refundPayment(ctx)).rejects.toThrow();
  });

  test('[BR-08] full refund of default amount (no body.amount) uses payment.amount', async () => {
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
      _params: { id: 'pay-1' },
      _body: {}, // no amount → full refund
    });

    const response = await refundPayment(ctx);
    expect(response.body.data.refundedAmount).toBe(10000);
    expect(response.body.data.status).toBe('refunded');
  });

  test('[BR-08] multiple partial refunds accumulate correctly', async () => {
    // First partial refund already happened: 3000 of 10000 refunded
    const partiallyRefunded = { ...fakePayment, refundedAmount: 3000, status: 'partially_refunded' };
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => partiallyRefunded,
      getFundAllocations: async () => fakeAllocations,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...partiallyRefunded,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: { amount: 4000 }, // second partial: 3000 + 4000 = 7000 of 10000
    });

    const response = await refundPayment(ctx);
    expect(response.body.data.refundedAmount).toBe(7000);
    expect(response.body.data.status).toBe('partially_refunded');
  });

  test('[BR-08] refund reversals are proportional per fund', async () => {
    let capturedReversals: any[] = [];
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment, // amount: 10000
      getFundAllocations: async () => fakeAllocations, // fund-1: 6000, fund-2: 4000
      createFundAllocations: async (allocs: any) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment,
        status,
        ...extra,
      }),
    });

    const ctx = makeCtx({
      _params: { id: 'pay-1' },
      _body: {}, // full refund
    });

    await refundPayment(ctx);
    // Full refund: 100% reversal
    expect(capturedReversals[0].amount).toBe(-6000);
    expect(capturedReversals[1].amount).toBe(-4000);
    expect(capturedReversals.every((r) => r.isReversal === true)).toBe(true);
  });

  test('[BR-08] records updatedBy as refunding officer', async () => {
    let capturedExtra: any = null;
    mocks = stubRepo(DuesRepository, {
      getPayment: async () => fakePayment,
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _status: string, extra: any) => {
        capturedExtra = extra;
        return { ...fakePayment, ...extra };
      },
    });

    const ctx = makeCtx({
      user: { id: 'treasurer-99', role: 'officer' },
      _params: { id: 'pay-1' },
      _body: {},
    });

    await refundPayment(ctx);
    expect(capturedExtra.updatedBy).toBe('treasurer-99');
  });
});
