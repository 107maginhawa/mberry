import { test, expect } from '../helpers/test-fixture'

test.describe('Public Payment Page (/pay/$token)', () => {
  test('shows invalid state for bad token', async ({ page }) => {
    await page.goto('/pay/invalid-test-token')
    await page.waitForLoadState('networkidle')

    // Should show error state
    await expect(
      page.getByText(/payment link invalid|invalid|error/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('page renders without crash for random token', async ({ page }) => {
    await page.goto('/pay/abc123-random-token')
    await page.waitForLoadState('networkidle')

    // Page should render something (error or payment form)
    const hasError = await page.getByText(/invalid|error|not found/i).first().isVisible().catch(() => false)
    const hasPayForm = await page.getByText(/amount|pay now/i).first().isVisible().catch(() => false)
    expect(hasError || hasPayForm).toBeTruthy()
  })
})
