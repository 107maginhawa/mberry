// WF-035 — Record Payment
/**
 * Cross-persona: Treasurer records a manual dues payment for a member;
 *                that member's /persons/me/dues call reflects the new
 *                payment.
 *
 * Personas: P3 (treasurer) → P6 (member)
 *
 * API-driven multi-actor — UI path tested separately in officer/payments
 * + my/dues specs. The cross-persona contract this verifies is that a
 * treasurer-recorded payment propagates to the member's read model.
 *
 * Strategy: pull a seeded member id via /membership/members/{orgId} as
 * the treasurer, POST a payment, then re-read /persons/me/dues via a
 * second context signed in as that same seeded member (member@memberry.ph).
 */

import { test, expect } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { captureAnyApiSuccess } from '../helpers/real-flow'
import { attachErrorSurface } from '../helpers/error-surface'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: treasurer records dues, member sees receipt', () => {
  // ⚠ BLOCKED ON DOMAIN DECISION (Phase B validation finding):
  // Hardening this journey exposed that the old version POSTed `/dues/payments`
  // (a non-existent route) with `method`/`paymentDate` (wrong fields) and read
  // `/persons/me/dues` (a non-existent endpoint) — all silently swallowed by the
  // old `< 500` asserts, so it NEVER verified a recorded payment. The real op is
  // `POST /association/member/dues-payments` (recordDuesPayment), but it is
  // invoice/state-machine driven: recording for the seeded member 409s
  // ("Cannot transition dues payment from 'completed' to 'completed'") because
  // that member already has a completed payment. Recording a NEW payment needs a
  // member with an OPEN balance (e.g. a just-approved applicant in
  // `pendingPayment`). Re-enable once the intended manual-payment flow is
  // confirmed (standalone vs invoice-bound; approve-then-pay setup). The route +
  // body + durable-read oracle below are correct and ready.
  test.fixme('manual payment propagates from treasurer to member', async ({ browser }) => {
    // ---- Clause 4 setup: resolve the member's id from an INDEPENDENT member
    //      session so the payment targets the SAME person we later re-read as.
    //      (The old spec targeted a random active roster row, which is why it
    //      could only assert "surface responded" — it never knew if the row it
    //      paid matched the row it read.) ----
    const memberId = await independentRead<string | undefined>('member', async (api) => {
      const me = await api.get<{ id?: string; data?: { id?: string } }>('/persons/me')
      expect(me.status, 'member /persons/me readable').toBe(200)
      return me.data?.id ?? me.data?.data?.id
    })
    expect(memberId, 'seeded member has a person id').toBeTruthy()

    // ---- Treasurer (driving session): record a payment for that member ----
    const treasurerCtx = await browser.newContext({
      storageState: await freshAuthState('treasurer'),
    })
    const treasurerPage = await treasurerCtx.newPage()
    // Clause 1: fail on any silent error surface during the treasurer's path.
    // The dashboard fires GET /association/event-lifecycle/my which 403s for
    // this persona — a known, consistent role-gated probe (see EXEC findings);
    // declared expected here rather than masked.
    const assertTreasurerClean = attachErrorSurface(treasurerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: [/GET \/api\/association\/event-lifecycle\/my → 403/],
    })
    const treasurerHydration = captureAnyApiSuccess(treasurerPage)
    await treasurerPage.goto('/dashboard')
    const treasurerResp = await treasurerHydration
    // Clause 3: dashboard hydration must succeed.
    expect(treasurerResp?.status(), 'treasurer dashboard hydrated').toBe(200)

    // Record a manual dues payment via the REAL route + body shape.
    // (The old spec POSTed `/dues/payments` with `method`/`paymentDate` — a
    // non-existent route the `< 500` assert silently swallowed, so the journey
    // never actually recorded anything. Real op: recordDuesPayment.)
    // Unique integer amount (cents) so re-runs don't collide on a stale row.
    const amount = 10000 + (Date.now() % 90000)
    const payment = await apiFetch<{
      id?: string
      amount?: number
      data?: { id?: string; amount?: number }
    }>(treasurerPage, `/association/member/dues-payments`, {
      method: 'POST',
      orgId: ORG_ID,
      body: {
        organizationId: ORG_ID,
        personId: memberId,
        amount,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    })
    // Clause 3: the mutation MUST succeed — no `< 500` tolerance.
    expect(
      [200, 201],
      `POST dues-payments succeeded (got ${payment.status} ${JSON.stringify(payment.data).slice(0, 200)})`,
    ).toContain(payment.status)
    const paymentId = payment.data?.id ?? payment.data?.data?.id
    const recordedAmount = payment.data?.amount ?? payment.data?.data?.amount
    expect(paymentId, 'recorded payment has an id').toBeTruthy()

    assertTreasurerClean()
    await treasurerCtx.close()

    // ---- Clause 2 + 4: re-read the recorded payment from a SEPARATE session
    //      and assert it durably committed with the right person + amount
    //      (goal state, not "a row exists"). NOTE: there is no member-facing
    //      dues read model (/persons/me/dues does not exist), so the durable
    //      oracle is the authorized payment-by-id read; the member's own
    //      receipt view is a product gap (flagged in EXEC). ----
    const receipt = await independentRead<{
      status: number
      personId?: string
      amount?: number
    }>('treasurer', async (api) => {
      const res = await api.get<{
        personId?: string
        amount?: number
        data?: { personId?: string; amount?: number }
      }>(`/association/member/dues-payments/${paymentId}`, { orgId: ORG_ID })
      const body = res.data?.data ?? res.data ?? {}
      return { status: res.status, personId: body.personId, amount: body.amount }
    })
    expect(receipt.status, 'recorded payment is durably retrievable').toBe(200)
    expect(receipt.personId, 'payment is attributed to the target member').toBe(memberId)
    expect(receipt.amount, 'payment amount round-trips durably').toBe(recordedAmount)
  })
})
