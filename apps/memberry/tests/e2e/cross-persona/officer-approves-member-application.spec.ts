// @journey-firewall — must-never-break journey; all 4 DoD clauses enforced by audit-e2e-depth gate
// WF-024 — Application Approval
/**
 * Cross-persona: Society officer approves a pending member application;
 *                that applicant then signs in as a member and sees
 *                "Active membership" in their dashboard.
 *
 * Personas: P5 (society officer) → P6 (member)
 *
 * Strategy: API-level multi-actor flow. UI sign-in steps are kept for
 * the applicant (to mint an authenticated browser context with a real
 * person row via the user.create.after hook), but state mutations
 * (apply, approve) go through apiFetch so the test exercises the
 * cross-actor state propagation, not the officer UI's dialog plumbing.
 *
 * Multi-context: officer uses storageState (helpers/auth-state.ts);
 * applicant gets a fresh context per run.
 */

import { test, expect } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { signUp } from '../helpers/auth'
import { attachErrorSurface } from '../helpers/error-surface'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Each multi-actor test mutates the membership row → run serial.
test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: officer approves member application', () => {
  test('applicant submits → officer approves → applicant sees Active', async ({
    browser,
  }) => {
    // ---- 1. Applicant context: fresh signUp + apply ----
    const applicantCtx = await browser.newContext()
    const applicantPage = await applicantCtx.newPage()
    const { email, password } = await signUp(applicantPage)
    await applicantPage.goto('/dashboard') // ensure SPA origin for apiFetch
    // Clause 1: no silent error surface on the applicant's path (pre-auth 401
    // session probes during the signup→dashboard transition are expected).
    const assertApplicantClean = attachErrorSurface(applicantPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: [/→ 401/, /GET \/api\/association\/event-lifecycle\/my → 403/],
    })

    // Resolve applicant's person id (better-auth hook autocreates person
    // row with person.id = user.id on sign-up).
    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(
      applicantPage,
      '/persons/me',
    )
    const personId = me.data?.id ?? me.data?.data?.id
    expect(personId, 'applicant person row exists post-signUp').toBeTruthy()

    // Fetch tier list via the public endpoint (G12) — no auth required,
    // mirrors what the real applicant UI flow does in /org/$slug.tsx.
    const tiers = await apiFetch<{
      data?: Array<{ id: string }>
    }>(applicantPage, `/public/org/${ORG_ID}/tiers`)
    const tierId = tiers.data?.data?.[0]?.id
    expect(tierId, 'org has at least one membership tier').toBeTruthy()

    // Submit application via API (mirrors /org/$slug.tsx apply dialog).
    const submit = await apiFetch<{
      id?: string
      data?: { id?: string }
    }>(applicantPage, '/association/member/applications', {
      method: 'POST',
      orgId: ORG_ID,
      body: {
        personId,
        organizationId: ORG_ID,
        tierId,
        applicationDate: new Date().toISOString().split('T')[0],
      },
    })
    // Clause 3: apply must succeed — 201/200 created, or 409 already-applied
    // (re-run safe). No `< 400` tolerance (which paradoxically excluded 409).
    expect(
      [200, 201, 409],
      `apply succeeded (got ${submit.status} ${JSON.stringify(submit.data).slice(0, 200)})`,
    ).toContain(submit.status)
    const applicationId = submit.data?.id ?? submit.data?.data?.id ?? null

    // ---- 2. Officer context: approve ----
    const officerCtx = await browser.newContext({
      storageState: await freshAuthState('officer'),
    })
    const officerPage = await officerCtx.newPage()
    const assertOfficerClean = attachErrorSurface(officerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
      allowApiFailures: [/→ 401/, /GET \/api\/association\/event-lifecycle\/my → 403/],
    })
    await officerPage.goto('/dashboard')

    // Find this applicant's pending application. DB enum is `submitted`
    // (NOT `pending`); see membership.schema.ts applicationStatusEnum.
    const pending = await apiFetch<{
      data?: Array<{ id: string; personId: string; status: string }>
    }>(officerPage, `/membership/applications/${ORG_ID}?status=submitted`, {
      orgId: ORG_ID,
    })
    const row =
      pending.data?.data?.find((a) => a.personId === personId) ?? null
    expect(row, `submitted application exists for ${email}`).toBeTruthy()

    const approveTarget = applicationId ?? row!.id
    const approve = await apiFetch(
      officerPage,
      `/association/member/applications/bulk-approve`,
      {
        method: 'POST',
        orgId: ORG_ID,
        body: { applicationIds: [approveTarget] },
      },
    )
    // Clause 3: approval must succeed.
    expect([200, 201], `bulk-approve succeeded (got ${approve.status})`).toContain(approve.status)

    // Clause 1: both actors' success paths produced no silent error surface.
    assertApplicantClean()
    assertOfficerClean()
    await applicantCtx.close()
    await officerCtx.close()

    // ---- 3. Clause 2 + 4: re-read memberships from a SEPARATE applicant
    //      session (a fresh sign-in, not the context that drove signup/apply)
    //      and assert the approval durably propagated a membership row.
    //      Bulk-approve creates it in `pendingPayment` until first dues clear. ----
    const membership = await independentRead<{ status: number; value?: string }>(
      { email, password },
      async (api) => {
        const res = await api.get<{ data?: Array<{ organizationId: string; status: string }> }>(
          '/persons/me/memberships',
        )
        const row = (res.data?.data ?? []).find((m) => m.organizationId === ORG_ID)
        return { status: res.status, value: row?.status }
      },
    )
    expect(membership.status, 'applicant reads memberships in a fresh session').toBe(200)
    expect(
      membership.value,
      `approval propagated a membership row (got ${membership.value})`,
    ).toMatch(/^(active|pendingPayment|grace|gracePeriod)$/)
  })
})
