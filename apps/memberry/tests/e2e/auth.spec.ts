import { test, expect } from '@playwright/test'

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
    await page.waitForLoadState('networkidle')

    // Form should be visible
    const nameInput = page.getByLabel('Name', { exact: true })
    const emailInput = page.getByLabel('Email', { exact: true })
    const passwordInput = page.getByLabel('Password', { exact: true })

    await expect(nameInput).toBeVisible()
    await nameInput.fill('Test Signup User')
    await emailInput.fill(email)
    await passwordInput.click()
    await passwordInput.pressSequentially('TestPass123!', { delay: 10 })

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
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Name', { exact: true }).fill('First User')
    await page.getByLabel('Email', { exact: true }).fill(email)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.pressSequentially('TestPass123!', { delay: 10 })
    await page.getByRole('button', { name: /create an account/i }).click()
    await page.waitForTimeout(3000)

    // Clear cookies and try same email
    await page.context().clearCookies()
    await page.goto('/auth/sign-up')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Name', { exact: true }).fill('Second User')
    await page.getByLabel('Email', { exact: true }).fill(email)
    const pw2 = page.getByLabel('Password', { exact: true })
    await pw2.click()
    await pw2.pressSequentially('TestPass123!', { delay: 10 })
    await page.getByRole('button', { name: /create an account/i }).click()

    // Should show an error — user already exists
    await page.waitForTimeout(3000)
    // Should still be on sign-up page (not redirected)
    expect(page.url()).toContain('/auth/sign-up')
  })
})

test.describe('Sign-in flow', () => {
  let testEmail: string
  const testPassword = 'TestPass123!'

  test.beforeAll(async ({ browser }) => {
    // Create a user to sign in with
    testEmail = `signin-${Date.now()}@test.com`
    const page = await browser.newPage()
    await page.goto('/auth/sign-up')
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Name', { exact: true }).fill('Sign In Test')
    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.pressSequentially(testPassword, { delay: 10 })
    await page.getByRole('button', { name: /create an account/i }).click()
    await page.waitForTimeout(3000)
    await page.close()
  })

  test('A2: sign in with valid creds → dashboard with sidebar', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.pressSequentially(testPassword, { delay: 10 })

    const submit = page.getByRole('button', { name: /login|sign in/i })
    await submit.click()

    // Should leave sign-in page
    await page.waitForURL((url) => !url.pathname.includes('/auth/'), { timeout: 15000 })

    // Sidebar should be visible with nav links
    await expect(page.getByText('Memberry')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible()

    // User email should appear in sidebar
    await expect(page.getByText(testEmail)).toBeVisible()
  })

  test('A2: sign in with wrong password → error message', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email', { exact: true }).fill(testEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.pressSequentially('WrongPassword99!', { delay: 10 })

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
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Should be redirected to sign-in
    expect(page.url()).toContain('/auth/sign-in')
  })
})

test.describe('Auth guard', () => {
  test('A2: public route /org/pda-metro-manila works without auth', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/org/pda-metro-manila')
    await page.waitForLoadState('networkidle')

    // Should show org profile, NOT redirect to sign-in
    await expect(page.getByText('PDA Metro Manila Chapter')).toBeVisible()
    expect(page.url()).not.toContain('/auth/')
  })

  test('A2: root / redirects unauthenticated to sign-in', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('/auth/sign-in')
  })
})
