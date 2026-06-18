import { describe, test, expect } from 'bun:test';
import { clampPageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination';

describe('clampPageSize', () => {
  test('returns DEFAULT_PAGE_SIZE when requested is undefined', () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  test('returns DEFAULT_PAGE_SIZE when requested is NaN', () => {
    expect(clampPageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
  });

  test('clamps values below 1 up to 1', () => {
    expect(clampPageSize(0)).toBe(1);
    expect(clampPageSize(-50)).toBe(1);
  });

  test('clamps values above MAX_PAGE_SIZE down to the cap', () => {
    expect(clampPageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(10_000)).toBe(MAX_PAGE_SIZE);
  });

  test('passes through valid in-range values, flooring fractionals', () => {
    expect(clampPageSize(1)).toBe(1);
    expect(clampPageSize(50)).toBe(50);
    expect(clampPageSize(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(25.9)).toBe(25);
  });

  test('boundary: exactly 1 and exactly MAX stay put', () => {
    expect(clampPageSize(1)).toBe(1);
    expect(clampPageSize(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
  });
});

describe('pagination constants', () => {
  test('DEFAULT_PAGE_SIZE within [1, MAX_PAGE_SIZE]', () => {
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });
});
