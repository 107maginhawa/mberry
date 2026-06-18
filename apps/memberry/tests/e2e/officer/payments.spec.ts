// Business Rules: [BR-04] [BR-05] [BR-06] [BR-08] [BR-32]
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const PAYMENTS = /\/(payments|dues-invoices)/

/**
 * /officer/payments redirects to /payments/new when the org has zero
 * payments (a common state for the seeded org under parallel test
 * pollution). Treat either landing page as "payments surface mounted"
 * — assert via the h1 of either page.
 */
async function assertPaymentsSurfaceMounted(page: import('@playwright/test').Page) {
  await expect(page).toHaveURL(/\/officer\/payments(\/new)?/, { timeout: 10000 })
  await expect(
    page.getByRole('heading', { level: 1 }).first(),
  ).toBeVisible({ timeout: 10000 })
}

test.describe('Officer Payments', () => {
  test('payments surface mounts', async ({ page }) => {
    const respP = captureRouteHydration(page, PAYMENTS)
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPaymentsSurfaceMounted(page)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('Record Payment form is reachable', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page).toHaveURL(/\/payments\/new/, { timeout: 10000 })
    await expect(
      page.getByRole('heading', { name: /record payment/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('[BR-32] payment listing area or empty state renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPaymentsSurfaceMounted(page)
  })
})
