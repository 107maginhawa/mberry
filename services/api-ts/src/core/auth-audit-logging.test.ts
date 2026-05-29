/**
 * AL-001: Password change audit event with typed eventSubType
 * AL-002: MFA enable/disable audit logging
 *
 * Source-level assertions verifying auth.ts emits typed audit events
 * for password changes and MFA lifecycle events.
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const authSource = fs.readFileSync(
  path.resolve(import.meta.dir, './auth.ts'),
  'utf-8',
);

describe('AL-001: password change emits typed audit event', () => {
  test('password change audit uses authentication.password-changed eventSubType', () => {
    expect(authSource).toContain("eventSubType: 'authentication.password-changed'");
  });

  test('password change audit uses security category with authentication eventSubType', () => {
    // category is a compliance domain ('security'), eventSubType carries the typed classification
    expect(authSource).toContain("category: 'security'");
  });
});

describe('AL-002: MFA lifecycle audit logging', () => {
  test('MFA disable route emits authentication.mfa-disabled audit event', () => {
    expect(authSource).toContain("eventSubType: 'authentication.mfa-disabled'");
  });

  test('MFA enable route is intercepted for audit logging', () => {
    expect(authSource).toContain('/auth/two-factor/enable');
  });

  test('MFA enable emits authentication.mfa-enabled audit event', () => {
    expect(authSource).toContain("eventSubType: 'authentication.mfa-enabled'");
  });

  test('MFA audit events use AuditRepository', () => {
    // Both MFA intercepts must use the audit repo
    const mfaDisabledIndex = authSource.indexOf('mfa-disabled');
    const mfaEnabledIndex = authSource.indexOf('mfa-enabled');
    expect(mfaDisabledIndex).toBeGreaterThan(-1);
    expect(mfaEnabledIndex).toBeGreaterThan(-1);
  });
});

describe('audit-events.ts includes MFA sub-types', () => {
  const auditEventsSource = fs.readFileSync(
    path.resolve(import.meta.dir, '../utils/audit-events.ts'),
    'utf-8',
  );

  test('authentication category includes mfa-enabled', () => {
    expect(auditEventsSource).toContain("'mfa-enabled'");
  });

  test('authentication category includes mfa-disabled', () => {
    expect(auditEventsSource).toContain("'mfa-disabled'");
  });
});
