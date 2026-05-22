import { test, expect } from '../helpers/test-fixture'

test.describe('Member Onboarding (/onboarding)', () => {
  test('shows profile completion heading', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Complete Your Profile' })).toBeVisible({ timeout: 10000 })
  })

  test('shows step 1 with specialization input', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Step 1 of 2')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('e.g. General Dentistry, Orthodontics')).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to step 2', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy Preferences' })).toBeVisible({ timeout: 10000 })
  })

  test('can go back from step 2 to step 1', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy Preferences' })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Specialization')).toBeVisible({ timeout: 10000 })
  })

  test('skip button navigates away', async ({ page }) => {
    await page.goto('/onboarding')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page).toHaveURL('/', { timeout: 10000 })
  })
})
