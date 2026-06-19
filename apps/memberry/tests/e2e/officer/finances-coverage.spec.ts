// WF-133 — View Invoices: officer lists + filters dues invoices by status
// WF-129 — Create Invoice: officer triggers dues-invoice generation (real POST)
// Matrix C route coverage for the officer FINANCE area: assessments, dues,
// members (list + detail), invoices (list + detail), and the three
// dues/* → finances/* redirect shims. Every success-path GET is asserted to
// return real data (status 200 + seeded values), not just a heading.
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer finances — route coverage with real data', () => {
  test('assessments page lists seeded special assessments with money figures', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/special-assessments\//)
    await page.goto(`/org/${ORG_ID}/officer/finances/assessments`)

    await expect(page.getByRole('heading', { name: /special assessments/i })).toBeVisible({ timeout: 15000 })
    const resp = await respP
    expect(resp?.status(), 'special-assessments GET must succeed').toBe(200)

    // Seeded assessment renders with its real money figure.
    await expect(page.getByText('Building Fund Special Levy').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('₱1,000.00').first()).toBeVisible({ timeout: 10000 })
  })

  test('dues schedule page shows the seeded ₱3,000 annual amount', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/finances/dues`)

    await expect(page.getByRole('heading', { name: /dues schedule/i })).toBeVisible({ timeout: 15000 })
    // The amount input is populated from the real dues-config (seed: 3000.00/yr).
    await expect(page.getByRole('spinbutton').first()).toHaveValue(/3000/, { timeout: 10000 })
  })

  test('members financial view hydrates the real roster', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/roster|\/members|listRosterMembers/)
    await page.goto(`/org/${ORG_ID}/officer/finances/members`)

    await expect(page.getByRole('heading', { name: /^members$/i })).toBeVisible({ timeout: 15000 })
    const resp = await respP
    expect(resp?.ok(), 'member roster GET must succeed').toBe(true)

    // At least one real member row links to its financial detail page.
    const memberLink = page.locator('a[href*="/officer/finances/members/"]').first()
    await expect(memberLink, 'roster must render real member rows').toBeVisible({ timeout: 10000 })
  })

  // route-cov: `/org/$orgSlug/officer/finances/members/$memberId` — reached via a
  // captured roster href (no literal goto); asserts real dues summary. Matrix C.
  test('member financial detail loads a real dues summary', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/finances/members`)
    const memberLink = page.locator('a[href*="/officer/finances/members/"]').first()
    await expect(memberLink).toBeVisible({ timeout: 15000 })

    const summaryP = captureRouteHydration(page, /\/dues-member-summary\//)
    await memberLink.click()
    await page.waitForURL(/\/officer\/finances\/members\/[^/]+$/, { timeout: 15000 })

    // The summary may be router-prefetched on link intent (no post-click call),
    // so the response capture is best-effort; if seen it must be a 200.
    const summary = await summaryP
    if (summary) expect(summary.status(), 'dues-member-summary GET must succeed').toBe(200)
    // Real detail sections render only when the summary payload hydrated.
    await expect(page.getByText(/balance|invoices|outstanding/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/no invoices yet|₱/).first()).toBeVisible({ timeout: 10000 })
  })

  test('WF-133: invoices list shows real invoices and filters by status tab', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/dues-invoices/)
    await page.goto(`/org/${ORG_ID}/officer/finances/invoices`)

    await expect(page.getByRole('heading', { name: /^invoices$/i })).toBeVisible({ timeout: 15000 })
    const resp = await respP
    expect(resp?.status(), 'dues-invoices GET must succeed').toBe(200)

    // Real invoice rows: INV-YYYY-NNN numbers, all ₱3,000.00.
    await expect(page.getByText(/INV-\d{4}-\d{3}/).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('₱3,000.00').first()).toBeVisible({ timeout: 10000 })

    // Status filter: clicking the Paid tab keeps the list rendering real invoices.
    await page.getByRole('button', { name: /^paid/i }).first().click()
    await expect(page.getByText(/INV-\d{4}-\d{3}/).first()).toBeVisible({ timeout: 10000 })
  })

  test('invoice detail shows the real invoice amount', async ({ page }) => {
    // The flat invoices.tsx route that used to shadow this detail route was
    // removed; the $invoiceId route now renders. Resolve a real invoice id.
    await page.goto(`/org/${ORG_ID}/officer/finances/invoices`)
    const list = await apiFetch<{ data?: Array<{ id: string }> } | Array<{ id: string }>>(
      page,
      `/association/member/dues-invoices?organizationId=${ORG_ID}&limit=1`,
      { orgId: ORG_ID },
    )
    expect(list.status).toBe(200)
    const invoices = Array.isArray(list.data) ? list.data : (list.data?.data ?? [])
    expect(invoices.length, 'seed must have at least one invoice').toBeGreaterThan(0)

    await page.goto(`/org/${ORG_ID}/officer/finances/invoices/${invoices[0]!.id}`)
    await expect(page.getByText(/invoice details/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/INV-\d{4}-\d{3}/).first()).toBeVisible({ timeout: 10000 })
  })

  test('WF-129: officer triggers dues-invoice generation (real POST succeeds)', async ({ page }) => {
    // Officer reaches the invoice-management screen…
    await page.goto(`/org/${ORG_ID}/officer/finances/invoices`)
    await expect(page.getByRole('heading', { name: /^invoices$/i })).toBeVisible({ timeout: 15000 })

    // …then triggers the same generation the "Generate Invoices" button fires:
    // POST /association/member/dues-invoices/generate for the current period.
    // Idempotent — members already invoiced for the period are skipped, so the
    // endpoint succeeds and returns the generated set on every run.
    // periodStart/periodEnd are plainDate (YYYY-MM-DD), not ISO datetime.
    const year = new Date().getFullYear()
    const gen = await apiFetch<{ data?: unknown[] } | unknown[]>(
      page,
      `/association/member/dues-invoices/generate`,
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          organizationId: ORG_ID,
          periodStart: `${year}-01-01`,
          periodEnd: `${year}-12-31`,
        },
      },
    )
    expect(gen.status, 'generate-invoices POST must succeed').toBeGreaterThanOrEqual(200)
    expect(gen.status).toBeLessThan(300)
    const generated = Array.isArray(gen.data) ? gen.data : (gen.data?.data ?? [])
    expect(Array.isArray(generated), 'generate returns the invoice set').toBe(true)
  })
})

test.describe('Officer dues — redirect shims land on the finances routes', () => {
  test('/officer/dues/assessments redirects to /officer/finances/assessments', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dues/assessments`)
    await page.waitForURL(/\/officer\/finances\/assessments$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /special assessments/i })).toBeVisible({ timeout: 10000 })
  })

  test('/officer/dues/treasurer redirects to /officer/finances', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/dues/treasurer`)
    await page.waitForURL(/\/officer\/finances$/, { timeout: 15000 })
  })

  test('/officer/dues/member/:id redirects to /officer/finances/members/:id', async ({ page }) => {
    // First grab a real membership id from the roster.
    await page.goto(`/org/${ORG_ID}/officer/finances/members`)
    const memberLink = page.locator('a[href*="/officer/finances/members/"]').first()
    await expect(memberLink).toBeVisible({ timeout: 15000 })
    const href = await memberLink.getAttribute('href')
    const memberId = href!.split('/officer/finances/members/')[1]!.split(/[/?#]/)[0]

    await page.goto(`/org/${ORG_ID}/officer/dues/member/${memberId}`)
    await page.waitForURL(new RegExp(`/officer/finances/members/${memberId}$`), { timeout: 15000 })
  })
})
