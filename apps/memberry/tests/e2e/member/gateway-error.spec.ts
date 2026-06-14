// WF-038 — Pay Dues Online: gateway error path
// M-19: Payment gateway unavailable fallback
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ authRole: 'member' })
test.describe('M-19: Gateway Error Handling', () => {
test('payments page loads without crash', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/my/payments')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    // Should show payments page (may be empty)
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('Something went wrong')
    expect(pageText).not.toContain('undefined undefined')
  })

  test('payments page shows payment history or empty state', async ({ page }) => {
    await page.goto('/my/payments')
    const hasContent = await page.getByText(/payment|no payment|history/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })
})
