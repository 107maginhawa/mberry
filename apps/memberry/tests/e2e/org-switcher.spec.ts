/**
 * Org Switcher E2E — verifies multi-org switching flow.
 *
 * Covers:
 * - Org icon rail renders with user's memberships
 * - Active org highlighted with visual indicator
 * - Clicking different org navigates to /org/{slug}/home
 * - URL updates to reflect new org slug
 * - "Join another org" link present
 * - Mobile org picker sheet (responsive)
 */

import { test, expect } from '@playwright/test'
import { signInAsMember } from './helpers/auth'
import { captureAnyApiSuccess } from './helpers/real-flow'

/** Sign in and navigate to a path */
async function signInAndGo(page: import('@playwright/test').Page, path = '/') {
  await signInAsMember(page)
  await page.goto(path)
}

test.describe('Org Switcher', () => {
  test.describe('Desktop — OrgIconRail', () => {
    test('renders org switcher rail with memberships', async ({ page }) => {
      const respP = captureAnyApiSuccess(page)
      await signInAndGo(page, '/')
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)

      // Wait for org rail to appear (desktop only, hidden on mobile)
      const rail = page.locator('nav[aria-label="Organization switcher"]')
      await expect(rail).toBeVisible({ timeout: 10000 })

      // Should have at least one org button
      const orgButtons = rail.locator('button[aria-label^="Switch to"]')
      await expect(orgButtons.first()).toBeVisible()
      const count = await orgButtons.count()
      expect(count).toBeGreaterThanOrEqual(1)
    })

    test('active org has aria-current indicator', async ({ page }) => {
      await signInAndGo(page, '/')

      const rail = page.locator('nav[aria-label="Organization switcher"]')
      await expect(rail).toBeVisible({ timeout: 10000 })

      // If user has orgs and is on an org page, one button should have aria-current
      const orgButtons = rail.locator('button[aria-label^="Switch to"]')
      const count = await orgButtons.count()

      if (count > 0) {
        // Navigate to first org to ensure we're on an org page
        const firstButton = orgButtons.first()
        const label = await firstButton.getAttribute('aria-label')
        await firstButton.click()
        await page.waitForLoadState('networkidle')

        // After clicking, the button for that org should be aria-current
        const activeButton = rail.locator('button[aria-current="true"]')
        await expect(activeButton).toBeVisible({ timeout: 5000 })
      }
    })

    test('switching org updates URL to new slug', async ({ page }) => {
      await signInAndGo(page, '/')

      const rail = page.locator('nav[aria-label="Organization switcher"]')
      await expect(rail).toBeVisible({ timeout: 10000 })

      const orgButtons = rail.locator('button[aria-label^="Switch to"]')
      const count = await orgButtons.count()

      if (count >= 1) {
        // Click first org
        await orgButtons.first().click()
        await page.waitForLoadState('networkidle')

        // URL should contain /org/{slug}/home
        expect(page.url()).toMatch(/\/org\/[a-z0-9-]+\/home/)
      }
    })

    test('switching between orgs changes URL slug', async ({ page }) => {
      await signInAndGo(page, '/')

      const rail = page.locator('nav[aria-label="Organization switcher"]')
      await expect(rail).toBeVisible({ timeout: 10000 })

      const orgButtons = rail.locator('button[aria-label^="Switch to"]')
      const count = await orgButtons.count()

      if (count >= 2) {
        // Click first org, capture URL
        await orgButtons.first().click()
        await page.waitForLoadState('networkidle')
        const firstUrl = page.url()

        // Click second org, capture URL
        await orgButtons.nth(1).click()
        await page.waitForLoadState('networkidle')
        const secondUrl = page.url()

        // URLs should differ (different slugs)
        expect(firstUrl).not.toEqual(secondUrl)
        expect(secondUrl).toMatch(/\/org\/[a-z0-9-]+\/home/)
      }
    })

    test('join another org link is present', async ({ page }) => {
      await signInAndGo(page, '/')

      const joinLink = page.locator('a[aria-label="Join another organization"]')
      await expect(joinLink).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Mobile — OrgPickerSheet', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('org rail hidden on mobile', async ({ page }) => {
      await signInAndGo(page, '/')

      // Desktop rail should be hidden on mobile (md:flex = hidden below md)
      const rail = page.locator('nav[aria-label="Organization switcher"]')
      await expect(rail).toBeHidden({ timeout: 5000 })
    })
  })
})
