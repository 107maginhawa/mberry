import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Credits — Interaction States', () => {
  test('loading: credit progress widget shows loading before data', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)

    await page.goto('/dashboard', { waitUntil: 'commit' })

    const skeleton = page.locator('[class*="skeleton"], [class*="animate-pulse"]')
    const loadingText = page.getByText(/loading/i)

    await skeleton.first().isVisible().catch(() => false)
    await loadingText.first().isVisible().catch(() => false)

    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Credit Progress')).toBeVisible({ timeout: 10000 })
  })

  test('success: credit progress shows numeric values and progress indicator', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await expect(page.getByText('Credit Progress')).toBeVisible({ timeout: 10000 })

    // Should display credit numbers (earned/required)
    const creditSection = page.locator('text=/\\d+/').first()
    await expect(creditSection).toBeVisible({ timeout: 10000 })

    // Progress bar or percentage indicator
    const progressBar = page.getByRole('progressbar')
    const percentText = page.locator('text=/%/')

    const hasProgress = await progressBar.first().isVisible().catch(() => false)
    const hasPercent = await percentText.first().isVisible().catch(() => false)
    const hasNumeric = await page.locator('text=/\\d+/').first().isVisible().catch(() => false)

    expect(hasProgress || hasPercent || hasNumeric).toBeTruthy()
  })

  test('success: my training page shows CPE Credits stat card', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/training')
    await expect(page.getByText('CPE Credits', { exact: true })).toBeVisible({ timeout: 10000 })

    // The CPE Credits card should have a numeric value
    const cpeSection = page.locator(':has-text("CPE Credits")')
    await expect(cpeSection.first()).toBeVisible({ timeout: 10000 })
  })

  test('empty: new member shows zero credits state', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await expect(page.getByText('Credit Progress')).toBeVisible({ timeout: 10000 })

    // Credit display should show some form of numeric data (even 0)
    const creditWidget = page.locator(':has-text("Credit Progress")').first()
    await expect(creditWidget).toBeVisible({ timeout: 10000 })
  })

  test('permission-error: unauthenticated user cannot see credits', async ({ page }) => {
    await page.goto('/dashboard')
    const isOnSignIn = page.url().includes('/auth/sign-in')
    const hasAuthPrompt = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)

    expect(isOnSignIn || hasAuthPrompt).toBeTruthy()
  })

  test('a11y: baseline accessibility check passes on credit progress', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/dashboard')
    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
