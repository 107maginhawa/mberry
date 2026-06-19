// WF-115 — Create Booking Event: a provider configures an availability template.
// Booking events are org-scoped (the create endpoint requires org context), so
// this drives the real create with the org header + reads it back. Cleans up to
// stay idempotent. (The /my/schedule UI does not yet supply org context on the
// /my/* surface — a separate flagged gap — so the action is driven via the API.)
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'member' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-115: provider creates a booking schedule', () => {
  test('provider publishes an availability template (durable read-back)', async ({ page }) => {
    await page.goto('/my/schedule')
    await expect(page.getByRole('heading', { name: /schedule|availability/i }).first()).toBeVisible({ timeout: 15000 })

    const title = `E2E Schedule ${Date.now()}`
    const created = await apiFetch<any>(page, '/booking/events', {
      method: 'POST', orgId: ORG_ID,
      body: {
        title, timezone: 'Asia/Manila', locationTypes: ['video'], status: 'active',
        dailyConfigs: { monday: { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '17:00', slotDuration: 30, bufferTime: 0 }] } },
      },
    })
    expect(created.status, 'booking event create must succeed').toBe(201)
    const eventId = (created.data?.data ?? created.data)?.id
    expect(eventId, 'create returns an event id').toBeTruthy()

    const mine = await apiFetch<any>(page, '/booking/events/me', { orgId: ORG_ID })
    expect(mine.status, 'owner schedule is readable').toBe(200)
    expect((mine.data?.data ?? mine.data)?.title).toBe(title)

    await apiFetch(page, `/booking/events/${eventId}`, { method: 'DELETE', orgId: ORG_ID })
  })
})
