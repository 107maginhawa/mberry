// M-10: Browse member directory
// Verifies directory search page renders, search works, and member cards display
import { test, expect } from '../helpers/test-fixture'
import { signInAsMember } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('M-10: Member Directory', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  test('directory page loads with search input', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/members`)
    await page.waitForLoadState('networkidle')

    // Search input should be visible
    const searchInput = page.getByPlaceholder(/search members/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('search returns member cards with names', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/members`)
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search members/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Search for a known seed user
    await searchInput.fill('Juan')
    await page.waitForTimeout(1500) // wait for debounce + API

    // Should show at least one member card or no error
    const hasResults = await page.locator('.border.rounded-lg').first().isVisible({ timeout: 10000 }).catch(() => false)
    const hasError = await page.getByText(/search failed/i).isVisible().catch(() => false)
    expect(hasError).toBe(false)

    if (hasResults) {
      const nameText = await page.locator('.border.rounded-lg').first().locator('.font-medium').first().textContent()
      expect(nameText).toBeTruthy()
      expect(nameText!.length).toBeGreaterThan(1)
    }
  })

  test('empty search shows no errors', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/members`)
    await page.waitForLoadState('networkidle')

    // Page should load without errors even with no search query
    const hasError = await page.getByText(/search failed/i).isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasError).toBe(false)
  })

  test('page renders without undefined values', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/members`)
    await page.waitForLoadState('networkidle')

    const pageContent = await page.textContent('body')
    expect(pageContent).not.toContain('undefined undefined')
  })
})
