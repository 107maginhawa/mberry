import { describe, test, expect } from 'vitest';
import {
  validateLicenseNumber,
  validatePrcId,
  normalizeLicenseNumber,
  professionalFieldsSchema,
} from './professional-fields';

describe('validateLicenseNumber', () => {
  test('valid license numbers pass', () => {
    expect(validateLicenseNumber('0012345')).toBe(true);
    expect(validateLicenseNumber('123456')).toBe(true);
    expect(validateLicenseNumber('PRC-12345')).toBe(true);
  });

  test('empty is valid (optional field)', () => {
    expect(validateLicenseNumber('')).toBe(true);
    expect(validateLicenseNumber(undefined)).toBe(true);
  });

  test('too long is invalid', () => {
    expect(validateLicenseNumber('a'.repeat(51))).toBe(false);
  });
});

describe('validatePrcId', () => {
  test('valid PRC IDs pass', () => {
    expect(validatePrcId('PRC-2024-12345')).toBe(true);
    expect(validatePrcId('12345')).toBe(true);
  });

  test('empty is valid (optional)', () => {
    expect(validatePrcId('')).toBe(true);
    expect(validatePrcId(undefined)).toBe(true);
  });

  test('too long is invalid', () => {
    expect(validatePrcId('x'.repeat(51))).toBe(false);
  });
});

describe('normalizeLicenseNumber', () => {
  test('strips spaces and dashes', () => {
    expect(normalizeLicenseNumber('PRC - 12345')).toBe('PRC12345');
    expect(normalizeLicenseNumber('00 123 45')).toBe('0012345');
  });

  test('trims whitespace', () => {
    expect(normalizeLicenseNumber('  12345  ')).toBe('12345');
  });

  test('empty returns empty', () => {
    expect(normalizeLicenseNumber('')).toBe('');
  });
});

describe('professionalFieldsSchema', () => {
  test('all empty is valid (all optional)', () => {
    const result = professionalFieldsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test('valid professional fields pass', () => {
    const result = professionalFieldsSchema.safeParse({
      licenseNumber: '12345',
      specialization: 'Dentistry',
      prcId: 'PRC-2024-001',
    });
    expect(result.success).toBe(true);
  });

  test('specialization too long fails', () => {
    const result = professionalFieldsSchema.safeParse({
      specialization: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
