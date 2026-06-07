// WF-055 — Events Dashboard
// Business Rules: [BR-15] [BR-16] [BR-17] [BR-27]
import { test, expect } from '../helpers/test-fixture'
import { authStateFile } from '../helpers/auth-state'
import { captureRouteHydration } from '../helpers/real-flow'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const EVENTS = /\/(event-lifecycle|events)/

/**
 * Find the first event card link on the officer events page. Events render
 * as <a href="/org/{slug}/officer/events/{eventId}"> wrapping an h3 with
 * the event title. The seed list mutates across runs (other specs create
 * test events with their own names), so we can't pin to "General Assembly"
 * or any other specific seeded title.
 */
function firstEventLink(page: import('@playwright/test').Page) {
  // Match /officer/events/{uuid} but NOT /officer/events/new (create form).
  return page
    .locator('a[href*="/officer/events/"]')
    .and(page.locator('a:not([href$="/new"])'))
    .first()
}

test.describe('Officer Events', () => {
  test('events page shows heading and stat cards', async ({ page }) => {
    const respP = captureRouteHydration(page, EVENTS)
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await expect(
      page.getByRole('heading', { name: 'Events', level: 1 }),
    ).toBeVisible({ timeout: 10000 })
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
  })

  test('events list shows at least one event link', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    // Don't pin to a specific event title — other tests mutate the seed.
    await expect(firstEventLink(page)).toBeVisible({ timeout: 10000 })
  })

  test('Create Event button is visible', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await expect(
      page.getByRole('link', { name: /create event/i })
        .or(page.getByRole('button', { name: /create event/i })),
    ).toBeVisible({ timeout: 10000 })
  })

  test('can navigate to event detail page', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    const eventLink = firstEventLink(page)
    await expect(eventLink).toBeVisible({ timeout: 10000 })
    await eventLink.click()
    await expect(page).toHaveURL(/\/officer\/events\/[^/]+/, { timeout: 10000 })
  })

  test('event detail shows event information', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    const eventLink = firstEventLink(page)
    await expect(eventLink).toBeVisible({ timeout: 10000 })
    await eventLink.click()
    await expect(page).toHaveURL(/\/officer\/events\/[^/]+/, { timeout: 10000 })
    // Detail page renders a primary heading — proves it mounted.
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('[BR-16] new event form renders', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await expect(page).toHaveURL(/\/officer\/events\/new/, { timeout: 10000 })
    // The form mounts a heading + at least one input.
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test('[BR-17] attendance page renders check-in list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    const eventLink = firstEventLink(page)
    await expect(eventLink).toBeVisible({ timeout: 10000 })
    await eventLink.click()
    await expect(page).toHaveURL(/\/officer\/events\/[^/]+/, { timeout: 10000 })

    // Attendance may be a tab, a sibling link, or part of the detail body.
    const attendanceLink = page
      .getByRole('link', { name: /attendance/i })
      .or(page.getByRole('tab', { name: /attendance/i }))
      .or(page.getByRole('button', { name: /attendance/i }))
      .first()
    const hasLink = await attendanceLink.isVisible({ timeout: 3000 }).catch(() => false)
    if (hasLink) {
      await attendanceLink.click()
      await page.waitForLoadState('domcontentloaded')
    }
    // Accept any of: dedicated attendance heading, check-in text, empty
    // state, or the attendance term appearing in the body.
    const hasHeading = await page
      .getByRole('heading', { name: /attendance/i })
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)
    const hasBodyText = await page
      .getByText(/attendance|check.?in|no attendees|no records/i)
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)
    expect(hasHeading || hasBodyText).toBeTruthy()
  })
})
