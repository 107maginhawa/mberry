/**
 * E2E: Member detail (Slice 3) — the money-path flow over the FROZEN engine.
 *
 * Sign in → directory row → member detail → record a GCash payment (2-step confirm) →
 * it appears in the timeline → void it → renew. Stateful stubs match the handler shapes
 * (roster { data, totalCount }; getRosterMember single object; dues-payments list/record/refund).
 */
import { test, expect } from '@playwright/test'

const MEMBER = {
  id: 'm1', personId: 'p1', name: 'Maria Santos', firstName: 'Maria', lastName: 'Santos',
  status: 'active', memberNumber: '#00142', categoryName: 'Gold',
  joinedAt: '2019-05-01T00:00:00Z', duesExpiryDate: '2026-01-12T00:00:00Z', organizationId: 'o1',
}

test('officer opens a member, records a GCash payment, voids it, renews', async ({ page }) => {
  let signedIn = false
  let payments: any[] = []

  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))
  await page.route('**/association/member/tiers**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"pagination":{}}' }))
  await page.route('**/association/member/dues-invoices**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"totalCount":0}' }))

  // Roster list (…/roster) vs single member (…/roster/{id}).
  await page.route('**/association/member/roster**', (r) => {
    if (r.request().method() === 'POST') return r.fallback()
    const path = new URL(r.request().url()).pathname
    if (/\/roster\/[^/]+$/.test(path)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(MEMBER) })
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [MEMBER], totalCount: 1 }) })
  })

  // A full DuesPayment object — the record/refund response transformers coerce amount/dates,
  // so a minimal body makes them throw (mutation would silently fail).
  const fullPayment = (over: Record<string, unknown>) => ({
    id: 'pay1', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    organizationId: 'o1', personId: 'p1', invoiceId: null, receiptNumber: 'R-1', amount: 250000, currency: 'PHP',
    paymentMethod: 'gcash', referenceNumber: null, status: 'completed', recordedBy: null,
    membershipExtendedFrom: null, membershipExtendedTo: null, paidAt: new Date().toISOString(), refundedAmount: 0,
    ...over,
  })

  // Dues payments: list (GET) / record (POST) / refund (POST …/{id}/refund).
  await page.route('**/association/member/dues-payments**', (r) => {
    const method = r.request().method()
    const path = new URL(r.request().url()).pathname
    if (method === 'POST' && path.endsWith('/refund')) {
      payments = payments.map((p) => ({ ...p, status: 'refunded' }))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fullPayment({ status: 'refunded', refundedAmount: 250000 })) })
    }
    if (method === 'POST') {
      payments.push(fullPayment({}))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fullPayment({})) })
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: payments, totalCount: payments.length }) })
  })

  await page.route('**/association/member/memberships/*/renew', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm1', duesExpiryDate: '2027-01-12T00:00:00Z' }) }))

  // No paid-event registrations for this member — keep the history dues-only.
  await page.route('**/association/events/registrations**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [], totalCount: 0 }) }))

  // ── Sign in ──
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('o@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')

  // ── Directory row → detail ──
  await page.getByRole('link', { name: /view maria santos/i }).click()
  await page.waitForURL('**/members/m1')
  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible()
  await expect(page.getByText('No payments recorded yet')).toBeVisible()

  // ── Record a GCash payment (2-step confirm) ──
  await page.getByRole('button', { name: 'Record payment' }).click()
  await page.getByLabel('Amount (₱)').fill('2500')
  await page.getByLabel('Payment method').selectOption('gcash')
  await page.getByRole('button', { name: 'Review' }).click()
  await expect(page.getByText('Step 2 of 2 — confirm and record.')).toBeVisible()
  await page.getByRole('button', { name: /record payment/i }).last().click()

  // ── Payment now in the timeline ──
  await expect(page.getByText('Recorded ₱2,500.00 from Maria Santos')).toBeVisible()
  await expect(page.getByText(/Receipt R-1/)).toBeVisible() // the timeline row (receipt is unique to it)

  // ── Void it ──
  await page.getByRole('button', { name: /void \/ refund/i }).click()
  await page.getByRole('button', { name: 'Void payment' }).click()
  // exact: the badge is "Voided"; the toast "Payment voided" would otherwise also match.
  await expect(page.getByText('Voided', { exact: true })).toBeVisible()

  // ── Renew ──
  await page.getByRole('button', { name: 'Renew' }).click()
  await page.getByRole('button', { name: 'Renew membership' }).click()
  await expect(page.getByText('Membership renewed')).toBeVisible()
})

test('member history merges a dues payment and a paid-event payment chronologically', async ({ page }) => {
  let signedIn = false
  const ISO = '2026-01-01T00:00:00Z'

  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))
  await page.route('**/association/member/tiers**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"pagination":{}}' }))
  await page.route('**/association/member/dues-invoices**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"totalCount":0}' }))
  await page.route('**/association/member/roster**', (r) => {
    if (r.request().method() === 'POST') return r.fallback()
    const path = new URL(r.request().url()).pathname
    if (/\/roster\/[^/]+$/.test(path)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(MEMBER) })
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [MEMBER], totalCount: 1 }) })
  })

  // One dues payment (Feb).
  await page.route('**/association/member/dues-payments**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{
      id: 'pay1', version: 1, createdAt: ISO, updatedAt: ISO, organizationId: 'o1', personId: 'p1', invoiceId: null,
      receiptNumber: 'R-1', amount: 250000, currency: 'PHP', paymentMethod: 'gcash', referenceNumber: null,
      status: 'completed', recordedBy: null, membershipExtendedFrom: null, membershipExtendedTo: null,
      paidAt: '2026-02-01T00:00:00Z', refundedAmount: 0,
    }], totalCount: 1 }) }))

  // One settled paid-event registration (Mar) + the event it points at.
  await page.route('**/association/events/registrations**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{
      id: 'er1', version: 1, createdAt: ISO, updatedAt: ISO, organizationId: 'o1', eventId: 'ev1', personId: 'p1',
      status: 'confirmed', registeredAt: ISO, paidAt: '2026-03-01T00:00:00Z',
    }], totalCount: 1 }) }))
  await page.route('**/association/events/ev1', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({
      id: 'ev1', version: 1, createdAt: ISO, updatedAt: ISO, organizationId: 'o1', title: 'Annual Gala',
      eventType: 'assembly', startDate: '2026-03-01T00:00:00Z', endDate: '2026-03-01T06:00:00Z', status: 'completed',
      registrationFee: 50000, currency: 'PHP', visibility: 'internal', creditBearing: false,
    }) }))

  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('o@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')
  await page.goto('/members/m1')

  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible()
  // Both payments appear, the event tagged + read-only.
  await expect(page.getByText(/Annual Gala/)).toBeVisible()
  await expect(page.getByText('Event', { exact: true })).toBeVisible()
  await expect(page.getByText('₱500.00')).toBeVisible()
  await expect(page.getByText('₱2,500.00')).toBeVisible()
})
