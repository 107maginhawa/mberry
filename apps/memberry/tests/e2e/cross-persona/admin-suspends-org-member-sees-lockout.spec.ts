/**
 * Cross-persona: Platform admin suspends an org; the active member's session
 *                survives but every authenticated UI surface routes to a
 *                lockout/banner explaining the suspension.
 *
 * Personas: P1 (platform admin) → P6 (member)
 *
 * Verifies BR-08 (refund policy on suspend) + access-control cascade. The
 * memberry app must HOLD the session (not log the user out) but degrade
 * the surface to read-only with an explanation.
 */

import { test, expect } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: admin suspends org → member sees lockout', () => {
  test.fixme('suspended org cascades to a member lockout surface', async ({ browser }) => {
    // 1. Member context: sign in, capture current dashboard screenshot.
    // 2. Admin context (apps/admin, storageState platform_admin):
    //    POST /admin/organizations/$ORG_ID/suspend with a reason.
    // 3. Member context: refresh /dashboard. Assert lockout banner is
    //    visible AND read-only surface (no Pay Dues button, no Register
    //    for Event button). Session token must still be valid (no redirect
    //    to /auth/sign-in).
    // 4. Admin context: unsuspend. Member dashboard should re-enable the
    //    write actions on next refresh.
  })
})
