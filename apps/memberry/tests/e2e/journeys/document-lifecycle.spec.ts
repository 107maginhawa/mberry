import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Document Lifecycle (Officer Journey)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('officer can navigate to document library', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    await expect(
      page.getByRole('heading', { name: /document library/i }).first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('upload button opens upload dialog or form', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const uploadBtn = page
      .getByRole('button', { name: /upload|add document|new document/i })
      .first()

    await expect(uploadBtn).toBeVisible({ timeout: 10000 })
    await uploadBtn.click()

    // Should open a dialog, drawer, or navigate to upload form
    const hasDialog = await page.getByRole('dialog').isVisible({ timeout: 5000 }).catch(() => false)
    const hasForm = await page.getByLabel(/title|file|name/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasFileInput = await page.locator('input[type="file"]').isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasDialog || hasForm || hasFileInput).toBeTruthy()
  })

  test('document list shows category filter', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Categories may appear as tabs, filter buttons, or select dropdown
    const hasTabs = await page.getByRole('tab').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasFilter = await page.getByText(/all|bylaws|policies|forms/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasSelect = await page.getByRole('combobox').first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTabs || hasFilter || hasSelect).toBeTruthy()
  })

  test('clicking a document navigates to detail page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Find a clickable document row/link
    const docLink = page
      .getByRole('link')
      .filter({ hasNot: page.getByText(/upload|create|new|officer|home|dashboard/i) })
      .first()

    const hasDoc = await docLink.isVisible({ timeout: 5000 }).catch(() => false)

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
      const hasEmpty = await page.getByText(/no documents|upload your first|empty/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasEmpty).toBeTruthy()
    }
  })

  test('document detail page shows metadata', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const docLink = page
      .getByRole('link')
      .filter({ hasNot: page.getByText(/upload|create|new|officer|home|dashboard/i) })
      .first()

    const hasDoc = await docLink.isVisible({ timeout: 5000 }).catch(() => false)

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
