// M-27: Voluntary organization departure
// Verifies the "Leave" button, confirmation dialog, and termination flow
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
test.describe('M-27: Leave Organization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my/organizations')
  })

  test('Leave button is visible for active memberships', async ({ page }) => {
    // Wait for memberships to load
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    // Leave button should be visible
    const leaveBtn = page.getByRole('button', { name: /leave/i }).first()
    await expect(leaveBtn).toBeVisible()
  })

  test('clicking Leave opens confirmation dialog', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const leaveBtn = page.getByRole('button', { name: /leave/i }).first()
    await leaveBtn.click()

    // Confirmation dialog should appear (heading may include org name)
    await expect(page.getByRole('heading', { name: /leave.*\?/i })).toBeVisible({ timeout: 5000 })
    // Dialog body warns about consequences
    await expect(page.getByText(/lose access/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /leave organization/i })).toBeVisible()
  })

  test('confirmation dialog has Leave Organization and Cancel buttons', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const leaveBtn = page.getByRole('button', { name: /leave/i }).first()
    await leaveBtn.click()

    // Dialog buttons
    await expect(page.getByRole('button', { name: /leave organization/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('Cancel dismisses dialog without leaving', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const leaveBtn = page.getByRole('button', { name: /leave/i }).first()
    await leaveBtn.click()

    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close, membership still shows
    await expect(page.getByText('Active').first()).toBeVisible()
  })

  // Note: We don't test actual leave confirmation to avoid destroying test data
  // The API call (POST /memberships/:id/terminate) is tested in contract tests
})
