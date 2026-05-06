/**
 * Admin E2E auth helper.
 * Signs in via backend API (admin has no auth UI routes).
 */

import type { Page, BrowserContext } from '@playwright/test'
import { API_BASE, TEST_PASSWORD } from './test-config'

export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_BASE}/auth/sign-in/email`, {
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
