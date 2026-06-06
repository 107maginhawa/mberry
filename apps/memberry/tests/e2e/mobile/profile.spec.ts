// Mobile viewport tests for the member-facing /my/* pages.
// Viewport: 375×812 (iPhone X).
//
// History (B-10, 2026-06-06): the original assertions were
// `getByText(/regex/).first().isVisible(...).catch(() => false)`. That
// pattern silently swallows Playwright strict-mode errors when the
// regex matches multiple elements on the page — every failure returned
// `false` regardless of root cause, and there was no signal whether the
// page actually rendered or just had ambiguous text. Replace with
// role-scoped, single-heading assertions that fail loudly and pin the
// real page contract (page-title heading + bottom-nav landmark).
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('Mobile: Profile & Settings', () => {
  test('profile page renders correctly on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/profile')
    await expect(page.getByRole('heading', { name: /profile/i, level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('settings page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/settings')
    await expect(page.getByRole('heading', { name: /^settings$/i, level: 1 })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('tab', { name: /general/i })).toBeVisible()
  })

  test('organizations page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/organizations')
    await expect(page.getByRole('heading', { name: /organization/i, level: 1 })).toBeVisible({ timeout: 10000 })
  })

  test('mobile bottom navigation is visible', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/dashboard')
    await expect(page.getByRole('navigation', { name: /member navigation/i })).toBeVisible({ timeout: 10000 })
  })

  test('ID card page renders on mobile', async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/id-card')
    await expect(page.getByRole('heading', { name: /digital id card/i, level: 1 })).toBeVisible({ timeout: 10000 })
  })
})
