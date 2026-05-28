// Business Rules: [BR-06]
import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesPayment as createFakeDuesPayment, fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { recordDuesPayment } from './recordDuesPayment';
import { DuesRepository } from './repos/dues-payments.repo';
import { MembershipRepository } from './repos/membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';
import { DuesInvoiceRepository } from './repos/dues.repo';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = createFakeDuesPayment({
  id: 'pay-1',
  personId: 'person-1',
  receiptNumber: 'ORG-2025-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash',
  status: 'completed',
  refundedAmount: 0,
  recordedBy: 'user-1',
});

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '60', sortOrder: 1, active: true },
  { id: 'fund-2', organizationId: 'org-1', name: 'Education Fund', percentage: '25', sortOrder: 2, active: true },
  { id: 'fund-3', organizationId: 'org-1', name: 'Welfare Fund', percentage: '15', sortOrder: 3, active: true },
];

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'person-1',
  duesExpiryDate: FUTURE_EXPIRY,
});

/** Fake DB supporting persistWithComputedStatus (db.update chain) + transactions */
const txDb = makeMockDb();

/**
 * Capturing DB mock: intercepts db.update().set().where().returning() calls
 * so tests can verify what was written (status, duesExpiryDate) by persistWithComputedStatus.
 */
function makeCapturingDb(onSet: (data: any) => void) {
  const base = makeMockDb();
  return {
    ...base,
    transaction: async (fn: any) => fn(makeCapturingDb(onSet)),
    update: (_table: any) => ({
      set: (data: any) => {
        onSet(data);
        return { where: (_c: any) => ({ returning: async () => [data] }) };
      },
    }),
  };
}

// ─── Helpers ────────────────────────────────────────────

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[BR-06] recordDuesPayment fund allocation', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('splits payment across 3 funds correctly', async () => {
    let capturedAllocations: any[] = [];
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => fakeFunds,
      createFundAllocations: async (allocs: any[]) => { capturedAllocations = allocs; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(capturedAllocations.length).toBe(3);

    // 60% of 5000 = 3000, 25% = 1250, 15% (last) = 750
    const amounts = capturedAllocations.map((a: any) => a.amount);
    expect(amounts[0]).toBe(3000);
    expect(amounts[1]).toBe(1250);
    expect(amounts[2]).toBe(750); // last fund absorbs remainder
  });

  test('last fund absorbs rounding remainder (33.33% × 3)', async () => {
    let capturedAllocations: any[] = [];
    const thirdFunds = [
      { id: 'f-1', organizationId: 'org-1', name: 'Fund A', percentage: '33.33', sortOrder: 1, active: true },
      { id: 'f-2', organizationId: 'org-1', name: 'Fund B', percentage: '33.33', sortOrder: 2, active: true },
      { id: 'f-3', organizationId: 'org-1', name: 'Fund C', percentage: '33.34', sortOrder: 3, active: true },
    ];

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data, amount: 10000 }),
      getConfig: async () => undefined,
      listFunds: async () => thirdFunds,
      createFundAllocations: async (allocs: any[]) => { capturedAllocations = allocs; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 10000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);

    // Sum must equal total amount exactly
    const total = capturedAllocations.reduce((sum: number, a: any) => sum + a.amount, 0);
    expect(total).toBe(10000);
  });

  test('skips fund allocation when no funds configured', async () => {
    let allocCalled = false;
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      createFundAllocations: async () => { allocCalled = true; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(allocCalled).toBe(false);
  });
});

describe('[BR-07] recordDuesPayment expiry extension', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('extends annual member by 12 months from current expiry', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((data) => { capturedSetData = data; });

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership, duesExpiryDate: '2025-12-31' }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: capturingDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    await recordDuesPayment(ctx);
    // persistWithComputedStatus writes duesExpiryDate via db.update (not repo.updateOneById)
    // Extended from 2025-12-31 by 12 months → 2026-12-31
    expect(capturedSetData).toBeDefined();
    expect(capturedSetData.duesExpiryDate.startsWith('2026-12')).toBe(true);
  });

  test('skips extension when no membership found', async () => {
    let updateCalled = false;
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async () => fakePayment,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [],
      updateOneById: async () => { updateCalled = true; return fakeMembership; },
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(updateCalled).toBe(false);
  });

  test('generates receipt number in org sequence', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 42,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    // Receipt should contain sequence 42
    const body = (response as any).body;
    expect(body.receiptNumber).toContain('000042');
  });
});

describe('[BR-06] recordDuesPayment concurrent guard', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('warns when recent payment exists for same member', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => ({ id: 'recent-pay', amount: 5000 }),
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    const body = (response as any).body;
    expect(body.meta.concurrentWarning).toBe(true);
  });

  test('proceeds without warning when no recent payment', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    const body = (response as any).body;
    expect(body.meta.concurrentWarning).toBe(false);
  });
});

