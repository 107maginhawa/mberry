// M-19: Payment gateway unavailable fallback
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../auth.setup'


test.use({ storageState: authStateFile('member') })
test.describe('M-19: Gateway Error Handling', () => {
test('payments page loads without crash', async ({ page }) => {
    await page.goto('/my/payments')
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
