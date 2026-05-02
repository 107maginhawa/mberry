import { describe, test, expect } from 'bun:test';
import { allocateFunds, type FundSplit } from './fund-math';

describe('allocateFunds', () => {
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

  test('last fund absorbs remainder (M6-R1)', () => {
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

  test('many funds with odd percentages', () => {
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
});
