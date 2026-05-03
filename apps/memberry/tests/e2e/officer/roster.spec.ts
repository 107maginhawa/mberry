// Business Rules: [BR-01] [BR-03] [BR-22]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Roster', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('heading "Member Roster" is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows member table with columns', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    // Table headers visible
    await expect(page.getByText('Name')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Status')).toBeVisible({ timeout: 10000 })
  })

  test('shows member rows with status badges', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    // Seeded members show as "Pending" status
    await expect(
      page.getByText('Pending').first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('search input is present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    const searchInput = page.getByPlaceholder(/search/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('category filter is present', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await page.waitForLoadState('networkidle')

    await expect(
      page.getByText('All Categories'),
    ).toBeVisible({ timeout: 10000 })
  })
})
