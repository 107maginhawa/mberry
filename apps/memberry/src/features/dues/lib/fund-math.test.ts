import { describe, test, expect } from 'vitest';
import { allocateFunds } from './fund-math';

describe('allocateFunds', () => {
  test('last fund absorbs remainder', () => {
    const result = allocateFunds(1500, [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ]);
    expect(result).toEqual([
      { fundId: 'a', amount: 495 },
      { fundId: 'b', amount: 495 },
      { fundId: 'c', amount: 510 },
    ]);
  });

  test('sum always equals input', () => {
    const result = allocateFunds(999, [
      { fundId: 'a', percentage: 33 },
      { fundId: 'b', percentage: 33 },
      { fundId: 'c', percentage: 34 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(999);
  });
});
