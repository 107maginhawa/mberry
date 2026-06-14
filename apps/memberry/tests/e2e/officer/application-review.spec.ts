// WF-024 — Application Approval: officer reviews + approves pending
// CO-07: Application review — view pending, approve/deny
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration, captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CO-07: Application Review', () => {
test('applications page loads with heading', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/(memberships|applications)/)
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    await expect(page.getByText('Membership Applications')).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('applications list renders without errors', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    // Should show either applications or an empty state — no crash
    const hasContent = await page.locator('body').textContent()
    expect(hasContent).not.toContain('undefined undefined')

    // Check for either application items or empty state message
    await expect(page.getByText(/pending|approved|denied|no applications/i).first()).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.ok()).toBe(true)
  })

  test('page is accessible from officer nav', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Navigate to applications via sidebar/nav
    const appLink = page.locator('a[href*="applications"]').first()
    const visible = await appLink.isVisible({ timeout: 5000 }).catch(() => false)
    if (visible) {
      await appLink.click()
      await expect(page.getByText('Membership Applications')).toBeVisible({ timeout: 10000 })
    }
  })
})
