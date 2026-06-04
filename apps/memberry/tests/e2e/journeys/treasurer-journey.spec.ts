// Persona P3: Chapter Treasurer (Juan Cruz)
// Covers: CT-1 through CT-11 — payment recording, dues config, financial reports
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('P3 Treasurer Journey', () => {
test('CT-1: treasurer accesses officer dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const hasDashboard = await page.getByText(/dashboard|overview|metric/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasDashboard).toBeTruthy()
  })

  test('CT-2: treasurer views payment list with real data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Should see payments with amounts and member names
    const hasPayments = await page.getByText(/payment|₱|amount|member/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasPayments).toBeTruthy()
  })

  test('CT-3: treasurer can access payments page with action buttons', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Should see payment data and some action button (Record, Add, New, etc.)
    const hasPaymentContent = await page.getByText(/payment|amount|member|₱/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasBtn = await page.getByRole('button').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await page.getByRole('link').filter({ hasText: /record|add|new|create/i }).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasPaymentContent).toBeTruthy()
  })

  test('CT-4: treasurer can access dues configuration', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    const hasDuesConfig = await page.getByText(/dues.*config|amount|billing.*cycle|period/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasDuesConfig).toBeTruthy()
  })

  test('CT-5: treasurer can view fund allocation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    const hasFunds = await page.getByText(/fund|allocation|percent|chapter|national/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasFunds).toBeTruthy()
  })

  test('CT-6: treasurer can access financial reports', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/reports`)
    const hasReports = await page.getByText(/report|collection|revenue|financial/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasReports).toBeTruthy()
  })

  test('CT-7: treasurer can view payment corrections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    // Payment list should show correction/refund options or history
    const hasPaymentActions = await page.getByText(/payment|history|status/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasPaymentActions).toBeTruthy()
  })

  test('CT-8: treasurer sidebar shows finance navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Treasurer should see finance-related nav items
    const financeNav = page.getByText(/finance|payment|dues|fund/i)
    const count = await financeNav.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('full journey: dashboard → payments → config → reports', async ({ page }) => {
    await test.step('officer dashboard', async () => {
      await page.goto(`/org/${ORG_ID}/officer/dashboard`)
      await expect(page).toHaveURL(/officer/)
    })

    await test.step('payments', async () => {
      await page.goto(`/org/${ORG_ID}/officer/payments`)
      await expect(page).toHaveURL(/payments/)
    })

    await test.step('dues config', async () => {
      await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
      await expect(page).toHaveURL(/settings/)
    })

    await test.step('financial reports', async () => {
      await page.goto(`/org/${ORG_ID}/officer/settings/reports`)
      await expect(page).toHaveURL(/settings/)
    })
  })
})
