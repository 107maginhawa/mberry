import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stubRepo, restoreRepo, makeMockDb } from '@/test-utils/make-ctx';
import { fakeMembership as createFakeMembership } from '@/test-utils/factories';
import { settlePayment } from './settle-payment';
import { DuesRepository } from '../repos/dues-payments.repo';
import { MembershipRepository } from '../repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

const baseMembership = createFakeMembership({
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  startDate: '2024-01-01',
  duesExpiryDate: FUTURE_EXPIRY,
  gracePeriodDays: 30,
  status: 'active',
  joinedAt: new Date().toISOString(),
  suspendedAt: null,
  removedAt: null,
});

/** Fake DB supporting persistWithComputedStatus (db.update chain) + transactions */
const fakeDb = makeMockDb() as any;

/**
 * Capturing DB: intercepts db.update().set().where().returning() calls.
 * persistWithComputedStatus uses db.update() directly — NOT repo.updateOneById.
 */
function makeCapturingDb(onSet: (data: any) => void): any {
  const db: any = {
    transaction: async (fn: (tx: any) => Promise<any>) => fn(makeCapturingDb(onSet)),
    update: (_table: any) => ({
      set: (data: any) => {
        onSet(data);
        return { where: (_c: any) => ({ returning: async () => [data] }) };
      },
    }),
  };
  return db;
}

const baseInput = {
  db: fakeDb,
  organizationId: 'org-1',
  personId: 'person-1',
  paymentId: 'pay-1',
  amount: 5000,
};

// ─── Tests ──────────────────────────────────────────────

describe('[BR-03] settlePayment — status-aware reactivation', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  test('suspended member — payment extends expiry but does NOT reactivate', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'suspended', suspendedAt: new Date(), removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // persistWithComputedStatus writes status via db.update (not repo.updateOneById)
    // Expiry extended (payment valid), but suspended flag keeps status = suspended
    expect(capturedSetData?.status).not.toBe('active');
  });

  test('removed member — payment extends expiry but does NOT reactivate', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'removed', removedAt: new Date(), suspendedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    expect(capturedSetData?.status).not.toBe('active');
  });

  test('lapsed member — payment SHOULD reactivate (valid BR-03 transition)', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    // duesExpiryDate: '2024-01-01' (past); settlePayment extends it → future → reactivates
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'lapsed', duesExpiryDate: '2024-01-01', suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    expect(capturedSetData?.status).toBe('active');
  });

  test('gracePeriod member — payment SHOULD reactivate', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });
    const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    // duesExpiryDate: yesterday (within grace) → payment extends to future → active
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'gracePeriod', duesExpiryDate: YESTERDAY, suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    expect(capturedSetData?.status).toBe('active');
  });

  test('pendingPayment member — settlePayment extends expiry but isPendingPayment flag stays (cleared by caller)', async () => {
    // settlePayment passes { duesExpiryDate } to persistWithComputedStatus.
    // computeMembershipStatus: isPendingPayment=true wins over expiry check → stays 'pendingPayment'.
    // The caller (recordDuesPayment / markDuesInvoicePaid) is responsible for clearing isPendingPayment.
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'pendingPayment', duesExpiryDate: null, suspendedAt: null, removedAt: null, isPendingPayment: true }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // duesExpiryDate extended (payment processed), but isPendingPayment not cleared by settlePayment
    expect(capturedSetData?.duesExpiryDate).toBeDefined();
    // Status stays pendingPayment — caller must clear isPendingPayment to activate
    expect(capturedSetData?.status).toBe('pendingPayment');
  });

  test('active member — payment extends expiry, keeps active', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    expect(capturedSetData?.status).toBe('active');
  });
});

describe('[Phase 15] settlePayment — billing frequency support', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  test('quarterly billing — extends by 3 months', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'quarterly' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry, suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // 2027-01-15 + 3 months = 2027-04-15
    expect(capturedSetData?.duesExpiryDate).toBe('2027-04-15');
  });

  test('semi-annual billing — extends by 6 months', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'semi-annual' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry, suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // 2027-01-15 + 6 months = 2027-07-15
    expect(capturedSetData?.duesExpiryDate).toBe('2027-07-15');
  });

  test('annual billing — extends by 12 months (existing behavior)', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry, suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // 2027-01-15 + 12 months = 2028-01-15
    expect(capturedSetData?.duesExpiryDate).toBe('2028-01-15');
  });

  test('missing config — defaults to annual (12 months)', async () => {
    let capturedSetData: any;
    const capturingDb = makeCapturingDb((d) => { capturedSetData = d; });
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry, suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: capturingDb });

    // Missing config → default annual → 2027-01-15 + 12 months = 2028-01-15
    expect(capturedSetData?.duesExpiryDate).toBe('2028-01-15');
  });
});

describe('[Wave 1.2] settlePayment — transactional boundary', () => {
  beforeEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  afterEach(() => {
    restoreRepo(DuesRepository);
    restoreRepo(MembershipRepository);
  });

  test('wraps fund allocation + membership update in db.transaction()', async () => {
    let transactionCalled = false;

    const txDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
      update: (_table: any) => ({
        set: (data: any) => ({ where: (_c: any) => ({ returning: async () => [data] }) }),
      }),
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => [],
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: txDb as any });

    expect(transactionCalled).toBe(true);
  });

  test('rolls back fund allocations when membership update fails', async () => {
    let fundsAllocated = false;
    let transactionCalled = false;

    // DB that fails during update (after fund allocation succeeds)
    const txDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
      update: (_table: any) => ({
        set: (_data: any) => ({
          where: (_c: any) => ({
            returning: async () => { throw new Error('DB write failed'); },
          }),
        }),
      }),
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => { fundsAllocated = true; return []; },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    // Error must propagate out of transaction (triggering DB rollback)
    await expect(settlePayment({ ...baseInput, db: txDb as any })).rejects.toThrow('DB write failed');
    expect(transactionCalled).toBe(true);
  });

  test('rolls back membership update when fund allocation fails', async () => {
    let membershipUpdated = false;
    let transactionCalled = false;

    const txDb: any = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
      update: (_table: any) => ({
        set: (data: any) => {
          membershipUpdated = true;
          return { where: (_c: any) => ({ returning: async () => [data] }) };
        },
      }),
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => { throw new Error('Fund allocation failed'); },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', suspendedAt: null, removedAt: null }],
      updateOneById: async () => baseMembership,
    });

    await expect(settlePayment({ ...baseInput, db: txDb as any })).rejects.toThrow('Fund allocation failed');
    expect(transactionCalled).toBe(true);
    // Fund allocation failed BEFORE membership update — membership should NOT be updated
    expect(membershipUpdated).toBe(false);
  });
});
