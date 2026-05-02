import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo } from '@/test-utils/make-ctx';
import { recordPayment } from './recordPayment';
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
  recordedBy: 'user-1',
  createdBy: 'user-1',
  updatedBy: 'user-1',
};

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '60', sortOrder: 1, active: true },
  { id: 'fund-2', organizationId: 'org-1', name: 'Education Fund', percentage: '40', sortOrder: 2, active: true },
];

// ─── Tests ──────────────────────────────────────────────

describe('recordPayment', () => {
  let mocks: ReturnType<typeof stubRepo>;

  afterEach(() => {
    if (mocks) Object.values(mocks).forEach((m) => m.mockRestore());
  });

  test('creates payment and returns 201', async () => {
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordPayment(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(5000);
    expect(response.body.meta.concurrentWarning).toBe(false);
  });

  test('returns concurrentWarning when duplicate payment found', async () => {
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => fakePayment,
      getNextReceiptSequence: async () => 2,
      createPayment: async (data: any) => ({ ...fakePayment, ...data, id: 'pay-2' }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    const response = await recordPayment(ctx);
    expect(response.status).toBe(201);
    expect(response.body.meta.concurrentWarning).toBe(true);
    expect(response.body.meta.recentPayment).toBeTruthy();
  });

  test('allocates funds when funds are configured', async () => {
    let capturedAllocations: any[] = [];
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => fakeFunds,
      createFundAllocations: async (allocs: any) => { capturedAllocations = allocs; },
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 10000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    expect(capturedAllocations).toHaveLength(2);
    expect(capturedAllocations[0].amount).toBe(6000); // 60%
    expect(capturedAllocations[1].amount).toBe(4000); // 40%
  });

  test('crashes without session (no auth)', async () => {
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      user: null,
      session: null,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    // session.user.id is accessed for recordedBy/createdBy/updatedBy
    await expect(recordPayment(ctx)).rejects.toThrow();
  });

  test('SECURITY: accepts orgId from request body without validation', async () => {
    // This test documents that recordPayment uses organizationId from the body
    // rather than from a route param or session — a potential security concern.
    let capturedData: any = null;
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => { capturedData = data; return { ...fakePayment, ...data }; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _body: {
        organizationId: 'org-ATTACKER',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    const response = await recordPayment(ctx);
    // Payment is created under attacker's orgId — no route-param scoping
    expect(response.status).toBe(201);
    expect(capturedData.organizationId).toBe('org-ATTACKER');
  });

  test('accepts zero amount payment', async () => {
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 0,
        paymentMethod: 'cash',
      },
    });

    // No validation on zero amount — handler accepts it
    const response = await recordPayment(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(0);
  });

  test('accepts negative amount payment', async () => {
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: -1000,
        paymentMethod: 'cash',
      },
    });

    // No validation on negative amount — handler accepts it
    const response = await recordPayment(ctx);
    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(-1000);
  });

  test('generates receipt number with orgCode fallback', async () => {
    let capturedData: any = null;
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 42,
      createPayment: async (data: any) => { capturedData = data; return { ...fakePayment, ...data }; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
        // no orgCode provided — should fall back to 'ORG'
      },
    });

    await recordPayment(ctx);
    const year = new Date().getFullYear();
    expect(capturedData.receiptNumber).toBe(`ORG-${year}-000042`);
  });
});
