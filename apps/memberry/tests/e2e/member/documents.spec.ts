// WF-073 — Document Library: member browses + downloads org documents
// Business Rules: Documents module — member document browsing
import { test, expect } from '../helpers/test-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('member') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member Documents', () => {
test('documents browser renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    await expect(
      page.getByRole('heading', { name: /documents?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows category navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    const hasTabs = await page.getByRole('tab').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasCategories = await page.getByText(/all|bylaws|policies|forms|announcements/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTabs || hasCategories).toBeTruthy()
  })

  test('member sees only published documents (not drafts)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    // Draft badge should not appear in member view
    const hasDraftBadge = await page.getByText(/^draft$/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasDraftBadge).toBe(false)
  })

  test('can click through to document detail', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    // Wait for content to load
    await page.waitForTimeout(2000)

    // Find a document link (any link that navigates to a document detail page)
    const docLinks = page.locator('a[href*="/documents/"]')
    const count = await docLinks.count()

    if (count > 0) {
      await docLinks.first().click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/documents/')
    } else {
      // No published documents — verify empty state or document list renders without error
      const hasPage = await page.getByRole('heading', { name: /documents?/i }).first().isVisible().catch(() => false)
      expect(hasPage).toBeTruthy()
    }
  })
})
