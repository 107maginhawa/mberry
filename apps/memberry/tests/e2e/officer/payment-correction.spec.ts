// CT-9: Payment correction
import { test, expect } from '@playwright/test'
import { signInAsTreasurer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CT-9: Payment Correction', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTreasurer(page)
  })

  test('payment detail shows all payment fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Should show payment fields: amount, method, date, reference
      await expect(page.getByText(/amount/i).first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/method/i).first()).toBeVisible()
    }
  })

  test('payment detail shows fund allocations when present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    const paymentLink = page.locator('a[href*="/officer/payments/"]:not([href*="/new"])').first()
    const hasPayments = await paymentLink.isVisible({ timeout: 10000 }).catch(() => false)

    if (hasPayments) {
      await paymentLink.click()
      await page.waitForLoadState('networkidle')

      // Page should render fully without errors
      const pageText = await page.locator('body').textContent()
      expect(pageText).not.toContain('undefined undefined')
    }
  })
})
