import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const PERSON_ME = /\/persons\/me(?:[/?]|$)/

test.describe('Officer Dashboard', () => {
test('dashboard renders with content', async ({ page }) => {
    const respP = captureRouteHydration(page, PERSON_ME)
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const dashboard = page.locator('main')
    await expect(dashboard).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)

    const hasGreeting = await page.getByText(/dashboard|welcome|good\s(morning|afternoon|evening)|overview/i).first().isVisible().catch(() => false)
    const hasOrgName = await page.getByText(/PDA Metro Manila/i).first().isVisible().catch(() => false)
    expect(hasGreeting || hasOrgName).toBeTruthy()
  })

  test('metrics strip shows member counts or activity summary', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await expect(
      page
        .getByText(/members?/i)
        .or(page.getByText(/total|active|pending|collection/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to officer roster via URL', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })
  })
})
