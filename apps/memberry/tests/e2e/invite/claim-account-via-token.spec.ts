// AXIS-4 — Invite Claim (member journey)
// WF-002 / M-2 / BR-24: an officer-issued invite token is claimed by a newly
// signed-up person → a REAL membership row is created → they land authenticated
// inside the org.
//
// Why this file exists (gap-filler, not a duplicate):
//   tests/e2e/auth/account-claim.spec.ts only covers the *error* states of the
//   /invite/$token page (invalid / expired / already-claimed fake tokens). It
//   never drives the success path: no real invite is created, nothing is
//   claimed, and no membership/landing state is asserted. This spec closes that
//   gap end-to-end against the live stack:
//     officer → POST /invite (real token)
//     fresh person → signUp → GET /invite/validate/<token> (200, pre-pop data)
//     fresh person → "Accept Invitation" → POST /invite/claim/<token> (200)
//     assert: claim response carries a real membershipId + org slug
//     assert: UI lands authenticated at /org/<slug>/home
//     assert (clause-4 independent read): a durable membership row now exists
//             for that person in the org, status 'active', tier matches the
//             invite, id === claim.membershipId
//     assert (idempotency): re-claiming the same token → 409 ALREADY_CLAIMED
//
// Real-flow, not selector-only: every claim assertion reads wire status/data
// (captureRouteHydration + apiFetch + independentRead), per the journey DoD.

import { test, expect } from '../helpers/test-fixture'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { signUp } from '../helpers/auth'
import { captureRouteHydration } from '../helpers/real-flow'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ORG_SLUG = 'pda-metro-manila'

// Officer-issued invites + membership creation mutate durable state and the
// claim is one-time — keep the actors deterministic and serial.
test.describe.configure({ mode: 'serial' })

/**
 * Officer mints a real invite for `email` carrying a valid membership tier in
 * its metadata (tierId is NOT NULL at the DB level — claimInvite hard-rejects a
 * missing tier with a 400, so the invite must carry a real one). Returns the
 * raw token (shown only once by createInvite).
 */
async function createRealInvite(
  browser: import('@playwright/test').Browser,
  email: string,
  name: string,
): Promise<{ token: string; tierId: string }> {
  const officerCtx = await browser.newContext({
    storageState: await freshAuthState('officer'),
  })
  try {
    const officerPage = await officerCtx.newPage()
    // Navigate to the SPA origin so apiFetch's CSRF/Origin plumbing is valid.
    await officerPage.goto('/dashboard')

    // Resolve a REAL tier for this org (seeded ids are generated, not fixed).
    const tiers = await apiFetch<{ data?: Array<{ id: string }> }>(
      officerPage,
      '/association/member/tiers',
      { orgId: ORG_ID },
    )
    const tierId = tiers.data?.data?.[0]?.id
    expect(
      tierId,
      `org ${ORG_SLUG} exposes at least one membership tier (got ${tiers.status})`,
    ).toBeTruthy()

    // Officer issues the invite. In the test stack NODE_ENV!=='production', so
    // requireOfficerTerm does not gate on 2FA → the seeded president can create.
    const created = await apiFetch<{ token?: string; id?: string }>(
      officerPage,
      '/invite',
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          email,
          type: 'invite',
          metadata: { name, membershipTierId: tierId },
        },
      },
    )
    expect(
      [200, 201],
      `officer created invite (got ${created.status} ${JSON.stringify(created.data).slice(0, 200)})`,
    ).toContain(created.status)
    const token = created.data?.token
    expect(token, 'createInvite returned a raw token (one-time)').toBeTruthy()

    return { token: token as string, tierId: tierId as string }
  } finally {
    await officerCtx.close()
  }
}

