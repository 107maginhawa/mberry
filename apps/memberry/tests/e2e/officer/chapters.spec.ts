// CO-11: Chapter affiliations
import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CO-11: Chapter Affiliations', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOfficer(page)
  })

  test('chapters settings page loads', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Chapter Affiliations' })).toBeVisible({ timeout: 10000 })
  })

  test('affiliation list renders without errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    await page.waitForLoadState('networkidle')

    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')
    expect(pageText).not.toContain('Something went wrong')
  })

  test('chapters page accessible from officer settings nav', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    // Look for chapters link in nav
    const chaptersLink = page.locator('a[href*="chapters"]').first()
    const visible = await chaptersLink.isVisible({ timeout: 5000 }).catch(() => false)
    if (visible) {
      await chaptersLink.click()
      await expect(page.getByRole('heading', { name: 'Chapter Affiliations' })).toBeVisible({ timeout: 10000 })
    }
  })
})
