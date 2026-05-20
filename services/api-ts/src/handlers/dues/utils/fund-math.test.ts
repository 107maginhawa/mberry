import { describe, test, expect } from 'bun:test';
import {
  allocateFunds,
  validateFundSplits,
  isWithinRetentionPeriod,
  FINANCIAL_RETENTION_YEARS,
  type FundSplit,
} from './fund-math';

describe('allocateFunds [BR-05]', () => {
  test('splits evenly when divisible [BR-05]', () => {
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

  test('last fund absorbs remainder [BR-05]', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(1500, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 495 },
      { fundId: 'b', amount: 495 },
      { fundId: 'c', amount: 510 },
    ]);
  });

  test('single fund gets full amount', () => {
    const funds: FundSplit[] = [{ fundId: 'a', percentage: 100 }];
    const result = allocateFunds(9999, funds);
    expect(result).toEqual([{ fundId: 'a', amount: 9999 }]);
  });

  test('handles 1 cent total', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 50 },
    ];
    const result = allocateFunds(1, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 0 },
      { fundId: 'b', amount: 1 },
    ]);
  });

  test('handles zero amount', () => {
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

  test('many funds with odd percentages [BR-05]', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 10 },
      { fundId: 'b', percentage: 15 },
      { fundId: 'c', percentage: 25 },
      { fundId: 'd', percentage: 50 },
    ];
    const result = allocateFunds(333, funds);
    expect(result).toEqual([
      { fundId: 'a', amount: 33 },
      { fundId: 'b', amount: 49 },
      { fundId: 'c', amount: 83 },
      { fundId: 'd', amount: 168 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(333);
  });

  // ─── [BR-05] Gap tests from BR text ──────────────────

  test('[BR-05] PHP 500.00 across 60/30/10% — exact BR example', () => {
    // BR-05 example: PHP 500.00 across 3 funds at 60/30/10%
    // Fund A = 300.00, Fund B = 150.00, Fund C = 50.00
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 60 },
      { fundId: 'b', percentage: 30 },
      { fundId: 'c', percentage: 10 },
    ];
    const result = allocateFunds(50000, funds); // 500.00 in cents
    expect(result).toEqual([
      { fundId: 'a', amount: 30000 },
      { fundId: 'b', amount: 15000 },
      { fundId: 'c', amount: 5000 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(50000);
  });

  test('[BR-05] PHP 100.00 at 33/33/34% — rounding BR example', () => {
    // BR-05 example: PHP 100.00 at 33/33/34%
    // Fund A = 33.00, Fund B = 33.00, Fund C = 34.00
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(10000, funds); // 100.00 in cents
    expect(result).toEqual([
      { fundId: 'a', amount: 3300 },
      { fundId: 'b', amount: 3300 },
      { fundId: 'c', amount: 3400 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(10000);
  });

  test('[BR-05] last fund absorbs negative remainder', () => {
    // Edge: 33/33/34 on 99 cents — each floor gives 32+32=64, last gets 35
    // But 34% of 99 = 33.66 → floor = 33. Last absorbs remainder: 99-64=35
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    const result = allocateFunds(99, funds);
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(99); // sum must always equal original amount exactly
  });

  test('[BR-05] empty funds array returns no allocations', () => {
    // BR-05 edge case: zero funds configured → no allocation records
    const result = allocateFunds(50000, []);
    expect(result).toEqual([]);
  });

  test('[BR-05] sum always equals input for adversarial percentages', () => {
    // 7 funds with percentages that cause lots of rounding
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 14 },
      { fundId: 'b', percentage: 14 },
      { fundId: 'c', percentage: 14 },
      { fundId: 'd', percentage: 14 },
      { fundId: 'e', percentage: 14 },
      { fundId: 'f', percentage: 15 },
      { fundId: 'g', percentage: 15 },
    ];
    // Test with a prime number of cents
    const result = allocateFunds(10007, funds);
    const sum = result.reduce((s, r) => s + r.amount, 0);
    expect(sum).toBe(10007);
  });

  // ─── [M6-R1] Currency-aware rounding property tests ───

  test('[M6-R1] sum == payment_amount for every currency amount 1..200', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ];
    for (let cents = 1; cents <= 200; cents++) {
      const result = allocateFunds(cents, funds);
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(sum).toBe(cents);
    }
  });

  test('[M6-R1] large amounts preserve sum invariant', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 17 },
      { fundId: 'b', percentage: 23 },
      { fundId: 'c', percentage: 29 },
      { fundId: 'd', percentage: 31 },
    ];
    // Test representative large amounts (PHP, USD, JPY scales)
    for (const amount of [999999, 1000000, 5000001, 99999999]) {
      const result = allocateFunds(amount, funds);
      const sum = result.reduce((s, r) => s + r.amount, 0);
      expect(sum).toBe(amount);
    }
  });

  test('[M6-R1] no negative allocations for any fund', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 1 },
      { fundId: 'b', percentage: 1 },
      { fundId: 'c', percentage: 98 },
    ];
    const result = allocateFunds(3, funds);
    for (const r of result) {
      expect(r.amount).toBeGreaterThanOrEqual(0);
    }
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(3);
  });
});

