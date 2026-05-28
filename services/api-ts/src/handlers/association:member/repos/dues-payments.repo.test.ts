/**
 * Tests for DuesRepository
 *
 * All database calls are intercepted by a hand-crafted db stub so no real
 * Postgres connection is needed. We verify that each method calls the correct
 * DB chain and returns/transforms data appropriately.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { DuesRepository } from './dues-payments.repo';
import { restoreRepo } from '@/test-utils/make-ctx';

// ---------------------------------------------------------------------------
// Prototype isolation — Bun runs test files in-process and in parallel.
// Handler tests use stubRepo() which mutates DuesRepository.prototype.
// restoreRepo() restores ALL methods from a pristine snapshot captured
// on the first stubRepo() call (before any modification). We also save
// a direct reference to each restored method so that even if a parallel
// file re-stubs the prototype between beforeEach and the test body,
// the test can call the real method via the saved reference.
// ---------------------------------------------------------------------------
let _restored: Record<string, (...args: any[]) => any> = {};
beforeEach(() => {
  restoreRepo(DuesRepository);
  // Snapshot restored methods — immune to subsequent prototype mutations
  _restored = {};
  for (const name of Object.getOwnPropertyNames(DuesRepository.prototype)) {
    const val = (DuesRepository.prototype as any)[name];
    if (typeof val === 'function' && name !== 'constructor') {
      _restored[name] = val;
    }
  }
});

/** Create a DuesRepository with restored methods as own properties,
 *  immune to prototype re-stubbing by parallel test files. */
