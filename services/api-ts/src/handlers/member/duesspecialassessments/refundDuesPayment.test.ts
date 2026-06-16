// Business Rules: [BR-08]
import { describe, test, expect, afterEach, beforeEach, spyOn } from 'bun:test';
import { makeCtx, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { fakeDuesPayment as createFakeDuesPayment, fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { refundDuesPayment } from './refundDuesPayment';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';

// ─── Fixtures ───────────────────────────────────────────

const fakePayment = createFakeDuesPayment({
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
  // A completed payment always carries a paidAt in production
  // (recordDuesPayment/settlePayment set it). Recent date keeps the refund
  // inside the 30-day BR-08 window so eligibility passes for these flow tests.
  paidAt: new Date(),
  membershipExtendedFrom: '2025-06-30',
  membershipExtendedTo: '2026-06-30',
});

const fakeAllocations = [
  { id: 'alloc-1', paymentId: 'pay-1', fundId: 'fund-1', amount: 3000, isReversal: false, organizationId: 'org-1' },
  { id: 'alloc-2', paymentId: 'pay-1', fundId: 'fund-2', amount: 1250, isReversal: false, organizationId: 'org-1' },
  { id: 'alloc-3', paymentId: 'pay-1', fundId: 'fund-3', amount: 750, isReversal: false, organizationId: 'org-1' },
];

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

const fakeMembership = createFakeMembership({
  id: 'mem-1',
  personId: 'person-1',
  duesExpiryDate: FUTURE_EXPIRY,
  suspendedAt: null,
  removedAt: null,
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
      getPaymentForUpdate: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      organizationId: 'org-1',
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
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((data) => { capturedSetData = data; });

    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getPaymentForUpdate: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{
        ...fakeMembership,
        duesExpiryDate: '2026-06-30', // current (post-payment)
      }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: capturingDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await refundDuesPayment(ctx);

    // persistWithComputedStatus writes duesExpiryDate via db.update (not repo.updateOneById)
    // Should reset to pre-payment expiry (membershipExtendedFrom)
    expect(capturedSetData).toBeDefined();
    expect(capturedSetData.duesExpiryDate).toBe('2025-06-30');
  });

  test('partial refund creates proportional reversal entries', async () => {
    let capturedReversals: any[] = [];

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000 }),
      getPaymentForUpdate: async () => ({ ...fakePayment, amount: 5000 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async (allocs: any[]) => { capturedReversals = allocs; },
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDb,
      organizationId: 'org-1',
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
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((data) => { capturedSetData = data; });

    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2024-01-01', // pre-payment expiry in the past
        membershipExtendedTo: '2026-06-30',
      }),
      getPaymentForUpdate: async () => ({
        ...fakePayment,
        membershipExtendedFrom: '2024-01-01', // pre-payment expiry in the past
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
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
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: capturingDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await refundDuesPayment(ctx);

    // persistWithComputedStatus writes duesExpiryDate + status via db.update (not repo.updateOneById)
    // Pre-payment expiry was 2024-01-01 (past) — after reversal should be lapsed
    expect(capturedSetData).toBeDefined();
    expect(capturedSetData.duesExpiryDate).toBe('2024-01-01');
    expect(capturedSetData.status).toBe('lapsed');
  });

  test('all operations wrapped in db.transaction()', async () => {
    let transactionCalled = false;

    const txDbTracking: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbTracking);
      },
      update: (_table: any) => ({
        set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
      }),
    };

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      getPaymentForUpdate: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDbTracking,
      organizationId: 'org-1',
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
      organizationId: 'org-1',
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
      organizationId: 'org-1',
      _params: { paymentId: 'nonexistent' },
      _body: {},
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow('Dues payment');
  });

  test('partial refund sets status to partiallyRefunded', async () => {
    let capturedStatus: string | undefined;

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getPaymentForUpdate: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
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
      organizationId: 'org-1',
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
      getPaymentForUpdate: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
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
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {}, // no amount = full refund
    });

    await refundDuesPayment(ctx);
    expect(capturedStatus).toBe('refunded');
  });

  test('rolls back all operations when membership update fails', async () => {
    let transactionCalled = false;

    // DB that throws during update (simulates write failure triggering rollback)
    const txDbTracking: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDbTracking);
      },
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: (_c: any) => ({
            returning: async () => { throw new Error('Membership update failed'); },
          }),
        }),
      }),
    };

    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment }),
      getPaymentForUpdate: async () => ({ ...fakePayment }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: txDbTracking,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {},
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow('Membership update failed');
    expect(transactionCalled).toBe(true);
  });

  // ─── FIX-007: over-refund cap + validateRefundEligibility wiring ──────────
  // The handler must not let repeated partial refunds exceed the original
  // payment. It must wire the existing validateRefundEligibility util (BR-08):
  // a requested amount > (amount - alreadyRefunded) is rejected, and the
  // refund must never be processed (no fund reversal, no membership change).

  test('[FIX-007] rejects refund exceeding remaining refundable (partial already refunded)', async () => {
    let refundProcessed = false;
    const recentPaidAt = new Date(); // within the 30-day window
    stubRepo(DuesRepository, {
      // 5000 payment, 3000 already refunded → only 2000 remaining
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 3000,
        status: 'partiallyRefunded',
        paidAt: recentPaidAt,
      }),
      getPaymentForUpdate: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 3000,
        status: 'partiallyRefunded',
        paidAt: recentPaidAt,
      }),
      getFundAllocations: async () => { refundProcessed = true; return [...fakeAllocations]; },
      createFundAllocations: async () => { refundProcessed = true; },
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        refundProcessed = true;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => { refundProcessed = true; return [{ ...fakeMembership }]; },
      updateOneById: async () => { refundProcessed = true; return fakeMembership; },
    });

    const ctx = makeCtx({
      database: txDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: { amount: 3000 }, // 3000 > 2000 remaining → over-refund
    });

    // Must reject (thrown error) and NOT touch funds/membership.
    await expect(refundDuesPayment(ctx)).rejects.toThrow();
    expect(refundProcessed).toBe(false);
  });

  test('[FIX-007] allows refund within remaining refundable; cumulative-full → status refunded', async () => {
    let capturedRefundedAmount: number | undefined;
    let capturedStatus: string | undefined;
    const recentPaidAt = new Date();
    stubRepo(DuesRepository, {
      // 5000 payment, 3000 already refunded → 2000 remaining
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 3000,
        status: 'partiallyRefunded',
        paidAt: recentPaidAt,
      }),
      getPaymentForUpdate: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 3000,
        status: 'partiallyRefunded',
        paidAt: recentPaidAt,
      }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        capturedRefundedAmount = extra?.refundedAmount;
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
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2000 }, // exactly the remaining → allowed
    });

    const res = await refundDuesPayment(ctx);
    expect(res.status).toBe(200);
    // Cumulative refunded must equal the full original (3000 + 2000 = 5000)
    expect(capturedRefundedAmount).toBe(5000);
    // A refund that brings cumulative to the full amount IS a full refund.
    expect(capturedStatus).toBe('refunded');
  });

  test('[FIX-007] genuinely-partial refund (below full) stays partiallyRefunded and does NOT reverse expiry (Q-PD2 boundary)', async () => {
    // Q-PD2 (partial-refund expiry reversal) is product-gated. This test pins
    // the *current* behavior: a refund below the cumulative-full amount must
    // NOT reset duesExpiryDate (only full refunds reverse expiry today).
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((data) => { capturedSetData = data; });
    const recentPaidAt = new Date();

    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 0,
        status: 'completed',
        paidAt: recentPaidAt,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getPaymentForUpdate: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 0,
        status: 'completed',
        paidAt: recentPaidAt,
        membershipExtendedFrom: '2025-06-30',
        membershipExtendedTo: '2026-06-30',
      }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership, duesExpiryDate: '2026-06-30' }],
      updateOneById: async () => fakeMembership,
    });

    const ctx = makeCtx({
      database: capturingDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: { amount: 2500 }, // 50% partial — below cumulative full
    });

    const res = await refundDuesPayment(ctx);
    expect(res.status).toBe(200);
    // Genuinely-partial refund: persistWithComputedStatus (expiry reset) must
    // NOT have been invoked — capturedSetData stays undefined.
    expect(capturedSetData).toBeUndefined();
  });

  test('[FIX-007] rejects refund outside the 30-day window (eligibility wired)', async () => {
    let refundProcessed = false;
    const oldPaidAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days ago
    stubRepo(DuesRepository, {
      getPayment: async () => ({
        ...fakePayment,
        amount: 5000,
        refundedAmount: 0,
        status: 'completed',
        paidAt: oldPaidAt,
      }),
      getFundAllocations: async () => { refundProcessed = true; return [...fakeAllocations]; },
      createFundAllocations: async () => { refundProcessed = true; },
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => {
        refundProcessed = true;
        return { ...fakePayment, status, ...extra };
      },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => { refundProcessed = true; return [{ ...fakeMembership }]; },
      updateOneById: async () => { refundProcessed = true; return fakeMembership; },
    });

    const ctx = makeCtx({
      database: txDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {}, // full refund attempt, but outside window
    });

    await expect(refundDuesPayment(ctx)).rejects.toThrow();
    expect(refundProcessed).toBe(false);
  });

  // [EM-M06] Wave 26 — dues lifecycle event
  test('emits dues.payment.refunded after successful refund', async () => {
    stubRepo(DuesRepository, {
      getPayment: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getPaymentForUpdate: async () => ({ ...fakePayment, amount: 5000, refundedAmount: 0 }),
      getFundAllocations: async () => [...fakeAllocations],
      createFundAllocations: async () => {},
      updatePaymentStatus: async (_id: string, _cur: string, status: string, extra: any) => ({
        ...fakePayment, status, ...extra,
      }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...fakeMembership }],
      updateOneById: async () => fakeMembership,
    });

    const emitSpy = spyOn(domainEvents, 'emit');
    const ctx = makeCtx({
      database: txDb,
      organizationId: 'org-1',
      _params: { paymentId: 'pay-1' },
      _body: {}, // full refund
    });

    await refundDuesPayment(ctx);

    const call = emitSpy.mock.calls.find((c) => c[0] === 'dues.payment.refunded');
    expect(call).toBeDefined();
    expect(call?.[1]).toMatchObject({
      paymentId: 'pay-1',
      personId: 'person-1',
      refundAmount: 5000,
      isFullRefund: true,
    });
    emitSpy.mockRestore();
  });
});
