import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

test.describe('Wave 7: New admin routes load correctly', () => {
  test('national-dashboard page loads with association selector', async ({ page }) => {
    await signInAndNavigate(page, '/national-dashboard')
    await page.waitForLoadState('networkidle')

    // Heading visible
    await expect(page.getByRole('heading', { name: /National Dashboard/i })).toBeVisible()
    // Association selector visible
    await expect(page.getByText(/Select association/i)).toBeVisible()
  })

  test('events page loads with search and table', async ({ page }) => {
    await signInAndNavigate(page, '/events')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Events/i })).toBeVisible()
    // Search input
    await expect(page.getByPlaceholder(/Search events/i)).toBeVisible()
    // Status filter
    await expect(page.getByText(/All statuses/i)).toBeVisible()
    // Table renders (either with data or empty state)
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/No events found/i).isVisible().catch(() => false)
    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('training page loads with search and table', async ({ page }) => {
    await signInAndNavigate(page, '/training')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Training/i })).toBeVisible()
    await expect(page.getByPlaceholder(/Search courses/i)).toBeVisible()
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page.getByText(/No courses found/i).isVisible().catch(() => false)
    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('committees page loads with stats and table', async ({ page }) => {
    await signInAndNavigate(page, '/committees')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Committees/i })).toBeVisible()
    // Stats cards visible (Total, Active, Dissolved)
    await expect(page.getByText('Total')).toBeVisible()
    await expect(page.getByText('Active')).toBeVisible()
    await expect(page.getByText('Dissolved')).toBeVisible()
    // Search input
    await expect(page.getByPlaceholder(/Search committees/i)).toBeVisible()
  })
})

test.describe('Wave 7: Enhanced existing routes', () => {
  test('dashboard shows Recent Activity section', async ({ page }) => {
    await signInAndNavigate(page, '/')
    await page.waitForLoadState('networkidle')

    // Quick actions for new routes visible
    await expect(page.getByText('National Dashboard')).toBeVisible()
    await expect(page.getByText('Events')).toBeVisible()
    await expect(page.getByText('Training')).toBeVisible()
    // Recent Activity section
    await expect(page.getByRole('heading', { name: /Recent Activity/i })).toBeVisible()
    // View all link to audit
    await expect(page.getByText(/View all/i)).toBeVisible()
  })

  test('association detail shows Chapter Health section', async ({ page }) => {
    await signInAndNavigate(page, '/associations')
    await page.waitForLoadState('networkidle')

    // Click first association if exists
    const firstLink = page.locator('table a').first()
    const hasAssociations = await firstLink.isVisible().catch(() => false)

    if (hasAssociations) {
      await firstLink.click()
      await page.waitForLoadState('networkidle')
      // Chapter Health section
      await expect(page.getByText(/Chapter Health/i)).toBeVisible()
      // Link to full dashboard
      await expect(page.getByText(/Full dashboard/i)).toBeVisible()
    }
  })

  test('members page has org filter dropdown', async ({ page }) => {
    await signInAndNavigate(page, '/members')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Members/i })).toBeVisible()
    // Org filter dropdown
    await expect(page.getByText(/All organizations/i)).toBeVisible()
    // Impersonate action column header
    await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible()
  })
})
