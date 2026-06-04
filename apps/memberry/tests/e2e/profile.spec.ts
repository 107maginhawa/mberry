import { test, expect } from './helpers/test-fixture'
import { signUp, signIn } from './helpers/auth'
import { TEST_PASSWORD } from './helpers/test-config'

test.describe('Profile page (/my/profile)', () => {
  let credentials: { email: string; password: string; name: string }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await signUp(page)
    await page.close()
  })

  test('B1: view mode shows name and edit button', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/profile')

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible()
  })

  test('B1: no person record shows empty state', async ({ page }) => {
    // Sign up a fresh user (no person record created by auth helper)
    const freshEmail = `noperson-${Date.now()}@test.com`
    await page.goto('/auth/sign-up')
    await page.getByLabel('Name', { exact: true }).fill('No Person')
    await page.getByLabel('Email', { exact: true }).fill(freshEmail)
    const pw = page.getByLabel('Password', { exact: true })
    await pw.click()
    await pw.fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /create an account/i }).click()
    await page.waitForTimeout(3000)

    // Navigate to profile — should show empty state, not crash
    await page.goto('/my/profile')
    await page.waitForTimeout(2000)

    // Should show some content, not spinner forever
    const hasHeading = await page.getByRole('heading', { name: 'My Profile' }).isVisible()
    const hasEmptyState = await page.getByText(/no profile|complete onboarding/i).isVisible()
    expect(hasHeading || hasEmptyState).toBe(true)
  })

  test('B2: edit → change specialization → save → returns to view mode', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/profile')
    // Enter edit mode
    await page.getByRole('button', { name: /edit profile/i }).click()
    await expect(page.getByText('Edit Profile')).toBeVisible()

    // Change specialization
    const uniqueSpec = `Orthodontics-${Date.now()}`
    const specLabel = page.getByText('Specialization')
    const specInput = specLabel.locator('..').locator('input')
    await specInput.fill(uniqueSpec)

    // Save — capture the PATCH response
    const patchPromise = page.waitForResponse(
      (res) => res.url().includes('/persons/') && res.request().method() === 'PATCH',
      { timeout: 10000 }
    )

    await page.getByRole('button', { name: /save changes/i }).click()

    const patchResponse = await patchPromise
    // PATCH should succeed (200)
    expect(patchResponse.status()).toBe(200)

    // Should return to view mode
    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible({ timeout: 10000 })

    // Reload and verify specialization persisted
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(uniqueSpec)).toBeVisible({ timeout: 5000 })
  })

  test('B2: cancel reverts changes', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/profile')

    await page.getByRole('button', { name: /edit profile/i }).click()

    const specLabel = page.getByText('Specialization')
    const specInput = specLabel.locator('..').locator('input')
    await specInput.fill('SHOULD_NOT_PERSIST')

    await page.getByRole('button', { name: /cancel/i }).first().click()

    await expect(page.getByRole('button', { name: /edit profile/i })).toBeVisible()
    await expect(page.getByText('SHOULD_NOT_PERSIST')).not.toBeVisible()
  })

  test('B2: save disabled when first name empty', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/profile')

    await page.getByRole('button', { name: /edit profile/i }).click()
    await page.locator('form input').first().fill('')

    await expect(page.getByRole('button', { name: /save changes/i })).toBeDisabled()
  })
})
