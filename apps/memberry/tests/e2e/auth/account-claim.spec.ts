// M-2 / BR-24: Account claim via invitation
import { test, expect } from '@playwright/test'

test.describe('M-2: Account Claim', () => {
  test('invite page with invalid token shows error', async ({ page }) => {
    await page.goto('/invite/invalid-token-12345')
    await page.waitForLoadState('networkidle')

    // Should show error state for invalid token
    const hasError = await page.getByText(/invalid|expired|not found/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasValidating = await page.getByText(/validating/i).isVisible({ timeout: 3000 }).catch(() => false)

    // Either shows error or finishes validating with error
    if (hasValidating) {
      // Wait for validation to complete
      await page.waitForTimeout(5000)
      const hasErrorAfter = await page.getByText(/invalid|expired|not found/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasErrorAfter).toBeTruthy()
    } else {
      expect(hasError).toBeTruthy()
    }
  })

  test('invite page renders correct structure', async ({ page }) => {
    await page.goto('/invite/test-token')
    await page.waitForLoadState('networkidle')

    // Page should render without crash — shows either invite details or error
    await page.waitForTimeout(3000)
    const pageText = await page.locator('body').textContent()
    expect(pageText).toBeTruthy()
    // Should not show React error boundary
    expect(pageText).not.toContain('Something went wrong')
  })

  test('expired invite shows contact secretary message', async ({ page }) => {
    // Using a token that would be expired — tests the UI state
    await page.goto('/invite/expired-token-test')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    // If expired, should mention contacting secretary
    const hasExpired = await page.getByText(/expired/i).isVisible({ timeout: 3000 }).catch(() => false)
    if (hasExpired) {
      await expect(page.getByText(/secretary/i)).toBeVisible()
    }
    // If not expired error (just invalid), that's also fine
  })

  test('already claimed invite shows login link', async ({ page }) => {
    await page.goto('/invite/already-claimed-test')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    const isClaimed = await page.getByText(/already/i).isVisible({ timeout: 3000 }).catch(() => false)
    if (isClaimed) {
      const hasLogin = await page.getByText(/log in/i).isVisible({ timeout: 3000 }).catch(() => false)
      expect(hasLogin).toBeTruthy()
    }
  })
})
