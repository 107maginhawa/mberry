import { describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { refundPayment } from './refundPayment';
import { DuesRepository } from './repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';

// ─── Fixtures ───────────────────────────────────────────

const NOW = new Date('2026-06-15T12:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

const fakePayment = {
  id: 'pay-1',
  organizationId: 'org-1',
  personId: 'person-1',
  receiptNumber: 'ORG-2026-000001',
  amount: 5000,
  currency: 'PHP',
  paymentMethod: 'cash' as const,
  status: 'completed' as const,
  refundedAmount: 0,
  recordedBy: 'user-1',
  paidAt: daysAgo(5),
  membershipExtendedFrom: '2026-05-30',
  membershipExtendedTo: '2027-05-30',
  createdAt: daysAgo(5),
  updatedAt: daysAgo(5),
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
  duesExpiryDate: '2027-05-30',
  status: 'active',
  suspendedAt: null,
  removedAt: null,
};

/** Fake DB that passes tx through to callback (simulates transaction) */
const txDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(txDb),
};

// ─── Helpers ────────────────────────────────────────────

function stubOfficerAccess(title: string = 'Treasurer') {
  return stubRepo(OfficerTermRepository, {
    findActiveByPersonAndOrg: async () => [{ positionTitle: title }],
  });
}

function stubDuesRepo(overrides: Partial<Record<string, (...args: any[]) => any>> = {}) {
  return stubRepo(DuesRepository, {
    getPayment: async () => ({ ...fakePayment }),
    getFundAllocations: async () => [...fakeAllocations],
    createFundAllocations: async () => {},
    updatePaymentStatus: async (_id: string, status: string, extra: any) => ({
      ...fakePayment, status, ...extra,
    }),
    ...overrides,
  });
}

function stubMembershipRepo(overrides: Partial<Record<string, (...args: any[]) => any>> = {}) {
  return stubRepo(MembershipRepository, {
    findMany: async () => [{ ...fakeMembership }],
    updateOneById: async () => fakeMembership,
    ...overrides,
  });
}

// ─── Tests ──────────────────────────────────────────────

describe('[008] refundPayment — BR-08 refund handler', () => {
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

  // ─── BR-08: 30-day window enforcement ──────────────────

  test('rejects refund when payment is older than 30 days', async () => {
    stubDuesRepo({
      getPayment: async () => ({ ...fakePayment, paidAt: daysAgo(31) }),
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Customer request' },
    });

    await expect(refundPayment(ctx, NOW)).rejects.toThrow('Refund window expired');
  });

  test('allows refund within 30-day window', async () => {
    stubDuesRepo({
      getPayment: async () => ({ ...fakePayment, paidAt: daysAgo(15) }),
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Customer request' },
    });

    const response = await refundPayment(ctx, NOW);
    expect(response.status).toBe(200);
  });

  // ─── Payment status → refunded ─────────────────────────

  test('full refund sets status to refunded', async () => {
    let capturedStatus: string | undefined;

    stubDuesRepo({
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedStatus = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Full refund requested' },
    });

    await refundPayment(ctx, NOW);
    expect(capturedStatus).toBe('refunded');
  });

  test('partial refund sets status to partiallyRefunded', async () => {
    let capturedStatus: string | undefined;

    stubDuesRepo({
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedStatus = status;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2500, reason: 'Partial refund' },
    });

    await refundPayment(ctx, NOW);
    expect(capturedStatus).toBe('partiallyRefunded');
  });

  // ─── Fund allocation reversal ──────────────────────────

  test('full refund reverses all fund allocations with negative amounts', async () => {
    let capturedReversals: any[] = [];

    stubDuesRepo({
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Full refund' },
    });

    await refundPayment(ctx, NOW);

    expect(capturedReversals).toHaveLength(3);
    for (const rev of capturedReversals) {
      expect(rev.isReversal).toBe(true);
      expect(rev.amount).toBeLessThan(0);
    }
    expect(capturedReversals[0].amount).toBe(-3000);
    expect(capturedReversals[1].amount).toBe(-1250);
    expect(capturedReversals[2].amount).toBe(-750);
  });

  test('partial refund creates proportional reversal entries', async () => {
    let capturedReversals: any[] = [];

    stubDuesRepo({
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2500, reason: 'Partial' }, // 50%
    });

    await refundPayment(ctx, NOW);

    expect(capturedReversals).toHaveLength(3);
    expect(capturedReversals[0].amount).toBe(-1500); // 3000 * 0.5
    expect(capturedReversals[1].amount).toBe(-625);  // 1250 * 0.5
    expect(capturedReversals[2].amount).toBe(-375);  // 750 * 0.5
  });

  // ─── Membership status recomputation after refund ──────

  test('full refund resets duesExpiryDate to pre-payment value', async () => {
    let updatedMembership: any;

    stubDuesRepo({
      getPayment: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2026-05-30',
        membershipExtendedTo: '2027-05-30',
      }),
    });
    stubMembershipRepo({
      updateOneById: async (_id: string, updates: any) => {
        updatedMembership = updates;
        return fakeMembership;
      },
    });

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    await refundPayment(ctx, NOW);

    expect(updatedMembership).toBeDefined();
    expect(updatedMembership.duesExpiryDate).toBe('2026-05-30');
  });

  // ─── Refund date and reason recorded ───────────────────

  test('records refund_date and refund_reason on payment', async () => {
    let capturedExtra: any;

    stubDuesRepo({
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedExtra = extra;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Customer changed mind' },
    });

    await refundPayment(ctx, NOW);

    expect(capturedExtra.refundReason).toBe('Customer changed mind');
    expect(capturedExtra.refundDate).toBeInstanceOf(Date);
  });

  // ─── Permission checks ────────────────────────────────

  test('requires Treasurer or President position', async () => {
    restoreRepo(OfficerTermRepository);
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubDuesRepo();
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    const response = await refundPayment(ctx, NOW);
    expect(response.status).toBe(403);
  });

  test('Treasurer can initiate refund', async () => {
    restoreRepo(OfficerTermRepository);
    stubOfficerAccess('Treasurer');
    stubDuesRepo();
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    const response = await refundPayment(ctx, NOW);
    expect(response.status).toBe(200);
  });

  test('President can initiate refund', async () => {
    restoreRepo(OfficerTermRepository);
    stubOfficerAccess('President');
    stubDuesRepo();
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    const response = await refundPayment(ctx, NOW);
    expect(response.status).toBe(200);
  });

  // ─── Edge cases ────────────────────────────────────────

  test('payment not found throws NotFoundError', async () => {
    stubDuesRepo({ getPayment: async () => undefined });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'nonexistent' },
      _body: { reason: 'Refund' },
    });

    await expect(refundPayment(ctx, NOW)).rejects.toThrow();
  });

  test('already refunded payment throws ALREADY_REFUNDED', async () => {
    stubDuesRepo({
      getPayment: async () => ({ ...fakePayment, status: 'refunded' }),
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    await expect(refundPayment(ctx, NOW)).rejects.toThrow('Payment already fully refunded');
  });

  test('all operations wrapped in db.transaction()', async () => {
    let transactionCalled = false;
    const txDbTracking = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbTracking);
      },
    };

    stubDuesRepo();
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDbTracking,
      _params: { paymentId: 'pay-1' },
      _body: { reason: 'Refund' },
    });

    await refundPayment(ctx, NOW);
    expect(transactionCalled).toBe(true);
  });

  test('refund amount exceeding remaining throws error', async () => {
    stubDuesRepo({
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 3000,
      }),
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 3000, reason: 'Too much' },
    });

    await expect(refundPayment(ctx, NOW)).rejects.toThrow('exceeds refundable');
  });

  test('accumulates refundedAmount for partial refunds', async () => {
    let capturedExtra: any;

    stubDuesRepo({
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 2000,
        status: 'partiallyRefunded',
      }),
      updatePaymentStatus: async (_id: string, status: string, extra: any) => {
        capturedExtra = extra;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubMembershipRepo();

    const ctx = makeCtx({
      database: txDb,
      _params: { paymentId: 'pay-1' },
      _body: { amount: 1500, reason: 'Second partial refund' },
    });

    await refundPayment(ctx, NOW);

    // 2000 already refunded + 1500 new = 3500
    expect(capturedExtra.refundedAmount).toBe(3500);
  });
});
