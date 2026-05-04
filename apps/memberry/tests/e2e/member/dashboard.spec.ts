import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'

test.describe('Member Dashboard (/dashboard)', () => {
  test('shows time-based greeting', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const greeting = page.getByText(/good (morning|afternoon|evening)/i)
    await expect(greeting).toBeVisible({ timeout: 10000 })
  })

  test('shows "Your Organizations" section with org card', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText('Your Organizations'),
    ).toBeVisible({ timeout: 10000 })

    // Org card shows membership ID and Active badge
    await expect(
      page.getByText(/PDA-2025/).first(),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText('Active').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('credit summary widget is visible', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText('Credit Progress'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('sidebar navigation: click Profile navigates to /my/profile', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: /profile/i }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/my\/profile/)
  })

  test('sidebar navigation: click Home navigates to /dashboard', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: /home/i }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('mobile viewport: bottom nav visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Bottom nav should be visible on mobile
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeVisible({ timeout: 10000 })
  })
})
