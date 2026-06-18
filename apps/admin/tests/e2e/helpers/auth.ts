/**
 * Admin E2E auth helper.
 * Signs in via backend API (admin has no auth UI routes).
 */

import type { Page, BrowserContext } from '@playwright/test'
import { ADMIN_BASE, TEST_PASSWORD } from './test-config'

export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${ADMIN_BASE}/api/auth/sign-in/email`, {
    headers: {
      // Better-Auth rejects requests without an Origin header
      // (MISSING_OR_NULL_ORIGIN). Provide the admin app origin so the
      // raw APIRequestContext call passes the CSRF/origin guard.
      Origin: ADMIN_BASE,
    },
    data: {
      email: 'test@memberry.ph',
      password: TEST_PASSWORD,
    },
  })

  if (!response.ok()) {
    throw new Error(`Admin sign-in failed: ${response.status()} ${await response.text()}`)
  }
}

export async function signInAndNavigate(page: Page, path = '/'): Promise<void> {
  await signInAsAdmin(page.context())
  await page.goto(`http://localhost:3003${path}`)
}

/**
 * Headers for state-changing admin-API calls made via the raw
 * APIRequestContext (POST/PUT/PATCH/DELETE).
 *
 * The backend enforces a double-submit CSRF guard (middleware/csrf-token.ts):
 * a state-changing request must carry an `x-csrf-token` header whose value
 * equals the `csrf_token` cookie. A real browser page gets this for free via
 * the SDK; the raw APIRequestContext does not, so every mutating admin test
 * 403'd with CSRF_TOKEN_MISSING. This fetches GET /csrf-token (which sets the
 * cookie in the shared context jar and returns the token in the body), then
 * returns the header so the cookie+header pair matches. Always includes Origin
 * (Better-Auth rejects missing/null Origin).
 */
export async function csrfHeaders(
  context: BrowserContext,
): Promise<{ Origin: string; 'x-csrf-token': string }> {
  const res = await context.request.get(`${ADMIN_BASE}/api/csrf-token`, {
    headers: { Origin: ADMIN_BASE },
  })
  if (!res.ok()) {
    throw new Error(`csrf-token fetch failed: ${res.status()} ${await res.text()}`)
  }
  const { token } = (await res.json()) as { token: string }
  return { Origin: ADMIN_BASE, 'x-csrf-token': token }
}
