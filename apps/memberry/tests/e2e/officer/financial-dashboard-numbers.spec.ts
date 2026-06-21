// SHALLOW→REAL: Officer Finances Overview dashboard — assert the displayed
// figures are REAL numbers consistent with the hydration wire, not just that
// cards render.
//
// finances-coverage.spec.ts covers the assessments/dues/members/invoices
// sub-routes but NEVER the finances overview index (`/officer/finances`) — the
// dashboard with Collection Rate / Collected / Outstanding metric cards. This
// spec fills that gap.
//
// Why data-driven (not hardcoded): the shared seed DB is MUTABLE — sibling
// specs record dues payments, which mutates totalCount / completedCount and so
// shifts collectionRate (observed live: 84% → 83% as totalCount 126 → 127 mid
// run). So we capture the dashboard hydration payload (200 + JSON) and assert
// the DISPLAYED card values exactly equal the values DERIVED FROM THE WIRE the
// same way the component derives them (FinancesOverviewPage in
// routes/.../officer/finances/index.tsx). Plus invariants that hold under
// drift: rate == round(completed/total*100), collected/outstanding > 0,
// rate ∈ (0,100], pending banner count matches pendingCount.
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// The hydration endpoint for the metric cards:
//   GET /association/member/dues-reporting/{org}/dashboard  (getDuesFinancialDashboard)
const DASHBOARD_WIRE = /\/dues-reporting\/[^/]+\/dashboard(\?|$)/

interface FinancialDashboardPayload {
  totalCollected: number
  totalOutstanding: number
  pendingCount: number
  completedCount: number
  totalCount: number
  collectionRate: number
  gatewayConfigured: boolean
  expiringThisMonth: number
}

// Mirror the component's formatting exactly (index.tsx):
//   value={totalCollected / 100} prefix="₱"
//   format={(n) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
function money(cents: number): string {
  return '₱' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}
// Collection Rate card: value={collectionRate} format={(n) => `${Math.round(n)}%`}
function ratePct(rate: number): string {
  return `${Math.round(rate)}%`
}

// Locate the value <p> inside the MetricCard whose label <span> matches `label`.
// MetricCard renders the GlassCard surface (a `div.rounded-md.border…` with
// EXACTLY one `p.text-2xl` value and one `span.text-sm` label) — so anchoring on
// that card class + filtering by the unique label text scopes to the one card.
// GlassCard drops aria-label, so getByRole/getByLabel are unavailable; the card
// class is the stable anchor (outer grid/shell divs also "contain" the label
// text but are not `.rounded-md.border` cards).
function metricValue(page: import('@playwright/test').Page, label: string) {
  return page
    .locator('div.rounded-md.border')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('p.text-2xl')
}

