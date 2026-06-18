// WF-070 — Credit Reporting: officer compliance dashboard
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const REPORTS = /\/(credits|reports)/

test.describe('Credit Compliance Report', () => {
test('report page loads with heading and summary cards', async ({ page }) => {
    const respP = captureRouteHydration(page, REPORTS)
    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)
    await expect(
      page.getByRole('heading', { name: /credit compliance report/i }),
    ).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Summary cards exist (filter buttons)
    await expect(page.getByText(/total tracked/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/compliant/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('filter buttons update the member table', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)
    // Table should be visible
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10000 })

    // Click a filter — "Compliant"
    const compliantBtn = page.getByRole('button', { name: /compliant/i }).first()
    await compliantBtn.click()

    // Table should still be visible (may show filtered results or empty state)
    const hasRows = await page.locator('table tbody tr').first().isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no members found/i).isVisible().catch(() => false)
    expect(hasRows || hasEmpty).toBeTruthy()
  })

  test('no NaN or Infinity visible in progress bars', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)
    // Check that no NaN or Infinity text appears on the page
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('NaN')
    expect(pageText).not.toContain('Infinity')
  })
})
