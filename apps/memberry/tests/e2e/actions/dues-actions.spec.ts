// Action-Contract Tests: Dues & Payments Module
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ORG_SLUG = 'pda-metro-manila'

test.describe('Dues & Payments Actions', () => {
  test('T5 mark invoice paid via UI → invoice migrates to Paid tab', async ({ page }) => {
    // Real-UI promotion: drive the Invoices page Mark Paid dropdown action
    // and assert the status badge transitions to "Paid" in the same row
    // after the mutation resolves. Source of truth: seeded `pda-metro-manila`
    // org which has 4 sent/overdue invoices via layer-4 seed.
    await page.goto(`/org/${ORG_SLUG}/officer/finances/invoices?tab=sent`)
    await expect(
      page.getByRole('heading', { name: /invoices/i, level: 1 }),
    ).toBeVisible({ timeout: 15000 })

    // Wait for invoice rows to load (skeleton → table).
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 })

    // First row — the page renders sent-tab filtered rows in invoice-number
    // order. Capture invoice number text from the row.
    const firstRow = page.locator('table tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 15000 })
    const rowText = (await firstRow.textContent()) ?? ''
    const invoiceNumber = rowText.match(/INV-\d{4}-\d{3}/)?.[0] ?? ''
    expect(invoiceNumber, 'first invoice number captured').toMatch(/INV-/)

    // Use bulk-select Mark Paid instead of the per-row dropdown trigger —
    // the dropdown trigger is an icon-only button that Playwright's
    // accessibility snapshot collapses, making direct targeting brittle.
    // Bulk path: select the row's checkbox → click Mark Paid in bulk-actions bar.
    const rowCheckbox = firstRow.getByRole('checkbox')
    await rowCheckbox.click()

    const markPaidRes = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/dues-invoices\/.+\/mark-paid/.test(r.url()) &&
        r.status() < 400,
      { timeout: 15000 },
    )
    // The bulk Mark Paid button appears in the bulk-actions bar after select.
    const bulkMarkPaid = page.getByRole('button', { name: /^mark paid$/i }).first()
    await expect(bulkMarkPaid).toBeVisible({ timeout: 5000 })
    await bulkMarkPaid.click()
    const resp = await markPaidRes
    expect(resp.status(), `mark-paid POST got ${resp.status()}`).toBeLessThan(300)

    // Cross-surface persistence: flip to the Paid tab, verify the invoice
    // we just marked appears there. The invalidate() in the page hook
    // refetches after the mutation settles, so the row migrates tabs.
    // Real state change > flaky toast assertion.
    await page.goto(`/org/${ORG_SLUG}/officer/finances/invoices?tab=paid`)
    await expect(page.getByText(invoiceNumber).first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('payments page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Page mounts an h1 + sidebar. Don't pin to specific receipt prefixes
    // or seed amounts — payments mutate between specs.
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('Record Payment form is reachable', async ({ page }) => {
    // /payments lands on the listing OR the create form depending on
    // whether any payments exist for the org. Navigate directly to
    // /new — verifies the form mounts either way.
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    await expect(page).toHaveURL(/\/payments\/new/, { timeout: 10000 })
    await expect(
      page.getByRole('heading', { name: /record payment/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })
    // Member-search is now a combobox with "Search by name or license
    // number..." inline text (no placeholder attr). Verify the Amount
    // field instead — single mandatory form input on the page.
    await expect(page.getByRole('spinbutton', { name: /amount/i }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('member search input is present on payment form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)
    // Member search is a combobox now (was a placeholder input).
    // Assert it renders by its accessible name.
    await expect(
      page
        .getByRole('combobox')
        .filter({ hasText: /search.*name|license/i })
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('dues config page loads with form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
    await expect(
      page.locator('input[type="number"], input[type="text"]').first(),
    ).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /save/i }).first())
      .toBeVisible({ timeout: 5000 })
  })

  test('fund allocation page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('gateway settings page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/gateway`)
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('financial reports page renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/financial`)
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })
})
