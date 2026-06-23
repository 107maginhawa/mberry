// @journey-firewall — must-never-break journey; all 4 DoD clauses enforced by audit-e2e-depth gate
// WF-062 — Paid Training: fee collection via the offline proof-of-payment gate
// (TC-DEC-01/02). Officer creates + publishes a paid training; member enrolls
// (→ payment_pending), submits offline payment proof; officer confirms payment
// (→ enrolled). Cross-actor state machine, proven durable from an INDEPENDENT
// session. Self-contained (fresh training per run, so no enrollment clash).
//
// History: the prior version was a @selector-only-ok single-context API smoke —
// it asserted the flow but read the result back from the SAME officer session
// that performed the confirm, so it never proved server-side durability. R3-4
// hardened it to the 4-clause firewall: error-surface (clause 1), goal-state
// values (clause 2), per-step status (clause 3), independent-session read-back
// (clause 4).
import { test, expect } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { attachErrorSurface } from '../helpers/error-surface'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const unwrap = (d: any) => d?.data ?? d

// Known role-gated dashboard over-fetches that 403/401 for these personas and
// are swallowed by the UI (flagged separately as app bugs). Declared, not masked.
const DASHBOARD_ALLOW = [/→ 401/, /GET \/api\/association\/event-lifecycle\/my → 403/]

test.describe.configure({ mode: 'serial' })

test.describe('WF-062: paid training fee collection (proof-of-payment firewall)', () => {
  test('member enrolls in a paid training, submits proof, officer confirms; durable', async ({
    browser,
  }) => {
    // ---- 1. Officer creates + publishes a fresh PAID training ----
    const officerCtx = await browser.newContext({ storageState: await freshAuthState('officer') })
    const officerPage = await officerCtx.newPage()
    const assertOfficerClean = attachErrorSurface(officerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: DASHBOARD_ALLOW,
    })
    await officerPage.goto('/dashboard')

    const title = `E2E Paid Training ${Date.now()}`
    const tr = await apiFetch<{ id?: string; data?: { id?: string } }>(
      officerPage,
      '/association/training',
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          organizationId: ORG_ID,
          title,
          type: 'seminar',
          description: 'E2E paid-training coverage',
          location: 'Online',
          instructor: 'E2E Instructor',
          startDate: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          endDate: new Date(Date.now() + 14 * 86_400_000 + 7_200_000).toISOString(),
          capacity: 20,
          creditAmount: 5,
          registrationFee: 2000,
        },
      },
    )
    expect(tr.status, 'create training').toBe(201) // clause 3
    const trainingId = tr.data?.id ?? tr.data?.data?.id
    expect(trainingId, 'training id present').toBeTruthy()

    const pub = await apiFetch(officerPage, `/association/training/${trainingId}/publish`, {
      method: 'POST',
      orgId: ORG_ID,
      body: {},
    })
    expect([200, 201], `publish training (got ${pub.status})`).toContain(pub.status) // clause 3
    assertOfficerClean() // clause 1

    // ---- 2. Member enrolls (→ payment_pending) + submits offline proof ----
    const memberCtx = await browser.newContext({ storageState: await freshAuthState('member') })
    const memberPage = await memberCtx.newPage()
    const assertMemberClean = attachErrorSurface(memberPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: DASHBOARD_ALLOW,
    })
    await memberPage.goto('/dashboard')

    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(memberPage, '/persons/me')
    expect(me.status, 'member /persons/me readable').toBe(200) // clause 3
    const memberPid = me.data?.id ?? me.data?.data?.id
    expect(memberPid, 'member person id present').toBeTruthy()

    const enroll = await apiFetch<{ id?: string; status?: string; data?: { id?: string; status?: string } }>(
      memberPage,
      `/association/training-lifecycle/${trainingId}/enroll?organizationId=${ORG_ID}`,
      { method: 'POST', orgId: ORG_ID, body: { trainingId, personId: memberPid, organizationId: ORG_ID } },
    )
    expect(enroll.status, `enroll (got ${enroll.status})`).toBe(201) // clause 3
    const enrollment = unwrap(enroll.data)
    // clause 2: a PAID enrollment gates on payment — it is NOT yet enrolled.
    expect(enrollment.status, 'paid enrollment awaits payment').toBe('payment_pending')
    const enrollmentId = enrollment.id as string

    const proof = await apiFetch(
      memberPage,
      `/association/training-lifecycle/enrollments/${enrollmentId}/payment-proof?organizationId=${ORG_ID}`,
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          proofStorageKey: `s3://e2e/proof-${Date.now()}.pdf`,
          proofFileName: 'proof.pdf',
          proofMimeType: 'application/pdf',
        },
      },
    )
    expect([200, 201], `submit payment proof (got ${proof.status})`).toContain(proof.status) // clause 3
    assertMemberClean() // clause 1

    // ---- 3. Officer confirms payment → enrolled (clause 2 goal-state) ----
    const confirm = await apiFetch<{ status?: string; data?: { status?: string } }>(
      officerPage,
      `/association/training-lifecycle/enrollments/${enrollmentId}/confirm-payment?organizationId=${ORG_ID}`,
      { method: 'POST', orgId: ORG_ID, body: {} },
    )
    expect([200, 201], `confirm payment (got ${confirm.status})`).toContain(confirm.status) // clause 3
    expect(unwrap(confirm.data).status, 'enrollment confirmed → enrolled').toBe('enrolled') // clause 2
    assertOfficerClean() // clause 1
    await officerCtx.close()
    await memberCtx.close()

    // ---- 4. Clause 4: durable INDEPENDENT-session read-back ----
    // A fresh officer session must see the enrollment as 'enrolled' — proving the
    // proof→confirm transition persisted server-side, not just in the session
    // that wrote it.
    const durable = await independentRead<{ status: number; value?: string }>(
      'officer',
      async (api) => {
        const res = await api.get<{ data?: Array<{ personId: string; status: string }> }>(
          `/association/training-lifecycle/${trainingId}/enrollments?organizationId=${ORG_ID}`,
          { orgId: ORG_ID },
        )
        const rows = (res.data?.data ?? (res.data as unknown as Array<{ personId: string; status: string }>) ?? [])
        const row = rows.find((e) => e.personId === memberPid)
        return { status: res.status, value: row?.status }
      },
    )
    expect(durable.status, 'enrollments durably readable in a fresh session').toBe(200)
    expect(durable.value, 'the confirmed enrollment is durably enrolled').toBe('enrolled')
  })
})