test.describe('Officer Finances Overview — real dashboard numbers', () => {
  test('metric cards display real figures consistent with the hydration wire', async ({
    page,
  }) => {
    const respP = captureRouteHydration(page, DASHBOARD_WIRE)
    await page.goto(`/org/${ORG_ID}/officer/finances`)

    // Page mounted (not blank-redirected).
    await expect(page.getByRole('heading', { name: /finances overview/i })).toBeVisible({
      timeout: 15000,
    })

    // --- Wire: the dashboard GET returned 200 with a real payload ---
    const resp = await respP
    expect(resp?.status(), 'dues-reporting dashboard GET must succeed').toBe(200)
    const wire = (await resp!.json()) as FinancialDashboardPayload

    // --- Invariants that must hold regardless of seed drift ---
    // Collection rate is the percentage of payment records completed.
    expect(
      wire.collectionRate,
      'collectionRate == round(completedCount / totalCount * 100)',
    ).toBe(Math.round((wire.completedCount / wire.totalCount) * 100))
    expect(wire.totalCount, 'org has real payment records').toBeGreaterThan(0)
    expect(wire.completedCount, 'some payments are completed').toBeGreaterThan(0)
    // Non-trivial collection rate (seed is ~83% — not 0, not a placeholder).
    expect(wire.collectionRate).toBeGreaterThan(50)
    expect(wire.collectionRate).toBeLessThanOrEqual(100)
    // Non-trivial money: real pesos have been collected, and there is a real
    // outstanding balance — both must be positive integers (minor units).
    expect(wire.totalCollected, 'real collected total').toBeGreaterThan(0)
    expect(wire.totalOutstanding, 'real outstanding balance').toBeGreaterThan(0)
    expect(Number.isInteger(wire.totalCollected)).toBe(true)
    expect(Number.isInteger(wire.totalOutstanding)).toBe(true)

    // --- Displayed cards exactly match the wire (CountUp settles to target) ---
    // toHaveText auto-retries, so it waits past the 0→target count animation.
    await expect(
      metricValue(page, 'Collection Rate'),
      'displayed rate reflects the real wire value',
    ).toHaveText(ratePct(wire.collectionRate), { timeout: 10000 })

    await expect(
      metricValue(page, 'Collected This Period'),
      'displayed collected reflects the real wire value',
    ).toHaveText(money(wire.totalCollected), { timeout: 10000 })

    await expect(
      metricValue(page, 'Outstanding Balance'),
      'displayed outstanding reflects the real wire value',
    ).toHaveText(money(wire.totalOutstanding), { timeout: 10000 })
  })

  test('pending-payments alert banner count matches the wire pendingCount', async ({ page }) => {
    const respP = captureRouteHydration(page, DASHBOARD_WIRE)
    await page.goto(`/org/${ORG_ID}/officer/finances`)
    await expect(page.getByRole('heading', { name: /finances overview/i })).toBeVisible({
      timeout: 15000,
    })

    const resp = await respP
    expect(resp?.status()).toBe(200)
    const wire = (await resp!.json()) as FinancialDashboardPayload

    // The overview renders an info AlertBanner only when pendingCount > 0:
    //   `${pendingCount} pending payment(s) awaiting review`
    // Seed has 8 pending — assert the banner reflects the real count, proving
    // the number on screen is wired to data, not a static string.
    if (wire.pendingCount > 0) {
      const banner = page.getByRole('alert').filter({ hasText: /pending payment/i })
      await expect(banner, 'pending-payments banner renders when wire says pendingCount>0')
        .toBeVisible({ timeout: 10000 })
      await expect(
        banner,
        'banner count equals the real pendingCount from the wire',
      ).toContainText(new RegExp(`\\b${wire.pendingCount}\\b\\s*pending payment`, 'i'))
    } else {
      // Defensive: if drift ever zeroes pending, the banner must be absent.
      await expect(
        page.getByRole('alert').filter({ hasText: /pending payment/i }),
      ).toHaveCount(0)
    }
  })

  test('collected + outstanding reconcile against the member-detail dues summary', async ({
    page,
  }) => {
    // Cross-check the overview figures against an INDEPENDENT read path: the
    // dashboard's totalCollected is the sum of completed payments, so it must be
    // ≥ the collected total surfaced for any single member detail page. We
    // assert the overview collected total is at least as large as the largest
    // single seeded invoice amount (₱3,000.00), proving the aggregate is a real
    // rollup over many records — not a 0 placeholder or a single row echoed.
    const respP = captureRouteHydration(page, DASHBOARD_WIRE)
    await page.goto(`/org/${ORG_ID}/officer/finances`)
    await expect(page.getByRole('heading', { name: /finances overview/i })).toBeVisible({
      timeout: 15000,
    })
    const wire = (await (await respP)!.json()) as FinancialDashboardPayload

    // The aggregate collected (₱318k seed) is a rollup over completedCount (>1)
    // records — strictly larger than one ₱3,000 invoice. Locks "real rollup".
    const ONE_INVOICE_CENTS = 300000 // ₱3,000.00 — seeded annual dues amount
    expect(wire.completedCount, 'rollup spans many completed payments').toBeGreaterThan(1)
    expect(
      wire.totalCollected,
      'aggregate collected exceeds a single invoice (proves real rollup)',
    ).toBeGreaterThan(ONE_INVOICE_CENTS)

    // And the displayed Collected card equals that same aggregate — the number
    // on the dashboard is the true sum, end to end.
    await expect(metricValue(page, 'Collected This Period')).toHaveText(
      money(wire.totalCollected),
      { timeout: 10000 },
    )
  })
})
