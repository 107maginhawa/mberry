// M-16: Transfer membership between organizations
// Verifies the transfer dialog UI, input validation, and form submission
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

test.describe('M-16: Transfer Membership', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
    await page.goto('/my/organizations')
    await page.waitForLoadState('networkidle')
  })

  test('transfer button is visible for active memberships', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    // Transfer button has ArrowRightLeft icon with title "Transfer membership"
    const transferBtn = page.locator('button[title="Transfer membership"]').first()
    await expect(transferBtn).toBeVisible()
  })

  test('clicking transfer opens dialog with org ID input', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const transferBtn = page.locator('button[title="Transfer membership"]').first()
    await transferBtn.click()

    // Dialog should open
    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/another chapter/i)).toBeVisible()
    await expect(page.getByPlaceholder(/target org/i)).toBeVisible()
  })

  test('Request Transfer button is disabled when org ID is empty', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const transferBtn = page.locator('button[title="Transfer membership"]').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })

    // Button should be disabled with empty input
    const submitBtn = page.getByRole('button', { name: /request transfer/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('entering org ID enables the Request Transfer button', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const transferBtn = page.locator('button[title="Transfer membership"]').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })

    // Fill in target org ID
    await page.getByPlaceholder(/target org/i).fill('some-target-org-id')

    // Button should now be enabled
    const submitBtn = page.getByRole('button', { name: /request transfer/i })
    await expect(submitBtn).toBeEnabled()
  })

  test('Cancel closes transfer dialog', async ({ page }) => {
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    const transferBtn = page.locator('button[title="Transfer membership"]').first()
    await transferBtn.click()

    await expect(page.getByText('Transfer Membership')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: /cancel/i }).click()

    // Dialog should close
    await expect(page.getByText('Transfer Membership')).not.toBeVisible()
  })
})
