/**
 * Programmatic (API) sign-in → Playwright storageState.
 *
 * Durable replacement for the once-per-suite UI sign-in + long-lived
 * `.auth/<role>.json` storageState files (see auth.setup.ts, now retired).
 *
 * Why this exists (CONTINUE-55 / CONTINUE-56):
 *   The old model signed each persona in ONCE and reused that single session
 *   for the whole ~46-min run. That session ages, and any of:
 *     - V-15 concurrent-session eviction (core/session-limit.ts),
 *     - a role/term/membership mutation that revokes the user's sessions
 *       (governance updateOfficerTerm/deleteOfficerTerm, member
 *       resign/terminate/decease, P1-4 role-change at core/auth.ts),
 *   silently kills the reused session mid-run → every later spec is
 *   unauthenticated → 401 → toBeVisible cascade.
 *
 *   Minting a FRESH session per test (via `authRole` in helpers/test-fixture)
 *   removes that whole failure class: no spec depends on a stale session, and
 *   a sibling spec revoking a session can't 401 the next one. Paired with the
 *   SESSION_LIMIT override (Phase 0) so the flood of test sign-ins never
 *   evicts an in-use session.
 *
 * Mechanics:
 *   POST {API_BASE}/auth/sign-in/email (better-auth) sets the
 *   `better-auth.session_token` cookie for the `localhost` host (port-agnostic;
 *   localhost:3004 ↔ localhost:7213 is same-site, so SameSite=Lax travels on
 *   the app's direct API calls). We capture the cookie jar via Playwright's
 *   APIRequestContext.storageState() and hand the `{ cookies, origins }` object
 *   straight to the browser context — no file, no UI.
 */

import { request as pwRequest } from '@playwright/test'
import type { AuthRole } from './auth-state'
import {
  API_BASE,
  TEST_PASSWORD,
  SEED_OFFICER_EMAIL,
  SEED_MEMBER_EMAIL,
  SEED_TREASURER_EMAIL,
  SEED_SECRETARY_EMAIL,
  SEED_SOCIETY_EMAIL,
  SEED_IDOR_EMAIL,
} from './test-config'

export type { AuthRole }

/** Seeded better-auth credentials per persona (helpers/test-config.ts). */
const ROLE_EMAIL: Record<AuthRole, string> = {
  officer: SEED_OFFICER_EMAIL,
  member: SEED_MEMBER_EMAIL,
  treasurer: SEED_TREASURER_EMAIL,
  secretary: SEED_SECRETARY_EMAIL,
  society: SEED_SOCIETY_EMAIL,
  idor: SEED_IDOR_EMAIL,
}

/** Playwright storageState shape (cookies + localStorage origins). */
export type AuthStorageState = Awaited<
  ReturnType<Awaited<ReturnType<typeof pwRequest.newContext>>['storageState']>
>

/**
 * Sign the seeded persona in via the API and return a fresh Playwright
 * storageState. Pass the result straight to `test.use({ storageState })` (the
 * `authRole` fixture does this for you) or `browser.newContext({ storageState })`.
 *
 * Throws on a non-2xx sign-in so a broken seed/credential fails loudly instead
 * of producing a silently-unauthenticated context (the 401-cascade trap).
 */
export async function freshAuthState(role: AuthRole): Promise<AuthStorageState> {
  return signInState(ROLE_EMAIL[role], TEST_PASSWORD, `freshAuthState('${role}')`)
}

/**
 * Sign ANY email/password in via the API and return a fresh Playwright
 * storageState — used for dynamically-created users (a just-signed-up
 * applicant) that have no seeded `AuthRole`. Same durable, per-call session
 * semantics as `freshAuthState`. Backs the clause-4 independent-read helper.
 *
 * Throws on a non-2xx sign-in so a bad credential fails loudly instead of
 * yielding a silently-unauthenticated context.
 */
export async function signInState(
  email: string,
  password: string,
  label = `signInState('${email}')`,
): Promise<AuthStorageState> {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE })
  try {
    const res = await ctx.post('/auth/sign-in/email', {
      data: { email, password },
      headers: {
        'Content-Type': 'application/json',
        // CORS allow-list match (services CORS_ORIGINS); better-auth also uses
        // Origin for its own CSRF check on auth routes.
        Origin: 'http://localhost:3004',
      },
    })
    if (!res.ok()) {
      const body = await res.text().catch(() => '<unreadable>')
      throw new Error(`${label} sign-in failed: ${res.status()} ${body.slice(0, 300)}`)
    }
    return await ctx.storageState()
  } finally {
    await ctx.dispose()
  }
}
