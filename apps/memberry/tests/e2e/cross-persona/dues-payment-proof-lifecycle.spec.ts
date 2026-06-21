// WF-039 — Manual Payment Proof Lifecycle (offline GCash/bank ref)
/**
 * Cross-persona MANUAL payment-proof lifecycle — the offline money path that
 * the Stripe online-pay journey (services/api-ts/scripts/stripe-happy-path.ts)
 * does NOT cover:
 *
 *   1. CONFIRM path: member submits a payment proof (GCash/bank ref + receipt
 *      file) against an unpaid dues invoice → officer/treasurer sees it pending
 *      in finances/payments → CONFIRMS it → the linked invoice flips to PAID and
 *      the member sees the payment as CONFIRMED in their dues history.
 *   2. REJECT path: member submits a proof → treasurer REJECTS it with a reason
 *      → the payment flips to REJECTED, the invoice stays UNPAID, and the member
 *      sees the rejected badge + the officer's reason + a resubmit affordance.
 *
 * This is a REAL-DATA / state-transition spec, not a render smoke test. Every
 * status flip is asserted on the wire (submitted → confirmed | rejected) AND is
 * verified to persist into BOTH personas' UI surfaces:
 *   - member  /org/$org/dues                 (Payment History + proof badges)
 *   - officer /org/$org/officer/payments      (Pending Payment Proofs list)
 *
 * Personas (two real sessions, minted by the helpers):
 *   - member    — submits the proof, reads back their dues page.
 *   - treasurer — confirms / rejects. confirm/rejectPaymentProof are gated by
 *     requirePosition([Treasurer, President]) on the backend, so the privileged
 *     `treasurer` authRole (not the plain member) is the reviewer.
 *
 * Why mutations go through `apiFetch` (real authenticated wire) rather than the
 * file-picker UI: submitting a proof requires a real S3/MinIO upload to mint a
 * proofStorageKey, which is environment-fragile in CI. The handler only
 * validates the proof MIME type (not storage residency), so a fixed storageKey
 * exercises the exact same submitted→confirmed/rejected state machine. The UI
 * is then asserted to RENDER the persisted state — same split as the
 * treasurer-records-dues @journey-firewall spec.
 *
 * Self-healing seed dependency: the member needs an UNPAID invoice to submit a
 * proof against. We list their invoices and reuse a payable one; if none exists
 * (a prior run consumed it), the treasurer generates one for a per-run-unique
 * far-future period so the per-period idempotency skip never starves the test.
 */

import { test, expect } from '../helpers/test-fixture'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'
import { attachErrorSurface } from '../helpers/error-surface'
import type { Browser, Page } from '@playwright/test'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Dashboard over-fetches that 403/401 for these personas and are swallowed by
// the UI (flagged separately as app bugs). Declared, not masked.
const DASHBOARD_ALLOW = [
  /→ 401/,
  /GET \/api\/association\/event-lifecycle\/my → 403/,
]

type Invoice = { id: string; status: string; invoiceNumber?: string; totalAmount?: number }
type Payment = {
  id: string
  status: string
  invoiceId?: string
  referenceNumber?: string
  receiptNumber?: string
  rejectionReason?: string
}

const PAYABLE = ['generated', 'sent', 'overdue']

/** List the member's dues invoices (member session scopes to self). */
async function listMemberInvoices(page: Page): Promise<Invoice[]> {
  const res = await apiFetch<{ data?: Invoice[] } | Invoice[]>(
    page,
    `/association/member/dues-invoices?organizationId=${ORG_ID}&limit=50`,
    { orgId: ORG_ID },
  )
  expect(res.status, 'member dues-invoices readable').toBe(200)
  return Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
}

/**
 * Guarantee the member has at least one UNPAID invoice to submit a proof
 * against. Reuses an existing payable invoice; otherwise asks the treasurer to
 * generate one for a per-run-unique far-future period (dodges the
 * already-invoiced-for-period skip + parallel-pollution), then re-reads as the
 * member to confirm it landed on their account.
 */
