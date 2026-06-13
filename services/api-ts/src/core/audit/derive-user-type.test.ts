import { describe, expect, test } from 'bun:test';
import { deriveAuditUserType } from './derive-user-type';

describe('deriveAuditUserType', () => {
  test('null/undefined/empty role → client', () => {
    expect(deriveAuditUserType(null)).toBe('client');
    expect(deriveAuditUserType(undefined)).toBe('client');
    expect(deriveAuditUserType('')).toBe('client');
  });

  test('plain user role → client', () => {
    expect(deriveAuditUserType('user')).toBe('client');
  });

  test('system → system', () => {
    expect(deriveAuditUserType('system')).toBe('system');
  });

  test('comma-joined role list containing admin → admin (no overflow)', () => {
    const roleList = 'admin,platform_admin,association:admin,association:member,association:officer';
    expect(deriveAuditUserType(roleList)).toBe('admin');
    // The whole point of the fix: the result must fit varchar(20).
    expect(deriveAuditUserType(roleList).length).toBeLessThanOrEqual(20);
  });

  test('platform_admin alone → admin', () => {
    expect(deriveAuditUserType('platform_admin')).toBe('admin');
  });

  test('association officer (no admin) → client', () => {
    expect(deriveAuditUserType('association:member,association:officer')).toBe('client');
  });

  test('result is always a valid short user_type', () => {
    for (const role of [null, 'user', 'system', 'admin', 'admin,platform_admin', 'association:officer']) {
      const out = deriveAuditUserType(role);
      expect(['client', 'admin', 'system']).toContain(out);
      expect(out.length).toBeLessThanOrEqual(20);
    }
  });
});
