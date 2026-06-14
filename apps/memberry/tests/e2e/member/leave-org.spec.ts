// M-27: Voluntary organization departure
// Verifies the "Leave" button, confirmation dialog, and termination flow
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /my/organizations hydrates via GET /memberships
// (or /persons/me on the auth shell). Capturing that proves the
// backend returned data, not just that the Active badge rendered.
const MEMBERSHIPS_OR_PERSON = /\/(memberships|persons\/me)(?:[/?]|$)/

test.use({ authRole: 'member' })
test.describe('M-27: Leave Organization', () => {
  test('Leave button is visible for active memberships', async ({ page }) => {
    const respP = captureRouteHydration(page, MEMBERSHIPS_OR_PERSON)
    await page.goto('/my/organizations')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    // Wait for memberships to load
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })

    // Leave button should be visible
    const leaveBtn = page.getByRole('button', { name: /leave/i }).first()
    await expect(leaveBtn).toBeVisible()
  })

  test.describe('with organizations preloaded', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/my/organizations')
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
})
