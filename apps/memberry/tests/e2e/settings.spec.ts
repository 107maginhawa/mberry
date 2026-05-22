import { test, expect } from './helpers/test-fixture'
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

    // Click Notifications tab
    await page.getByRole('tab', { name: 'Notifications' }).click()

    await expect(page.getByText('Notification Preferences')).toBeVisible()
    // Verify categories within the notifications tab panel
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByText('Dues & Payments')).toBeVisible()
    await expect(panel.getByText('Events', { exact: true })).toBeVisible()
    await expect(panel.getByText('Trainings')).toBeVisible()
    await expect(panel.getByText('Announcements')).toBeVisible()
    await expect(panel.getByText('Credits', { exact: true })).toBeVisible()

    // Should have toggle switches
    const switches = panel.getByRole('switch')
    await expect(switches.first()).toBeVisible()
  })

  test('C1: toggle sends PATCH request', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')
    await page.getByRole('tab', { name: 'Notifications' }).click()
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
    await page.getByRole('tab', { name: 'Notifications' }).click()
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
    await page.getByRole('tab', { name: 'Notifications' }).click()
    await expect(page.getByText('Dues & Payments')).toBeVisible()

    // Check toggle state changed
    const newChecked = await page.getByRole('switch').first().getAttribute('aria-checked')
    expect(newChecked).not.toBe(initialChecked)
  })

  // --- Privacy Controls ---

  test('C2: privacy section shows empty state without org membership', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    // Click Privacy tab
    await page.getByRole('tab', { name: 'Privacy' }).click()

    // New user with no org → empty state
    await expect(page.getByText(/join an organization/i)).toBeVisible()
  })

  // --- Security Section ---

  test('C3: security section has heading and portal link', async ({ page }) => {
    await signIn(page, credentials.email, credentials.password)
    await page.goto('/my/settings')

    // Click Security tab
    await page.getByRole('tab', { name: 'Security' }).click()

    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
    await expect(page.getByRole('link', { name: /account settings/i })).toBeVisible()
  })
})
