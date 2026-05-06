// Business Rules: [BR-13] [BR-15]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const MEMBER_EMAIL = SEED_MEMBER_EMAIL
const MEMBER_PASSWORD = TEST_PASSWORD

test.describe('Member Training (/my/training)', () => {
  test('shows "My Training" heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/training')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: 'My Training' }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows stat cards (Enrolled, Pending, CPE Credits, Completed)', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/training')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Enrolled', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Pending', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('CPE Credits', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Completed', { exact: true })).toBeVisible({ timeout: 10000 })
  })
})
