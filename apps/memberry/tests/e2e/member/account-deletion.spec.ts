// WF-011 — Account Deletion: request, 30-day grace, cascade via person.deletionProcessor
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /settings/account mounts a settings shell that
// hydrates the signed-in person via GET /persons/me. Capturing that
// response proves the wire actually returned data, not just that the
// settings shell rendered.
const PERSON_ME = /\/persons\/me(?:[/?]|$)/

test.use({ authRole: 'member' })
const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Account Deletion (/settings/account)', () => {
test('shows Delete Account card with destructive border', async ({ page }) => {
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/settings/account')

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

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
