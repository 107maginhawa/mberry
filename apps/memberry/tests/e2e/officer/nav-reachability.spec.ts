// Business Rules: [BR-09]
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer Navigation Reachability', () => {
  test('officer dashboard shows officer sidebar with all sections', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Section labels render as uppercase tracking spans (officer-sidebar
    // .tsx). Use exact-match so we don't collide with the "Members" link.
    for (const section of ['MEMBERS', 'FINANCES', 'ACTIVITIES', 'COMMUNICATIONS', 'SETTINGS']) {
      await expect(sidebar.getByText(section, { exact: true }).first())
        .toBeVisible({ timeout: 10000 })
    }
  })

  test('officer sidebar nav items link to correct routes', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const sidebar = page.locator('aside nav').first()

    // Nav matches current officer-sidebar render. Note: sidebar links
    // use the org's *slug* in their href (pda-metro-manila), even when
    // the user landed via UUID — the /_authenticated/org/$orgSlug
    // beforeLoad rewrites the URL. So we match on the path *suffix*,
    // not the full UUID-prefixed path.
    const expectedLinks: Array<{ name: string; suffix: string }> = [
      { name: 'Dashboard', suffix: '/officer/dashboard' },
      { name: 'Roster', suffix: '/officer/roster' },
      { name: 'Applications', suffix: '/officer/applications' },
      { name: 'Payments', suffix: '/officer/payments' },
      { name: 'Events', suffix: '/officer/events' },
      { name: 'Trainings', suffix: '/officer/training' },
      { name: 'Announcements', suffix: '/officer/communications' },
    ]

    for (const { name, suffix } of expectedLinks) {
      const link = sidebar.getByRole('link', { name, exact: true }).first()
      await expect(link).toBeVisible({ timeout: 10000 })
      await expect(link).toHaveAttribute('href', new RegExp(`${suffix}$`))
    }
  })

  test('clicking Roster in sidebar navigates to roster page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.locator('aside nav').first()
      .getByRole('link', { name: 'Roster', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/officer/roster`), { timeout: 10000 })
    await expect(page.getByRole('heading', { name: /roster/i }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('clicking Events in sidebar navigates to events page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    await page.locator('aside nav').first()
      .getByRole('link', { name: 'Events', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`/officer/events`), { timeout: 10000 })
  })

  test('officer sidebar shows user name and role', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dashboard`)
    const sidebar = page.locator('aside').first()
    // Footer area shows the user's role label (e.g. "President"). User
    // name may be PII-redacted in some flows — keep the OR check.
    await expect(
      sidebar
        .getByText(/President|Secretary|Treasurer|Vice/i)
        .or(sidebar.getByText(/maria|santos|reyes|cruz/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('member dashboard shows member sidebar, not officer sidebar', async ({ page }) => {
    await page.goto('/dashboard')
    const sidebar = page.locator('aside').last()
    await expect(sidebar).toBeVisible({ timeout: 10000 })

    // Current member sidebar links: Home, My Events, My Calendar, My Bookings,
    // Credits, Certificates, Digital ID, Payments, Billing, My Schedule,
    // My Surveys, Profile, Data Export, Settings.
    await expect(sidebar.getByRole('link', { name: 'Home', exact: true }).first())
      .toBeVisible({ timeout: 10000 })
    await expect(sidebar.getByRole('link', { name: 'Credits', exact: true }).first())
      .toBeVisible({ timeout: 10000 })
    await expect(sidebar.getByRole('link', { name: 'Profile', exact: true }).first())
      .toBeVisible({ timeout: 10000 })

    // Member sidebar should NOT have officer-specific links like Roster
    // or Applications (those are officer-only nav items).
    await expect(sidebar.getByRole('link', { name: 'Roster', exact: true }))
      .toHaveCount(0)
    await expect(sidebar.getByRole('link', { name: 'Applications', exact: true }))
      .toHaveCount(0)
  })
})
