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
import { authStateFile } from '../helpers/auth-state'
import { apiFetch } from '../helpers/api-fetch'
import { signUp } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Each multi-actor test mutates the membership row → run serial.
test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: officer approves member application', () => {
  // BLOCKED on product bug: POST /association/member/applications requires
  // existing org membership (services/api-ts/src/middleware/org-context.ts
  // — orgContextMiddleware rejects non-members with 403 "Not a member of
  // this organization"). Applicants by definition are not yet members,
  // so the apply flow cannot complete via API. The UI's /org/$slug.tsx
  // dialog silently swallows the 403 too.
  //
  // To unblock: add POST /association/member/applications (and tier
  // listing for non-members) to ORG_CONTEXT_EXEMPT in
  // middleware/org-context.ts, OR route apply through a public
  // `/public/org/{slug}/apply` endpoint that runs auth without org-membership.
  // Body below is wired and ready — remove .fixme once middleware is patched.
  test.fixme('applicant submits → officer approves → applicant sees Active', async ({
    browser,
  }) => {
    // ---- 1. Applicant context: fresh signUp + apply ----
    const applicantCtx = await browser.newContext()
    const applicantPage = await applicantCtx.newPage()
    const { email } = await signUp(applicantPage)
    await applicantPage.goto('/dashboard') // ensure SPA origin for apiFetch

    // Resolve applicant's person id (better-auth hook autocreates person
    // row with person.id = user.id on sign-up).
    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(
      applicantPage,
      '/persons/me',
    )
    const personId = me.data?.id ?? me.data?.data?.id
    expect(personId, 'applicant person row exists post-signUp').toBeTruthy()

    // Fetch a tier id for the org. /association/member/tiers requires
    // existing membership (org-context middleware throws 403 for non-
    // members), so we use the officer's storageState to read the tier id
    // up front. The applicant later submits with that tierId. The real UI
    // applicant flow silently fails to fetch tiers and submits with an
    // empty tierId — that's a separate product bug, not a test concern.
    const officerCtxBootstrap = await browser.newContext({
      storageState: authStateFile('officer'),
    })
    const officerBootstrapPage = await officerCtxBootstrap.newPage()
    await officerBootstrapPage.goto('/dashboard')
    const tiers = await apiFetch<
      Array<{ id: string }> | { data: Array<{ id: string }> }
    >(officerBootstrapPage, `/association/member/tiers`, { orgId: ORG_ID })
    const tierList = Array.isArray(tiers.data)
      ? tiers.data
      : (tiers.data as { data?: Array<{ id: string }> })?.data ?? []
    const tierId = tierList[0]?.id
    await officerCtxBootstrap.close()
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
    // 201 created OR 409 already-applied (re-run safe).
    expect(
      submit.status,
      `apply succeeded (got ${submit.status} ${JSON.stringify(submit.data).slice(0, 200)})`,
    ).toBeLessThan(400)
    const applicationId = submit.data?.id ?? submit.data?.data?.id ?? null

    // ---- 2. Officer context: approve ----
    const officerCtx = await browser.newContext({
      storageState: authStateFile('officer'),
    })
    const officerPage = await officerCtx.newPage()
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
    expect(approve.status).toBeLessThan(400)

    // ---- 3. Applicant sees Active membership ----
    // Force fresh data — the dashboard query may have cached the pre-approval
    // state. Refetch via API as the canonical post-state assertion.
    const memberships = await apiFetch<{
      data?: Array<{ organizationId: string; status: string }>
    }>(applicantPage, `/membership/members/me`)
    const orgMembership = memberships.data?.data?.find(
      (m) => m.organizationId === ORG_ID,
    )
    expect(
      orgMembership?.status,
      'applicant now has active membership in org',
    ).toBe('active')

    await applicantCtx.close()
    await officerCtx.close()
  })
})
