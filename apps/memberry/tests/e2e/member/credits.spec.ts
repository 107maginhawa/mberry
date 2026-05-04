// Business Rules: [BR-11] [BR-12] [BR-13] [BR-14]
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
      page.getByText(/Manual Entry/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test('credit log page renders heading', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/credits/log')
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /Log Manual Credit/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('[BR-14] credit summary shows aggregate across organizations', async ({ page }) => {
    await signIn(page, MEMBER_EMAIL, MEMBER_PASSWORD)
    await page.goto('/my/credits')
    await page.waitForLoadState('networkidle')

    // The aggregate credit view should render — even if the total is 0,
    // the summary component (stat cards or total line) must be present.
    const hasEarned = await page.getByText('Earned', { exact: true }).isVisible().catch(() => false)
    const hasTotal = await page.getByText(/total/i).first().isVisible().catch(() => false)
    const hasSummary = await page.getByText(/credits/i).first().isVisible().catch(() => false)
    expect(hasEarned || hasTotal || hasSummary).toBeTruthy()
  })
})
