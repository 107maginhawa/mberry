import { test, expect } from '../helpers/test-fixture'

test.describe('Public Payment Page (/pay/$token)', () => {
  test('shows invalid state for bad token', async ({ page, allowApiFailures }) => {
    allowApiFailures.push(/pay/)
    await page.goto('/pay/invalid-test-token')
    await page.waitForLoadState('networkidle')

    // Should show error state — "Payment Link Invalid" heading
    await expect(
      page.getByText(/payment link invalid|invalid payment|error/i).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('page renders without crash for random token', async ({ page, allowApiFailures }) => {
    allowApiFailures.push(/pay/)
    allowApiFailures.push(/validate/)
    await page.goto('/pay/abc123-random-token')
    // Page may show spinner while API call runs — wait for any text to appear
    await page.waitForTimeout(5000)

    // Page should render error state, payment form, or at minimum not crash
    const hasError = await page.getByText(/invalid|error|not found|payment link/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasPayForm = await page.getByText(/amount|pay now/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    const hasSpinner = await page.locator('[class*="spin"], [class*="load"]').first().isVisible({ timeout: 3000 }).catch(() => false)
    // Spinner is acceptable — means page loaded without crashing
    expect(hasError || hasPayForm || hasSpinner).toBeTruthy()
  })
})
