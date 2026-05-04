/**
 * Admin E2E auth helper.
 * Signs in via backend API (admin has no auth UI routes).
 */

import type { Page, BrowserContext } from '@playwright/test'

const API_URL = 'http://localhost:7213'

export async function signInAsAdmin(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    data: {
      email: 'test@memberry.ph',
      password: 'TestPass123!',
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
