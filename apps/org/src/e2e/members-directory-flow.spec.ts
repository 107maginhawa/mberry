/**
 * E2E: Members directory (Slice 2) — real officer flow over the FROZEN engine.
 *
 * Sign in → directory lists roster (listRosterMembers) → add one member
 * (importRosterMembers one-row) → filter Unpaid (server status re-query). All API
 * stubbed via page.route; stubs match the HANDLER shapes ({ data, totalCount } for
 * roster — NOT the generated { data, pagination }). Asserts behaviour, not selectors.
 */
import { test, expect } from '@playwright/test'

const member = (over: Record<string, unknown>) => ({
  id: 'x', personId: 'px', name: 'X', status: 'active', memberNumber: 'A-0',
  joinedAt: '2019-01-01T00:00:00Z', categoryName: 'Gold', duesInvoiceStatus: null, ...over,
})
const MARIA = member({ id: 'm1', personId: 'p1', name: 'Maria Santos', status: 'active', memberNumber: 'A-1' })
const JOSE = member({ id: 'm2', personId: 'p2', name: 'Jose Cruz', status: 'pendingPayment', memberNumber: 'A-2', categoryName: 'Regular' })

test('officer lists members, adds one, then filters to Unpaid', async ({ page }) => {
  let signedIn = false

  await page.route('**/csrf-token', (r) => r.fulfill({ contentType: 'application/json', body: '{"token":"t"}' }))
  await page.route('**/auth/email-otp/send-verification-otp', (r) => r.fulfill({ status: 200, body: '{}' }))
  await page.route('**/auth/sign-in/email-otp', (r) => { signedIn = true; r.fulfill({ status: 200, body: '{}' }) })
  await page.route('**/persons/me/memberships', (r) =>
    signedIn
      ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Olive Dental Chapter' }], total: 1 }) })
      : r.fulfill({ status: 401, body: '{"error":"unauthorized"}' }))

  // Tiers for the Add-member select (full shape — the response transformer coerces annualFee).
  await page.route('**/association/member/tiers**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 't1', name: 'Regular', code: 'REGULAR', annualFee: '300000', currency: 'PHP', benefits: [], status: 'active' }],
        pagination: {},
      }),
    }))

  // Roster list — stateful on the status query so the Unpaid chip is exercised for real.
  // Handler shape: { data, totalCount }.
  await page.route('**/association/member/roster**', (r) => {
    if (r.request().method() !== 'GET') return r.fallback() // POST /roster/import handled below
    const status = new URL(r.request().url()).searchParams.get('status')
    const data = status === 'pendingPayment' ? [JOSE] : [MARIA, JOSE]
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ data, totalCount: data.length }) })
  })
  // Add-member (one-row import). Registered after the list glob so it wins for this path.
  await page.route('**/association/member/roster/import', (r) =>
    r.request().method() === 'POST'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ imported: 1, skipped: 0, failed: 0, errors: [] }) })
      : r.fallback())

  // ── Sign in ──
  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill('officer@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
  await page.waitForURL('/')

  // ── Directory lists both members with status + meta ──
  await expect(page.getByText('Maria Santos')).toBeVisible()
  await expect(page.getByText('Jose Cruz')).toBeVisible()
  await expect(page.getByText('Pending')).toBeVisible() // pendingPayment → Pending badge
  await expect(page.getByText(/Member since 2019/).first()).toBeVisible()

  // ── Add one member → success toast, dialog closes ──
  await page.getByRole('button', { name: 'Add member' }).click()
  await page.getByLabel('First name').fill('Tess')
  await page.getByLabel('Email').fill('tess@x.com')
  await page.getByLabel('Membership tier').selectOption('t1')
  // The dialog's own submit (second "Add member" button).
  await page.getByRole('button', { name: 'Add member' }).last().click()
  await expect(page.getByText('Added Tess')).toBeVisible()

  // ── Filter Unpaid → server re-query (status=pendingPayment) → only Jose ──
  await page.getByRole('radio', { name: 'Unpaid' }).click()
  await expect(page.getByText('Jose Cruz')).toBeVisible()
  await expect(page.getByText('Maria Santos')).toHaveCount(0)
})
