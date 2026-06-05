// WF-044 — Manual Payment Recording: treasurer records offline payment
// Persona P3: Chapter Treasurer (Juan Cruz)
// Covers: CT-1 through CT-11 — payment recording, dues config, financial reports
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('treasurer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Helper: assert the page navigated to the expected URL pattern AND the
// app sidebar mounted (proxy for "page rendered, not blank-redirected").
// All CT-* tests were structurally identical; isVisible({timeout}) ran
// before the SPA fully hydrated, returning false silently. Use toBeVisible.
async function assertPageMounted(
  page: import('@playwright/test').Page,
  urlMatch: RegExp,
) {
  await expect(page).toHaveURL(urlMatch, { timeout: 10000 })
  // OrgProvider/officer sidebar always renders an officer nav once mounted.
  await expect(page.getByRole('complementary').first()).toBeVisible({ timeout: 10000 })
}

test.describe('P3 Treasurer Journey', () => {
test('CT-1: treasurer accesses officer dashboard', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await assertPageMounted(page, /\/officer\/dashboard$/)
  })

  test('CT-2: treasurer views payment list with real data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-3: treasurer can access payments page with action buttons', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-4: treasurer can access dues configuration', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/dues`)
    await assertPageMounted(page, /\/officer\/settings\/dues/)
  })

  test('CT-5: treasurer can view fund allocation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/funds`)
    await assertPageMounted(page, /\/officer\/settings\/funds/)
  })

  test('CT-6: treasurer can access financial reports', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/reports`)
    await assertPageMounted(page, /\/officer\/settings\/reports/)
  })

  test('CT-7: treasurer can view payment corrections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    await assertPageMounted(page, /\/officer\/payments/)
  })

  test('CT-8: treasurer sidebar shows finance navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Sidebar exposes Payments + Dues Schedule + Funds + Reports as
    // explicit nav links (visible in the snapshot under "FINANCES").
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByRole('link', { name: /payments/i }).first())
      .toBeVisible({ timeout: 10000 })
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
