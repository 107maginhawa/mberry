/**
 * E2E: Event detail / door check-in (Slice 5) — real officer flow over the FROZEN engine.
 *
 * Deep-link a published paid event → see attendees with paid/RSVP status → check one in
 * (row flips, summary updates) → mark another no-show. Stateful stubs; full handler shapes
 * so the SDK response transformers don't choke. No paidAt — paid = amountPaid>0/paymentId.
 */
import { test, expect } from '@playwright/test'

const ISO = '2026-01-01T00:00:00Z'
const EVENT = {
  id: 'e1', version: 1, createdAt: ISO, updatedAt: ISO, title: 'Annual Assembly', organizationId: 'o1',
  eventType: 'assembly', startDate: '2026-03-14T02:00:00Z', endDate: '2026-03-14T08:00:00Z', location: 'Manila',
  status: 'published', registrationFee: 50000, currency: 'PHP', registeredCount: 2, waitlistCount: 0,
  visibility: 'internal', creditBearing: false, capacity: 100,
}
const reg = (o: Record<string, unknown>) => ({
  id: 'r', version: 1, createdAt: ISO, updatedAt: ISO, eventId: 'e1', personId: 'p', registeredAt: ISO,
  status: 'confirmed', amountPaid: 0, paymentId: null, ...o,
})
const checkin = (o: Record<string, unknown>) => ({
  id: 'c1', version: 1, createdAt: ISO, updatedAt: ISO, eventId: 'e1', registrationId: 'r1', personId: 'p1',
  checkedInAt: ISO, method: 'manual', ...o,
})

test('officer runs the door: sees paid status, checks in, marks no-show', async ({ page }) => {
  let signedIn = false
  let regs = [
    reg({ id: 'r1', personId: 'p1', status: 'confirmed', amountPaid: 50000, paymentId: 'pay1' }),
    reg({ id: 'r2', personId: 'p2', status: 'confirmed', amountPaid: 0, paymentId: null }),
  ]
  let checkins: any[] = []

  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))
  await page.route('**/association/member/roster**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [
      { personId: 'p1', name: 'Maria Santos', memberNumber: 'A-1' },
      { personId: 'p2', firstName: 'Jose', lastName: 'Cruz', memberNumber: 'A-2' },
    ], totalCount: 2 }) }))

  // Registrations list + door check-in live under /association/event-lifecycle/{eventId}/…
  await page.route('**/association/event-lifecycle/**', (r) => {
    const path = new URL(r.request().url()).pathname
    const m = r.request().method()
    if (path.endsWith('/registrations/summary') && m === 'GET') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ totalAttending: 2, paid: 1, checkedIn: 1, noShow: 0 }) })
    if (path.endsWith('/registrations') && m === 'GET') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: regs, total: regs.length, limit: 200, offset: 0 }) })
    if (path.endsWith('/check-in') && m === 'POST') { checkins.push(checkin({})); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(checkin({})) }) }
    return r.fallback()
  })

  // getEvent, searchCheckIns, and no-show (PATCH) live under /association/events/…
  await page.route('**/association/events/**', (r) => {
    const path = new URL(r.request().url()).pathname
    const m = r.request().method()
    if (path.includes('/checkins') && m === 'GET') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: checkins, total: checkins.length, limit: 200, offset: 0 }) })
    if (path.endsWith('/mark-paid') && m === 'POST') { regs = regs.map((x) => (x.id === 'r2' ? { ...x, paidAt: ISO } : x)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(regs.find((x) => x.id === 'r2')) }) }
    if (path.includes('/registrations/') && m === 'PATCH') { regs = regs.map((x) => (x.id === 'r2' ? { ...x, status: 'noShow' } : x)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(regs.find((x) => x.id === 'r2')) }) }
    // getEvent — suffix match (requests carry the /api proxy prefix); checkins handled above.
    if (m === 'GET' && /\/association\/events\/[^/]+$/.test(path)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(EVENT) })
    return r.fallback()
  })

  // ── Sign in, then deep-link the event detail ──
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('o@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')
  await page.goto('/events/e1')

  // ── Header + attendees with paid status ──
  await expect(page.getByRole('heading', { name: 'Annual Assembly' })).toBeVisible()
  // Count summary comes from the server endpoint (accurate beyond the 100-row page).
  await expect(page.getByText('2 attending · 1 paid · 1 checked in')).toBeVisible()
  // Filter by member number too — Sonner toasts are <li> and contain the member name,
  // which would otherwise make these row locators ambiguous after a toast fires.
  const maria = page.locator('li').filter({ hasText: 'Maria Santos' }).filter({ hasText: 'A-1' })
  const jose = page.locator('li').filter({ hasText: 'Jose Cruz' }).filter({ hasText: 'A-2' })
  await expect(maria.getByText('Paid')).toBeVisible()
  await expect(jose.getByText('Unpaid')).toBeVisible()

  // ── Check Maria in → row flips to Checked in ──
  await maria.getByRole('button', { name: 'Check in' }).click()
  await expect(page.getByText('Checked in Maria Santos')).toBeVisible() // toast
  await expect(maria.getByText('Checked in')).toBeVisible()

  // ── Record Jose's walk-up cash → confirm step → row flips Paid ──
  await jose.getByRole('button', { name: 'Record cash payment' }).click()
  await page.getByRole('button', { name: 'Record payment' }).click()
  await expect(jose.getByText('Paid')).toBeVisible()

  // ── Mark Jose no-show ──
  await jose.getByRole('button', { name: 'No-show' }).click()
  await expect(jose.getByText('No-show')).toBeVisible()
})
