import { describe, test, expect } from 'bun:test';
import {
  normalizeEmail,
  normalizeLicenseNumber,
  findIdentityMatches,
} from './identity-matching';

describe('normalizeEmail', () => {
  test('lowercases and trims', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });
});

describe('normalizeLicenseNumber', () => {
  test('strips spaces, dashes and leading zeros', () => {
    expect(normalizeLicenseNumber(' 00 12-3450 ')).toBe('123450');
  });

  test('all-zeros collapses to a single 0', () => {
    expect(normalizeLicenseNumber('0000')).toBe('0');
  });
});

describe('findIdentityMatches', () => {
  // Audit P1: the function previously returned [] unconditionally (real query
  // commented out). In an identity-dedup context a silent empty result means
  // "no match -> create a duplicate person", so it must fail loud until the
  // person license-field queries are actually implemented (v1.2.0).
  test('throws not-implemented instead of silently returning []', async () => {
    await expect(findIdentityMatches({}, 'a@b.com', '12345')).rejects.toThrow(/not implemented/i);
  });
});
