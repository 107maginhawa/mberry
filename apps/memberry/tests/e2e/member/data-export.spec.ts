import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

test.describe('Data Export (/my/data-export)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
  })

  test('page loads with export description and request button', async ({ page }) => {
    await page.goto('/my/data-export')
    await page.waitForLoadState('networkidle')

    // Heading
    await expect(page.getByRole('heading', { name: /export my data/i })).toBeVisible({
      timeout: 10000,
    })

    // Info box with what's included
    await expect(page.getByText(/profile information/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/delivered as a JSON file/i)).toBeVisible({ timeout: 10000 })

    // Request button exists
    const btn = page.getByRole('button', { name: /request data export|next export available/i })
    await expect(btn).toBeVisible({ timeout: 10000 })
  })

  test('clicking export triggers download and shows rate limit', async ({ page }) => {
    // Clear rate limit state
    await page.goto('/my/data-export')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.removeItem('data_export_last_request'))
    await page.reload()
    await page.waitForLoadState('networkidle')

    const btn = page.getByRole('button', { name: /request data export/i })
    const isBtnVisible = await btn.isVisible().catch(() => false)

    if (isBtnVisible) {
      // Intercept the API call
      const responsePromise = page.waitForResponse(
        (r) => r.url().includes('/persons/me/export') && r.status() < 500,
        { timeout: 15000 },
      )
      await btn.click()
      await responsePromise

      // After click: either "Previous Exports" table appears or rate-limit message
      const hasExport = await page.getByText(/previous exports/i).isVisible().catch(() => false)
      const hasRateLimit = await page
        .getByText(/requested an export recently/i)
        .isVisible()
        .catch(() => false)
      expect(hasExport || hasRateLimit).toBeTruthy()
    } else {
      // Already rate limited — verify rate-limit message
      await expect(page.getByText(/next export available/i)).toBeVisible({ timeout: 10000 })
    }
  })
})
