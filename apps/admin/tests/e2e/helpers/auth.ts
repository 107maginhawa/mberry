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
