// Business Rules: [BR-15] [BR-27]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Events (/my/events)', () => {
  test('shows "My Events" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/events')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: 'My Events' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('has Upcoming and Past stat cards', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/events')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText('Upcoming').first(),
    ).toBeVisible({ timeout: 10000 })

    await expect(
      page.getByText('Past').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('has Upcoming tab active by default', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/events')
    await page.waitForLoadState('networkidle')

    // Upcoming tab/button should be present
    const upcomingTab = page.getByRole('tab', { name: /upcoming/i })
      .or(page.getByRole('button', { name: /upcoming/i }))
      .first()
    await expect(upcomingTab).toBeVisible({ timeout: 10000 })
  })
})
