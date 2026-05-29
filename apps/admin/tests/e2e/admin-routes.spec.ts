import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

// The admin app holds open the Vite HMR socket in dev mode, so
// page.waitForLoadState('networkidle') never settles. Wait for DOM ready
// and assert <main> renders — that is the actual signal the route mounted.
test.describe('Admin route coverage (Phase 4 gap fill)', () => {
  test('feature-flags page loads', async ({ page }) => {
    await signInAndNavigate(page, '/feature-flags')
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
