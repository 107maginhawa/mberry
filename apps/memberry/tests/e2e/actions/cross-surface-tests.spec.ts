// Phase 3: Cross-surface consistency tests
// Verifies data created in one view appears in another
import { test, expect } from '../helpers/test-fixture'
import { signIn } from '../helpers/auth'
import { apiFetch } from '../helpers/api-fetch'
import { withIsolatedFixture } from '../helpers/isolated-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { expectVisibleOnPage } from '../helpers/persistence'

test.describe('Cross-Surface Consistency', () => {
  // F3: spin up a fresh org per run. Event + announcement creates here
  // would otherwise poison the shared pda-metro-manila list assertions
  // in officer/events.spec.ts and officer/communications.spec.ts.
  // Teardown via withIsolatedFixture's afterAll deletes the org + all
  // child rows (events/announcements/etc.) — replaces the old
  // cleanupAnnouncements timestamp-regex pass that left orphans on
  // mid-run failure.
  const fx = withIsolatedFixture(test, { memberCount: 1 })

  test('event created by officer appears in event list', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const eventName = `CrossSurface Event ${Date.now()}`
    const orgId = fx().orgId

    // Create event via apiFetch (handles CSRF + Origin). Cross-surface
    // persistence (the invariant under test) is independent of how the
    // date is captured in the UI.
    const start = new Date()
    start.setDate(start.getDate() + 21)
    start.setHours(9, 0, 0, 0)
    const end = new Date(start)
    end.setHours(17, 0, 0, 0)

    await page.goto(`/org/${orgId}/officer/events`) // SPA origin for apiFetch
    const created = await apiFetch<{ id?: string; data?: { id?: string } }>(
      page,
      '/association/events',
      {
        method: 'POST',
        orgId,
        body: {
          title: eventName,
          organizationId: orgId,
          eventType: 'assembly',
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          visibility: 'internal',
          creditBearing: false,
          registrationFee: 0,
        },
      },
    )
    expect(
      created.status,
      `create failed: ${JSON.stringify(created.data).slice(0, 300)}`,
    ).toBeLessThan(400)
    const eventId = created.data?.id ?? created.data?.data?.id
    if (eventId) {
      await apiFetch(page, `/association/events/${eventId}/publish`, {
        method: 'POST',
        orgId,
        body: {},
      })
    }

    await expectVisibleOnPage(page, `/org/${orgId}/officer/events`, eventName)
  })

  test('announcement created as draft appears in list', async ({ page }) => {
    await signIn(page, SEED_OFFICER_EMAIL, TEST_PASSWORD)
    const title = `CrossSurface Ann ${Date.now()}`
    const orgId = fx().orgId

    await page.goto(`/org/${orgId}/officer/communications/new`)
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

    await page.goto(`/org/${orgId}/officer/communications`)
    const draftsTab = page.getByRole('button', { name: /Drafts/i }).or(page.getByText(/Drafts/i))
    if (await draftsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await draftsTab.click()
      await page.waitForTimeout(1000)
    }
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 10000 })
  })

  // F3 cleanup is now handled by withIsolatedFixture's afterAll teardown —
  // the explicit cleanupAnnouncements pass is no longer required.
})
