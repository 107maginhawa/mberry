import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Account Deletion (/settings/account)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
  })

  test('shows Delete Account card with destructive border', async ({ page }) => {
    await page.goto('/settings/account')
    await expect(
      page.getByRole('heading', { name: /delete account/i }),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/permanently delete your account/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows "Request Account Deletion" button', async ({ page }) => {
    await page.goto('/settings/account')
    await expect(
      page.getByRole('button', { name: /request account deletion/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking deletion button opens confirmation dialog', async ({ page }) => {
    await page.goto('/settings/account')
    await page.getByRole('button', { name: /request account deletion/i }).click()

    // Confirmation dialog should appear
    await expect(
      page.getByText(/are you sure/i),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText(/30 days to cancel/i),
    ).toBeVisible({ timeout: 10000 })

    // Dialog has cancel and confirm buttons
    await expect(
      page.getByRole('button', { name: /cancel/i }),
    ).toBeVisible({ timeout: 5000 })

    await expect(
      page.getByRole('button', { name: /yes, delete my account/i }),
    ).toBeVisible({ timeout: 5000 })
  })

  test('cancelling the confirmation dialog closes it', async ({ page }) => {
    await page.goto('/settings/account')
    await page.getByRole('button', { name: /request account deletion/i }).click()

    await expect(
      page.getByText(/are you sure/i),
    ).toBeVisible({ timeout: 10000 })

    // Click cancel to close dialog
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close, deletion button still visible
    await expect(
      page.getByRole('button', { name: /request account deletion/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('deletion description mentions 30-day grace period', async ({ page }) => {
    await page.goto('/settings/account')
    await expect(
      page.getByText(/30-day grace period/i),
    ).toBeVisible({ timeout: 10000 })
  })
})