async function ensurePayableInvoice(memberPage: Page, browser: Browser): Promise<Invoice> {
  const existing = (await listMemberInvoices(memberPage)).find((i) => PAYABLE.includes(i.status))
  if (existing) return existing

  // Per-run-unique far-future period so generate() never collides/skips.
  const year = 2035 + (Date.now() % 40) // 2035..2074, effectively unique per run
  const periodStart = `${year}-01-01`
  const periodEnd = `${year}-12-31`

  const treasCtx = await browser.newContext({ storageState: await freshAuthState('treasurer') })
  const treasPage = await treasCtx.newPage()
  await treasPage.goto('/dashboard') // SPA origin for apiFetch CSRF/Origin
  const gen = await apiFetch(treasPage, '/association/member/dues-invoices/generate', {
    method: 'POST',
    orgId: ORG_ID,
    body: { organizationId: ORG_ID, periodStart, periodEnd },
  })
  expect([200, 201], `generate invoices succeeded (got ${gen.status})`).toContain(gen.status)
  await treasCtx.close()

  const fresh = (await listMemberInvoices(memberPage)).find((i) => PAYABLE.includes(i.status))
  expect(fresh, 'member has a payable invoice after generation').toBeTruthy()
  return fresh!
}

/** Submit a manual payment proof for `invoice` as the current (member) session. */
async function submitProof(
  page: Page,
  invoice: Invoice,
  referenceNumber: string,
): Promise<Payment> {
  const res = await apiFetch<Payment & { data?: Payment }>(
    page,
    '/association/member/dues-payments/submit-proof',
    {
      method: 'POST',
      orgId: ORG_ID,
      body: {
        invoiceId: invoice.id,
        amount: invoice.totalAmount ?? 300000,
        currency: 'PHP',
        paymentMethod: 'gcash',
        referenceNumber,
        proofStorageKey: `e2e-proof/${referenceNumber}.png`,
        proofFileName: `${referenceNumber}.png`,
        proofMimeType: 'image/png',
      },
    },
  )
  expect(
    [200, 201],
    `submit-proof succeeded (got ${res.status} ${JSON.stringify(res.data).slice(0, 200)})`,
  ).toContain(res.status)
  const payment = (res.data?.data ?? res.data) as Payment
  expect(payment?.id, 'submitted proof has an id').toBeTruthy()
  expect(payment?.status, 'fresh proof starts in submitted state').toBe('submitted')
  return payment
}

