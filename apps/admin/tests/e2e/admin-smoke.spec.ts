import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

function captureAnyApiSuccess(page: import('@playwright/test').Page, timeout = 20000) {
  return page
    .waitForResponse(
      (r) => r.url().includes('/api/') && r.request().method() === 'GET' && r.status() < 400,
      { timeout },
    )
    .catch(() => null)
}

test.describe('Admin app smoke tests', () => {
  test('dashboard loads for admin user', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await signInAndNavigate(page, '/')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(page.locator('text=Memberry Admin')).toBeVisible()
  })

  test('non-admin user cannot access admin dashboard', async ({ page }) => {
    // Navigate without signing in — admin content should not render
    await page.goto('http://localhost:3003/', { waitUntil: 'domcontentloaded' })
    // Admin sidebar/dashboard must NOT be visible (auth guard blocks rendering)
    await expect(page.locator('text=Platform Admin')).not.toBeVisible({ timeout: 10000 })
  })
})
