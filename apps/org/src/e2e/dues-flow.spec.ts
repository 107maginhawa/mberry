// apps/org/src/e2e/dues-flow.spec.ts
//
// E2E: officer dues dashboard money flow — dashboard tiles, outstanding invoices,
// and the invoices error → retry recovery. All API calls are stubbed via
// page.route; only the org dev server on :3005 is needed.
//
// Authed-state pattern: memberships 200 + localStorage org seed (see import-flow
// .spec.ts). All dues reads are GET → no /csrf-token needed.
//
// Shapes verified against DuesView.tsx + use-dues.ts + use-dues.test.tsx + the
// generated responseTransformers (money is bigint; invoices use totalAmount):
//  - getDuesDashboard (GET /dues/dashboard/{orgId}) — NO transformer; hook reads
//    data.data ?? data and Number()-coerces. Money fields are centavos.
//  - listDuesPayments (GET) → duesPaymentListResponseTransformer; each payment needs
//    amount + refundedAmount (BigInt(...toString())). Empty list here.
//  - listDuesInvoices (GET) → duesInvoiceListResponseTransformer; each invoice needs
//    totalAmount + fundAllocations[] + periodStart/End/generated dates. Field is
//    `totalAmount` (NOT amount) — the hook maps it to `amount`. The hook calls the
//    endpoint TWICE (status=sent, status=overdue) and merges; isError requires BOTH
//    to fail.
//  - centavosToPhp(250000) === '₱2,500.00'.
import { test, expect, type Page } from '@playwright/test'

const ORG_ID = 'org-1'

function authStubs(page: Page) {
  page.route('**/persons/me/memberships', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ organizationId: ORG_ID, orgName: 'Dental Chapter' }], total: 1 }),
    }),
  )
  return page.addInitScript((id) => localStorage.setItem('org.selectedOrgId', id), ORG_ID)
}

// Dashboard stub with known centavos numbers.
function dashboardStub(page: Page) {
  return page.route('**/dues/dashboard/**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          totalCollected: 250000, // ₱2,500.00
          totalOutstanding: 500000, // ₱5,000.00
          paidCount: 4,
          unpaidCount: 7,
          overdueCount: 1,
          collectionRate: 33,
          memberCount: 12,
        },
      }),
    }),
  )
}

// Recent payments — empty (not under test here; keeps the container out of loading).
function emptyPaymentsStub(page: Page) {
  return page.route('**/association/member/dues-payments**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )
}

const sentInvoice = {
  id: 'inv-sent',
  membershipId: 'ms1',
  personId: 'p1',
  organizationId: ORG_ID,
  invoiceNumber: 'INV-001',
  memberName: 'Olive Cruz',
  totalAmount: '150000', // ₱1,500.00
  fundAllocations: [],
  status: 'sent',
  periodStart: new Date('2026-01-01').toISOString(),
  periodEnd: new Date('2026-12-31').toISOString(),
  generatedAt: new Date('2026-01-01').toISOString(),
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-01-01').toISOString(),
}

const overdueInvoice = {
  ...sentInvoice,
  id: 'inv-overdue',
  invoiceNumber: 'INV-002',
  memberName: 'Maria Santos',
  totalAmount: '200000', // ₱2,000.00
  status: 'overdue',
}

function invoiceFor(status: string | null) {
  return { data: status === 'overdue' ? [overdueInvoice] : [sentInvoice] }
}

test('dues dashboard shows the formatted PHP totals', async ({ page }) => {
  await authStubs(page)
  await dashboardStub(page)
  await emptyPaymentsStub(page)
  await page.route('**/association/member/dues-invoices**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  )

  await page.goto('/dues')

  // Real numbers on the tiles (not just "page loaded").
  await expect(page.getByText('₱2,500.00')).toBeVisible() // Collected
  await expect(page.getByText('₱5,000.00')).toBeVisible() // Outstanding
  await expect(page.getByText('33%')).toBeVisible() // Collection rate
  await expect(page.getByText('1 overdue')).toBeVisible()
})

test('outstanding invoices list shows sent + overdue with formatted amounts', async ({ page }) => {
  await authStubs(page)
  await dashboardStub(page)
  await emptyPaymentsStub(page)
  await page.route('**/association/member/dues-invoices**', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(invoiceFor(status)),
    })
  })

  await page.goto('/dues')

  const section = page.getByRole('region', { name: 'Outstanding invoices' })
  await expect(section.getByText('Olive Cruz')).toBeVisible()
  await expect(section.getByText('Maria Santos')).toBeVisible()
  await expect(section.getByText('Sent')).toBeVisible()
  await expect(section.getByText('Overdue')).toBeVisible()
  await expect(section.getByText('₱1,500.00')).toBeVisible()
  await expect(section.getByText('₱2,000.00')).toBeVisible()
  // No money rendered NaN anywhere.
  await expect(page.getByText('₱NaN')).toHaveCount(0)
})

test('invoices error renders a friendly state and recovers on retry', async ({ page }) => {
  await authStubs(page)
  await dashboardStub(page)
  await emptyPaymentsStub(page)

  // Fail the first two invoice calls (sent + overdue) → invoicesError; succeed
  // after the user taps "Try again" (next sent + overdue calls).
  let calls = 0
  await page.route('**/association/member/dues-invoices**', (route) => {
    calls += 1
    if (calls <= 2) {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'internal error: db connection refused' }),
      })
    }
    const status = new URL(route.request().url()).searchParams.get('status')
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(invoiceFor(status)),
    })
  })

  await page.goto('/dues')

  // Friendly error state (no raw server string) with a retry affordance.
  const section = page.getByRole('region', { name: 'Outstanding invoices' })
  await expect(section.getByText("We couldn't load invoices.")).toBeVisible()
  await expect(section.getByText(/db connection refused/i)).toHaveCount(0)

  await section.getByRole('button', { name: 'Try again' }).click()

  // Recovers: the invoices now render.
  await expect(section.getByText('Olive Cruz')).toBeVisible()
  await expect(section.getByText('₱1,500.00')).toBeVisible()
})
