/**
 * Account app E2E auth helper.
 * Signs in via backend API for speed (avoids UI form interaction on every test).
 */

import type { Page, BrowserContext } from '@playwright/test'

const API_URL = 'http://localhost:7213'

export async function signInAsUser(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
    data: {
      email: 'test@memberry.ph',
      password: 'TestPass123!',
    },
  })

  if (!response.ok()) {
    throw new Error(`Account sign-in failed: ${response.status()} ${await response.text()}`)
  }
}

export async function signInAndNavigate(page: Page, path = '/'): Promise<void> {
  await signInAsUser(page.context())
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}
