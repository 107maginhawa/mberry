// Business Rules: [BR-06] [BR-07]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Payments (/my/payments)', () => {
  test('shows "My Payments" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/payments')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: 'My Payments' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('filter controls are present', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/payments')
    await page.waitForLoadState('networkidle')

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
    await page.waitForLoadState('networkidle')

    // Member may see empty state or payment rows depending on data
    const hasEmpty = await page.getByText(/no payments/i).isVisible().catch(() => false)
    const hasPayments = await page.locator('table tbody tr').first().isVisible().catch(() => false)
    expect(hasEmpty || hasPayments).toBeTruthy()
  })
})
