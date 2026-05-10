import { test, expect } from '@playwright/test'
import { isMailpitAvailable } from './helpers/mailpit'
import { mockDate, getPageTime, daysFromNow, formatDate } from './helpers/clock'
import { signInAsOfficer, signInAsMember, signInAsTreasurer, signInAsSecretary, signInAsSociety } from './helpers/auth'

test.describe('Wave 0: Test Infrastructure', () => {
  test('mailpit helper reports availability correctly', async () => {
    // Just verify the function doesn't throw — result depends on Docker state
    const available = await isMailpitAvailable()
    expect(typeof available).toBe('boolean')
  })

  test('clock helper mocks Date in page', async ({ page }) => {
    const fakeDate = new Date('2025-06-15T12:00:00Z')
    await mockDate(page, fakeDate)
    await page.goto('about:blank')

    const pageTime = await getPageTime(page)
    // Should be within 2 seconds of our fake date
    expect(Math.abs(pageTime.getTime() - fakeDate.getTime())).toBeLessThan(2000)
  })

  test('clock utility functions work', () => {
    const base = new Date('2026-01-01T00:00:00Z')
    const future = daysFromNow(30, base)
    expect(future.getTime() - base.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
    expect(formatDate(base)).toBe('2026-01-01')
  })

  test('per-role auth helpers sign in successfully', async ({ page }) => {
    // Test officer login (most likely to work — primary seed user)
    await signInAsOfficer(page)
    // Should be redirected away from auth page
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('member role sign-in works', async ({ page }) => {
    await signInAsMember(page)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('treasurer role sign-in works', async ({ page }) => {
    await signInAsTreasurer(page)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('secretary role sign-in works', async ({ page }) => {
    await signInAsSecretary(page)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })

  test('society officer role sign-in works', async ({ page }) => {
    await signInAsSociety(page)
    await expect(page).not.toHaveURL(/\/auth\/sign-in/)
  })
})
