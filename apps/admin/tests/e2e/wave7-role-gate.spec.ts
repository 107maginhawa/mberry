// @selector-only-ok: auth-guard spec — asserts unauthenticated requests are blocked, no data hydration to capture
import { test, expect } from '@playwright/test'

test.describe('Wave 7: New routes require admin auth', () => {
  const protectedRoutes = [
    { path: '/national-dashboard', label: 'National Dashboard' },
    { path: '/events', label: 'Events' },
    { path: '/training', label: 'Training' },
    { path: '/committees', label: 'Committees' },
  ]

  for (const route of protectedRoutes) {
    test(`${route.path} blocks unauthenticated access`, async ({ page }) => {
      // Navigate without signing in
      await page.goto(`http://localhost:3003${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      })

      // Admin sidebar must NOT be visible (auth guard redirects to sign-in)
      await expect(page.locator('text=Memberry Admin')).not.toBeVisible({ timeout: 5000 })
      // The specific page heading must NOT render
      await expect(
        page.getByRole('heading', { name: new RegExp(route.label, 'i') })
      ).not.toBeVisible({ timeout: 5000 })
    })
  }
})
