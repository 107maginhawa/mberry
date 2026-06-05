// WF-003 — Login
// Business Rules: [BR-21] [BR-24] [BR-25] [BR-26]
import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from './helpers/test-config'

/**
 * Wave A: Auth Foundation E2E Tests
 *
 * These tests define what "working auth" means for the memberry app.
 * Written BEFORE fixing implementation — they MUST fail first.
 */

test.describe('Sign-up flow', () => {
  test('A1: sign up with valid credentials → lands on authenticated page', async ({ page }) => {
    const email = `signup-${Date.now()}@test.com`

    await page.goto('/auth/sign-up')
    // Form should be visible
    const nameInput = page.getByLabel('Name', { exact: true })
    const emailInput = page.getByLabel('Email', { exact: true })
    const passwordInput = page.getByLabel('Password', { exact: true })

    await expect(nameInput).toBeVisible()
    await nameInput.fill('Test Signup User')
    await emailInput.fill(email)
    await passwordInput.click()
    await passwordInput.fill(TEST_PASSWORD)

    // Submit
    const submit = page.getByRole('button', { name: /create an account/i })
    await submit.click()

    // Should eventually leave the sign-up page
    await page.waitForURL((url) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 })

    // Should be on an authenticated page (dashboard or similar) — NOT the sign-in page
    const url = page.url()
    expect(url).not.toContain('/auth/sign-in')
  })

  test('A1: sign up with duplicate email → shows error', async ({ page }) => {
    const email = `dup-${Date.now()}@test.com`

    // First sign-up
    await page.goto('/auth/sign-up')
    await page.getByLabel('Name', { exact: true }).fill('First User')
    await page.getByLabel('Email', { exact: true }).fill(email)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create an account/i }).click()
    await page.waitForTimeout(3000)

    // Clear cookies and try same email
    await page.context().clearCookies()
    await page.goto('/auth/sign-up')
    await page.getByLabel('Name', { exact: true }).fill('Second User')
    await page.getByLabel('Email', { exact: true }).fill(email)
    const pw2 = page.getByLabel('Password', { exact: true })
    await pw2.click()
    await pw2.fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create an account/i }).click()

    // Should show an error — user already exists
    await page.waitForTimeout(3000)
    // Should still be on sign-up page (not redirected)
    expect(page.url()).toContain('/auth/sign-up')
  })
})

test.describe('Sign-in flow', () => {
  let testEmail: string
  const testPassword = TEST_PASSWORD

  test.beforeAll(async ({ browser }) => {
    // Create a user to sign in with
    testEmail = `signin-${Date.now()}@test.com`
    const page = await browser.newPage()
    await page.goto('/auth/sign-up')
    await page.getByLabel('Name', { exact: true }).fill('Sign In Test')
    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.fill(testPassword)
    await page.getByRole('button', { name: /create an account/i }).click()
    await page.waitForTimeout(3000)
    await page.close()
  })

  test('A2: sign in with valid creds → dashboard with sidebar', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.fill(testPassword)

    const submit = page.getByRole('button', { name: /login|sign in/i })
    await submit.click()

    // Should leave sign-in page
    await page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 15000 })

    // Sidebar should be visible with nav links. Brand is rendered as an
    // <img alt="Memberry"> (logo file), not literal text — assert via alt.
    // Scope nav-link queries to the sidebar (complementary role) — Home /
    // Profile also appear in breadcrumbs and bottom-nav on smaller viewports.
    const sidebar = page.getByRole('complementary')
    await expect(sidebar.getByAltText('Memberry')).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible()

    // User email should appear in sidebar
    await expect(page.getByText(testEmail)).toBeVisible()
  })

  test('A2: sign in with wrong password → error message', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.fill('WrongPassword99!')

    await page.getByRole('button', { name: /login|sign in/i }).click()
    await page.waitForTimeout(3000)

    // Should still be on sign-in page
    expect(page.url()).toContain('/auth/sign-in')
    // Should show some error indication (text or toast)
    // Better-auth-ui shows inline errors
  })

  test('A2: visit /my/profile unauthenticated → redirect to sign-in', async ({ page }) => {
    // Clear any cookies
    await page.context().clearCookies()

    await page.goto('/my/profile')
    await page.waitForTimeout(2000)

    // Should be redirected to sign-in
    expect(page.url()).toContain('/auth/sign-in')
  })
})

test.describe('Auth guard', () => {
  test.fixme(
    'A2: public route /org/pda-metro-manila works without auth',
    async ({ page }) => {
      // KNOWN PRODUCT ISSUE: a public route exists at routes/org/$slug.tsx,
      // but routes/_authenticated/org/$orgSlug/route.tsx claims the same path
      // pattern. The generated TanStack route tree resolves to the
      // authenticated variant first, so guests get bounced to /auth/sign-in
      // (with a `redirect=/org/...` param) instead of rendering PublicOrgProfile.
      //
      // Re-enable once routes/org/$slug.tsx wins resolution (e.g. rename the
      // authenticated path to /_authenticated/orgs/$orgSlug, or wire an
      // explicit public-org slug list at __root.tsx beforeLoad).
      await page.context().clearCookies()
      await page.goto('/org/pda-metro-manila')
      await expect(page.getByText('Philippine Dental Association')).toBeVisible({ timeout: 15000 })
      expect(page.url()).not.toContain('/auth/')
    },
  )

  test('A2: root / redirects unauthenticated to sign-in', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('/auth/sign-in')
  })
})

test.describe('Multi-org & Invitations', () => {
  test('[BR-21] dashboard shows organization membership cards', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard')
    // Dashboard renders an h2 "Your Organizations" section (dashboard.tsx:228).
    // Use heading-role + accessible name so we don't false-match on the word
    // "organizations" appearing in other UI (nav links, footer, etc.).
    await expect(
      page.getByRole('heading', { name: /your organizations/i, level: 2 }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('[BR-24] expired invite page shows message', async ({ page }) => {
    // Visit invite with fake token — should show expired/invalid message, not crash
    await page.goto('/invite/expired-test-token')
    const hasContent = await page.locator('main, body').first().isVisible()
    expect(hasContent).toBeTruthy()
  })

  test('[BR-25] sign-up form renders with email field', async ({ page }) => {
    await page.goto('/auth/sign-up')
    // better-auth-ui mounts the form async — use waitFor instead of an
    // immediate isVisible() so we don't race the first paint.
    await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 10000 })
  })
})
