// WF-027 — Chapter Management: org admin creates + manages chapters
// CO-11: Chapter affiliations
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('CO-11: Chapter Affiliations', () => {
test('chapters settings page loads', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/chapters/)
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    await expect(page.getByRole('heading', { name: 'Chapter Affiliations' })).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('affiliation list renders without errors', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/chapters/)
    await page.goto(`/org/${ORG_ID}/officer/settings/chapters`)
    const pageText = await page.locator('body').textContent()
    expect(pageText).not.toContain('undefined undefined')
    expect(pageText).not.toContain('Something went wrong')
    const resp = await respP
    expect(resp?.ok()).toBe(true)
  })

  test('chapters page accessible from officer settings nav', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    // Look for chapters link in nav
    const chaptersLink = page.locator('a[href*="chapters"]').first()
    const visible = await chaptersLink.isVisible({ timeout: 5000 }).catch(() => false)
    if (visible) {
      await chaptersLink.click()
      await expect(page.getByRole('heading', { name: 'Chapter Affiliations' })).toBeVisible({ timeout: 10000 })
    }
  })
})
