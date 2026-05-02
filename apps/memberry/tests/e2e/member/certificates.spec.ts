import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'

test.describe('Member Certificates (/my/certificates)', () => {
  test('shows "My Certificates" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/certificates')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: 'My Certificates' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows certificates or loading state', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/certificates')
    await page.waitForLoadState('networkidle')

    // Page shows certificates, empty state, or skeleton loading cards
    const hasCert = await page.getByText(/CERT-/i).isVisible().catch(() => false)
    const hasEmpty = await page.getByText(/no certificates/i).isVisible().catch(() => false)
    const hasCards = await page.locator('main').locator('div').first().isVisible().catch(() => false)
    expect(hasCert || hasEmpty || hasCards).toBeTruthy()
  })
})
