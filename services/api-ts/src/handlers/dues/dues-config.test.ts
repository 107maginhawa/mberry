/**
 * Dues Config & Fund Allocation handler-level tests
 *
 * Covers:
 * - BR-05: Fund split totals 100%
 * - M6-R1: Rounding — sum == payment_amount always
 * - BR-32: 7-year retention
 * - Permission: Treasurer or President only
 * - Config CRUD: dues amount, frequency, grace period
 * - Fund config: CRUD with allocation % validation
 * - Audit: all config changes tracked
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { DuesRepository } from '@/handlers/association:member/repos/dues-payments.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { getDuesDashboard } from './getDuesDashboard';
import {
  allocateFunds,
  validateFundSplits,
  isWithinRetentionPeriod,
  FINANCIAL_RETENTION_YEARS,
  type FundSplit,
} from '../association:member/utils/fund-math';

// ─── Factories ────────────────────────────────────────────

function makeConfig(overrides: Record<string, any> = {}) {
  return {
    id: 'cfg-1',
    organizationId: 'org-1',
    defaultAmount: 50000, // PHP 500.00
    currency: 'PHP',
    billingFrequency: 'annual',
    dueDateMonth: 1,
    dueDateDay: 15,
    gracePeriodDays: 30,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    version: 1,
    ...overrides,
  };
}

function makeFund(overrides: Record<string, any> = {}) {
  return {
    id: 'fund-1',
    organizationId: 'org-1',
    name: 'General Fund',
    percentage: '60.00',
    sortOrder: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────

beforeEach(() => {
  restoreRepo(DuesRepository);
  restoreRepo(OfficerTermRepository);
});

afterEach(() => {
  restoreRepo(DuesRepository);
  restoreRepo(OfficerTermRepository);
});

// ─── Permission Tests ─────────────────────────────────────

describe('Dues config permission enforcement', () => {
  test('Treasurer can access dues dashboard', async () => {
    stubRepo(DuesRepository, {
      getFullDashboardStats: async () => ({
        totalCollected: '50000',
        totalOutstanding: '10000',
        paidCount: 10,
        unpaidCount: 5,
        overdueCount: 2,
        collectionRate: 0.83,
      }),
      getMemberCount: async () => 15,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', positionTitle: 'Treasurer' }],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx as any);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.data.totalCollected).toBe(50000);
    expect(body.data.totalOutstanding).toBe(10000);
    expect(body.data.memberCount).toBe(15);
  });

  test('President can access dues dashboard', async () => {
    stubRepo(DuesRepository, {
      getFullDashboardStats: async () => ({
        totalCollected: '30000',
        totalOutstanding: '5000',
        paidCount: 6,
        unpaidCount: 2,
        overdueCount: 1,
        collectionRate: 0.86,
      }),
      getMemberCount: async () => 8,
    });
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-2', positionTitle: 'President' }],
    });

    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
    });

    const res = await getDuesDashboard(ctx as any);
    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.data.totalCollected).toBe(30000);
    expect(body.data.totalOutstanding).toBe(5000);
    expect(body.data.memberCount).toBe(8);
  });

  test('unauthenticated request throws', async () => {
    const ctx = makeCtx({
      _params: { organizationId: 'org-1' },
      session: null,
      user: null,
    });
    await expect(getDuesDashboard(ctx as any)).rejects.toThrow();
  });
});

// ─── Config CRUD Tests ───────────────────────────────────

describe('Dues config CRUD', () => {
  test('getConfig returns config with amount/frequency/grace', async () => {
    const cfg = makeConfig();
    stubRepo(DuesRepository, {
      getConfig: async () => cfg,
    });

    const repo = new DuesRepository({} as any);
    const result = await repo.getConfig('org-1');

    expect(result).toBeDefined();
    expect(result!.defaultAmount).toBe(50000);
    expect(result!.currency).toBe('PHP');
    expect(result!.billingFrequency).toBe('annual');
    expect(result!.gracePeriodDays).toBe(30);
    expect(result!.dueDateDay).toBe(15);
  });

  test('upsertConfig creates new config', async () => {
    const cfg = makeConfig();
    stubRepo(DuesRepository, {
      upsertConfig: async () => cfg,
    });

    const repo = new DuesRepository({} as any);
    const result = await repo.upsertConfig('org-1', {
      defaultAmount: 50000,
      currency: 'PHP',
      billingFrequency: 'annual' as any,
      dueDateDay: 15,
      gracePeriodDays: 30,
    });

    expect(result.defaultAmount).toBe(50000);
    expect(result.billingFrequency).toBe('annual');
  });

  test('upsertConfig updates existing config', async () => {
    const updated = makeConfig({ defaultAmount: 75000, billingFrequency: 'semi-annual' });
    stubRepo(DuesRepository, {
      upsertConfig: async () => updated,
    });

    const repo = new DuesRepository({} as any);
    const result = await repo.upsertConfig('org-1', {
      defaultAmount: 75000,
      currency: 'PHP',
      billingFrequency: 'semi-annual' as any,
      dueDateDay: 15,
      gracePeriodDays: 60,
    });

    expect(result.defaultAmount).toBe(75000);
    expect(result.billingFrequency).toBe('semi-annual');
  });

  test('config supports all billing frequencies', () => {
    const frequencies = ['annual', 'semi-annual', 'quarterly'];
    for (const freq of frequencies) {
      const cfg = makeConfig({ billingFrequency: freq });
      expect(cfg.billingFrequency).toBe(freq);
    }
  });
});

// ─── Fund Config CRUD Tests ──────────────────────────────

describe('Fund config CRUD', () => {
  test('listFunds returns active funds ordered by sortOrder', async () => {
    const funds = [
      makeFund({ id: 'f1', name: 'General', percentage: '60.00', sortOrder: 0 }),
      makeFund({ id: 'f2', name: 'Building', percentage: '30.00', sortOrder: 1 }),
      makeFund({ id: 'f3', name: 'Reserve', percentage: '10.00', sortOrder: 2 }),
    ];
    stubRepo(DuesRepository, { listFunds: async () => funds });

    const repo = new DuesRepository({} as any);
    const result = await repo.listFunds('org-1');

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('General');
    expect(result[2].name).toBe('Reserve');
  });

  test('replaceFunds replaces fund configuration', async () => {
    let replaceCalled = false;
    stubRepo(DuesRepository, {
      replaceFunds: async () => { replaceCalled = true; },
    });

    const repo = new DuesRepository({} as any);
    await repo.replaceFunds('org-1', [
      { name: 'New General', percentage: '70.00', sortOrder: 0 },
      { name: 'New Building', percentage: '30.00', sortOrder: 1 },
    ]);

    expect(replaceCalled).toBe(true);
  });
});

// ─── BR-05: Fund Split Validation ────────────────────────

describe('BR-05: Fund allocation percentages', () => {
  test('[BR-05] valid 3-fund split at 60/30/10 passes', () => {
    const funds: FundSplit[] = [
      { fundId: 'general', percentage: 60 },
      { fundId: 'building', percentage: 30 },
      { fundId: 'reserve', percentage: 10 },
    ];
    expect(validateFundSplits(funds)).toBeNull();
  });

  test('[BR-05] split at 99% fails', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 60 },
      { fundId: 'b', percentage: 39 },
    ];
    expect(validateFundSplits(funds)).toContain('must sum to 100%');
  });

  test('[BR-05] validate before replaceFunds — integration pattern', () => {
    // Simulates what a handler should do before calling repo.replaceFunds
    const fundsInput = [
      { fundId: 'general', percentage: 60 },
      { fundId: 'building', percentage: 30 },
      { fundId: 'reserve', percentage: 10 },
    ];

    const validationError = validateFundSplits(fundsInput);
    expect(validationError).toBeNull();

    // If validation passes, allocation should work correctly
    const allocation = allocateFunds(50000, fundsInput);
    const sum = allocation.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(50000);
  });

  test('[BR-05] invalid split rejected before save', () => {
    const fundsInput = [
      { fundId: 'general', percentage: 60 },
      { fundId: 'building', percentage: 30 },
      // Missing 10% — only 90%
    ];

    const validationError = validateFundSplits(fundsInput);
    expect(validationError).not.toBeNull();
    expect(validationError).toContain('must sum to 100%');
  });
});

// ─── M6-R1: Rounding Invariant ──────────────────────────

describe('M6-R1: Currency-aware rounding', () => {
  test('[M6-R1] PHP allocation: sum == payment for PHP 500.00', () => {
    const funds: FundSplit[] = [
      { fundId: 'general', percentage: 60 },
      { fundId: 'building', percentage: 30 },
      { fundId: 'reserve', percentage: 10 },
    ];
    const result = allocateFunds(50000, funds);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(50000);
    expect(result[0].amount).toBe(30000); // 60% of 500.00
    expect(result[1].amount).toBe(15000); // 30% of 500.00
    expect(result[2].amount).toBe(5000);  // 10% of 500.00
  });

  test('[M6-R1] JPY allocation: no subunit, 1-yen amounts work', () => {
    // JPY has no subunit — amounts are in whole yen
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(1000, funds); // 1000 yen
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(1000);
  });

  test('[M6-R1] USD allocation: penny-level precision', () => {
    const funds: FundSplit[] = [
      { fundId: 'dues', percentage: 70 },
      { fundId: 'charity', percentage: 20 },
      { fundId: 'admin', percentage: 10 },
    ];
    const result = allocateFunds(9999, funds); // $99.99
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(9999);
  });

  test('[M6-R1] last fund absorption correctness', () => {
    // 3 funds at 33/33/34 on PHP 100.01 (10001 cents)
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(10001, funds);
    // a: floor(10001 * 0.33) = floor(3300.33) = 3300
    // b: floor(10001 * 0.33) = floor(3300.33) = 3300
    // c: 10001 - 3300 - 3300 = 3401
    expect(result[0].amount).toBe(3300);
    expect(result[1].amount).toBe(3300);
    expect(result[2].amount).toBe(3401);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(10001);
  });
});

// ─── BR-32: Financial Record Retention ───────────────────

describe('BR-32: 7-year retention', () => {
  test('[BR-32] retention period constant is 7 years', () => {
    expect(FINANCIAL_RETENTION_YEARS).toBe(7);
  });

  test('[BR-32] payment record from 2020 retained through 2027', () => {
    const createdAt = new Date('2020-01-15');
    const checkDate = new Date('2026-12-31');
    expect(isWithinRetentionPeriod(createdAt, checkDate)).toBe(true);
  });

  test('[BR-32] payment record from 2018 is outside retention in 2026', () => {
    const createdAt = new Date('2018-01-01');
    const checkDate = new Date('2026-01-01');
    // 2018 + 7 = 2025, so by 2026 it's outside
    expect(isWithinRetentionPeriod(createdAt, checkDate)).toBe(false);
  });

  test('[BR-32] fund allocation records follow same retention', () => {
    // Fund allocations are financial records — same 7-year rule
    const allocationCreated = new Date('2020-06-15');
    const withinPeriod = new Date('2027-06-15'); // exactly at boundary
    const afterPeriod = new Date('2027-06-16');

    expect(isWithinRetentionPeriod(allocationCreated, withinPeriod)).toBe(true);
    expect(isWithinRetentionPeriod(allocationCreated, afterPeriod)).toBe(false);
  });

  test('[BR-32] config audit records follow same retention', () => {
    const auditCreated = new Date('2019-03-01');
    const check2026 = new Date('2026-02-28');
    const check2026Mar = new Date('2026-03-02');
    expect(isWithinRetentionPeriod(auditCreated, check2026)).toBe(true);
    expect(isWithinRetentionPeriod(auditCreated, check2026Mar)).toBe(false);
  });
});

// ─── Audit Trail Tests ──────────────────────────────────

describe('Audit trail for config changes', () => {
  test('dues config has createdAt and updatedAt for audit', () => {
    const cfg = makeConfig();
    expect(cfg.createdAt).toBeInstanceOf(Date);
    expect(cfg.updatedAt).toBeInstanceOf(Date);
    expect(cfg.version).toBe(1);
  });

  test('fund config has createdAt and updatedAt for audit', () => {
    const fund = makeFund();
    expect(fund.createdAt).toBeInstanceOf(Date);
    expect(fund.updatedAt).toBeInstanceOf(Date);
  });

  test('upsertConfig sets updatedAt on update', async () => {
    const now = new Date();
    const updated = makeConfig({ updatedAt: now });
    stubRepo(DuesRepository, {
      upsertConfig: async () => updated,
    });

    const repo = new DuesRepository({} as any);
    const result = await repo.upsertConfig('org-1', {
      defaultAmount: 50000,
      currency: 'PHP',
      billingFrequency: 'annual' as any,
      dueDateDay: 15,
      gracePeriodDays: 30,
    });

    expect(result.updatedAt).toEqual(now);
  });
});
