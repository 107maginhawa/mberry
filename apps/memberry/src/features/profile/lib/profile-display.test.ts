import { describe, test, expect } from 'vitest';
import { formatPersonName, formatLicenseDisplay, getInitials } from './profile-display';

describe('formatPersonName', () => {
  test('formats full name', () => {
    expect(formatPersonName('Juan', 'Dela Cruz', 'Santos')).toBe('Juan Santos Dela Cruz');
  });

  test('handles missing middle name', () => {
    expect(formatPersonName('Juan', 'Dela Cruz')).toBe('Juan Dela Cruz');
  });

  test('handles missing last name', () => {
    expect(formatPersonName('Juan')).toBe('Juan');
  });
});

describe('formatLicenseDisplay', () => {
  test('formats license with PRC prefix', () => {
    expect(formatLicenseDisplay('12345', 'PRC-001')).toBe('PRC-001 (License: 12345)');
  });

  test('license only', () => {
    expect(formatLicenseDisplay('12345')).toBe('License: 12345');
  });

  test('prcId only', () => {
    expect(formatLicenseDisplay(undefined, 'PRC-001')).toBe('PRC: PRC-001');
  });

  test('neither returns empty', () => {
    expect(formatLicenseDisplay()).toBe('');
  });
});

describe('getInitials', () => {
  test('returns first letters of first and last name', () => {
    expect(getInitials('Juan', 'Dela Cruz')).toBe('JD');
  });

  test('returns first letter only if no last name', () => {
    expect(getInitials('Juan')).toBe('J');
  });

  test('uppercase', () => {
    expect(getInitials('juan', 'dela cruz')).toBe('JD');
  });
});
