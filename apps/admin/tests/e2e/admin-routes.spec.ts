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

// The admin app holds open the Vite HMR socket in dev mode, so
// page.waitForLoadState('networkidle') never settles. Wait for DOM ready
// and assert <main> renders — that is the actual signal the route mounted.
test.describe('Admin route coverage (Phase 4 gap fill)', () => {
  test('feature-flags page loads', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await signInAndNavigate(page, '/feature-flags')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
  })

  test('operators page loads', async ({ page }) => {
    await signInAndNavigate(page, '/operators')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
  })

  test('impersonate page loads', async ({ page }) => {
    await signInAndNavigate(page, '/impersonate')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 })
  })
})