describe('recordDuesPayment transaction atomicity', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('rolls back payment when settlement fails — createPayment inside outer transaction', async () => {
    /**
     * This test verifies that createPayment and settlePayment both run inside
     * a single outer db.transaction(). If createPayment runs outside a transaction
     * (current bug), the payment persists even when settlement fails.
     *
     * Strategy: track the call order. If the handler wraps everything in
     * db.transaction(), the sequence is: transaction → createPayment → settlePayment.
     * If NOT wrapped, the sequence is: createPayment → transaction (from settlePayment).
     */
    const callOrder: string[] = [];

    const rawDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        callOrder.push('transaction');
        const txObj: any = {
          transaction: async (innerFn: (t: any) => Promise<any>) => {
            callOrder.push('nested-transaction');
            return innerFn(txObj);
          },
          update: (_table: any) => ({
            set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
          }),
        };
        return fn(txObj);
      },
      update: (_table: any) => ({
        set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
      }),
    };

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => {
        callOrder.push('createPayment');
        return { ...fakePayment, ...data };
      },
      getConfig: async () => undefined,
      listFunds: async () => { throw new Error('Settlement DB failure'); },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: rawDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    await expect(recordDuesPayment(ctx)).rejects.toThrow('Settlement DB failure');

    // Verify transaction is opened BEFORE createPayment (atomicity guarantee)
    const txIdx = callOrder.indexOf('transaction');
    const createIdx = callOrder.indexOf('createPayment');
    expect(txIdx).toBeGreaterThanOrEqual(0);
    expect(createIdx).toBeGreaterThan(txIdx);
  });

  test('happy path: payment + settlement wrapped in single outer transaction', async () => {
    let outerTxCallCount = 0;

    const singleTxDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        outerTxCallCount++;
        const txObj: any = {
          transaction: async (innerFn: (t: any) => Promise<any>) => innerFn(txObj),
          update: (_table: any) => ({
            set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
          }),
        };
        return fn(txObj);
      },
      update: (_table: any) => ({
        set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
      }),
    };

    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => fakeFunds,
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: singleTxDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    // Handler must call db.transaction() exactly once as the outer wrapper
    expect(outerTxCallCount).toBe(1);
  });
});

describe('[PAY-01] invoice linking on payment recording', () => {
  let officerMocks: ReturnType<typeof stubRepo>;

  const fakeInvoice = {
    id: 'inv-1',
    membershipId: 'mem-1',
    personId: 'person-1',
    organizationId: 'tenant-1',  // matches makeCtx default organizationId
    invoiceNumber: 'INV-2025-001',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    totalAmount: 5000,
    status: 'sent',
    version: 2,
    generatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
    officerMocks = stubOfficerAccess();
  });

  afterEach(() => {
    Object.values(officerMocks).forEach((m) => m.mockRestore());
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
    restoreRepo(OfficerTermRepository);
    restoreRepo(DuesInvoiceRepository);
  });

  test('when invoiceId provided, markPaid is called with correct invoiceId and version inside transaction', async () => {
    let markPaidCalled = false;
    let markPaidInvoiceId: string | undefined;
    let markPaidVersion: number | undefined;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => fakeInvoice,
      markPaid: async (invoiceId: string, expectedVersion: number, paymentId: string, paidAt?: Date) => {
        markPaidCalled = true;
        markPaidInvoiceId = invoiceId;
        markPaidVersion = expectedVersion;
        return { ...fakeInvoice, status: 'paid', version: 3 };
      },
    });
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
        invoiceId: 'inv-1',
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(markPaidCalled).toBe(true);
    expect(markPaidInvoiceId).toBe('inv-1');
    expect(markPaidVersion).toBe(2);
  });

  test('when invoiceId NOT provided, markPaid is NOT called', async () => {
    let markPaidCalled = false;

    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => fakeInvoice,
      markPaid: async () => { markPaidCalled = true; return { ...fakeInvoice, status: 'paid' }; },
    });
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'org-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
        // No invoiceId
      },
    });

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(markPaidCalled).toBe(false);
  });

  test('when invoiceId has non-payable status, throws BusinessLogicError', async () => {
    stubRepo(DuesInvoiceRepository, {
      findOneById: async () => ({ ...fakeInvoice, status: 'cancelled', version: 1, organizationId: 'tenant-1' }),
      markPaid: async () => { throw new Error('should not be called'); },
    });
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      getConfig: async () => undefined,
      listFunds: async () => [],
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _body: {
        organizationId: 'tenant-1',
        personId: 'person-1',
        amount: 5000,
        currency: 'PHP',
        paymentMethod: 'cash',
        invoiceId: 'inv-1',
      },
    });

    await expect(recordDuesPayment(ctx)).rejects.toThrow("Cannot pay invoice with status 'cancelled'");
  });
});
