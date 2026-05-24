/**
 * BR-05: Fund allocation splits payment across multiple funds proportionally.
 *
 * Source lives at association:member/utils/fund-math.ts — re-tested here
 * at the path registered in br-registry.json for BR-05.
 */

import { describe, test, expect } from 'bun:test';
import {
  allocateFunds,
  validateFundSplits,
  isWithinRetentionPeriod,
  FINANCIAL_RETENTION_YEARS,
  type FundSplit,
} from '../../association:member/utils/fund-math';

// ─── allocateFunds [BR-05] ─────────────────────────────

describe('[BR-05] allocateFunds', () => {
  test('splits evenly when divisible', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(1000, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 500 },
      { fundId: 'b', amount: 500 },
    ]);
  });

  test('last fund absorbs rounding remainder', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(100, funds);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(100);
  });

  test('single fund gets full amount', () => {
    const result = allocateFunds(5000, [{ fundId: 'only', percentage: 100 }]);
    expect(result).toEqual([{ fundId: 'only', amount: 5000 }]);
  });

  test('empty funds array returns empty', () => {
    expect(allocateFunds(1000, [])).toEqual([]);
  });

  test('zero amount distributes zeros', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(0, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 0 },
      { fundId: 'b', amount: 0 },
    ]);
  });

  test('large amount with many funds sums correctly', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 10 },
      { fundId: 'b', percentage: 20 },
      { fundId: 'c', percentage: 30 },
      { fundId: 'd', percentage: 40 },
    ];
    const result = allocateFunds(999_99, funds);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(999_99);
  });

  test('1 cent distributed to last fund when indivisible', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(1, funds);
    // floor(1 * 0.5) = 0 for first, remainder 1 for last
    expect(result[0]!.amount).toBe(0);
    expect(result[1]!.amount).toBe(1);
  });
});

// ─── validateFundSplits [BR-05] ────────────────────────

describe('[BR-05] validateFundSplits', () => {
  test('valid splits summing to 100% returns null', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 60 },
      { fundId: 'b', percentage: 40 },
    ];
    expect(validateFundSplits(funds)).toBeNull();
  });

  test('empty array returns error', () => {
    expect(validateFundSplits([])).toBe('At least one fund is required');
  });

  test('sum not 100% returns error', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 40 },
    ];
    const err = validateFundSplits(funds);
    expect(err).toContain('must sum to 100%');
  });

  test('negative percentage returns error', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: -10 },
      { fundId: 'b', percentage: 110 },
    ];
    const err = validateFundSplits(funds);
    expect(err).toContain('negative percentage');
  });

  test('percentage over 100 returns error', () => {
    const funds: FundSplit[] = [{ fundId: 'a', percentage: 101 }];
    const err = validateFundSplits(funds);
    expect(err).toContain('over 100');
  });

  test('duplicate fund IDs returns error', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'a', percentage: 50 },
    ];
    expect(validateFundSplits(funds)).toBe('Duplicate fund IDs detected');
  });

  test('tolerance allows 99.995% to pass', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33.335 },
      { fundId: 'b', percentage: 33.33 },
      { fundId: 'c', percentage: 33.33 },
    ];
    // Sum = 99.995, diff from 100 = 0.005 < 0.01 tolerance
    expect(validateFundSplits(funds)).toBeNull();
  });
});

// ─── isWithinRetentionPeriod [BR-32] ───────────────────

describe('[BR-32] isWithinRetentionPeriod', () => {
  test('record created today is within retention', () => {
    const now = new Date('2025-06-15');
    expect(isWithinRetentionPeriod(now, now)).toBe(true);
  });

  test('record 6 years old is within retention', () => {
    const created = new Date('2019-01-01');
    const now = new Date('2025-01-01');
    expect(isWithinRetentionPeriod(created, now)).toBe(true);
  });

  test('record exactly 7 years old is at boundary (within)', () => {
    const created = new Date('2018-01-01');
    const now = new Date('2025-01-01');
    expect(isWithinRetentionPeriod(created, now)).toBe(true);
  });

  test('record over 7 years old is outside retention', () => {
    const created = new Date('2017-06-01');
    const now = new Date('2025-06-02');
    expect(isWithinRetentionPeriod(created, now)).toBe(false);
  });

  test('FINANCIAL_RETENTION_YEARS is 7', () => {
    expect(FINANCIAL_RETENTION_YEARS).toBe(7);
  });
});
