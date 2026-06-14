import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /dashboard hydrates via GET /persons/me.
// Capturing that response proves the backend returned data, not just
// that the dashboard shell rendered.
const PERSON_ME = /\/persons\/me(?:[/?]|$)/

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Dashboard (/dashboard)', () => {
  test('shows time-based greeting', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const respP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    const greeting = page.getByText(/good (morning|afternoon|evening)/i)
    await expect(greeting).toBeVisible({ timeout: 10000 })
  })

  test('shows "Your Organizations" section with org card', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await expect(
      page.getByText('Your Organizations').first(),
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
    await expect(
      page.getByText('Credit Progress'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('sidebar navigation: click Profile navigates to /my/profile', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /profile/i }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/my\/profile/)
  })

  test('sidebar navigation: click Home navigates to /dashboard', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/profile')
    await page.getByRole('link', { name: /home/i }).first().click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('mobile viewport: bottom nav visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })

    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    // Bottom nav should be visible on mobile
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeVisible({ timeout: 10000 })
  })
})
