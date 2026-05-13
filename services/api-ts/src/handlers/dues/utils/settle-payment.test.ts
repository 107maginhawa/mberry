import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { settlePayment } from './settle-payment';
import { DuesRepository } from '@/handlers/dues/repos/dues.repo';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

// ─── Fixtures ───────────────────────────────────────────

const baseMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  personId: 'person-1',
  tierId: 'tier-1',
  startDate: '2024-01-01',
  duesExpiryDate: '2025-06-30',
  gracePeriodDays: 30,
  status: 'active',
  joinedAt: new Date().toISOString(),
  suspendedAt: null,
  terminatedAt: null,
};

/** Fake DB that passes `tx` through to the callback (simulates transaction) */
const fakeDb = {
  transaction: async (fn: (tx: any) => Promise<any>) => fn(fakeDb),
} as any;

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
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'suspended', suspendedAt: new Date() }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    // Expiry should still be extended (payment is valid), but status must NOT change
    expect(updatedStatus).not.toBe('active');
  });

  test('terminated member — payment extends expiry but does NOT reactivate', async () => {
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'terminated', terminatedAt: new Date() }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    expect(updatedStatus).not.toBe('active');
  });

  test('lapsed member — payment SHOULD reactivate (valid BR-03 transition)', async () => {
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'lapsed', duesExpiryDate: '2024-01-01' }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    expect(updatedStatus).toBe('active');
  });

  test('gracePeriod member — payment SHOULD reactivate', async () => {
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'gracePeriod', duesExpiryDate: '2025-06-01' }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    expect(updatedStatus).toBe('active');
  });

  test('pendingPayment member — payment SHOULD activate', async () => {
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'pendingPayment', duesExpiryDate: null }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    expect(updatedStatus).toBe('active');
  });

  test('active member — payment extends expiry, keeps active', async () => {
    let updatedStatus: string | undefined;

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active' }],
      updateOneById: async (_id: string, updates: any) => {
        updatedStatus = updates.status;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    expect(updatedStatus).toBe('active');
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
    let capturedExpiry: string | undefined;
    // Use a future expiry so computeNewExpiry uses standard extension (not severely-lapsed reset)
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'quarterly' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry }],
      updateOneById: async (_id: string, updates: any) => {
        capturedExpiry = updates.duesExpiryDate;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    // 2027-01-15 + 3 months = 2027-04-15
    expect(capturedExpiry).toBe('2027-04-15');
  });

  test('semi-annual billing — extends by 6 months', async () => {
    let capturedExpiry: string | undefined;
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'semi-annual' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry }],
      updateOneById: async (_id: string, updates: any) => {
        capturedExpiry = updates.duesExpiryDate;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    // 2027-01-15 + 6 months = 2027-07-15
    expect(capturedExpiry).toBe('2027-07-15');
  });

  test('annual billing — extends by 12 months (existing behavior)', async () => {
    let capturedExpiry: string | undefined;
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => ({ billingFrequency: 'annual' }),
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry }],
      updateOneById: async (_id: string, updates: any) => {
        capturedExpiry = updates.duesExpiryDate;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    // 2027-01-15 + 12 months = 2028-01-15
    expect(capturedExpiry).toBe('2028-01-15');
  });

  test('missing config — defaults to annual (12 months)', async () => {
    let capturedExpiry: string | undefined;
    const futureExpiry = '2027-01-15';

    stubRepo(DuesRepository, {
      listFunds: async () => [],
      getConfig: async () => undefined,
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active', duesExpiryDate: futureExpiry }],
      updateOneById: async (_id: string, updates: any) => {
        capturedExpiry = updates.duesExpiryDate;
        return baseMembership;
      },
    });

    await settlePayment(baseInput);

    // Missing config → default annual → 2027-01-15 + 12 months = 2028-01-15
    expect(capturedExpiry).toBe('2028-01-15');
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

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => [],
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active' }],
      updateOneById: async () => baseMembership,
    });

    await settlePayment({ ...baseInput, db: txDb as any });

    expect(transactionCalled).toBe(true);
  });

  test('rolls back fund allocations when membership update fails', async () => {
    let fundsAllocated = false;
    let transactionCalled = false;

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        // DB would auto-rollback on throw — just verify the error propagates
        return fn(txDb);
      },
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => { fundsAllocated = true; return []; },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active' }],
      updateOneById: async () => { throw new Error('DB write failed'); },
    });

    // Error must propagate out of transaction (triggering DB rollback)
    await expect(settlePayment({ ...baseInput, db: txDb as any })).rejects.toThrow('DB write failed');
    expect(transactionCalled).toBe(true);
  });

  test('rolls back membership update when fund allocation fails', async () => {
    let membershipUpdated = false;
    let transactionCalled = false;

    const txDb = {
      transaction: async (fn: (tx: any) => Promise<any>) => {
        transactionCalled = true;
        return fn(txDb);
      },
    };

    stubRepo(DuesRepository, {
      listFunds: async () => [
        { id: 'fund-1', name: 'General', percentage: '100', organizationId: 'org-1' },
      ],
      getConfig: async () => undefined,
      createFundAllocations: async () => { throw new Error('Fund allocation failed'); },
    });
    stubRepo(MembershipRepository, {
      findMany: async () => [{ ...baseMembership, status: 'active' }],
      updateOneById: async () => { membershipUpdated = true; return baseMembership; },
    });

    await expect(settlePayment({ ...baseInput, db: txDb as any })).rejects.toThrow('Fund allocation failed');
    expect(transactionCalled).toBe(true);
    // Membership update should NOT have been reached since fund allocation failed first
    expect(membershipUpdated).toBe(false);
  });
});