test.describe('AXIS-4: invited person claims account via token → real membership', () => {
  test('signUp → validate token → Accept → real membership + authenticated org landing', async ({
    browser,
  }) => {
    // ---- 1. Fresh person: real signUp (autocreates the person row via the
    //         better-auth user.create.after hook; email-verification is OFF in
    //         the test stack so the session lands inside the app). ----
    const personCtx = await browser.newContext()
    const personPage = await personCtx.newPage()
    const { email, password, name } = await signUp(personPage)

    // Resolve the person id so the final independent read can sanity-check the
    // membership belongs to THIS person.
    await personPage.goto('/dashboard')
    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(
      personPage,
      '/persons/me',
    )
    const personId = me.data?.id ?? me.data?.data?.id
    expect(personId, 'fresh person row exists post-signUp').toBeTruthy()

    // ---- 2. Officer issues a REAL invite to this person's email. ----
    const { token, tierId } = await createRealInvite(browser, email, name)

    // ---- 3. Person opens the real claim link; validate must hydrate (200) and
    //         surface the pre-populated invite data, not a blank/error shell. ----
    const validateP = captureRouteHydration(
      personPage,
      new RegExp(`/api/invite/validate/${encodeURIComponent(token)}`),
      { method: 'GET' },
    )
    await personPage.goto(`/invite/${token}`)
    const validateResp = await validateP
    expect(validateResp?.status(), 'validate token hydration is 200').toBe(200)
    const validateBody = await validateResp!.json().catch(() => null)
    expect(validateBody?.valid, 'validate returned valid:true').toBe(true)
    expect(validateBody?.orgId, 'validate echoes the org').toBe(ORG_ID)

    // UI shows the real pre-populated invite (name + email from metadata).
    await expect(
      personPage.getByText(name, { exact: false }).first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      personPage.getByText(email, { exact: false }).first(),
    ).toBeVisible({ timeout: 10000 })

    // ---- 4. Accept: the authenticated person claims. Capture the real claim
    //         POST — assert it returns 200 with a durable membershipId + slug. ----
    const acceptBtn = personPage.getByRole('button', { name: /accept invitation/i })
    await expect(
      acceptBtn,
      'authenticated person sees "Accept Invitation" (not the sign-in CTA)',
    ).toBeVisible({ timeout: 10000 })

    const claimP = captureRouteHydration(
      personPage,
      new RegExp(`/api/invite/claim/${encodeURIComponent(token)}`),
      { method: 'POST' },
    )
    await acceptBtn.click()
    const claimResp = await claimP
    expect(claimResp?.status(), 'claim POST is 200').toBe(200)
    const claimBody = await claimResp!.json().catch(() => null)
    expect(claimBody?.claimed, 'claim response claimed:true').toBe(true)
    expect(claimBody?.organizationId, 'claim created membership in the org').toBe(ORG_ID)
    expect(claimBody?.organizationSlug, 'claim returns the org slug for redirect').toBe(ORG_SLUG)
    expect(
      claimBody?.membershipId,
      'claim created a REAL membership row (id present)',
    ).toBeTruthy()
    const membershipId = claimBody.membershipId as string

    // ---- 5. UI lands authenticated INSIDE the org (the journey's goal). ----
    await personPage.waitForURL(
      (url) => url.pathname === `/org/${ORG_SLUG}/home`,
      { timeout: 15000 },
    )
    await expect(
      personPage.getByRole('heading', { name: /organization home/i }),
    ).toBeVisible({ timeout: 15000 })

    await personCtx.close()

    // ---- 6. Clause-4 INDEPENDENT READ: from a brand-new session (not the page
    //         that drove the claim), assert the membership durably committed
    //         under this person, in this org, active, with the invite's tier,
    //         and is exactly the row the claim reported. ----
    const durable = await independentRead<{
      status: number
      row?: {
        id?: string
        organizationId?: string
        personId?: string
        status?: string
        tierId?: string
        orgSlug?: string
      }
    }>({ email, password }, async (api) => {
      const res = await api.get<{
        data?: Array<{
          id: string
          organizationId: string
          personId: string
          status: string
          tierId: string
          orgSlug: string
        }>
      }>('/persons/me/memberships')
      const row = (res.data?.data ?? []).find((m) => m.organizationId === ORG_ID)
      return { status: res.status, row }
    })

    expect(durable.status, 'independent session reads memberships (200)').toBe(200)
    expect(
      durable.row,
      'a durable membership row exists for the claimer in the org',
    ).toBeTruthy()
    expect(durable.row?.id, 'durable row is the one the claim created').toBe(membershipId)
    expect(durable.row?.personId, 'membership belongs to the claimer').toBe(personId)
    expect(durable.row?.status, 'invite-claim membership is active').toBe('active')
    expect(durable.row?.tierId, 'membership carries the invited tier').toBe(tierId)
    expect(durable.row?.orgSlug, 'membership joined to the right org').toBe(ORG_SLUG)
  })

  test('claimed token is one-time: re-claiming the same token → 409 ALREADY_CLAIMED', async ({
    browser,
  }) => {
    // Fresh person + fresh invite, claim it once via the API, then prove the
    // second claim is rejected (the invite is burned). This guards the
    // one-time / idempotency contract of claimInvite without depending on the
    // first test's leftover state.
    const personCtx = await browser.newContext()
    try {
      const personPage = await personCtx.newPage()
      const { email, name } = await signUp(personPage)
      await personPage.goto('/dashboard')

      const { token } = await createRealInvite(browser, email, name)

      // First claim succeeds (drive via API as the just-signed-up person).
      const first = await apiFetch<{ claimed?: boolean; membershipId?: string }>(
        personPage,
        `/invite/claim/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      expect(
        first.status,
        `first claim succeeds (got ${first.status} ${JSON.stringify(first.data).slice(0, 200)})`,
      ).toBe(200)
      expect(first.data?.claimed, 'first claim claimed:true').toBe(true)

      // Second claim of the SAME token is rejected as already-claimed (409).
      const second = await apiFetch<{ error?: string }>(
        personPage,
        `/invite/claim/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      expect(
        second.status,
        `re-claim is rejected as conflict (got ${second.status} ${JSON.stringify(second.data).slice(0, 200)})`,
      ).toBe(409)

      // The public validate endpoint now reports the token as gone (410 / claimed).
      const validate = await apiFetch<{ code?: string; error?: string }>(
        personPage,
        `/invite/validate/${encodeURIComponent(token)}`,
      )
      expect(validate.status, 'validate of a claimed token is 410 gone').toBe(410)
      expect(validate.data?.code, 'validate reports ALREADY_CLAIMED').toBe('ALREADY_CLAIMED')
    } finally {
      await personCtx.close()
    }
  })

  test('unauthenticated visitor on a valid invite is gated to sign-in, not auto-claimed', async ({
    browser,
  }) => {
    // A real, valid invite — but the visitor has NO session. The page must show
    // the sign-in CTA (claim requires auth) and must NOT create a membership.
    // This protects the auth boundary on the claim route.
    const officerEmail = `invitee-noauth-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.local`
    const { token } = await createRealInvite(browser, officerEmail, 'No Auth Invitee')

    const anonCtx = await browser.newContext() // no storageState → unauthenticated
    try {
      const anonPage = await anonCtx.newPage()

      const validateP = captureRouteHydration(
        anonPage,
        new RegExp(`/api/invite/validate/${encodeURIComponent(token)}`),
        { method: 'GET' },
      )
      await anonPage.goto(`/invite/${token}`)
      const validateResp = await validateP
      expect(validateResp?.status(), 'public validate works without auth (200)').toBe(200)

      // Unauthenticated branch renders the sign-in CTA, NOT the accept button.
      await expect(
        anonPage.getByRole('button', { name: /sign in to accept invitation/i }),
      ).toBeVisible({ timeout: 10000 })
      await expect(
        anonPage.getByRole('button', { name: /^accept invitation$/i }),
      ).toHaveCount(0)

      // Direct API claim without a session is rejected (401) — no silent claim.
      const claim = await apiFetch<{ error?: string }>(
        anonPage,
        `/invite/claim/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      expect(
        claim.status,
        `unauthenticated claim is rejected (got ${claim.status})`,
      ).toBe(401)
    } finally {
      await anonCtx.close()
    }
  })
})
