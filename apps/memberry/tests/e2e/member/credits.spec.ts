// Business Rules: [BR-11] [BR-12] [BR-13]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const MEMBER_EMAIL = 'member@memberry.ph'
const MEMBER_PASSWORD = 'TestPass123!'

test.describe('Member Credits (/my/credits)', () => {
  test('credits page shows summary cards', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/credits')
    await page.waitForLoadState('networkidle')

    // Stat card labels (use exact to avoid matching "No credits earned yet" etc.)
    await expect(page.getByText('Earned', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Required', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Carryover', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Remaining', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('view full log link is present', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/credits')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText(/view full log/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('credit log page renders heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/credits/log')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /credit log/i }),
    ).toBeVisible({ timeout: 10000 })
  })
})
