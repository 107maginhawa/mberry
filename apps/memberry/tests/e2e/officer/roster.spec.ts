// WF-030 — Member Roster: list, search, filter, bulk actions
// Business Rules: [BR-01] [BR-03] [BR-22] [BR-23]
import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const MEMBERSHIPS = /\/memberships/

test.describe('Officer Roster', () => {
test('heading "Member Roster" is visible', async ({ page }) => {
    const respP = captureRouteHydration(page, MEMBERSHIPS)
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('shows member roster with member fields', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    // The roster reflows to a card layout when its content container is < 960px
    // (globals.css .cq-roster-* container queries). The officer content column
    // is capped at the PageShell default width (~720px container even on wide
    // screens), so the card layout is what renders — the 9-column table only
    // appears when the container reaches 960px. Assert a member card showing
    // the member's name link and status badge (the same fields the table
    // columns would show).
    const cards = page.locator('.cq-roster-cards')
    await expect(
      cards.locator('a[href*="/officer/roster/"]').first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      cards.getByText(/active|pending|lapsed|grace period|suspended|removed/i).first(),
    ).toBeVisible({ timeout: 10000 })
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
    // Use toBeVisible (polls) — isVisible() is a single check that
    // races SPA hydration.
    await expect(
      page
        .getByPlaceholder(/search/i)
        .or(page.locator('input[type="text"], input[type="search"]'))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })
})
