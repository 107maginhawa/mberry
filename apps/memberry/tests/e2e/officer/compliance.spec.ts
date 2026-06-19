// Matrix C — officer/compliance: the CPD compliance dashboard.
// Asserts the real compliance report hydrates (GET succeeds) and renders real
// summary figures from the backend, plus the Refresh action re-fetches.
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer compliance dashboard', () => {
  test('renders the real CPD compliance summary', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/association\/member\/compliance\//)
    await page.goto(`/org/${ORG_ID}/officer/compliance`)

    await expect(page.getByRole('heading', { name: /compliance dashboard/i })).toBeVisible({ timeout: 15000 })
    const resp = await respP
    expect(resp?.status(), 'compliance report GET must succeed').toBe(200)

    // Real summary cards from the report payload.
    await expect(page.getByText(/total members/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/compliant/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('Refresh re-fetches the compliance report', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/compliance`)
    await expect(page.getByRole('heading', { name: /compliance dashboard/i })).toBeVisible({ timeout: 15000 })

    const refreshP = page.waitForResponse(
      (r) => /\/association\/member\/compliance\/.*\/refresh/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 20000 },
    )
    await page.getByRole('button', { name: /refresh/i }).first().click()
    const refresh = await refreshP
    expect(refresh.status(), 'compliance refresh POST must succeed').toBeGreaterThanOrEqual(200)
    expect(refresh.status()).toBeLessThan(300)
  })
})
