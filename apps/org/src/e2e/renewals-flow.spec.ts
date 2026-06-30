/**
 * E2E: Renewals view (Slice 7b) — real officer flow over the FROZEN engine.
 * Sign in → More → Renewals → the due-soon / grace / lapsed buckets render; tap a member → detail.
 * Dates are computed in-spec (relative to the real clock) so "due soon" is deterministic.
 */
import { test, expect } from '@playwright/test'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

test('officer reviews renewals and opens a member', async ({ page }) => {
  let signedIn = false
  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))

  // Roster list (…/roster) vs single member (…/roster/{id}) — the latter for the detail tap.
  await page.route('**/association/member/roster**', (r) => {
    const path = new URL(r.request().url()).pathname
    if (/\/roster\/[^/]+$/.test(path)) {
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'm1', personId: 'p1', name: 'Maria Santos', status: 'active', memberNumber: 'A-1', joinedAt: inDays(-2000), duesExpiryDate: inDays(10), organizationId: 'o1' }) })
    }
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [
      { id: 'm1', personId: 'p1', name: 'Maria Santos', status: 'active', memberNumber: 'A-1', duesExpiryDate: inDays(10) }, // due soon
      { id: 'm2', personId: 'p2', name: 'Jose Cruz', status: 'gracePeriod', memberNumber: 'A-2', duesExpiryDate: inDays(-5) }, // grace
      { id: 'm3', personId: 'p3', name: 'Ana Reyes', status: 'lapsed', memberNumber: 'A-3', duesExpiryDate: inDays(-60) }, // lapsed
      { id: 'm4', personId: 'p4', name: 'Bea Tan', status: 'active', memberNumber: 'A-4', duesExpiryDate: inDays(300) }, // not shown
    ], totalCount: 4 }) })
  })
  await page.route('**/association/member/dues-invoices**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"totalCount":0}' }))
  await page.route('**/association/member/dues-payments**', (r) => r.fulfill({ contentType: 'application/json', body: '{"data":[],"totalCount":0}' }))

  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('o@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')

  await page.getByRole('link', { name: 'More' }).click()
  await page.waitForURL('/more')
  await page.getByRole('link', { name: /renewals/i }).click()
  await page.waitForURL('/renewals')

  // Buckets render with the right members; the far-future member is excluded.
  await expect(page.getByText('Due soon (1)')).toBeVisible()
  await expect(page.getByText('In grace (1)')).toBeVisible()
  await expect(page.getByText('Lapsed (1)')).toBeVisible()
  await expect(page.getByText('Maria Santos')).toBeVisible()
  await expect(page.getByText('Bea Tan')).toHaveCount(0)

  // Tap a member → their detail.
  await page.getByRole('link', { name: 'View Maria Santos' }).click()
  await page.waitForURL('**/members/m1')
  await expect(page.getByRole('heading', { name: 'Maria Santos' })).toBeVisible()
})
