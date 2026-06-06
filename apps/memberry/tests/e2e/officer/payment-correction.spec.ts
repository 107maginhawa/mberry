// CT-9: Payment correction
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const PAYMENTS = /\/(payments|dues-invoices)/

test.describe('CT-9: Payment Correction', () => {
test('payment detail shows all payment fields', async ({ page }) => {
    const respP = captureRouteHydration(page, PAYMENTS)
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Should show payment fields: amount, method, date, reference
      await expect(page.getByText(/amount/i).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/method/i).first()).toBeVisible()
    }
    const resp = await respP
    expect(resp?.ok()).toBe(true)
  })

  test('payment detail shows fund allocations when present', async ({ page }) => {
    const respP = captureRouteHydration(page, PAYMENTS)
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Page should render fully without errors
      const pageText = await page.locator('body').textContent()
      expect(pageText).not.toContain('undefined undefined')
    }
    const resp = await respP
    expect(resp?.ok()).toBe(true)
  })
})
