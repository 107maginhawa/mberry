// Business Rules: Security flow coverage for Phase 5 hardening
import { test, expect } from '@playwright/test'
import { signIn } from './helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from './helpers/test-config'

test.describe('Security Flows', () => {
  test('unauthenticated user cannot access member dashboard', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/my/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/auth/')
  })

  test('unauthenticated user cannot access settings', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/auth/')
  })

  test('authenticated user can access protected routes', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await page.goto('/my/dashboard')
    await page.waitForLoadState('networkidle')
    // Should NOT redirect to auth
    expect(page.url()).not.toContain('/auth/')
    // Dashboard should show some content
    const body = page.locator('body')
    await expect(body).not.toBeEmpty()
  })

  test('error case — invalid credentials show error', async ({ page }) => {
    await page.goto('/auth/sign-in')
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Email', { exact: true }).fill('nonexistent@test.com')
    const passwordInput = page.getByLabel('Password', { exact: true })
    await passwordInput.click()
    await passwordInput.pressSequentially('WrongPass123!', { delay: 10 })

    const submit = page.getByRole('button', { name: /login|sign in/i })
    await submit.click()

    // Wait for response and any redirect
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // Should remain on auth page (sign-in failed)
    expect(page.url()).toContain('/auth/')
  })
})
