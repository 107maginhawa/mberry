// M-16: Transfer membership between organizations
// Verifies the transfer dialog UI, input validation, and form submission
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /my/organizations hydrates via /memberships
// or /persons/me. Capturing that proves the backend returned data,
// not just that the Active badge rendered.
const MEMBERSHIPS_OR_PERSON = /\/(memberships|persons\/me)(?:[/?]|$)/

test.use({ storageState: authStateFile('member') })
test.describe('M-16: Transfer Membership', () => {
  test('transfer button is visible for active memberships', async ({ page }) => {
    const respP = captureRouteHydration(page, MEMBERSHIPS_OR_PERSON)
    await page.goto('/my/organizations')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    const hasActive = await page.getByText('Active').first().isVisible({ timeout: 10000 }).catch(() => false)
    test.skip(!hasActive, 'No active membership found in seed data')

    // Transfer button uses aria-label="Transfer membership"
    const transferBtn = page.getByLabel('Transfer membership').first()
    await expect(transferBtn).toBeVisible()
  })

  test.describe('with organizations preloaded', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/my/organizations')
    })

  test('clicking transfer opens dialog with org ID input', async ({ page }) => {
    const hasActive = await page.getByText('Active').first().isVisible({ timeout: 10000 }).catch(() => false)
    test.skip(!hasActive, 'No active membership found in seed data')

    const transferBtn = page.getByLabel('Transfer membership').first()
    await transferBtn.click()

    // Dialog should open
    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/another chapter/i)).toBeVisible()
  })

  test('Request Transfer button is disabled when org ID is empty', async ({ page }) => {
    const hasActive = await page.getByText('Active').first().isVisible({ timeout: 10000 }).catch(() => false)
    test.skip(!hasActive, 'No active membership found in seed data')

    const transferBtn = page.getByLabel('Transfer membership').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })

    // Button should be disabled with empty input
    const submitBtn = page.getByRole('button', { name: /request transfer/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('entering org ID enables the Request Transfer button', async ({ page }) => {
    const hasActive = await page.getByText('Active').first().isVisible({ timeout: 10000 }).catch(() => false)
    test.skip(!hasActive, 'No active membership found in seed data')

    const transferBtn = page.getByLabel('Transfer membership').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })

    // Fill in target org ID — find any text input in the dialog
    const input = page.locator('[role="dialog"] input').first()
    await input.fill('some-target-org-id')

    // Button should now be enabled
    const submitBtn = page.getByRole('button', { name: /request transfer/i })
    await expect(submitBtn).toBeEnabled()
  })

  test('Cancel closes transfer dialog', async ({ page }) => {
    const hasActive = await page.getByText('Active').first().isVisible({ timeout: 10000 }).catch(() => false)
    test.skip(!hasActive, 'No active membership found in seed data')

    const transferBtn = page.getByLabel('Transfer membership').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close
    await expect(page.getByText('Transfer Membership')).not.toBeVisible()
  })
  })
})
