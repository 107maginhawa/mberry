import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('dashboard renders with content', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    const dashboard = page.locator('main')
    await expect(dashboard).toBeVisible({ timeout: 10000 })

    const hasGreeting = await page.getByText(/dashboard|welcome|good\s(morning|afternoon|evening)|overview/i).first().isVisible().catch(() => false)
    const hasOrgName = await page.getByText(/PDA Metro Manila/i).first().isVisible().catch(() => false)
    expect(hasGreeting || hasOrgName).toBeTruthy()
  })

  test('metrics strip shows member counts or activity summary', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    const hasMembers = await page.getByText(/members?/i).first().isVisible().catch(() => false)
    const hasTotal = await page.getByText(/total|active|pending|collection/i).first().isVisible().catch(() => false)
    expect(hasMembers || hasTotal).toBeTruthy()
  })

  test('can navigate to officer roster via URL', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })
  })
})
