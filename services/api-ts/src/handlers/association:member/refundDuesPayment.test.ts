import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { refundDuesPayment } from './refundDuesPayment';
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
  membershipExtendedFrom: '2025-06-30',
  membershipExtendedTo: '2026-06-30',
};

const fakeAllocations = [
  { id: 'alloc-1', paymentId: 'pay-1', fundId: 'fund-1', amount: 3000, isReversal: false, organizationId: 'org-1' },
  { id: 'alloc-2', paymentId: 'pay-1', fundId: 'fund-2', amount: 1250, isReversal: false, organizationId: 'org-1' },
  { id: 'alloc-3', paymentId: 'pay-1', fundId: 'fund-3', amount: 750, isReversal: false, organizationId: 'org-1' },
];

const fakeMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  duesExpiryDate: '2026-06-30',
  status: 'active',
  suspendedAt: null,
  removedAt: null,
};

/** Fake DB that passes tx through to callback (simulates transaction) */
const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
};

// ─── Helpers ────────────────────────────────────────────

function stubOfficerAccess() {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: 'Treasurer' }],
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[Phase15] refundDuesPayment — fund reversal + membership status', () => {
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

  test('full refund reverses all fund allocations with isReversal=true', async () => {
    let capturedReversals: any[] = [];

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: {}, // no amount = full refund
    });

    const response = await refundDuesPayment(ctx);
    expect(response.status).toBe(200);

    // Must create 3 reversal entries — one per original allocation
    expect(capturedReversals).toHaveLength(3);
    for (const rev of capturedReversals) {
      expect(rev.isReversal).toBe(true);
      expect(rev.amount).toBeLessThan(0);
      expect(rev.paymentId).toBe('pay-1');
    }
    // Verify exact reversal amounts (negative of originals)
    expect(capturedReversals[0].amount).toBe(-3000);
    expect(capturedReversals[1].amount).toBe(-1250);
    expect(capturedReversals[2].amount).toBe(-750);
  });

  test('full refund resets duesExpiryDate to pre-payment value', async () => {
    let updatedMembership: any;

    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        ...fakeMembership,
        duesExpiryDate: '2026-06-30', // current (post-payment)
      }],
      updateOneById: async (_id: string, updates: any) => {
        updatedMembership = updates;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await refundDuesPayment(ctx);

    // Should reset to pre-payment expiry (membershipExtendedFrom)
    expect(updatedMembership).toBeDefined();
    expect(updatedMembership.duesExpiryDate).toBe('2025-06-30');
  });

  test('partial refund creates proportional reversal entries', async () => {
    let capturedReversals: any[] = [];

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2500 }, // 50% refund
    });

    const response = await refundDuesPayment(ctx);
    expect(response.status).toBe(200);

    // 50% of each original allocation
    expect(capturedReversals).toHaveLength(3);
    for (const rev of capturedReversals) {
      expect(rev.isReversal).toBe(true);
      expect(rev.amount).toBeLessThan(0);
    }
    expect(capturedReversals[0].amount).toBe(-1500); // 3000 * 0.5
    expect(capturedReversals[1].amount).toBe(-625);  // 1250 * 0.5
    expect(capturedReversals[2].amount).toBe(-375);  // 750 * 0.5
  });

  test('refund recomputes membership status via computeMembershipStatus', async () => {
    let updatedMembership: any;

    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2024-01-01', // pre-payment expiry in the past
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        ...fakeMembership,
        duesExpiryDate: '2026-06-30',
        suspendedAt: null,
        removedAt: null,
      }],
      updateOneById: async (_id: string, updates: any) => {
        updatedMembership = updates;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await refundDuesPayment(ctx);

    // Pre-payment expiry was 2024-01-01 (past) — after reversal should be lapsed
    expect(updatedMembership).toBeDefined();
    expect(updatedMembership.duesExpiryDate).toBe('2024-01-01');
    expect(updatedMembership.status).toBe('lapsed');
  });

  test('all operations wrapped in db.transaction()', async () => {
    let transactionCalled = false;

    const txDbTracking = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbTracking);
      },
    };

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDbTracking,
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await refundDuesPayment(ctx);
    expect(transactionCalled).toBe(true);
  });

  test('already refunded payment throws ALREADY_REFUNDED', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, status: 'refunded' }),
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow('Payment already refunded');
  });

  test('payment not found throws NotFoundError', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => undefined,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'nonexistent' },
      _body: {},
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow('Dues payment');
  });

  test('partial refund sets status to partiallyRefunded', async () => {
    let capturedStatus: string | undefined;

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedStatus = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2500 },
    });

    await refundDuesPayment(ctx);
    expect(capturedStatus).toBe('partiallyRefunded');
  });

  test('full refund sets status to refunded', async () => {
    let capturedStatus: string | undefined;

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedStatus = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: {}, // no amount = full refund
    });

    await refundDuesPayment(ctx);
    expect(capturedStatus).toBe('refunded');
  });

  test('rolls back all operations when membership update fails', async () => {
    let transactionCalled = false;

    const txDbTracking = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbTracking);
      },
    };

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => { throw new Error('Membership update failed'); },
    });

    const ctx = makeCtx({
      database: txDbTracking,
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow('Membership update failed');
    expect(transactionCalled).toBe(true);
  });
});
