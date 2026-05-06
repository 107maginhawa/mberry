import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Account Settings', () => {
  test('account settings page renders profile forms', async ({ page }) => {
    await signInAndNavigate(page, '/settings/account')

    // Account settings renders "Account Settings" h1 + Personal Information card
    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    // Should NOT be on auth page
    expect(page.url()).not.toContain('/auth/')
  })

  test('security settings page renders security cards', async ({ page }) => {
    await signInAndNavigate(page, '/settings/security')

    // Security page renders "Security Settings" h1 heading
    await expect(page.getByRole('heading', { name: /security settings/i })).toBeVisible()

    // Should NOT be on auth page
    expect(page.url()).not.toContain('/auth/')
  })

  test('unauthenticated user is redirected from account settings', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should redirect to auth sign-in
    expect(page.url()).toContain('/auth/')
  })

  test('unauthenticated user is redirected from security settings', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/settings/security')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should redirect to auth sign-in
    expect(page.url()).toContain('/auth/')
  })
})
