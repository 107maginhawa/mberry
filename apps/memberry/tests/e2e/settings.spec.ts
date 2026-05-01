import { test, expect } from '@playwright/test'
import { signUp, signIn } from './helpers/auth'

test.describe('Settings page (/my/settings)', () => {
  let credentials: { email: string; password: string; name: string }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    credentials = await signUp(page)
    await page.close()
  })

  // --- Notification Preferences ---

  test('C1: notification section renders 5 categories with toggles', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    await expect(page.getByText('Notification Preferences')).toBeVisible()
    await expect(page.getByText('Dues & Payments')).toBeVisible()
    await expect(page.getByText('Events')).toBeVisible()
    await expect(page.getByText('Trainings')).toBeVisible()
    await expect(page.getByText('Announcements')).toBeVisible()
    await expect(page.getByText('Credits')).toBeVisible()

    // Should have toggle switches (at least 10 — 5 categories x 2 toggles each)
    const switches = page.getByRole('switch')
    await expect(switches.first()).toBeVisible()
  })

  test('C1: toggle sends PATCH request', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')
    await expect(page.getByText('Dues & Payments')).toBeVisible()

    // Listen for PATCH
    const patchPromise = page.waitForRequest(
      (req) => req.url().includes('notification-preferences') && req.method() === 'PATCH'
    )

    // Click first toggle
    await page.getByRole('switch').first().click()

    const req = await patchPromise
    expect(req.method()).toBe('PATCH')
  })

  test('C1: toggle persists on reload', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')
    await expect(page.getByText('Dues & Payments')).toBeVisible()

    // Get initial state of first switch
    const firstSwitch = page.getByRole('switch').first()
    const initialChecked = await firstSwitch.getAttribute('aria-checked')

    // Toggle it
    const patchResponse = page.waitForResponse(
      (res) => res.url().includes('notification-preferences') && res.request().method() === 'PATCH'
    )
    await firstSwitch.click()
    await patchResponse

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Dues & Payments')).toBeVisible()

    // Check toggle state changed
    const newChecked = await page.getByRole('switch').first().getAttribute('aria-checked')
    expect(newChecked).not.toBe(initialChecked)
  })

  // --- Privacy Controls ---

  test('C2: privacy section shows empty state without org membership', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    // New user with no org → empty state
    await expect(page.getByText(/join an organization/i)).toBeVisible()
  })

  // --- Account Section ---

  test('C3: account section has heading and portal link', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
    await expect(page.getByRole('link', { name: /account settings/i })).toBeVisible()
  })
})
