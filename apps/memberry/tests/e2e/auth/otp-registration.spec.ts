// WF-001 — Self-Registration: name, email, license, password + OTP verification
// BR-25: OTP registration flow
// Tests email verification during signup
import { test, expect } from '../helpers/test-fixture'
import { isMailpitAvailable } from '../helpers/mailpit'
import { captureAnyApiSuccess } from '../helpers/real-flow'
import { signUp } from '../helpers/auth'
import { independentRead } from '../helpers/independent-read'

let mailpitUp = false

test.beforeAll(async () => {
  mailpitUp = await isMailpitAvailable()
})

test.describe('BR-25: OTP Registration', () => {
  test('signup page is accessible', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto('/auth/sign-up')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    // Should show signup form
    await expect(page.getByRole('button', { name: /create|sign up|register/i })).toBeVisible({ timeout: 10000 })
  })

  test('signup requires name, email, and password', async ({ page }) => {
    await page.goto('/auth/sign-up')
    // All required fields should be present
    await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByLabel(/password/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('signup with valid data completes or requests verification', async ({ page }) => {
    test.skip(!mailpitUp, 'Mailpit not running — email verification requires Mailpit')

    const timestamp = Date.now()
    const email = `otp-test-${timestamp}@memberry.ph`

    await page.goto('/auth/sign-up')
    await page.getByLabel('Name', { exact: true }).fill(`OTP Test ${timestamp}`)
    await page.getByLabel('Email', { exact: true }).fill(email)

    const passwordInput = page.getByLabel('Password', { exact: true })
    await passwordInput.click()
    await passwordInput.fill('TestPass123!')

    await page.getByRole('button', { name: /create|sign up|register/i }).click()
    await page.waitForTimeout(5000)

    // Either redirected (no OTP required) or shows verification prompt
    const isRedirected = !page.url().includes('/auth/sign-up')
    const hasVerification = await page.getByText(/verify|code|otp|check your email/i).first().isVisible({ timeout: 3000 }).catch(() => false)

    expect(isRedirected || hasVerification).toBeTruthy()
  })
})

// De-Mailpit core (gap G5): account creation does NOT depend on email. This
// path runs in CI (no Mailpit) and asserts the real goal — a durable account —
// without the email-verification step. Clauses 1 + 4.
test.describe('BR-25: durable account creation (no Mailpit)', () => {
  // Clause 1: catch silent errors on the signup success path. Pre-auth 401
  // session/profile probes on the unauthenticated signup page are expected.
  test.use({
    failOnUnexpected4xx: true,
    failOnConsoleError: true,
    // Pre-auth 401 session probes during signup, + the known role-gated
    // dashboard probe that 403s for a fresh member (see EXEC findings).
    allowApiFailures: [/→ 401/, /GET \/api\/association\/event-lifecycle\/my → 403/],
  })

  test('signup durably creates an account verifiable from an independent session', async ({
    page,
  }) => {
    const { email, password } = await signUp(page)

    // Clause 4: confirm the person row durably exists by reading it back from
    // a SEPARATE auth session, not the browser context that just signed up.
    const me = await independentRead<{ status: number; id?: string }>(
      { email, password },
      async (api) => {
        const res = await api.get<{ id?: string; data?: { id?: string } }>('/persons/me')
        return { status: res.status, id: res.data?.id ?? res.data?.data?.id }
      },
    )
    expect(me.status, 'new account /persons/me readable in a fresh session').toBe(200)
    expect(me.id, 'signup durably created a person row').toBeTruthy()
  })
})
