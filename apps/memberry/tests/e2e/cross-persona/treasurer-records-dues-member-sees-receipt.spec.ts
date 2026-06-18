// @journey-firewall — must-never-break journey; all 4 DoD clauses enforced by audit-e2e-depth gate
// WF-035 — Record Payment
/**
 * Cross-persona money path: a fresh applicant is approved (→ pendingPayment),
 * then a treasurer records a dues payment for that member, and the recorded
 * payment is durably retrievable from an independent session.
 *
 * Personas: P6 (applicant→member) + P5 (officer) + P3 (treasurer)
 *
 * Why approve-then-pay: recordDuesPayment is invoice/state-machine driven and
 * 409s if the target already has a completed payment (every seeded member
 * does). A just-approved applicant sits in `pendingPayment` with an open dues
 * obligation, so recording a payment is a real, conflict-free transition.
 *
 * History: the prior version POSTed `/dues/payments` (a non-existent route)
 * with `method`/`paymentDate` and read `/persons/me/dues` (also non-existent) —
 * all silently swallowed by a `< 500` assert, so it verified nothing. Surfaced
 * by the Phase-B clause-1 fixture.
 */

import { test, expect } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { signUp } from '../helpers/auth'
import { attachErrorSurface } from '../helpers/error-surface'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Known-expected errors on these personas' dashboards: pre-auth 401 session
// probes + the role-gated GET /association/event-lifecycle/my → 403 (a
// swallowed over-fetch flagged separately as an app bug). Declared, not masked.
// Known role-gated dashboard over-fetches that 403 for these personas and are
// swallowed by the UI (flagged separately as app bugs in EXEC findings).
const DASHBOARD_ALLOW = [
  /→ 401/,
  /GET \/api\/association\/event-lifecycle\/my → 403/,
  /GET \/api\/credit-compliance\/[^ ]+ → 403/,
]

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: treasurer records dues, member sees receipt', () => {
  // This journey surfaced a real P1 backend bug (PAY-EXT-409): recordDuesPayment
  // persisted membership-extension dates via updatePaymentStatus('completed' →
  // 'completed'), which the dues state-machine rejects → 409 → the whole payment
  // rolled back, so NO membership-extending manual payment could ever be
  // recorded. Fixed by routing the field-only write through updatePaymentFields
  // (services/api-ts; locked by recordDuesPayment.test.ts [PAY-EXT-409]).
  test('treasurer records a payment for a newly-approved member; it is durable', async ({
    browser,
  }) => {
    // ---- 1. Applicant: fresh signUp + apply (no prior completed payment) ----
    const applicantCtx = await browser.newContext()
    const applicantPage = await applicantCtx.newPage()
    const { email, password } = await signUp(applicantPage)
    await applicantPage.goto('/dashboard') // SPA origin for apiFetch
    const assertApplicantClean = attachErrorSurface(applicantPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: DASHBOARD_ALLOW,
    })

    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(applicantPage, '/persons/me')
    expect(me.status, 'applicant /persons/me readable').toBe(200) // clause 3
    const personId = me.data?.id ?? me.data?.data?.id
    expect(personId, 'applicant person row exists post-signUp').toBeTruthy()

    const tiers = await apiFetch<{ data?: Array<{ id: string }> }>(
      applicantPage,
      `/public/org/${ORG_ID}/tiers`,
    )
    const tierId = tiers.data?.data?.[0]?.id
    expect(tierId, 'org has at least one membership tier').toBeTruthy()

    const submit = await apiFetch<{ id?: string; data?: { id?: string } }>(
      applicantPage,
      '/association/member/applications',
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          personId,
          organizationId: ORG_ID,
          tierId,
          applicationDate: new Date().toISOString().split('T')[0],
        },
      },
    )
    expect(
      [200, 201, 409],
      `apply succeeded (got ${submit.status} ${JSON.stringify(submit.data).slice(0, 200)})`,
    ).toContain(submit.status) // clause 3
    const applicationId = submit.data?.id ?? submit.data?.data?.id ?? null
    assertApplicantClean() // clause 1
    await applicantCtx.close()

    // ---- 2. Officer approves → membership goes pendingPayment ----
    const officerCtx = await browser.newContext({ storageState: await freshAuthState('officer') })
    const officerPage = await officerCtx.newPage()
    const assertOfficerClean = attachErrorSurface(officerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: DASHBOARD_ALLOW,
    })
    await officerPage.goto('/dashboard')

    const pending = await apiFetch<{
      data?: Array<{ id: string; personId: string; status: string }>
    }>(officerPage, `/membership/applications/${ORG_ID}?status=submitted`, { orgId: ORG_ID })
    const row = pending.data?.data?.find((a) => a.personId === personId) ?? null
    const approveTarget = applicationId ?? row?.id
    expect(approveTarget, `submitted application exists for ${email}`).toBeTruthy()

    const approve = await apiFetch(officerPage, '/association/member/applications/bulk-approve', {
      method: 'POST',
      orgId: ORG_ID,
      body: { applicationIds: [approveTarget] },
    })
    expect([200, 201], `bulk-approve succeeded (got ${approve.status})`).toContain(approve.status) // clause 3
    assertOfficerClean() // clause 1
    await officerCtx.close()

    // ---- 3. Treasurer records a dues payment for the now-open member ----
    const treasurerCtx = await browser.newContext({
      storageState: await freshAuthState('treasurer'),
    })
    const treasurerPage = await treasurerCtx.newPage()
    const assertTreasurerClean = attachErrorSurface(treasurerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: DASHBOARD_ALLOW,
    })
    await treasurerPage.goto('/dashboard')

    const amount = 10000 + (Date.now() % 90000) // unique integer cents
    const payment = await apiFetch<{
      id?: string
      amount?: number
      data?: { id?: string; amount?: number }
    }>(treasurerPage, '/association/member/dues-payments', {
      method: 'POST',
      orgId: ORG_ID,
      body: {
        organizationId: ORG_ID,
        personId,
        amount,
        currency: 'PHP',
        paymentMethod: 'cash',
      },
    })
    expect(
      [200, 201],
      `record payment succeeded (got ${payment.status} ${JSON.stringify(payment.data).slice(0, 200)})`,
    ).toContain(payment.status) // clause 3
    const paymentId = payment.data?.id ?? payment.data?.data?.id
    const recordedAmount = payment.data?.amount ?? payment.data?.data?.amount
    expect(paymentId, 'recorded payment has an id').toBeTruthy()
    assertTreasurerClean() // clause 1
    await treasurerCtx.close()

    // ---- 4. Clause 2 + 4: durable read-back from an INDEPENDENT session ----
    // (No member-facing dues/receipt read model exists — /persons/me/dues is not
    // a route — so the durable oracle is the authorized payment-by-id read. The
    // member's own receipt view is a product gap flagged in EXEC.)
    const receipt = await independentRead<{ status: number; personId?: string; amount?: number }>(
      'treasurer',
      async (api) => {
        const res = await api.get<{
          personId?: string
          amount?: number
          data?: { personId?: string; amount?: number }
        }>(`/association/member/dues-payments/${paymentId}`, { orgId: ORG_ID })
        const body = res.data?.data ?? res.data ?? {}
        return { status: res.status, personId: body.personId, amount: body.amount }
      },
    )
    expect(receipt.status, 'recorded payment is durably retrievable').toBe(200)
    expect(receipt.personId, 'payment is attributed to the approved member').toBe(personId)
    expect(receipt.amount, 'payment amount round-trips durably').toBe(recordedAmount)

    // Clause 2 (cross-actor goal): the member sees the resulting membership row
    // from their own fresh session.
    const membership = await independentRead<{ status: number; value?: string }>(
      { email, password },
      async (api) => {
        const res = await api.get<{ data?: Array<{ organizationId: string; status: string }> }>(
          '/persons/me/memberships',
        )
        const m = (res.data?.data ?? []).find((x) => x.organizationId === ORG_ID)
        return { status: res.status, value: m?.status }
      },
    )
    expect(membership.status, 'member reads memberships in a fresh session').toBe(200)
    expect(
      membership.value,
      `membership reflects payment lifecycle (got ${membership.value})`,
    ).toMatch(/^(active|pendingPayment|grace|gracePeriod)$/)
  })
})
