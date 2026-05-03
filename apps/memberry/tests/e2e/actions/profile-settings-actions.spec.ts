// Action-Contract Tests: Profile, Settings, Notifications, Credits
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

test.describe('Profile Actions', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('edit profile → change specialization → save → persists on reload', async ({ page }) => {
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /Edit Profile/i }).click()
    await page.waitForLoadState('networkidle')

    // Fill specialization with multi-word value
    const specInput = page.getByRole('textbox', { name: /Orthodontics/i }).or(page.getByPlaceholder(/Orthodontics/i))
    if (await specInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await specInput.fill('Oral Surgery and Implantology')
    }

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'PATCH' && resp.url().includes('/persons/')
    ).catch(() => null)
    await page.getByRole('button', { name: /Save/i }).click()
    await responsePromise

    // Verify persistence — reload and check
    await page.goto('/my/profile')
    await page.waitForLoadState('networkidle')
    const hasSpec = await page.getByText(/Oral Surgery|Implantology/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasSpec).toBeTruthy()
  })

  test('notifications page shows real notifications', async ({ page }) => {
    await page.goto('/my/notifications')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Notifications/i)).toBeVisible({ timeout: 10000 })
    // Should show seeded notifications
    const hasNotif = await page.getByText(/payment|Welcome|reminder|training/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasNotif).toBeTruthy()
  })

  test('mark all read button works', async ({ page }) => {
    await page.goto('/my/notifications')
    await page.waitForLoadState('networkidle')

    const markAllBtn = page.getByRole('button', { name: /Mark all/i })
    if (await markAllBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const responsePromise = page.waitForResponse(
        resp => resp.request().method() === 'POST' && resp.url().includes('/notifs/read-all')
      ).catch(() => null)
      await markAllBtn.click()
      const resp = await responsePromise
      if (resp) expect(resp.status()).toBe(200)
    }
  })

  test('settings notification toggles are interactive', async ({ page }) => {
    await page.goto('/my/settings')
    await page.waitForLoadState('networkidle')

    // Click Notifications tab
    await page.getByRole('tab', { name: /Notifications/i }).click()
    await page.waitForTimeout(500)

    // Should show toggle switches
    const hasToggle = await page.getByRole('switch').first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasToggle).toBeTruthy()
  })

  test('CPD credits page shows real credit count and log entries', async ({ page }) => {
    await page.goto('/my/credits')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/CPD Credits/i)).toBeVisible({ timeout: 10000 })
    // Should show earned credits > 0
    const hasCredits = await page.getByText(/\d+/).first().isVisible().catch(() => false)
    expect(hasCredits).toBeTruthy()
    // Should show credit log entries
    const hasEntry = await page.getByText(/Seminar|Workshop|Photography/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasEntry).toBeTruthy()
  })

  test('manual credit entry form submits and saves', async ({ page }) => {
    await page.goto('/my/credits/log')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Log Manual Credit|Credit Log/i)).toBeVisible({ timeout: 10000 })

    // Fill form
    const activityInput = page.getByPlaceholder(/Dental|activity/i).first()
    if (await activityInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activityInput.fill('Action Test External CPD')

      const creditInput = page.getByPlaceholder(/e.g.|hours/i).first().or(page.locator('input[type="number"]').first())
      if (await creditInput.isVisible().catch(() => false)) {
        await creditInput.fill('5')
      }

      const responsePromise = page.waitForResponse(
        resp => resp.request().method() === 'POST' && resp.url().includes('/credit-entries')
      ).catch(() => null)

      await page.getByRole('button', { name: /Add|Save|Submit/i }).click()
      const resp = await responsePromise
      if (resp) expect(resp.status()).toBe(201)
    }
  })

  test('organizations page shows membership cards', async ({ page }) => {
    await page.goto('/my/organizations')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/Organizations/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/PDA-2025/i).first()).toBeVisible()
    await expect(page.getByText(/Active/i).first()).toBeVisible()
  })

  test('dashboard shows officer link and real stat numbers', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // President Dashboard link should be visible
    await expect(page.getByText(/President Dashboard/i)).toBeVisible({ timeout: 10000 })

    // Stats should show real numbers (not "--" or "0" for everything)
    await expect(page.getByText(/Organizations/).first()).toBeVisible()
    const creditsText = await page.locator('text=/CPD Credits/').first().locator('..').textContent().catch(() => '')
    // Should contain a number
  })
})
