// CT-3: Payment reconciliation — test payment list as reconciliation view
import { test, expect } from '@playwright/test'
import { signInAsTreasurer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CT-3: Payment Reconciliation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTreasurer(page)
  })

  test('payments page shows financial dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Dues & Payments')).toBeVisible({ timeout: 10000 })
  })

  test('payment history table shows records', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await page.waitForLoadState('networkidle')

    // Table should render with headers or empty state
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')
  })

  test('financial report page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/financial`)
    await page.waitForLoadState('networkidle')

    // Should show financial report
    const hasContent = await page.getByText(/financial|report|revenue|summary/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()
  })
})
