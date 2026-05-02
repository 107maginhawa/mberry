import { describe, test, expect } from 'bun:test';
import { formatReceiptNumber, parseReceiptNumber } from './receipt-number';

describe('formatReceiptNumber', () => {
  test('formats with zero-padded sequence', () => {
    expect(formatReceiptNumber('PDA', 2026, 1)).toBe('PDA-2026-000001');
    expect(formatReceiptNumber('PDA', 2026, 42)).toBe('PDA-2026-000042');
    expect(formatReceiptNumber('PDA', 2026, 999999)).toBe('PDA-2026-999999');
  });
});

describe('parseReceiptNumber', () => {
  test('parses valid receipt number', () => {
    expect(parseReceiptNumber('PDA-2026-000042')).toEqual({
      orgCode: 'PDA',
      year: 2026,
      sequence: 42,
    });
  });

  test('returns null for invalid format', () => {
    expect(parseReceiptNumber('invalid')).toBeNull();
    expect(parseReceiptNumber('PDA-2026')).toBeNull();
  });
});
