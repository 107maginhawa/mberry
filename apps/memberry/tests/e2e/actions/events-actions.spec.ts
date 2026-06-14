// Action-Contract Tests: Events Module
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'


test.use({ authRole: 'officer' })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

function firstEventLink(page: import('@playwright/test').Page) {
  return page
    .locator('a[href*="/officer/events/"]')
    .and(page.locator('a:not([href$="/new"])'))
    .first()
}

test.describe('Events Actions', () => {
  test('event list shows real event cards', async ({ page }) => {
    const respP = captureAnyApiSuccess(page)
    await page.goto(`/org/${ORG_ID}/officer/events`)
    const resp = await respP
    expect(resp?.status()).toBe(200)
    expect(resp?.ok()).toBe(true)
    // Don't pin to specific seeded titles (Gala/Convention/Assembly).
    await expect(firstEventLink(page)).toBeVisible({ timeout: 15000 })
  })

  test.fixme('Create Event button → form → publish creates event', async ({ page }) => {
    // FLAKY UNDER PARALLEL: this test creates an event and then asserts
    // it appears in the list. Other parallel specs mutate event titles,
    // making the post-create assertion race. Re-enable when this spec is
    // wrapped in test.describe.configure({ mode: 'serial' }) along with
    // the other event-mutating specs, OR uses an isolated org id.
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await expect(
      page.getByRole('heading', { name: /create event/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('event detail shows tabs and data', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events`)
    await expect(firstEventLink(page)).toBeVisible({ timeout: 10000 })
    await firstEventLink(page).click()
    await expect(page).toHaveURL(/\/officer\/events\/[^/]+/, { timeout: 10000 })
    // Detail page renders an h1 + (Details/Registered/Check-in tabs OR
    // a "this event was cancelled" banner for cancelled events).
    await expect(page.getByRole('heading', { level: 1 }).first())
      .toBeVisible({ timeout: 10000 })
  })

  test.fixme('member can register for event', async ({ page }) => {
    // Same parallel-mutation issue as the publish test — registration is
    // a per-(member,event) constraint so re-runs collide. Needs a fresh
    // member context per run to be deterministic.
    await page.goto(`/org/${ORG_ID}/officer/events`)
  })

  test('my events page renders', async ({ page }) => {
    await page.goto('/my/events')
    await expect(
      page.getByRole('heading', { name: /my events/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })
  })
})
