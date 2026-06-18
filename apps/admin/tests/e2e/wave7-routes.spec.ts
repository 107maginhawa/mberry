import { test, expect } from '@playwright/test'
import { signInAndNavigate } from './helpers/auth'

function captureAnyApiSuccess(page: import('@playwright/test').Page, timeout = 20000) {
  return page
    .waitForResponse(
      (r) => r.url().includes('/api/') && r.request().method() === 'GET' && r.status() < 400,
      { timeout },
    )
    .catch(() => null)
}

test.describe('Wave 7: New admin routes load correctly', () => {
  test('national-dashboard page loads with association selector', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await signInAndNavigate(page, '/national-dashboard')
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
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
    // Stats cards visible (Total, Active, Dissolved). Exact match: row status
    // badges render lowercase "active", so a loose match collides with them.
    await expect(page.getByText('Total', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Dissolved', { exact: true }).first()).toBeVisible()
    // Search input
    await expect(page.getByPlaceholder(/Search committees/i)).toBeVisible()
  })
})

test.describe('Wave 7: Enhanced existing routes', () => {
  test('dashboard shows Recent Activity section', async ({ page }) => {
    await signInAndNavigate(page, '/')
    await page.waitForLoadState('networkidle')

    // Quick actions for new routes visible. "Events"/"Training" also appear as
    // sidebar nav links, so scope with exact + first to avoid strict-mode
    // collisions while still asserting the label renders.
    await expect(page.getByText('National Dashboard').first()).toBeVisible()
    await expect(page.getByText('Events', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Training', { exact: true }).first()).toBeVisible()
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
      // Chapter-health KPI cards render (the "Members" KPI is always present),
      // plus the link through to the national dashboard. The section has no
      // literal "Chapter Health" heading — that is only a code comment.
      await expect(page.getByText('Members', { exact: true }).first()).toBeVisible()
      await expect(page.getByText(/View National Dashboard/i)).toBeVisible()
    }
  })

  test('members page has org filter dropdown', async ({ page }) => {
    await signInAndNavigate(page, '/members')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /Members/i })).toBeVisible()
    // Org filter dropdown is a shadcn/Radix Select (button[role="combobox"])
    // whose trigger shows the selected "All organizations" value. Match the
    // combobox by its text so it doesn't collide with the page subtitle
    // ("…across all organizations").
    await expect(
      page.getByRole('combobox').filter({ hasText: /All organizations/i }),
    ).toBeVisible({ timeout: 10000 })
    // Members table renders with its expected columns (no Actions/impersonate
    // column exists on this page — only Name/Email/Organization/Role/Status).
    await expect(page.getByRole('columnheader', { name: /Name/i })).toBeVisible()
  })
})