function safeRepo(db: any): DuesRepository {
  const repo = new DuesRepository(db);
  for (const [name, fn] of Object.entries(_restored)) {
    (repo as any)[name] = fn.bind(repo);
  }
  return repo;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    id: 'cfg-1',
    organizationId: 'org-1',
    defaultAmount: 5000,
    currency: 'PHP',
    billingFrequency: 'annual',
    dueDateMonth: 1,
    dueDateDay: 1,
    gracePeriodDays: 30,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makeFund(overrides: Record<string, any> = {}) {
  return {
    id: 'fund-1',
    organizationId: 'org-1',
    name: 'General Fund',
    percentage: '50.00',
    sortOrder: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makePayment(overrides: Record<string, any> = {}) {
  return {
    id: 'pay-1',
    organizationId: 'org-1',
    personId: 'person-1',
    invoiceId: null,
    receiptNumber: 'DUES-2026-0001',
    amount: 5000,
    currency: 'PHP',
    paymentMethod: 'cash',
    referenceNumber: null,
    status: 'completed',
    recordedBy: 'admin-1',
    membershipExtendedFrom: '2026-01-01',
    membershipExtendedTo: '2027-01-01',
    paidAt: new Date(),
    expiredAt: null,
    refundedAmount: 0,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

function makeAllocation(overrides: Record<string, any> = {}) {
  return {
    id: 'alloc-1',
    paymentId: 'pay-1',
    fundId: 'fund-1',
    amount: 2500,
    isReversal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

/**
 * Build a minimal db stub whose chainable select/update/insert methods
 * resolve to whatever `rows` is provided.
 */
function makeDb({
  selectRows = [] as any[],
  selectRowsSets = undefined as any[][] | undefined,
  insertRow = {} as any,
  updateRow = {} as any,
}: {
  selectRows?: any[];
  selectRowsSets?: any[][];
  insertRow?: any;
  updateRow?: any;
} = {}) {
  let selectCallCount = 0;

  const awaitable = (result: any) => ({
    from: () => awaitable(result),
    leftJoin: () => awaitable(result),
    innerJoin: () => awaitable(result),
    where: () => awaitable(result),
    limit: (_n: number) => awaitable(result),
    returning: () => Promise.resolve(result),
    orderBy: () => awaitable(result),
    offset: (_n: number) => awaitable(result),
    groupBy: () => awaitable(result),
    // Allow direct await on the chain
    then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
  });

  return {
    select: (_fields?: any) => {
      const rows = selectRowsSets
        ? selectRowsSets[selectCallCount++] ?? selectRows
        : selectRows;
      return awaitable(rows);
    },
    insert: (_table: any) => ({
      values: (data: any) => ({
        returning: () =>
          Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        onConflictDoUpdate: (_opts: any) => ({
          returning: () =>
            Promise.resolve(Array.isArray(data) ? data.map(() => insertRow) : [insertRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    update: (_table: any) => ({
      set: (_data: any) => ({
        where: () => ({
          returning: () => Promise.resolve([updateRow]),
        }),
        then: (resolve: any, reject?: any) => Promise.resolve().then(resolve, reject),
      }),
    }),
    delete: (_table: any) => ({
      where: () => Promise.resolve({ rowCount: 1 }),
    }),
  };
}

// ---------------------------------------------------------------------------
// DuesRepository.getConfig
// ---------------------------------------------------------------------------

describe('DuesRepository.getConfig', () => {
  test('returns config for an organization', async () => {
    const cfg = makeConfig();
    const db = makeDb({ selectRows: [cfg] });
    const repo = safeRepo(db as any);

    const result = await repo.getConfig('org-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('cfg-1');
    expect(result!.defaultAmount).toBe(5000);
    expect(result!.currency).toBe('PHP');
  });

  test('returns undefined when no config exists', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.getConfig('org-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.upsertConfig
// ---------------------------------------------------------------------------

describe('DuesRepository.upsertConfig', () => {
  test('creates a new config and returns it', async () => {
    const cfg = makeConfig();
    const db = makeDb({ insertRow: cfg });
    const repo = safeRepo(db as any);

    const result = await repo.upsertConfig('org-1', {
      defaultAmount: 5000,
      currency: 'PHP',
      billingFrequency: 'annual' as any,
      dueDateDay: 1,
      gracePeriodDays: 30,
    });
    expect(result.id).toBe('cfg-1');
    expect(result.defaultAmount).toBe(5000);
  });

  test('updates existing config via onConflict and returns it', async () => {
    const updated = makeConfig({ defaultAmount: 7500, updatedAt: new Date() });
    const db = makeDb({ insertRow: updated });
    const repo = safeRepo(db as any);

    const result = await repo.upsertConfig('org-1', {
      defaultAmount: 7500,
      currency: 'PHP',
      billingFrequency: 'annual' as any,
      dueDateDay: 1,
      gracePeriodDays: 30,
    });
    expect(result.defaultAmount).toBe(7500);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.listFunds
// ---------------------------------------------------------------------------

describe('DuesRepository.listFunds', () => {
  test('returns active funds for an organization', async () => {
    const fund = makeFund();
    const db = makeDb({ selectRows: [fund] });
    const repo = safeRepo(db as any);

    const result = await repo.listFunds('org-1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('General Fund');
    expect(result[0].active).toBe(true);
  });

  test('returns empty array when no funds exist', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.listFunds('org-1');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.replaceFunds
// ---------------------------------------------------------------------------

describe('DuesRepository.replaceFunds', () => {
  test('deactivates old funds and inserts new ones', async () => {
    let updateCalled = false;
    let insertCalled = false;

    const db: any = {
      update: (_table: any) => {
        updateCalled = true;
        return {
          set: (_data: any) => ({
            where: () => Promise.resolve(),
          }),
        };
      },
      insert: (_table: any) => {
        insertCalled = true;
        return {
          values: (_data: any) => ({
            then: (resolve: any) => resolve(),
          }),
        };
      },
    };

    const repo = safeRepo(db);
    await repo.replaceFunds('org-1', [
      { name: 'New Fund', percentage: '100.00', sortOrder: 0 },
    ]);

    expect(updateCalled).toBe(true);
    expect(insertCalled).toBe(true);
  });

  test('deactivates old funds but skips insert when array is empty', async () => {
    let updateCalled = false;
    let insertCalled = false;

    const db: any = {
      update: (_table: any) => {
        updateCalled = true;
        return {
          set: (_data: any) => ({
            where: () => Promise.resolve(),
          }),
        };
      },
      insert: (_table: any) => {
        insertCalled = true;
        return {
          values: (_data: any) => ({
            then: (resolve: any) => resolve(),
          }),
        };
      },
    };

    const repo = safeRepo(db);
    await repo.replaceFunds('org-1', []);

    expect(updateCalled).toBe(true);
    expect(insertCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.listPayments
// ---------------------------------------------------------------------------

describe('DuesRepository.listPayments', () => {
  test('returns payments and total count for an org', async () => {
    const payment = makePayment();
    const countRow = { count: 1 };

    // listPayments uses Promise.all with two selects
    const db = makeDb({ selectRowsSets: [[payment], [countRow]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({ organizationId: 'org-1' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('pay-1');
    expect(result.total).toBe(1);
  });

  test('returns empty data and zero total when no payments', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({ organizationId: 'org-1' });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('supports personId filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({
      organizationId: 'org-1',
      personId: 'person-1',
    });
    expect(result.data).toEqual([]);
  });

  test('supports status filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({
      organizationId: 'org-1',
      status: 'completed',
    });
    expect(result.data).toEqual([]);
  });

  test('supports method filter without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({
      organizationId: 'org-1',
      method: 'cash',
    });
    expect(result.data).toEqual([]);
  });

  test('supports date range filters without error', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({
      organizationId: 'org-1',
      fromDate: new Date('2026-01-01'),
      toDate: new Date('2026-12-31'),
    });
    expect(result.data).toEqual([]);
  });

  test('supports pagination via limit and offset', async () => {
    const db = makeDb({ selectRowsSets: [[], [{ count: 0 }]] });
    const repo = safeRepo(db as any);

    const result = await repo.listPayments({
      organizationId: 'org-1',
      limit: 10,
      offset: 20,
    });
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.getPayment
// ---------------------------------------------------------------------------

describe('DuesRepository.getPayment', () => {
  test('returns payment when found', async () => {
    const payment = makePayment();
    const db = makeDb({ selectRows: [payment] });
    const repo = safeRepo(db as any);

    const result = await repo.getPayment('pay-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('pay-1');
    expect(result!.amount).toBe(5000);
  });

  test('returns undefined when payment not found', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.getPayment('missing-id');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.createPayment
// ---------------------------------------------------------------------------

describe('DuesRepository.createPayment', () => {
  test('inserts and returns payment record', async () => {
    const payment = makePayment();
    const db = makeDb({ insertRow: payment });
    const repo = safeRepo(db as any);

    const result = await repo.createPayment({
      organizationId: 'org-1',
      personId: 'person-1',
      receiptNumber: 'DUES-2026-0001',
      amount: 5000,
      paymentMethod: 'cash' as any,
      status: 'completed' as any,
    } as any);

    expect(result.id).toBe('pay-1');
    expect(result.amount).toBe(5000);
    expect(result.receiptNumber).toBe('DUES-2026-0001');
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.updatePaymentStatus
// ---------------------------------------------------------------------------

describe('DuesRepository.updatePaymentStatus', () => {
  test('updates status and returns updated payment', async () => {
    const updated = makePayment({ status: 'refunded' });
    const db = makeDb({ updateRow: updated });
    const repo = safeRepo(db as any);

    const result = await repo.updatePaymentStatus('pay-1', 'completed', 'refunded');
    expect(result.status).toBe('refunded');
  });

  test('passes extra fields through to update', async () => {
    let capturedData: any;
    const db: any = {
      update: (_table: any) => ({
        set: (data: any) => {
          capturedData = data;
          return {
            where: () => ({
              returning: () =>
                Promise.resolve([makePayment({ status: 'refunded', refundedAmount: 5000 })]),
            }),
          };
        },
      }),
    };

    const repo = safeRepo(db);
    const result = await repo.updatePaymentStatus('pay-1', 'completed', 'refunded', {
      refundedAmount: 5000,
    } as any);

    expect(result.refundedAmount).toBe(5000);
    expect(capturedData.refundedAmount).toBe(5000);
    expect(capturedData.updatedAt).toBeInstanceOf(Date);
  });

  test('throws ConflictError for invalid transition', () => {
    const db = makeDb({ updateRow: makePayment() });
    const repo = safeRepo(db as any);

    // pending → refunded is invalid (must complete first)
    expect(
      repo.updatePaymentStatus('pay-1', 'pending', 'refunded')
    ).rejects.toThrow(/Cannot transition/);
  });

  test('throws ConflictError from terminal state', () => {
    const db = makeDb({ updateRow: makePayment() });
    const repo = safeRepo(db as any);

    // refunded is terminal
    expect(
      repo.updatePaymentStatus('pay-1', 'refunded', 'pending')
    ).rejects.toThrow(/terminal/);
  });

  test('allows valid transition submitted → confirmed', async () => {
    const updated = makePayment({ status: 'confirmed' });
    const db = makeDb({ updateRow: updated });
    const repo = safeRepo(db as any);

    const result = await repo.updatePaymentStatus('pay-1', 'submitted', 'confirmed');
    expect(result.status).toBe('confirmed');
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.createFundAllocations
// ---------------------------------------------------------------------------

describe('DuesRepository.createFundAllocations', () => {
  test('batch inserts allocations', async () => {
    let insertCalled = false;
    const db: any = {
      insert: (_table: any) => {
        insertCalled = true;
        return {
          values: (_data: any) => ({
            then: (resolve: any) => resolve(),
          }),
        };
      },
    };

    const repo = safeRepo(db);
    await repo.createFundAllocations([
      makeAllocation() as any,
      makeAllocation({ id: 'alloc-2', fundId: 'fund-2' }) as any,
    ]);
    expect(insertCalled).toBe(true);
  });

  test('handles empty array without inserting', async () => {
    let insertCalled = false;
    const db: any = {
      insert: (_table: any) => {
        insertCalled = true;
        return {
          values: (_data: any) => ({
            then: (resolve: any) => resolve(),
          }),
        };
      },
    };

    const repo = safeRepo(db);
    await repo.createFundAllocations([]);
    expect(insertCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.findRecentPaymentForPerson
// ---------------------------------------------------------------------------

describe('DuesRepository.findRecentPaymentForPerson', () => {
  test('returns recent payment when found within time window', async () => {
    const payment = makePayment({ createdAt: new Date() });
    const db = makeDb({ selectRows: [payment] });
    const repo = safeRepo(db as any);

    const result = await repo.findRecentPaymentForPerson('org-1', 'person-1', 5);
    expect(result).toBeDefined();
    expect(result!.id).toBe('pay-1');
  });

  test('returns undefined when no recent payment exists', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.findRecentPaymentForPerson('org-1', 'person-1', 5);
    expect(result).toBeUndefined();
  });

  test('uses default 5-minute window when withinMinutes not specified', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    // Should not throw even without the third argument
    const result = await repo.findRecentPaymentForPerson('org-1', 'person-1');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.getNextReceiptSequence
// ---------------------------------------------------------------------------

describe('DuesRepository.getNextReceiptSequence', () => {
  test('returns count + 1 based on receipt number pattern', async () => {
    const db = makeDb({ selectRows: [{ count: 5 }] });
    const repo = safeRepo(db as any);

    const result = await repo.getNextReceiptSequence('org-1', 2026);
    expect(result).toBe(6);
  });

  test('returns 1 when no receipts exist for the year', async () => {
    const db = makeDb({ selectRows: [{ count: 0 }] });
    const repo = safeRepo(db as any);

    const result = await repo.getNextReceiptSequence('org-1', 2026);
    expect(result).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.getDashboardStats
// ---------------------------------------------------------------------------

describe('DuesRepository.getDashboardStats', () => {
  test('returns aggregated stats', async () => {
    const statsRow = {
      totalCollected: 50000,
      totalOutstanding: 10000,
      pendingCount: 2,
      completedCount: 10,
      totalCount: 12,
    };
    const db = makeDb({ selectRows: [statsRow] });
    const repo = safeRepo(db as any);

    const result = await repo.getDashboardStats('org-1');
    expect(result.totalCollected).toBe(50000);
    expect(result.totalOutstanding).toBe(10000);
    expect(result.pendingCount).toBe(2);
    expect(result.completedCount).toBe(10);
    expect(result.totalCount).toBe(12);
    expect(result.collectionRate).toBe(83); // Math.round(10/12 * 100)
  });

  test('returns zeros when no payments exist', async () => {
    const emptyStats = {
      totalCollected: 0,
      totalOutstanding: 0,
      pendingCount: 0,
      completedCount: 0,
      totalCount: 0,
    };
    const db = makeDb({ selectRows: [emptyStats] });
    const repo = safeRepo(db as any);

    const result = await repo.getDashboardStats('org-1');
    expect(result.totalCollected).toBe(0);
    expect(result.totalOutstanding).toBe(0);
    expect(result.pendingCount).toBe(0);
    expect(result.completedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.collectionRate).toBe(0);
  });

  test('handles null stats row gracefully', async () => {
    const db = makeDb({ selectRows: [undefined] });
    const repo = safeRepo(db as any);

    const result = await repo.getDashboardStats('org-1');
    expect(result.totalCollected).toBe(0);
    expect(result.collectionRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.reportCollectionSummary
// ---------------------------------------------------------------------------

describe('DuesRepository.reportCollectionSummary', () => {
  test('returns grouped rows by month and method', async () => {
    const rows = [
      { month: '2026-01', method: 'cash', count: 5, total: 25000 },
      { month: '2026-01', method: 'gcash', count: 3, total: 15000 },
      { month: '2026-02', method: 'cash', count: 2, total: 10000 },
    ];
    const db = makeDb({ selectRows: rows });
    const repo = safeRepo(db as any);

    const result = await repo.reportCollectionSummary(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-03-01'),
    );
    expect(result).toHaveLength(3);
    expect(result[0].month).toBe('2026-01');
    expect(result[0].total).toBe(25000);
  });

  test('returns empty array when no data in date range', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.reportCollectionSummary(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-03-01'),
    );
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DuesRepository.reportFundBreakdown
// ---------------------------------------------------------------------------

describe('DuesRepository.reportFundBreakdown', () => {
  test('returns fund allocation totals with joins', async () => {
    const rows = [
      {
        fundId: 'fund-1',
        fundName: 'General Fund',
        percentage: '50.00',
        totalAllocated: 25000,
        totalReversals: 0,
        netTotal: 25000,
      },
      {
        fundId: 'fund-2',
        fundName: 'Building Fund',
        percentage: '50.00',
        totalAllocated: 25000,
        totalReversals: 2500,
        netTotal: 22500,
      },
    ];
    const db = makeDb({ selectRows: rows });
    const repo = safeRepo(db as any);

    const result = await repo.reportFundBreakdown(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    );
    expect(result).toHaveLength(2);
    expect(result[0].fundName).toBe('General Fund');
    expect(result[0].netTotal).toBe(25000);
    expect(result[1].totalReversals).toBe(2500);
  });

  test('returns empty array when no allocations in date range', async () => {
    const db = makeDb({ selectRows: [] });
    const repo = safeRepo(db as any);

    const result = await repo.reportFundBreakdown(
      'org-1',
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    );
    expect(result).toEqual([]);
  });
});
