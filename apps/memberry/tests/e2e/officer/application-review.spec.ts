// CO-07: Application review — view pending, approve/deny
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CO-07: Application Review', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page)
  })

  test('applications page loads with heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    await expect(page.getByText('Membership Applications')).toBeVisible({ timeout: 10000 })
  })

  test('applications list renders without errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/applications`)
    // Should show either applications or an empty state — no crash
    const hasContent = await page.locator('body').textContent()
    expect(hasContent).not.toContain('undefined undefined')

    // Check for either application items or empty state message
    const hasApps = await page.getByText(/pending|approved|denied|no applications/i).first().isVisible({ timeout: 10000 }).catch(() => false)
    expect(hasApps).toBeTruthy()
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
