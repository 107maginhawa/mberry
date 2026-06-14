// WF-043 — Financial Dashboard: collection rates, payment history, fund reports
// BR-07: Payment recording extends dues expiry
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess, captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'treasurer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const PAYMENTS = /\/(payments|dues-invoices)/

test.describe('BR-07: Payment & Expiry', () => {
test('Record Payment page loads with form', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
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
    const respP = captureRouteHydration(page, PAYMENTS)
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Financial dashboard should render with data or placeholders
    await expect(page.getByText('Dues & Payments')).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.ok()).toBe(true)

    // Dashboard shows financial metrics (revenue, outstanding, etc)
    const pageText = await page.locator('body').textContent()
    // Should not show raw undefined values
    expect(pageText).not.toContain('undefined undefined')
  })
})
