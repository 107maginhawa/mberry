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

describe('recordPayment [BR-06]', () => {
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

  // ─── [BR-06] Gap tests from BR text ──────────────────

  test('[BR-06] records officer identity (recordedBy) from session', async () => {
    let capturedData: any = null;
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => { capturedData = data; return { ...fakePayment, ...data }; },
      listFunds: async () => [],
    });

    const ctx = makeCtx({
      user: { id: 'treasurer-1', role: 'officer' },
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    expect(capturedData.recordedBy).toBe('treasurer-1');
    expect(capturedData.createdBy).toBe('treasurer-1');
  });

  test('[BR-06] records payment method for manual payments', async () => {
    const methods = ['cash', 'check', 'bankTransfer'];
    for (const method of methods) {
      let capturedData: any = null;
      mocks = stubRepo(DuesRepository, {
        findRecentPaymentForPerson: async () => undefined,
        getNextReceiptSequence: async () => 1,
        createPayment: async (data: any) => { capturedData = data; return { ...fakePayment, ...data }; },
        listFunds: async () => [],
      });

      const ctx = makeCtx({
        _body: {
          organizationId: 'org-1',
          personId: 'person-1',
          amount: 5000,
          paymentMethod: method,
        },
      });

      await recordPayment(ctx);
      expect(capturedData.paymentMethod).toBe(method);
    }
  });

  test('[BR-06] records payment date (paidAt) at creation time', async () => {
    let capturedData: any = null;
    const before = new Date();
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => { capturedData = data; return { ...fakePayment, ...data }; },
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

    await recordPayment(ctx);
    const after = new Date();
    expect(capturedData.paidAt).toBeInstanceOf(Date);
    expect(capturedData.paidAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(capturedData.paidAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  test('[BR-06] includes fund breakdown when funds configured', async () => {
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
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    expect(capturedAllocations).toHaveLength(2);
    // Each allocation links back to the payment and fund
    expect(capturedAllocations[0].paymentId).toBeTruthy();
    expect(capturedAllocations[0].fundId).toBe('fund-1');
    expect(capturedAllocations[1].fundId).toBe('fund-2');
    expect(capturedAllocations[0].isReversal).toBe(false);
  });

  // ─── [BR-07] Expiry extension on payment ──────────────

  test('[BR-07] extends dues expiry from current expiry on payment', async () => {
    let capturedExpiry: Date | null = null;
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      getMembershipForExpiry: async () => ({
        duesExpiryDate: new Date('2026-08-01'),
        billingCycle: 'annual' as const,
        customMonths: null,
      }),
      updateDuesExpiry: async (_orgId: string, _personId: string, expiry: Date) => {
        capturedExpiry = expiry;
      },
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    // [BR-07] Extend from current expiry (2026-08-01), not today
    expect(capturedExpiry).toEqual(new Date('2027-08-01'));
  });

  test('[BR-07] severely lapsed member gets expiry from today', async () => {
    let capturedExpiry: Date | null = null;
    const now = new Date();
    // Set current expiry to 2 years ago (way more than 1 annual cycle)
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      getMembershipForExpiry: async () => ({
        duesExpiryDate: twoYearsAgo,
        billingCycle: 'annual' as const,
        customMonths: null,
      }),
      updateDuesExpiry: async (_orgId: string, _personId: string, expiry: Date) => {
        capturedExpiry = expiry;
      },
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    // Severely lapsed → expiry should be ~12 months from now
    const expectedYear = now.getFullYear() + 1;
    expect(capturedExpiry!.getFullYear()).toBe(expectedYear);
  });

  test('[BR-06] no fund allocations when zero funds configured', async () => {
    let allocCalled = false;
    mocks = stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      createFundAllocations: async () => { allocCalled = true; },
    });

    const ctx = makeCtx({
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        paymentMethod: 'cash',
      },
    });

    await recordPayment(ctx);
    expect(allocCalled).toBe(false);
  });
});
