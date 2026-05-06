import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Account Bookings', () => {
  test('authenticated user can view bookings list page', async ({ page }) => {
    await signInAndNavigate(page, '/bookings')

    // Bookings page renders h1 "Bookings" heading and tabs
    await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()

    // Should NOT be on auth page
    expect(page.url()).not.toContain('/auth/')
  })

  test('unauthenticated user is redirected from bookings', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should redirect to auth sign-in
    expect(page.url()).toContain('/auth/')
  })

  test('error case — navigating to invalid booking ID shows error or redirect', async ({ page }) => {
    await signInAndNavigate(page, '/bookings/nonexistent-id-12345')
    await page.waitForLoadState('networkidle')

    // Should show an error/not-found state or redirect away — not crash
    const errorVisible = await page.locator('text=not found').count() +
      await page.locator('text=error').count() +
      await page.locator('text=404').count()
    const redirectedAway = !page.url().includes('nonexistent-id-12345')

    expect(errorVisible > 0 || redirectedAway).toBe(true)
  })
})
