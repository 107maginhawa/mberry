// Action-Contract Tests: Dues & Payments Module
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Dues & Payments Actions', () => {
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
