import { describe, test, expect } from 'bun:test';
import { allocateFunds, type FundSplit } from './fund-math';

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
});