/** Read one of the member's dues payments by reference from a fresh member session. */
async function readMemberPaymentByRef(
  browser: Browser,
  referenceNumber: string,
): Promise<Payment | undefined> {
  const ctx = await browser.newContext({ storageState: await freshAuthState('member') })
  const page = await ctx.newPage()
  await page.goto('/dashboard')
  const res = await apiFetch<{ data?: Payment[] } | Payment[]>(
    page,
    `/association/member/dues-payments?organizationId=${ORG_ID}&limit=50`,
    { orgId: ORG_ID },
  )
  expect(res.status, 'member dues-payments readable in fresh session').toBe(200)
  const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  await ctx.close()
  return rows.find((p) => p.referenceNumber === referenceNumber)
}

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: manual dues payment-proof lifecycle (confirm + reject)', () => {
  // ---------------------------------------------------------------------------
  // CONFIRM PATH: submit → treasurer confirms → invoice PAID + member sees Confirmed
  // ---------------------------------------------------------------------------
  test('member proof is CONFIRMED by treasurer → invoice flips to paid, member sees Confirmed', async ({
    browser,
  }) => {
    const ref = `E2E-CONFIRM-${Date.now()}`

    // ---- 1. Member: ensure a payable invoice, then submit a proof ----
    const memberCtx = await browser.newContext({ storageState: await freshAuthState('member') })
    const memberPage = await memberCtx.newPage()
    const assertMemberClean = attachErrorSurface(memberPage, {
      allowApiFailures: DASHBOARD_ALLOW,
    })
    await memberPage.goto('/dashboard')

    const invoice = await ensurePayableInvoice(memberPage, browser)
    const submitted = await submitProof(memberPage, invoice, ref)

    // ---- 2. Member UI: the submitted proof renders with the Submitted badge ----
    const duesHydration = captureRouteHydration(memberPage, /\/dues-payments(\?|$)/)
    await memberPage.goto(`/org/${ORG_ID}/dues`)
    await expect(
      memberPage.getByRole('heading', { name: 'My Dues', level: 1 }),
    ).toBeVisible({ timeout: 15000 })
    const duesResp = await duesHydration
    expect(duesResp?.status(), 'member dues-payments hydration must succeed').toBe(200)
    // Payment History row renders the submitted proof's receipt + Submitted badge.
    await expect(
      memberPage.getByText(submitted.receiptNumber ?? ref).first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(memberPage.getByText('Submitted').first()).toBeVisible({ timeout: 10000 })
    assertMemberClean()
    await memberCtx.close()

    // ---- 3. Treasurer UI: the member's proof appears in Pending Payment Proofs ----
    const treasCtx = await browser.newContext({ storageState: await freshAuthState('treasurer') })
    const treasPage = await treasCtx.newPage()
    const assertTreasClean = attachErrorSurface(treasPage, {
      allowApiFailures: DASHBOARD_ALLOW,
    })
    const proofsHydration = captureRouteHydration(treasPage, /\/pending-proofs/)
    await treasPage.goto(`/org/${ORG_ID}/officer/payments`)
    await expect(page_h1(treasPage)).toBeVisible({ timeout: 15000 })
    await expect(treasPage.getByText('Pending Payment Proofs')).toBeVisible({ timeout: 10000 })
    const proofsResp = await proofsHydration
    expect(proofsResp?.status(), 'officer pending-proofs hydration must succeed').toBe(200)
    // The just-submitted proof card surfaces (by its reference number).
    await expect(treasPage.getByText(ref).first()).toBeVisible({ timeout: 10000 })

    // ---- 4. Treasurer: CONFIRM the proof (real wire state transition) ----
    const confirm = await apiFetch<Payment & { data?: Payment }>(
      treasPage,
      `/association/member/dues-payments/${submitted.id}/confirm`,
      { method: 'POST', orgId: ORG_ID, body: {} },
    )
    expect(
      [200, 201],
      `confirm succeeded (got ${confirm.status} ${JSON.stringify(confirm.data).slice(0, 200)})`,
    ).toContain(confirm.status)
    const confirmedStatus = (confirm.data?.data ?? confirm.data)?.status
    expect(confirmedStatus, 'proof transitions submitted → confirmed').toBe('confirmed')
    assertTreasClean()
    await treasCtx.close()

    // ---- 5. Cross-persona durability: invoice is PAID + member sees Confirmed ----
    // Independent member read of invoices: the linked invoice flipped to paid.
    const verifyCtx = await browser.newContext({ storageState: await freshAuthState('member') })
    const verifyPage = await verifyCtx.newPage()
    await verifyPage.goto('/dashboard')
    const invoicesAfter = await listMemberInvoices(verifyPage)
    const linked = invoicesAfter.find((i) => i.id === invoice.id)
    expect(linked?.status, `confirmed proof marks invoice ${invoice.invoiceNumber} paid`).toBe('paid')

    // Independent member read of payments: the proof itself is now confirmed.
    const memberPayment = await readMemberPaymentByRef(browser, ref)
    expect(memberPayment, 'member sees their submitted payment').toBeTruthy()
    expect(memberPayment?.status, 'member-side payment reflects the confirmation').toBe('confirmed')

    // Member UI surfaces the Confirmed badge in Payment History.
    await verifyPage.goto(`/org/${ORG_ID}/dues`)
    await expect(
      verifyPage.getByRole('heading', { name: 'My Dues', level: 1 }),
    ).toBeVisible({ timeout: 15000 })
    await expect(verifyPage.getByText('Confirmed').first()).toBeVisible({ timeout: 10000 })
    await verifyCtx.close()
  })

  // ---------------------------------------------------------------------------
  // REJECT PATH: submit → treasurer rejects w/ reason → invoice stays UNPAID,
  // member sees Rejected + reason + resubmit affordance.
  // ---------------------------------------------------------------------------
  test('member proof is REJECTED by treasurer → invoice stays unpaid, member sees reason + resubmit', async ({
    browser,
  }) => {
    const ref = `E2E-REJECT-${Date.now()}`
    const reason = `Blurry screenshot — please resend (${Date.now()})`

    // ---- 1. Member: ensure a payable invoice, then submit a proof ----
    const memberCtx = await browser.newContext({ storageState: await freshAuthState('member') })
    const memberPage = await memberCtx.newPage()
    await memberPage.goto('/dashboard')
    const invoice = await ensurePayableInvoice(memberPage, browser)
    const submitted = await submitProof(memberPage, invoice, ref)
    await memberCtx.close()

    // ---- 2. Treasurer: REJECT with a reason (real wire state transition) ----
    const treasCtx = await browser.newContext({ storageState: await freshAuthState('treasurer') })
    const treasPage = await treasCtx.newPage()
    await treasPage.goto('/dashboard')
    const reject = await apiFetch<Payment & { data?: Payment }>(
      treasPage,
      `/association/member/dues-payments/${submitted.id}/reject`,
      { method: 'POST', orgId: ORG_ID, body: { reason } },
    )
    expect(
      [200, 201],
      `reject succeeded (got ${reject.status} ${JSON.stringify(reject.data).slice(0, 200)})`,
    ).toContain(reject.status)
    const rejectedStatus = (reject.data?.data ?? reject.data)?.status
    expect(rejectedStatus, 'proof transitions submitted → rejected').toBe('rejected')
    await treasCtx.close()

    // ---- 3. Cross-persona durability: invoice STAYS unpaid + member sees Rejected ----
    const verifyCtx = await browser.newContext({ storageState: await freshAuthState('member') })
    const verifyPage = await verifyCtx.newPage()
    await verifyPage.goto('/dashboard')

    // The invoice was NOT paid by a rejection — it remains payable.
    const invoicesAfter = await listMemberInvoices(verifyPage)
    const linked = invoicesAfter.find((i) => i.id === invoice.id)
    expect(
      linked?.status,
      `rejected proof leaves invoice ${invoice.invoiceNumber} unpaid (got ${linked?.status})`,
    ).not.toBe('paid')
    expect(PAYABLE).toContain(linked?.status)

    // Member-side payment carries the rejected status + the officer's reason.
    const memberPayment = await readMemberPaymentByRef(browser, ref)
    expect(memberPayment?.status, 'member-side payment reflects the rejection').toBe('rejected')
    expect(
      memberPayment?.rejectionReason,
      'officer rejection reason is durable on the member-visible payment',
    ).toBe(reason)

    // Member UI: the Rejected badge renders in Payment History, and because the
    // invoice is still unpaid the page surfaces the officer's rejection reason +
    // a resubmit affordance in the Pay-Dues section.
    //
    // This is the assertion that FAILED before the dues.tsx fix: the rejected
    // proof was filtered out of `submittedPaymentsByInvoice` (which only mapped
    // ['submitted','confirmed']), so the `existingSubmission.status ===
    // 'rejected'` reason/resubmit block was dead code — the rejected proof fell
    // through to the default fresh-upload form and the member never saw WHY it
    // was rejected. The reason is durable on the wire (asserted above); it must
    // now be visible to the member who needs it to resubmit.
    const duesHydration = captureRouteHydration(verifyPage, /\/dues-payments(\?|$)/)
    await verifyPage.goto(`/org/${ORG_ID}/dues`)
    await expect(
      verifyPage.getByRole('heading', { name: 'My Dues', level: 1 }),
    ).toBeVisible({ timeout: 15000 })
    expect((await duesHydration)?.status(), 'member dues-payments hydration must succeed').toBe(200)
    await expect(verifyPage.getByText('Rejected').first()).toBeVisible({ timeout: 10000 })
    // The exact reason the treasurer typed is surfaced in the resubmit callout —
    // not just a status badge in Payment History.
    await expect(
      verifyPage.getByText(reason, { exact: false }).first(),
      'member sees the officer-typed rejection reason on the dues page',
    ).toBeVisible({ timeout: 10000 })
    // The "you can resubmit" callout copy is present.
    await expect(
      verifyPage.getByText(/you can resubmit your proof/i).first(),
    ).toBeVisible({ timeout: 10000 })
    // Resubmit affordance: the unpaid invoice still renders a proof-upload form.
    await expect(verifyPage.getByRole('button', { name: /submit payment proof/i }).first())
      .toBeVisible({ timeout: 10000 })
    await verifyCtx.close()
  })
})

/** The officer payments page always mounts a single h1 ("Dues & Payments"). */
function page_h1(page: Page) {
  return page.getByRole('heading', { level: 1 }).first()
}
