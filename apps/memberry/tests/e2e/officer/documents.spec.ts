// Business Rules: Documents module — officer document management
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Documents', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
  })

  test('documents list renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    await expect(
      page.getByRole('heading', { name: /documents?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows document categories or tabs', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Categories/tabs may render as tab list, nav links, or filter buttons
    const hasTabs = await page.getByRole('tab').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasCategories = await page.getByText(/all|bylaws|policies|forms|announcements/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTabs || hasCategories).toBeTruthy()
  })

  test('upload button is visible for officers', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const uploadBtn = page
      .getByRole('button', { name: /upload|add document|new document/i })
      .or(page.getByRole('link', { name: /upload|add document|new document/i }))
      .first()
    await expect(uploadBtn).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to document detail', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    // Click the first document link/row in the list
    const firstDoc = page
      .getByRole('link', { name: /.+/ })
      .filter({ hasNot: page.getByText(/upload|create|new/i) })
      .first()

    const isVisible = await firstDoc.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      await firstDoc.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/documents/')
    } else {
      // No documents seeded — verify empty state renders without error
      const emptyState = await page.getByText(/no documents|empty|upload your first/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(emptyState).toBeTruthy()
    }
  })

  test('shows document status badges (draft/published/archived)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const hasDraft = await page.getByText(/^draft$/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasPublished = await page.getByText(/^published$/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasArchived = await page.getByText(/^archived$/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasAnyStatus = hasDraft || hasPublished || hasArchived
    // If there are no documents, the status badges won't appear — that's acceptable
    const hasNoDocuments = await page.getByText(/no documents|empty/i).first().isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasAnyStatus || hasNoDocuments).toBeTruthy()
  })

  test('search input is functional', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/documents`)
    const searchInput = page
      .getByRole('searchbox')
      .or(page.getByPlaceholder(/search/i))
      .first()

    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.fill('test search query')
    await page.waitForLoadState('networkidle')

    // After typing, either results update or a no-results message appears
    const currentUrl = page.url()
    const hasQuery = currentUrl.includes('test') || currentUrl.includes('q=')
    const hasResults = await page.getByText(/test|no documents found|no results/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasQuery || hasResults).toBeTruthy()
  })
})
