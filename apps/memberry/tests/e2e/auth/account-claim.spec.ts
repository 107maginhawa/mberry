// M-2 / BR-24: Account claim via invitation
import { test, expect } from '../helpers/test-fixture'

test.describe('M-2: Account Claim', () => {
  test('invite page with invalid token shows error', async ({ page }) => {
    await page.goto('/invite/invalid-token-12345')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    // Invalid token must show error — not silently pass
    await expect(page.getByText(/invalid|expired|not found/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('invite page renders correct structure', async ({ page }) => {
    await page.goto('/invite/test-token')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Page must render without crash
    const pageText = await page.locator('body').textContent()
    expect(pageText).toBeTruthy()
    expect(pageText).not.toContain('Something went wrong')
    // Fake token must produce error state, not blank page
    await expect(page.getByText(/invalid|expired|not found|invitation/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('expired invite shows error state', async ({ page }) => {
    await page.goto('/invite/expired-token-test')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    // Expired/invalid token must show error — never silently pass
    await expect(page.getByText(/invalid|expired|not found/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('already claimed invite shows error state', async ({ page }) => {
    await page.goto('/invite/already-claimed-test')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    // Fake token must produce error — never silently pass
    await expect(page.getByText(/invalid|expired|not found|already/i).first()).toBeVisible({ timeout: 5000 })
  })
})
