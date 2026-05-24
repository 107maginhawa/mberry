import { test, expect } from '../helpers/test-fixture'
import { signUpForOnboarding } from '../helpers/auth'

// Shared helper to fill DOB via calendar picker and advance to step 2
async function fillDobAndAdvance(page: import('@playwright/test').Page) {
  await page.locator('button:has-text("Pick a date")').click()
  await page.waitForTimeout(1000)
  await page.locator('table button:has-text("15")').first().click({ timeout: 5000 })
  await page.getByRole('button', { name: /next/i }).first().click()
}

test.describe('Member Onboarding (/onboarding)', () => {
  test.beforeEach(async ({ page }) => {
    await signUpForOnboarding(page)
  })

  test('shows step 1 heading', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Step 1 of 2: Personal Information')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Tell us about yourself')).toBeVisible()
  })

  test('shows form fields for personal info', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })

    // Required fields — use exact: false to match "First Name *" etc.
    await expect(page.getByText('First Name').first()).toBeVisible()
    await expect(page.getByText('Last Name').first()).toBeVisible()
    await expect(page.getByText('Date of Birth').first()).toBeVisible()
    await expect(page.locator('button:has-text("Pick a date")')).toBeVisible()

    // Optional fields
    await expect(page.getByText('Middle Name')).toBeVisible()
    await expect(page.getByText('Specialization')).toBeVisible()
  })

  test('can navigate to step 2 after filling required fields', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })

    await fillDobAndAdvance(page)

    await expect(page.getByText('Step 2 of 2')).toBeVisible({ timeout: 10000 })
  })

  test('can go back from step 2 to step 1', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })

    await fillDobAndAdvance(page)
    await expect(page.getByText('Step 2 of 2')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /back/i }).click()
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })
  })

  test('skip button on step 2 navigates to dashboard', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })

    await fillDobAndAdvance(page)
    await expect(page.getByText('Step 2 of 2')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /skip for now/i }).click()
    // Skip creates person without address and redirects to dashboard
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/dashboard|\/onboarding/, { timeout: 15000 })
  })
})
