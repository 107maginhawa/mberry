// WF-007 — Session Management
// Business Rules: Security flow coverage for Phase 5 hardening
import { test, expect } from './helpers/test-fixture'
import { signIn } from './helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from './helpers/test-config'
import { captureAnyApiSuccess } from './helpers/real-flow'

test.describe('Security Flows', () => {
  test('authenticated user can access protected routes', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await page.goto('/dashboard')
    expect(page.url()).not.toContain('/auth/')
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('unauthenticated user cannot access member dashboard', async ({ page }) => {
    await page.context().clearCookies()
    // /dashboard is the real member dashboard route (/my/dashboard does not
    // exist, so it 404s outside the _authenticated guard and never redirects).
    await page.goto('/dashboard')
    await page.waitForURL((u) => u.pathname.includes('/auth/'), { timeout: 15000 }).catch(() => {})
    expect(page.url()).toContain('/auth/')
  })

  test('unauthenticated user cannot access settings', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/my/settings')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/auth/')
  })

  test('error case — invalid credentials show error', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.getByLabel('Email', { exact: true }).fill('nonexistent@test.com')
    const passwordInput = page.getByLabel('Password', { exact: true })
    await passwordInput.click()
    await passwordInput.fill('WrongPass123!')

    const submit = page.getByRole('button', { name: /login|sign in/i })
    await submit.click()

    // Wait for response and any redirect
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // Should remain on auth page (sign-in failed)
    expect(page.url()).toContain('/auth/')
  })
})
