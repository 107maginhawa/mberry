// CT-7 / BR-08: Payment refund flow
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CT-7: Payment Refund', () => {
test('payments page loads with history table', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByText('Dues & Payments')).toBeVisible({ timeout: 10000 })
  })

  test('payment detail page shows receipt and status', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Click first payment row to go to detail
    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Detail page shows receipt number and status badge
      await expect(page.getByText(/Amount:/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/completed|pending|refunded/i).first()).toBeVisible()
    }
  })

  test('completed payment shows refund form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // If payment is completed, refund form should be visible
      const isCompleted = await page.getByText('completed').isVisible({ timeout: 3000 }).catch(() => false)
      if (isCompleted) {
        // Refund form or refund-related UI should exist
        const hasRefund = await page.getByText(/refund/i).first().isVisible({ timeout: 3000 }).catch(() => false)
        expect(hasRefund).toBeTruthy()
      }
    }
  })

  test('payment detail has back navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Back link exists
      await expect(page.getByText(/back to payments/i)).toBeVisible({ timeout: 10000 })
    }
  })
})
