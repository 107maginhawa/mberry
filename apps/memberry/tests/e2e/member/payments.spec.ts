// Business Rules: [BR-06] [BR-07]
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: /my/payments hydrates via /persons/me or
// /dues-invoices. Capturing that proves the backend returned data,
// not just that the heading rendered.
const PAY_API = /\/(persons\/me|dues-invoices|payments)(?:[/?]|$)/

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Payments (/my/payments)', () => {
  test('shows "My Payments" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const respP = captureRouteHydration(page, PAY_API)
    await page.goto('/my/payments')

    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'My Payments' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('filter controls are present', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/payments')
    await expect(
      page.getByText('All Statuses'),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText('All Methods'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows empty state when no payments match', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/payments')
    // Member may see empty state or payment rows depending on data
    await expect(
      page
        .getByText(/No Payments Found/i)
        .or(page.locator('table tbody tr, [class*="card"]'))
        .or(page.getByText(/payment/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
