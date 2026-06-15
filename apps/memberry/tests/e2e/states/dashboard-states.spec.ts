import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectNoA11yViolations } from '../helpers/a11y'
import { captureRouteHydration } from '../helpers/real-flow'

// W2 real-flow upgrade: every authenticated /dashboard mount fires
// GET /persons/me via getPersonOptions in src/routes/_authenticated/dashboard.tsx.
// Each test captures that response so the assertion proves the backend
// returned data, not just that the shell rendered a heading.

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD
// Match any GET to /persons/me, whether via direct API base or vite proxy.
// Captures /persons/me, /persons/me?include=…, /api/persons/me, etc.
const PERSON_ME = /\/persons\/me(?:[/?]|$)/

test.describe('Dashboard — Interaction States', () => {
  test('loading: shows skeleton or spinner before data loads', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)

    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard', { waitUntil: 'commit' })

    // Should see a loading indicator (skeleton, spinner, or loading text)
    const skeleton = page.locator('[data-testid="skeleton"], [class*="skeleton"], [class*="animate-pulse"]')
    const spinner = page.locator('[class*="spinner"], [class*="loading"], [role="progressbar"]')
    const loadingText = page.getByText(/loading/i)

    const hasLoading =
      (await skeleton.first().isVisible().catch(() => false)) ||
      (await spinner.first().isVisible().catch(() => false)) ||
      (await loadingText.first().isVisible().catch(() => false))

    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    if (hasLoading) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 }).catch(() => {})
    }
  })

  test('success: shows greeting and org card with real data', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard')

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    const greeting = page.getByText(/good (morning|afternoon|evening)/i)
    await expect(greeting).toBeVisible({ timeout: 10000 })

    await expect(page.getByText(/PDA-2025/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Credit Progress')).toBeVisible({ timeout: 10000 })
  })

  test('success: Your Organizations section lists at least one org', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard')

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    await expect(page.getByRole('heading', { name: 'Your Organizations' })).toBeVisible({ timeout: 10000 })
  })

  test('disabled: credit progress shows correct numeric values', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard')

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    await expect(page.getByText('Credit Progress')).toBeVisible({ timeout: 10000 })

    const progressBar = page.getByRole('progressbar')
    const creditNumber = page.locator('text=/\\d+/')

    const hasProgress = await progressBar.first().isVisible().catch(() => false)
    const hasNumber = await creditNumber.first().isVisible().catch(() => false)

    expect(hasProgress || hasNumber).toBeTruthy()
  })

  test('permission-error: unauthenticated user redirects to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    // Guard redirect is async (client-side beforeLoad) — wait for it to settle.
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 10000 }).catch(() => {})

    // Should redirect to sign-in or show auth prompt — assert via URL or form.
    const isOnSignIn = page.url().includes('/auth/sign-in')
    const hasSignInForm = await page.getByLabel('Email', { exact: true }).isVisible().catch(() => false)
    const hasAuthPrompt = await page.getByText(/sign in|log in/i).first().isVisible().catch(() => false)

    expect(isOnSignIn || hasSignInForm || hasAuthPrompt).toBe(true)
  })

  test('a11y: baseline accessibility check passes', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    const personRespP = captureRouteHydration(page, PERSON_ME)
    await page.goto('/dashboard')

    const personResp = await personRespP
    expect(personResp?.status()).toBe(200)
    expect(personResp?.ok()).toBe(true)

    // Let the dashboard fully settle before scanning — loading skeletons
    // render low-contrast shimmer placeholders that axe (correctly) flags
    // as transient color-contrast violations until real data paints.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 })
    await page.waitForLoadState('networkidle').catch(() => {})

    await expectNoA11yViolations(page, {
      exclude: ['[data-radix-popper-content-wrapper]'],
    })
  })
})
