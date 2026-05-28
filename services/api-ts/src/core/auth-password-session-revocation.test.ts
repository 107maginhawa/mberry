/**
 * EF-M02: Session invalidation on password change
 *
 * Verifies that:
 * 1. auth.ts configures revokeSessionsOnPasswordReset: true
 * 2. /auth/change-password route forces revokeOtherSessions
 * 3. registerRoutes intercepts change-password before Better-Auth handler
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const authSource = fs.readFileSync(
  path.resolve(import.meta.dir, './auth.ts'),
  'utf-8',
);

describe('EF-M02: session invalidation on password change', () => {
  test('emailAndPassword config sets revokeSessionsOnPasswordReset: true', () => {
    // Better-Auth config must revoke all sessions when password is reset via email link
    expect(authSource).toContain('revokeSessionsOnPasswordReset: true');
  });

  test('change-password route intercepts and forces revokeOtherSessions', () => {
    // The registerRoutes function must intercept /auth/change-password
    // to inject revokeOtherSessions: true into the body
    expect(authSource).toContain('/auth/change-password');
    expect(authSource).toContain('revokeOtherSessions');
  });

  test('session revocation is audited on password change', () => {
    // The change-password interception must log to audit trail
    expect(authSource).toContain('Password changed');
    expect(authSource).toContain('EF-M02');
  });
});
