// WF-117 — Booking real-flow: a member books a real generated slot end-to-end,
// and the host confirm/reject state machine + slot release are proven against
// real persisted data (not headings). Replaces the conditional "if a host card
// exists" branches in booking-flow / booking-host-actions, which assert nothing.
//
// Slots are generated when the booking event is created (createBookingEvent →
// regenerateEventSlots), so we seed availability via the real API (CSRF-aware
// apiFetch) with minBookingMinutes:0 so near-future slots are immediately
// bookable, then drive book → confirm → reject through the real endpoints and
// assert the real persisted booking + slot state. Cleans up to stay idempotent.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

const ORG = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Slot generation (jobs/slotGenerator.ts dayMapping) keys days by 3-letter
// abbreviations — full names like 'monday' silently generate zero slots.
const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const dailyConfigs = Object.fromEntries(
  ALL_DAYS.map((d) => [d, { enabled: true, timeBlocks: [{ startTime: '09:00', endTime: '12:00', slotDuration: 30, bufferTime: 0 }] }]),
)

// Flexible unwrap: handlers return either the row directly or a {data} envelope.
const unwrap = (d: unknown): any => (d as any)?.data ?? d

async function seedEventWithSlots(page: any, title: string): Promise<{ eventId: string; slotId: string }> {
  const created = await apiFetch<any>(page, '/booking/events', {
    method: 'POST', orgId: ORG,
    body: { title, timezone: 'Asia/Manila', locationTypes: ['video'], status: 'active', minBookingMinutes: 0, maxBookingDays: 60, dailyConfigs },
  })
  expect(created.status, 'create booking event').toBe(201)
  const eventId = unwrap(created.data)?.id
  expect(eventId, 'event id returned').toBeTruthy()

  const slotsRes = await apiFetch<any>(page, `/booking/events/${eventId}/slots?status=available`, { orgId: ORG })
  expect(slotsRes.status, 'list available slots').toBe(200)
  const slots = unwrap(slotsRes.data)
  expect(Array.isArray(slots) && slots.length, 'event has generated available slots').toBeTruthy()
  return { eventId, slotId: slots[0].id }
}

test.use({ authRole: 'member' })

test.describe('Booking real-flow (real persisted data)', () => {
  test('member books a real available slot → booking persists as pending + slot is consumed (s5)', async ({ page }) => {
    await page.goto('/my/bookings') // establish SPA origin + session for apiFetch
    const { eventId, slotId } = await seedEventWithSlots(page, `E2E Book ${Date.now()}`)

    const booked = await apiFetch<any>(page, '/booking/bookings', {
      method: 'POST', orgId: ORG, body: { slot: slotId, locationType: 'video' },
    })
    expect(booked.status, 'create booking').toBe(201)
    const bookingId = unwrap(booked.data)?.id
    expect(bookingId).toBeTruthy()
    expect(unwrap(booked.data)?.status).toBe('pending')

    // Real persisted state: it appears in the bookings list as pending.
    const list = await apiFetch<any>(page, '/booking/bookings', { orgId: ORG })
    const rows = unwrap(list.data)
    const mine = (rows as any[]).find((b) => b.id === bookingId)
    expect(mine, 'booking appears in the list').toBeTruthy()
    expect(mine.status).toBe('pending')

    // The slot is consumed: it no longer appears among available slots.
    const after = await apiFetch<any>(page, `/booking/events/${eventId}/slots?status=available`, { orgId: ORG })
    const afterSlots = unwrap(after.data) as any[]
    expect(afterSlots.find((s) => s.id === slotId), 'booked slot no longer offered').toBeUndefined()

    await apiFetch(page, `/booking/events/${eventId}`, { method: 'DELETE', orgId: ORG })
  })

  test('host confirms a pending booking → confirmed; rejects another → rejected + slot released (s6)', async ({ page }) => {
    await page.goto('/my/bookings')

    // --- confirm path ---
    const a = await seedEventWithSlots(page, `E2E Confirm ${Date.now()}`)
    const b1 = await apiFetch<any>(page, '/booking/bookings', { method: 'POST', orgId: ORG, body: { slot: a.slotId, locationType: 'video' } })
    expect(b1.status).toBe(201)
    const booking1 = unwrap(b1.data)?.id

    const confirmed = await apiFetch<any>(page, `/booking/bookings/${booking1}/confirm`, { method: 'POST', orgId: ORG, body: {} })
    expect(confirmed.status, 'confirm transition').toBe(200)
    const getC = await apiFetch<any>(page, `/booking/bookings/${booking1}`, { orgId: ORG })
    expect(unwrap(getC.data)?.status, 'booking is confirmed').toBe('confirmed')

    // --- reject path (slot release) ---
    const c = await seedEventWithSlots(page, `E2E Reject ${Date.now()}`)
    const b2 = await apiFetch<any>(page, '/booking/bookings', { method: 'POST', orgId: ORG, body: { slot: c.slotId, locationType: 'video' } })
    expect(b2.status).toBe(201)
    const booking2 = unwrap(b2.data)?.id

    const rejected = await apiFetch<any>(page, `/booking/bookings/${booking2}/reject`, { method: 'POST', orgId: ORG, body: { reason: 'host unavailable' } })
    expect(rejected.status, 'reject transition').toBe(200)
    const getR = await apiFetch<any>(page, `/booking/bookings/${booking2}`, { orgId: ORG })
    expect(unwrap(getR.data)?.status, 'booking is rejected').toBe('rejected')

    // The rejected booking's slot is released → available again.
    const reAvail = await apiFetch<any>(page, `/booking/events/${c.eventId}/slots?status=available`, { orgId: ORG })
    const reSlots = unwrap(reAvail.data) as any[]
    expect(reSlots.find((s) => s.id === c.slotId), 'rejected slot is re-offered').toBeTruthy()

    await apiFetch(page, `/booking/events/${a.eventId}`, { method: 'DELETE', orgId: ORG })
    await apiFetch(page, `/booking/events/${c.eventId}`, { method: 'DELETE', orgId: ORG })
  })
})
