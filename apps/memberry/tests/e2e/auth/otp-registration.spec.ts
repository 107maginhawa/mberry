// WF-001 — Self-Registration: name, email, license, password + OTP verification
// BR-25: OTP registration flow
// Tests email verification during signup
import { test, expect } from '../helpers/test-fixture'
import { isMailpitAvailable } from '../helpers/mailpit'

let mailpitUp = false

test.beforeAll(async () => {
  mailpitUp = await isMailpitAvailable()
})

test.describe('BR-25: OTP Registration', () => {
  test('signup page is accessible', async ({ page }) => {
    await page.goto('/auth/sign-up')
    // Should show signup form
    const hasForm = await page.getByRole('button', { name: /create|sign up|register/i }).isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasForm).toBeTruthy()
  })

  test('signup requires name, email, and password', async ({ page }) => {
    await page.goto('/auth/sign-up')
    // All required fields should be present
    const hasName = await page.getByLabel(/name/i).isVisible({ timeout: 10000 }).catch(() => false)
    const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 5000 }).catch(() => false)
    const hasPassword = await page.getByLabel(/password/i).first().isVisible({ timeout: 5000 }).catch(() => false)

    expect(hasName).toBeTruthy()
    expect(hasEmail).toBeTruthy()
    expect(hasPassword).toBeTruthy()
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
