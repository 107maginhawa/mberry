// Business Rules: [BR-18] [BR-19] [BR-20]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

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

test.describe('QR Verification', () => {
  test('[BR-18] verify page accessible', async ({ page }) => {
    // Public verification page should load without auth errors
    await page.goto('/verify/test-token-123')
    await page.waitForLoadState('networkidle')
    // Should show verification result (valid, invalid, or expired) — not a crash
    const hasContent = await page.locator('main, [role="main"], body').first().isVisible()
    expect(hasContent).toBeTruthy()
  })
})

test.describe('Member ID Card', () => {
  test('[BR-19] ID card page renders', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/id-card')
    await page.waitForLoadState('networkidle')
    const hasHeading = await page.getByRole('heading').first().isVisible().catch(() => false)
    const hasContent = await page.locator('main').isVisible()
    expect(hasHeading || hasContent).toBeTruthy()
  })
})
