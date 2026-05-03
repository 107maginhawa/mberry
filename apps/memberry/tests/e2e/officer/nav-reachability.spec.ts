// Business Rules: [BR-09]
import { test, expect } from '@playwright/test'
import { signIn } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Navigation Reachability', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, 'test@memberry.ph', 'TestPass123!')
  })

  test('officer dashboard shows officer sidebar with all sections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    // Verify officer sidebar sections exist
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Check section headers
    await expect(sidebar.getByText('MEMBERS')).toBeVisible()
    await expect(sidebar.getByText('FINANCES')).toBeVisible()
    await expect(sidebar.getByText('ACTIVITIES')).toBeVisible()
    await expect(sidebar.getByText('COMMUNICATIONS')).toBeVisible()
    await expect(sidebar.getByText('SETTINGS')).toBeVisible()
  })

  test('officer sidebar nav items link to correct routes', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside nav')

    // Verify key nav items exist and have correct hrefs
    const expectedLinks = [
      { name: 'Dashboard', path: `/org/${ORG_ID}/officer/dashboard` },
      { name: 'Roster', path: `/org/${ORG_ID}/officer/roster` },
      { name: 'Applications', path: `/org/${ORG_ID}/officer/applications` },
      { name: 'Dues Config', path: `/org/${ORG_ID}/officer/settings/dues` },
      { name: 'Payment Records', path: `/org/${ORG_ID}/officer/payments` },
      { name: 'Events', path: `/org/${ORG_ID}/officer/events` },
      { name: 'Trainings', path: `/org/${ORG_ID}/officer/training` },
      { name: 'Announcements', path: `/org/${ORG_ID}/officer/communications` },
      { name: 'Org Profile', path: `/org/${ORG_ID}/officer/settings/org` },
      { name: 'Officers', path: `/org/${ORG_ID}/officer/officers` },
    ]

    for (const { name, path } of expectedLinks) {
      const link = sidebar.getByRole('link', { name, exact: true })
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', path)
    }
  })

  test('clicking Roster in sidebar navigates to roster page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    await page.locator('aside nav').getByRole('link', { name: 'Roster', exact: true }).click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`/org/${ORG_ID}/officer/roster`))
    await expect(page.getByRole('heading', { name: /roster/i })).toBeVisible({ timeout: 10000 })
  })

  test('clicking Events in sidebar navigates to events page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    await page.locator('aside nav').getByRole('link', { name: 'Events', exact: true }).click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(new RegExp(`/org/${ORG_ID}/officer/events`))
  })

  test('officer sidebar shows user name and role', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')
    // User name should be visible (Maria Santos or similar)
    const hasName = await sidebar.getByText(/Maria|Santos/i).first().isVisible().catch(() => false)
    // Role label should be visible (President, Vice President, etc.)
    const hasRole = await sidebar.getByText(/President|Secretary|Treasurer/i).first().isVisible().catch(() => false)
    expect(hasName || hasRole).toBeTruthy()
  })

  test('member dashboard shows member sidebar, not officer sidebar', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Member sidebar has 4 items: Home, Activities, Credits, Profile
    await expect(sidebar.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Activities' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Credits' })).toBeVisible()
    await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible()

    // Should NOT have officer sections
    await expect(sidebar.getByText('MEMBERS')).not.toBeVisible()
    await expect(sidebar.getByText('FINANCES')).not.toBeVisible()
  })
})
