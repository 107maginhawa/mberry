// Business Rules: Documents module — member document browsing
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member Documents', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
  })

  test('documents browser renders heading', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /documents?/i }).first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows category navigation', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    await page.waitForLoadState('networkidle')

    const hasTabs = await page.getByRole('tab').first().isVisible({ timeout: 5000 }).catch(() => false)
    const hasCategories = await page.getByText(/all|bylaws|policies|forms|announcements/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasTabs || hasCategories).toBeTruthy()
  })

  test('member sees only published documents (not drafts)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    await page.waitForLoadState('networkidle')

    // Draft badge should not appear in member view
    const hasDraftBadge = await page.getByText(/^draft$/i).first().isVisible({ timeout: 5000 }).catch(() => false)
    expect(hasDraftBadge).toBe(false)
  })

  test('can click through to document detail', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/documents`)
    await page.waitForLoadState('networkidle')

    const firstDoc = page
      .getByRole('link', { name: /.+/ })
      .filter({ hasNot: page.getByText(/home|dashboard|back/i) })
      .first()

    const isVisible = await firstDoc.isVisible({ timeout: 5000 }).catch(() => false)
    if (isVisible) {
      await firstDoc.click()
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain('/documents/')
    } else {
      // No published documents — verify empty state renders without error
      const emptyState = await page.getByText(/no documents|empty/i).first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(emptyState).toBeTruthy()
    }
  })
})
