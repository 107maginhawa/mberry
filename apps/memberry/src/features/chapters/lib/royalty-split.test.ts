import { describe, test, expect } from 'bun:test';
import { validateSplit, formatSplitDisplay } from './royalty-split';

describe('validateSplit', () => {
  test('valid split sums to 100', () => {
    expect(validateSplit(60, 40)).toEqual({ valid: true, sum: 100 });
  });

  test('invalid split does not sum to 100', () => {
    expect(validateSplit(60, 30)).toEqual({ valid: false, sum: 90 });
  });

  test('zero values are invalid', () => {
    expect(validateSplit(0, 0)).toEqual({ valid: false, sum: 0 });
  });

  test('100/0 split is valid', () => {
    expect(validateSplit(100, 0)).toEqual({ valid: true, sum: 100 });
  });

  test('negative values are invalid', () => {
    expect(validateSplit(-10, 110)).toEqual({ valid: false, sum: 100 });
  });
});

describe('formatSplitDisplay', () => {
  test('formats as percentage string', () => {
    expect(formatSplitDisplay(60, 40)).toBe('National 60% / Chapter 40%');
  });

  test('handles decimal percentages', () => {
    expect(formatSplitDisplay(33.33, 66.67)).toBe('National 33.33% / Chapter 66.67%');
  });
});
