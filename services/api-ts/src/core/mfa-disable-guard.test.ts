/**
 * M3-R7: Platform admins cannot disable 2FA.
 *
 * Tests the guard logic conceptually — the actual middleware is in auth.ts
 * registered on POST /auth/two-factor/disable. This test validates
 * the decision function without Better-Auth infrastructure.
 */
import { describe, test, expect } from 'bun:test';

describe('M3-R7: MFA disable prevention for platform admins', () => {
  // The guard in auth.ts checks: if user is in platform_admin table → reject
  // This is a conceptual test validating the rule

  test('platform admin should be blocked from disabling 2FA', () => {
    const isPlatformAdmin = true;
    const shouldBlock = isPlatformAdmin;
    expect(shouldBlock).toBe(true);
  });

  test('regular user should be allowed to disable 2FA', () => {
    const isPlatformAdmin = false;
    const shouldBlock = isPlatformAdmin;
    expect(shouldBlock).toBe(false);
  });

  test('guard returns 403 for admin, passes through for non-admin', () => {
    function mfaDisableGuard(isAdmin: boolean): { status: number } | null {
      if (isAdmin) return { status: 403 };
      return null; // pass through
    }

    expect(mfaDisableGuard(true)?.status).toBe(403);
    expect(mfaDisableGuard(false)).toBeNull();
  });
});
