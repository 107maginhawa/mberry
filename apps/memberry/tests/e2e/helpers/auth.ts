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
 */
export async function signUp(page: Page) {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const email = `test-${timestamp}-${random}@example.com`
  const password = TEST_PASSWORD
  const name = `Test User ${timestamp}`

  await page.goto('/auth/sign-up')
  await page.waitForLoadState('networkidle')

  const submit = page.getByRole('button', { name: /create an account|sign up|register/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)

  const passwordInput = page.getByLabel('Password', { exact: true })
  await passwordInput.click()
  await passwordInput.pressSequentially(password, { delay: 10 })

  // Capture the signup API response
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

  // Wait for session to settle
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle')

  // Create person record (sign-up only creates auth user, not person)
  const [firstName, ...lastParts] = name.split(' ')
  const lastName = lastParts.join(' ') || null
  await page.evaluate(async ({ firstName, lastName, email, apiBase }) => {
    await fetch(`${apiBase}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        firstName,
        lastName,
        contactInfo: { email },
      }),
    })
  }, { firstName, lastName, email, apiBase: API_BASE })

  await page.waitForTimeout(1000)

  return { email, password, name }
}

/**
 * Sign in an existing user via the UI.
 */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/auth/sign-in')
  await page.waitForLoadState('networkidle')

  const submit = page.getByRole('button', { name: /login|sign in/i })
  await expect(submit).toBeVisible({ timeout: 10000 })

  await page.getByLabel('Email', { exact: true }).fill(email)

  const passwordInput = page.getByLabel('Password', { exact: true })
  await passwordInput.click()
  await passwordInput.pressSequentially(password, { delay: 10 })

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

  // Wait for session + redirect
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle')
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
