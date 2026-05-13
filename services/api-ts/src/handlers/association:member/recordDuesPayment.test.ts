import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { recordDuesPayment } from './recordDuesPayment';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { MembershipRepository } from './repos/membership.repo';
import { OfficerTermRepository } from './repos/governance.repo';

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
};

const fakeFunds = [
  { id: 'fund-1', organizationId: 'org-1', name: 'General Fund', percentage: '60', sortOrder: 1, active: true },
  { id: 'fund-2', organizationId: 'org-1', name: 'Education Fund', percentage: '25', sortOrder: 2, active: true },
  { id: 'fund-3', organizationId: 'org-1', name: 'Welfare Fund', percentage: '15', sortOrder: 3, active: true },
];

const fakeMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  duesExpiryDate: '2025-06-30',
  status: 'active',
};

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
      listFunds: async () => fakeFunds,
      createFundAllocations: async (allocs: any[]) => { capturedAllocations = allocs; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
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
      listFunds: async () => thirdFunds,
      createFundAllocations: async (allocs: any[]) => { capturedAllocations = allocs; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
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
      listFunds: async () => [],
      createFundAllocations: async () => { allocCalled = true; },
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
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
    let updatedExpiry: string | undefined;
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership, duesExpiryDate: '2025-12-31' }],
      updateOneById: async (_id: string, updates: any) => {
        updatedExpiry = updates.duesExpiryDate;
        return fakeMembership;
      },
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

    await recordDuesPayment(ctx);
    // Should extend from 2025-12-31 by 12 months → 2026-12-31
    expect(updatedExpiry).toBeDefined();
    expect(updatedExpiry!.startsWith('2026-12')).toBe(true);
  });

  test('skips extension when no membership found', async () => {
    let updateCalled = false;
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 1,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      updatePaymentStatus: async () => fakePayment,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [],
      updateOneById: async () => { updateCalled = true; return fakeMembership; },
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

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    expect(updateCalled).toBe(false);
  });

  test('generates receipt number in org sequence', async () => {
    stubRepo(DuesRepository, {
      findRecentPaymentForPerson: async () => undefined,
      getNextReceiptSequence: async () => 42,
      createPayment: async (data: any) => ({ ...fakePayment, ...data }),
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
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
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
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
      listFunds: async () => [],
      updatePaymentStatus: async (_id: string, _s: string, extra: any) => ({ ...fakePayment, ...extra }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [fakeMembership],
      updateOneById: async () => fakeMembership,
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

    const response = await recordDuesPayment(ctx);
    expect(response.status).toBe(201);
    const body = (response as any).body;
    expect(body.meta.concurrentWarning).toBe(false);
  });
});
