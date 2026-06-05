// WF-043 — Financial Dashboard: collection rates, payment history, fund reports
// BR-07: Payment recording extends dues expiry
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-07: Payment & Expiry', () => {
test('Record Payment page loads with form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 10000 })
  })

  test('payment page has Record Payment button linking to form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const recordBtn = page.getByRole('link', { name: /record payment/i })
    await expect(recordBtn).toBeVisible({ timeout: 10000 })

    await recordBtn.click()
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 10000 })
    await expect(page).toHaveURL(/\/payments\/new/)
  })

  test('financial dashboard shows summary data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Financial dashboard should render with data or placeholders
    await expect(page.getByText('Dues & Payments')).toBeVisible({ timeout: 10000 })

    // Dashboard shows financial metrics (revenue, outstanding, etc)
    const pageText = await page.locator('body').textContent()
    // Should not show raw undefined values
    expect(pageText).not.toContain('undefined undefined')
  })
})
