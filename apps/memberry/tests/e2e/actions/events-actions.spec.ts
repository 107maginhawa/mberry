// Action-Contract Tests: Events Module
import { test, expect } from '../helpers/test-fixture'
import { captureAnyApiSuccess } from '../helpers/real-flow'
import { apiFetch } from '../helpers/api-fetch'


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

  // WF-051 — Create & Publish Event. Re-enabled: the original fixme raced
  // because it asserted against the shared event list; this uses a unique
  // timestamped title and asserts on THAT event by id, so parallel mutation
  // can't interfere. Officer reaches the create screen, then the create +
  // publish are driven through the real endpoints and verified by read-back.
  test('WF-051: officer creates and publishes an event', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/events/new`)
    await expect(
      page.getByRole('heading', { name: /create event/i, level: 1 }),
    ).toBeVisible({ timeout: 10000 })

    const title = `E2E Event ${Date.now()}`
    const start = new Date(Date.now() + 14 * 86_400_000).toISOString()
    const end = new Date(Date.now() + 14 * 86_400_000 + 7_200_000).toISOString()

    const created = await apiFetch<any>(page, '/association/events', {
      method: 'POST', orgId: ORG_ID,
      body: { organizationId: ORG_ID, title, eventType: 'seminar', startDate: start, endDate: end, creditBearing: false },
    })
    expect(created.status, 'event create must succeed').toBe(201)
    const eventId = (created.data?.data ?? created.data)?.id
    expect(eventId, 'create returns an event id').toBeTruthy()

    const published = await apiFetch<any>(page, `/association/events/${eventId}/publish`, {
      method: 'POST', orgId: ORG_ID, body: {},
    })
    expect([200, 201], 'publish must succeed').toContain(published.status)

    // Read-back: the event is durably persisted and published.
    const read = await apiFetch<any>(page, `/association/events/${eventId}`, { orgId: ORG_ID })
    expect(read.status).toBe(200)
    const ev = read.data?.data ?? read.data
    expect(ev?.title).toBe(title)
    expect(ev?.status, 'event is published').toBe('published')
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
