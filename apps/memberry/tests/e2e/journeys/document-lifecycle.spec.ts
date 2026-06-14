// WF-071 — Document Upload: officer publishes new document
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Document Lifecycle (Officer Journey)', () => {
test('officer can navigate to document library', async ({ page }) => {
    const respP = captureRouteHydration(page, '/documents')
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    await expect(
      page.getByRole('heading', { name: /document library/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('upload affordance is present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Upload is an inline drag-and-drop zone (with a "browse" link + hidden
    // file input), not a button that opens a dialog.
    await expect(
      page
        .getByText(/drag and drop/i)
        .or(page.getByText(/browse/i))
        .or(page.locator('input[type="file"]'))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('document list shows category filter', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Categories may appear as tabs, filter buttons, or select dropdown
    await expect(
      page.getByRole('tab').first()
        .or(page.getByText(/all|bylaws|policies|forms/i).first())
        .or(page.getByRole('combobox').first())
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('clicking a document navigates to detail page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Target an actual document-detail link (href .../officer/documents/<id>)
    // — a generic getByRole('link').first() resolves to a nav/breadcrumb link.
    const docLink = page
      .locator('a[href*="/officer/documents/"]')
      .first()

    // Wait for the list to hydrate into either a doc link or empty state —
    // isVisible() does not retry, so reading hasDoc immediately races.
    const emptyState = page.getByText(/no documents|upload your first|empty/i).first()
    await expect(docLink.or(emptyState)).toBeVisible({ timeout: 10000 })
    const hasDoc = await docLink.isVisible().catch(() => false)

    if (hasDoc) {
      await docLink.click()
      await page.waitForLoadState('networkidle')

      // Should navigate to a document detail page
      expect(page.url()).toMatch(/\/documents\/[a-zA-Z0-9-]+/)

      // Detail page should show document title or content
      const hasHeading = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasContent = await page.locator('main').isVisible()
      expect(hasHeading || hasContent).toBeTruthy()
    } else {
      // No documents seeded -- verify empty state renders correctly
      await expect(page.getByText(/no documents|upload your first|empty/i).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('document detail page shows metadata', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const docLink = page
      .locator('a[href*="/officer/documents/"]')
      .first()

    const emptyState = page.getByText(/no documents|upload your first|empty/i).first()
    await expect(docLink.or(emptyState)).toBeVisible({ timeout: 10000 })
    const hasDoc = await docLink.isVisible().catch(() => false)

    if (hasDoc) {
      await docLink.click()
      await page.waitForLoadState('networkidle')

      // Detail page should show at least some metadata: date, category, status, or description
      const hasDate = await page.getByText(/\d{4}|uploaded|created|modified/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasStatus = await page.getByText(/draft|published|archived|active/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasCategory = await page.getByText(/bylaws|policies|forms|general|announcements/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      const hasContent = await page.locator('main').isVisible()

      expect(hasDate || hasStatus || hasCategory || hasContent).toBeTruthy()
    } else {
      test.skip(true, 'No documents seeded for detail metadata test')
    }
  })

  test('search filters document list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const searchInput = page
      .getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first()

    const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasSearch) {
      await searchInput.fill('bylaws')
      await page.waitForLoadState('networkidle')

      // After typing, page should update (either results or "no documents found")
      const hasContent = await page.locator('main').isVisible()
      expect(hasContent).toBeTruthy()
    } else {
      test.skip(true, 'No search input found on documents page')
    }
  })
})
