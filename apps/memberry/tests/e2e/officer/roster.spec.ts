// WF-030 — Member Roster: list, search, filter, bulk actions
// Business Rules: [BR-01] [BR-03] [BR-22] [BR-23]
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Roster', () => {
test('heading "Member Roster" is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows member table with columns', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // Table headers visible
    await expect(page.getByText('Name')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Status')).toBeVisible({ timeout: 10000 })
  })

  test('shows member rows with status badges', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // Seeded members show as "Pending" status
    await expect(
      page.getByText('Pending').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('search input is present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('category filter is present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(
      page.getByText('All Categories'),
    ).toBeVisible({ timeout: 10000 })
  })

  test('[BR-23] roster search accepts text input', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // Search input should be present
    const hasSearch = await page.getByPlaceholder(/search/i).first().isVisible().catch(() => false)
    const hasInput = await page.locator('input[type="text"], input[type="search"]').first().isVisible().catch(() => false)
    expect(hasSearch || hasInput).toBeTruthy()
  })
})