// ─── validateFundSplits [BR-05] ───────────────────────────

describe('validateFundSplits [BR-05]', () => {
  test('[BR-05] valid 100% split returns null', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 60 },
      { fundId: 'b', percentage: 30 },
      { fundId: 'c', percentage: 10 },
    ];
    expect(validateFundSplits(funds)).toBeNull();
  });

  test('[BR-05] percentages summing to 99% rejected', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'b', percentage: 49 },
    ];
    const err = validateFundSplits(funds);
    expect(err).toContain('must sum to 100%');
  });

  test('[BR-05] percentages summing to 101% rejected', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 60 },
      { fundId: 'b', percentage: 41 },
    ];
    const err = validateFundSplits(funds);
    expect(err).toContain('must sum to 100%');
  });

  test('[BR-05] empty funds array rejected', () => {
    expect(validateFundSplits([])).toContain('At least one fund');
  });

  test('[BR-05] single fund at 100% is valid', () => {
    expect(validateFundSplits([{ fundId: 'a', percentage: 100 }])).toBeNull();
  });

  test('[BR-05] negative percentage rejected', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: -10 },
      { fundId: 'b', percentage: 110 },
    ];
    expect(validateFundSplits(funds)).toContain('negative percentage');
  });

  test('[BR-05] percentage over 100 rejected', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 150 },
    ];
    expect(validateFundSplits(funds)).toContain('over 100');
  });

  test('[BR-05] duplicate fund IDs rejected', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 50 },
      { fundId: 'a', percentage: 50 },
    ];
    expect(validateFundSplits(funds)).toContain('Duplicate');
  });

  test('[BR-05] floating-point tolerance: 33.33 + 33.33 + 33.34 = 100', () => {
    const funds: FundSplit[] = [
      { fundId: 'a', percentage: 33.33 },
      { fundId: 'b', percentage: 33.33 },
      { fundId: 'c', percentage: 33.34 },
    ];
    expect(validateFundSplits(funds)).toBeNull();
  });
});

// ─── isWithinRetentionPeriod [BR-32] ──────────────────────

describe('isWithinRetentionPeriod [BR-32]', () => {
  test('[BR-32] retention period is 7 years', () => {
    expect(FINANCIAL_RETENTION_YEARS).toBe(7);
  });

  test('[BR-32] record created 6 years ago is within retention', () => {
    const now = new Date('2026-05-20');
    const createdAt = new Date('2020-06-01');
    expect(isWithinRetentionPeriod(createdAt, now)).toBe(true);
  });

  test('[BR-32] record created exactly 7 years ago is still within retention', () => {
    const now = new Date('2027-06-01');
    const createdAt = new Date('2020-06-01');
    expect(isWithinRetentionPeriod(createdAt, now)).toBe(true);
  });

  test('[BR-32] record created 7 years + 1 day ago is outside retention', () => {
    const now = new Date('2027-06-02');
    const createdAt = new Date('2020-06-01');
    expect(isWithinRetentionPeriod(createdAt, now)).toBe(false);
  });

  test('[BR-32] recent record is within retention', () => {
    const now = new Date('2026-05-20');
    const createdAt = new Date('2026-01-01');
    expect(isWithinRetentionPeriod(createdAt, now)).toBe(true);
  });
});
