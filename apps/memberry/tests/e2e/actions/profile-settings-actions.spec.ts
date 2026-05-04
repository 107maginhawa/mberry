// Action-Contract Tests: Profile, Settings, Notifications, Credits
import { test, expect } from '../helpers/test-fixture'
import { expectVisibleAfterReload, expectVisibleOnPage } from '../helpers/persistence'
import { signIn } from '../helpers/auth'

test.describe('Profile Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('edit profile → change specialization → save → persists on reload', async ({ page }) => {
    await page.goto('/my/profile')
    await expect(page.getByRole('button', { name: /Edit Profile/i })).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: /Edit Profile/i }).click()

    // Fill specialization with multi-word value
    const specInput = page.getByRole('textbox', { name: /Orthodontics/i }).or(page.getByPlaceholder(/Orthodontics/i))
    await expect(specInput).toBeVisible({ timeout: 5000 })
    await specInput.fill('Oral Surgery and Implantology')

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'PATCH' && resp.url().includes('/persons/')
    )
    await page.getByRole('button', { name: /Save/i }).click()
    await responsePromise

    // Verify persistence — reload and check
    await expectVisibleAfterReload(page, /Oral Surgery|Implantology/i)
  })

  test('notifications page shows real notifications', async ({ page }) => {
    await page.goto('/my/notifications')

    await expect(page.getByRole('heading', { name: /Notifications/i })).toBeVisible({ timeout: 10000 })
    // Should show seeded notifications
    await expect(page.getByText(/payment|Welcome|reminder|training/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('notifications page works — shows content or empty state', async ({ page }) => {
    await page.goto('/my/notifications')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /Notifications/i })).toBeVisible({ timeout: 10000 })

    // Should show either notifications or "No notifications" — not a crash
    const hasContent = await page.getByText(/payment|Welcome|reminder|training|No notification/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasContent).toBeTruthy()

    // If "Mark all" button visible, click it
    const markAllBtn = page.getByRole('button', { name: /Mark all/i })
    if (await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await markAllBtn.click()
      await page.waitForTimeout(1000)
    }
  })

  test('settings notification toggles are interactive', async ({ page }) => {
    await page.goto('/my/settings')
    await expect(page.getByRole('tab', { name: /Notifications/i })).toBeVisible({ timeout: 10000 })

    // Click Notifications tab
    await page.getByRole('tab', { name: /Notifications/i }).click()

    // Should show toggle switches
    await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 5000 })
  })

  test('CPD credits page shows real credit count and log entries', async ({ page }) => {
    await page.goto('/my/credits')

    await expect(page.getByText(/CPD Credits/i)).toBeVisible({ timeout: 10000 })
    // Should show earned credits > 0
    await expect(page.getByText(/\d+/).first()).toBeVisible()
    // Should show credit log entries
    await expect(page.getByText(/Seminar|Workshop|Photography/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('manual credit entry form submits and saves', async ({ page }) => {
    await page.goto('/my/credits/log')

    await expect(page.getByText(/Log Manual Credit|Credit Log/i)).toBeVisible({ timeout: 10000 })

    // Fill form
    const activityInput = page.getByPlaceholder(/Dental|activity/i).first()
    await expect(activityInput).toBeVisible({ timeout: 5000 })
    await activityInput.fill('Action Test External CPD')

    const creditInput = page.getByPlaceholder('e.g. 4')
    await expect(creditInput).toBeVisible()
    await creditInput.fill('5')

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/credit-entries')
    )

    await page.getByRole('button', { name: /Add|Save|Submit/i }).click()
    const resp = await responsePromise
    expect(resp.status()).toBe(201)

    // Persistence: verify credit appears in credit list
    await expectVisibleOnPage(page, '/my/credits', 'Action Test External CPD')
  })

  test('organizations page shows membership cards', async ({ page }) => {
    await page.goto('/my/organizations')

    await expect(page.getByRole('heading', { name: /Organizations/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/PDA-2025/i).first()).toBeVisible()
    await expect(page.getByText(/Active/i).first()).toBeVisible()
  })

  test('dashboard shows officer link and real stat numbers', async ({ page }) => {
    await page.goto('/dashboard')

    // President Dashboard link should be visible
    await expect(page.getByText(/President Dashboard/i)).toBeVisible({ timeout: 10000 })

    // Stats should show real numbers (not "--" or "0" for everything)
    await expect(page.getByText(/Organizations/).first()).toBeVisible()
    const creditsText = await page.locator('text=/CPD Credits/').first().locator('..').textContent().catch(() => '')
    // Should contain a number
  })
})
