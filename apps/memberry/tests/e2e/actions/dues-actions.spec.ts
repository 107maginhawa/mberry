// Action-Contract Tests: Dues & Payments Module
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Dues & Payments Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('payments page shows real payment data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)

    // Must show real receipts, amounts, statuses
    await expect(page.getByText(/PDA-/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/₱/).first()).toBeVisible()
    await expect(page.getByText(/completed|pending/i).first()).toBeVisible()
  })

  test('Record Payment button → navigates to payment form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page.getByRole('link', { name: /Record Payment/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: /Record Payment/i }).click()

    // Should be on /payments/new with the form
    await expect(page.getByText(/Record Payment|Member/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.url()).toContain('/payments/new')
    await expect(page.getByPlaceholder(/search|name/i).first()).toBeVisible()
  })

  test('member search in payment form returns results', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments/new`)

    // Type in member search
    const searchInput = page.getByPlaceholder(/search|name|license/i).first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.fill('Juan')

    // Search should return results
    await expect(page.getByText(/Juan Cruz/i)).toBeVisible({ timeout: 5000 })
  })

  test('dues config page loads with values and Save button exists', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)

    await expect(page.getByText(/Dues Configuration/i)).toBeVisible({ timeout: 10000 })
    // Should show existing config values
    await expect(page.locator('input[type="number"], input[type="text"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /save/i })).toBeVisible()
  })

  test('fund allocation page shows funds totaling 100%', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)

    await expect(page.getByRole('heading', { name: /Fund Allocation/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/100/).first()).toBeVisible()
  })

  test('gateway settings page renders with provider fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/gateway`)

    await expect(page.getByRole('heading', { name: /Payment Gateway/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/PayMongo|Provider/i).first()).toBeVisible()
  })

  test('financial reports page shows report types', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/reports/financial`)

    await expect(page.getByText(/Financial Reports/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Collection Summary/i)).toBeVisible()
  })
})
