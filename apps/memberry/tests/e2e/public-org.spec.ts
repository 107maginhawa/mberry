import { test, expect } from '@playwright/test'

test.describe('Public org page (/org/$slug)', () => {
  test('shows org profile for valid slug', async ({ page }) => {
    await page.goto('/org/pda-metro-manila')

    // Org name visible
    await expect(page.getByText('PDA Metro Manila Chapter')).toBeVisible()

    // Association name
    await expect(page.getByText('Philippine Dental Association')).toBeVisible()

    // Org details
    await expect(page.getByText('Type')).toBeVisible()
    await expect(page.getByText('NCR')).toBeVisible()
    await expect(page.getByText('metromanila@pda.ph')).toBeVisible()
  })

  test('shows not found for invalid slug', async ({ page }) => {
    await page.goto('/org/nonexistent-org-slug')
    await expect(page.getByText('Organization Not Found')).toBeVisible()
  })

  test('Apply to Join button has correct href', async ({ page }) => {
    await page.goto('/org/pda-metro-manila')
    const applyButton = page.getByRole('link', { name: /apply to join/i })
    await expect(applyButton).toBeVisible()
    await expect(applyButton).toHaveAttribute('href', /register\?org=pda-metro-manila/)
  })

  test('shows loading spinner initially', async ({ page }) => {
    // Intercept API to delay response
    await page.route('**/api/public/org/**', async (route) => {
      await new Promise(r => setTimeout(r, 500))
      await route.continue()
    })
    await page.goto('/org/pda-metro-manila')
    // Spinner should be visible briefly
    const spinner = page.locator('.animate-spin')
    await expect(spinner).toBeVisible()
    // Then content loads
    await expect(page.getByText('PDA Metro Manila Chapter')).toBeVisible()
  })
})
