import { describe, test, expect } from 'bun:test';
import { formatCents, parseCentsInput, validateFundAllocations } from './money';

describe('formatCents', () => {
  test('formats PHP centavos', () => {
    expect(formatCents(10050, 'PHP')).toBe('₱100.50');
    expect(formatCents(0, 'PHP')).toBe('₱0.00');
    expect(formatCents(150075, 'PHP')).toBe('₱1,500.75');
  });

  test('formats USD cents', () => {
    expect(formatCents(10050, 'USD')).toBe('$100.50');
    expect(formatCents(99, 'USD')).toBe('$0.99');
  });

  test('handles negative amounts', () => {
    expect(formatCents(-5000, 'PHP')).toBe('-₱50.00');
  });

  test('defaults to PHP if no currency', () => {
    expect(formatCents(10000)).toBe('₱100.00');
  });
});

describe('parseCentsInput', () => {
  test('converts decimal string to cents', () => {
    expect(parseCentsInput('100.50')).toBe(10050);
    expect(parseCentsInput('0.99')).toBe(99);
    expect(parseCentsInput('1500')).toBe(150000);
  });

  test('handles empty/invalid input', () => {
    expect(parseCentsInput('')).toBe(0);
    expect(parseCentsInput('abc')).toBe(0);
  });

  test('rounds to nearest centavo', () => {
    expect(parseCentsInput('100.555')).toBe(10056);
    expect(parseCentsInput('100.554')).toBe(10055);
  });
});

describe('validateFundAllocations', () => {
  test('valid allocations sum to 100', () => {
    const allocations = [
      { fundName: 'National', percentage: 60 },
      { fundName: 'Chapter', percentage: 30 },
      { fundName: 'Reserve', percentage: 10 },
    ];
    expect(validateFundAllocations(allocations)).toEqual({ valid: true, sum: 100 });
  });

  test('invalid allocations do not sum to 100', () => {
    const allocations = [
      { fundName: 'National', percentage: 60 },
      { fundName: 'Chapter', percentage: 30 },
    ];
    expect(validateFundAllocations(allocations)).toEqual({ valid: false, sum: 90 });
  });

  test('empty allocations are invalid', () => {
    expect(validateFundAllocations([])).toEqual({ valid: false, sum: 0 });
  });

  test('single allocation of 100% is valid', () => {
    const allocations = [{ fundName: 'General', percentage: 100 }];
    expect(validateFundAllocations(allocations)).toEqual({ valid: true, sum: 100 });
  });
});
