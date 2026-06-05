// WF-043 — Financial Dashboard: collection rates, payment history, fund reports
// CT-3: Payment reconciliation — test payment list as reconciliation view
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CT-3: Payment Reconciliation', () => {
test('payments page shows financial dashboard with data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Heading must exist
    await expect(page.getByText('Dues & Payments')).toBeVisible({ timeout: 10000 })

    // Dashboard must show financial data — amounts, member counts, or payment records
    await expect(
      page.getByText(/\$|₱|total|collected|outstanding|members|paid|unpaid/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('payment history table renders with structure', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Table must render with headers or empty state message — not broken rendering
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')

    // Must show either payment records or explicit empty state
    const hasTable = await page.locator('table, [role="table"]').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasEmptyState = await page.getByText(/no payments|no records|no data/i).isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('financial report page loads with content', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/financial`)
    // Must show financial report content, not just shell
    await expect(page.getByText(/financial|report|revenue|summary/i).first()).toBeVisible({ timeout: 10000 })
  })
})
