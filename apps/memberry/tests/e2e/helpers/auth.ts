import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  API_BASE,
  TEST_PASSWORD,
  SEED_OFFICER_EMAIL,
  SEED_MEMBER_EMAIL,
  SEED_TREASURER_EMAIL,
  SEED_SECRETARY_EMAIL,
  SEED_SOCIETY_EMAIL,
} from './test-config'

/**
 * Sign up a new user via the UI.
 * Returns { email, password, name }.
 *
 * NOTE: sign-up auto-creates the person row via the Better-Auth
 * `user.create.after` hook (services/api-ts/src/core/auth.ts:194).
 * Earlier versions of this helper did an extra POST /persons here, which
 * (a) duplicated the auto-create and (b) silently failed under the new
 * CSRF middleware. Removed in the E2E timeout RCA pass (P1.3e-fix2).
 */
export async function signUp(page: Page) {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const email = `test-${timestamp}-${random}@example.com`
  const password = TEST_PASSWORD
  const name = `Test User ${timestamp}`

  await page.goto('/auth/sign-up')

  const submit = page.getByRole('button', { name: /create an account|sign up|register/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)

  const signupResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/sign-up') && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null)

  await submit.click()

  const response = await signupResponse
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Sign-up failed ${response.status()}: ${body.slice(0, 500)}`)
  }

  // Wait for navigation away from /auth/sign-up — Better-Auth sets the session
  // cookie in the sign-up response, so the next render redirects the user
  // either into onboarding, the dashboard, or an org home.
  // Accept any post-auth landing: dashboard, onboarding, my/*, org/*, OR
  // /auth/verify-email (Better-Auth's gate when requireEmailVerification is on).
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/auth/verify-email'),
    { timeout: 10000 },
  )

  return { email, password, name }
}

/**
 * Sign up a fresh user for onboarding testing.
 * Creates auth user WITHOUT person profile, then verifies email via admin API.
 * The resulting user can access /onboarding (passes requireNoPerson + requireEmailVerified).
 */
export async function signUpForOnboarding(page: Page) {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const email = `test-onboard-${timestamp}-${random}@example.com`
  const password = TEST_PASSWORD
  const name = `Onboard User ${timestamp}`

  // Step 1: Sign up (creates auth user, no person)
  await page.goto('/auth/sign-up')

  const submit = page.getByRole('button', { name: /create an account|sign up|register/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)

  const signupResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/sign-up') && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null)

  await submit.click()
  const response = await signupResponse
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Sign-up failed ${response.status()}: ${body.slice(0, 500)}`)
  }

  // Accept any post-auth landing: dashboard, onboarding, my/*, org/*, OR
  // /auth/verify-email (Better-Auth's gate when requireEmailVerification is on).
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/auth/verify-email'),
    { timeout: 10000 },
  )

  // Step 2: Sign in as officer (has admin role) to verify email via admin API
  // Officer uses admin list-users to find the new user, then sets emailVerified
  await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)

  const verifyResult = await page.evaluate(async ({ apiBase, targetEmail }) => {
    // Find user by email via admin API
    const listRes = await fetch(
      `${apiBase}/auth/admin/list-users?searchValue=${encodeURIComponent(targetEmail)}&searchField=email`,
      { credentials: 'include' },
    )
    if (!listRes.ok) return { ok: false, error: `list-users: ${listRes.status}` }
    const listData = await listRes.json()
    const users = listData?.users ?? listData?.data ?? listData
    const targetUser = Array.isArray(users)
      ? users.find((u: any) => u.email === targetEmail)
      : null
    if (!targetUser) return { ok: false, error: 'user not found in admin list' }

    // Set emailVerified via admin API
    const setRes = await fetch(`${apiBase}/auth/admin/update-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: targetUser.id, data: { emailVerified: true } }),
    })
    return { ok: setRes.ok, error: setRes.ok ? null : `set-user: ${setRes.status}` }
  }, { apiBase: API_BASE, targetEmail: email })

  if (!verifyResult.ok) {
    throw new Error(`Failed to verify email: ${verifyResult.error}`)
  }

  // Step 3: Sign back in as onboarding user
  await signIn(page, email, password)

  return { email, password, name }
}

/**
 * Sign in an existing user via the UI.
 *
 * Replaces the prior `waitForTimeout(2000) + waitForLoadState('networkidle')`
 * trailing pair (~3-5s per call across 166 invocations) with an explicit
 * "we left the auth surface" URL wait. See E2E_TIMEOUT_ROOT_CAUSE.md §1.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in')

  const submit = page.getByRole('button', { name: /login|sign in/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)

  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/sign-in') && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null)

  await submit.click()

  const response = await loginResponse
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Sign-in failed ${response.status()}: ${body.slice(0, 500)}`)
  }

  // Wait for the redirect after the session cookie lands. Better-Auth's
  // sign-in handler returns 200 with Set-Cookie and the SPA navigates next
  // render — usually < 200ms in dev, < 500ms in CI.
  // Accept any post-auth landing: dashboard, onboarding, my/*, org/*, OR
  // /auth/verify-email (Better-Auth's gate when requireEmailVerification is on).
  await page.waitForURL(
    (url) =>
      !url.pathname.startsWith('/auth/') ||
      url.pathname.startsWith('/auth/verify-email'),
    { timeout: 10000 },
  )
}

/**
 * Sign in as the seeded officer (president/chapter officer).
 */
export async function signInAsOfficer(page: Page) {
  await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
}

/**
 * Sign in as the seeded regular member.
 */
export async function signInAsMember(page: Page) {
  await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
}

/**
 * Sign in as the seeded treasurer.
 */
export async function signInAsTreasurer(page: Page) {
  await signIn(page, SEED_TREASURER_EMAIL, TEST_PASSWORD)
}

/**
 * Sign in as the seeded secretary.
 */
export async function signInAsSecretary(page: Page) {
  await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
}

/**
 * Sign in as the seeded society-level officer.
 */
export async function signInAsSociety(page: Page) {
  await signIn(page, SEED_SOCIETY_EMAIL, TEST_PASSWORD)
}

/**
 * Sign in as the seeded platform super-admin.
 *
 * Note: the seeded "President" (test@memberry.ph) is granted the
 * platform_admin (role: 'super') row in layer-2-users.ts and a multi-role
 * user.role string of 'admin,platform_admin,association:admin,…'. So the
 * same auth user serves both /admin/* (platform) and association-officer
 * paths. Kept as a separate helper so callers can express intent.
 */
export async function signInAsAdmin(page: Page) {
  await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
}
