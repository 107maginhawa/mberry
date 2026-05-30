// Phase 3: Cross-surface consistency tests
// Verifies data created in one view appears in another
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { cleanupAnnouncements } from '../helpers/fixtures'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectVisibleOnPage } from '../helpers/persistence'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Cross-Surface Consistency', () => {
  test('event created by officer appears in event list', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const eventName = `CrossSurface Event ${Date.now()}`

    // Create event via the API surface exposed to the officer (Vite proxy → backend).
    // The events form uses a popover-driven DateTimePicker; cross-surface persistence
    // (the invariant under test) is independent of how the date is captured.
    const created = await page.evaluate(async ({ orgId, name }) => {
      const start = new Date()
      start.setDate(start.getDate() + 21)
      start.setHours(9, 0, 0, 0)
      const end = new Date(start)
      end.setHours(17, 0, 0, 0)
      const r = await fetch(`/api/association/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        credentials: 'include',
        body: JSON.stringify({
          title: name,
          organizationId: orgId,
          eventType: 'assembly',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          visibility: 'internal',
          creditBearing: false,
          registrationFee: 0,
        }),
      })
      if (!r.ok) return { status: r.status, body: await r.text(), id: null as string | null }
      const created = await r.json()
      const id = created?.data?.id ?? created?.id ?? null
      // Publish so the event surfaces in the default "Upcoming" tab
      if (id) {
        await fetch(`/api/association/events/${id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
          credentials: 'include',
          body: '{}',
        })
      }
      return { status: r.status, body: '', id }
    }, { orgId: ORG_ID, name: eventName })
    expect(created.status, `create failed: ${created.body.slice(0, 300)}`).toBeLessThan(400)

    // Verify appears in officer event list (UI surface — the real cross-surface read path)
    await expectVisibleOnPage(page, `/org/${ORG_ID}/officer/events`, eventName)
  })

  test('announcement created as draft appears in list', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const title = `CrossSurface Ann ${Date.now()}`

    await page.goto(`/org/${ORG_ID}/officer/communications/new`)
    await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 10000 })
    await page.getByRole('textbox', { name: /Title/i }).first().fill(title)

    const msgInput = page.locator('textarea').first()
    if (await msgInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await msgInput.fill('Cross surface test body')
    }

    const responsePromise = page.waitForResponse(
      resp => resp.request().method() === 'POST' && resp.url().includes('/communications/announcements/'),
      { timeout: 15000 }
    ).catch(() => null)

    await page.getByRole('button', { name: /Save Draft/i }).click()
    await responsePromise

    // Verify appears in communications list
    await page.goto(`/org/${ORG_ID}/officer/communications`)
    // Look in Drafts tab
    const draftsTab = page.getByRole('button', { name: /Drafts/i }).or(page.getByText(/Drafts/i))
    if (await draftsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await draftsTab.click()
      await page.waitForTimeout(1000)
    }
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  })

  test('cleanup: remove cross-surface test announcements', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    await cleanupAnnouncements(page, ORG_ID, /^CrossSurface Ann/)
    await cleanupAnnouncements(page, ORG_ID, /^CrossSurface Event/)
  })
})
