/**
 * E2E: CSV export (Slice 7a) — real officer flow over the FROZEN engine.
 * Sign in → More → Export members (CSV) → a members.csv download fires with the right header.
 */
import { test, expect } from '@playwright/test'

test('officer exports the members CSV from More', async ({ page }) => {
  let signedIn = false
  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))
  await page.route('**/association/member/roster**', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [
      { id: 'm1', personId: 'p1', name: 'Maria Santos', memberNumber: 'A-1', status: 'active', joinedAt: '2019-05-01T00:00:00Z', duesExpiryDate: '2026-01-12T00:00:00Z', duesInvoiceStatus: null },
      { id: 'm2', personId: 'p2', name: 'Jose Cruz', memberNumber: 'A-2', status: 'pendingPayment', joinedAt: '2021-03-01T00:00:00Z', duesExpiryDate: null, duesInvoiceStatus: 'sent' },
    ], totalCount: 2 }) }))

  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('o@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')

  await page.getByRole('link', { name: 'More' }).click()
  await page.waitForURL('/more')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /export members/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('members.csv')

  // Verify the CSV content (header + a row per member).
  const stream = await download.createReadStream()
  const text = await new Promise<string>((resolve) => {
    let buf = ''
    stream.on('data', (c) => (buf += c))
    stream.on('end', () => resolve(buf))
  })
  expect(text).toContain('Name,Member number,Member since,Status,Renews,Dues')
  expect(text).toContain('Maria Santos,A-1,2019-05-01,Active,2026-01-12,Paid')
  expect(text).toContain('Jose Cruz,A-2,2021-03-01,Pending,,Unpaid')
})
