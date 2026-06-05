// WF-014 — Data Export: GDPR-style personal data export
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Data Export (/settings/account)', () => {
test('shows "Export My Data" card', async ({ page }) => {
    await page.goto('/settings/account')
    await expect(
      page.getByRole('heading', { name: /export my data/i }),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/download all your personal data/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows "Download My Data" button', async ({ page }) => {
    await page.goto('/settings/account')
    await expect(
      page.getByRole('button', { name: /download my data/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking export triggers download and shows success toast', async ({ page }) => {
    await page.goto('/settings/account')
    // Listen for download event
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null)

    await page.getByRole('button', { name: /download my data/i }).click()

    // Button may show "Preparing..." while fetching
    const preparing = await page.getByRole('button', { name: /preparing/i }).isVisible({ timeout: 3000 }).catch(() => false)
    // It's OK if the fetch is fast and we don't see the preparing state

    // Wait for either download or toast
    const download = await downloadPromise
    const hasToast = await page.getByText(/data export downloaded/i).isVisible({ timeout: 10000 }).catch(() => false)

    // Either download started or success toast appeared
    expect(download !== null || hasToast).toBeTruthy()

    // If download occurred, verify filename pattern
    if (download) {
      expect(download.suggestedFilename()).toMatch(/my-data-\d{4}-\d{2}-\d{2}\.json/)
    }
  })

  test('export description mentions data categories', async ({ page }) => {
    await page.goto('/settings/account')
    // Description should mention the types of data included
    await expect(
      page.getByText(/profile|memberships|payments|training|certificates|events/i),
    ).toBeVisible({ timeout: 10000 })
  })
})
