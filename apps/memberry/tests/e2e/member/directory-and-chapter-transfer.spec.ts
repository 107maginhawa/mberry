// WF — Member Directory publish/search + Chapter Affiliation Transfer (dual approval)
//
// REAL-FLOW upgrade of the thin selector-only specs member/directory.spec.ts
// (renders search input) and member/transfer.spec.ts (dialog open/close).
// Those assert headings + button enabled-state only; this file asserts the
// actual data + state change behind both journeys.
//
// Both features are LIVE routes (verified against routeTree.gen.ts + the route
// files):
//   J1 directory  → /org/$orgSlug/directory + /org/$orgSlug/members (search UI)
//                   + /my/profile "Directory Profile" publish control
//   J2 transfer   → /my/organizations "Transfer membership" dialog
//
// Backend wires confirmed live in the generated registry + OpenAPI spec:
//   GET   /association/member/directory/search                (searchDirectory)
//   POST  /association/member/directory/profiles              (createDirectoryProfile)
//   PATCH /association/member/directory/profiles/{profileId}  (updateDirectoryProfile — visibility)
//   POST  /association/member/affiliation-transfers           (createAffiliationTransfer → 'requested')
//   POST  .../{id}/approve-source                             ('pendingTargetApproval')
//   POST  .../{id}/approve-target                             ('approved')
//   POST  .../{id}/complete                                   ('completed' + affiliation MOVES)
//   GET   /association/member/affiliation-transfers/{id}      (getAffiliationTransfer)
//
// AUTH (verified live + in routes.ts / chapters.tsp):
//   - createAffiliationTransfer  → ['association:member:owner','association:admin']
//       → a plain MEMBER can request a transfer (member:owner).
//   - approve-source / approve-target / complete / get
//       → ['association:admin','chapter:officer'] (complete: admin only).
//       → a plain MEMBER is FORBIDDEN (403) — verified live: member approve-source → 403.
//   This is the run-blocker the old spec hit: it ran as authRole:'member' and
//   tried to drive the OFFICER approval legs. J2 below therefore runs in an
//   OFFICER context (the seeded officer holds association:admin, so it can drive
//   request → both approvals → complete and read affiliations back).
//   The approve bodies REQUIRE `officerId` (TransferDecisionRequest, z.string());
//   the old `body: {}` would 400 even with officer auth.
//
// The directory create+update+search wires are exactly what the /my/profile
// "Directory Profile" publishMutation drives (POST create when no profile, PATCH
// /profiles/{id} for visibility). NOTE: the handler publishMyDirectoryProfile
// (PATCH .../profiles/mine/publish) exists in source but is NOT wired into the
// registry/OpenAPI — it is DEAD CODE and is deliberately not exercised here.
//
// Visibility-respected proof: directory.repo.searchWithFilters restricts to
// visibility IN ('public','memberOnly') (hidden excluded) AND personId must be
// an active membership in the org. So a member's profile is searchable only
// when published (memberOnly/public) — and disappears when set to hidden.
import type { Page } from '@playwright/test'
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'
import { freshAuthState } from '../helpers/programmatic-auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.use({ authRole: 'member' })

// ── shared helpers ─────────────────────────────────────────────────────────

/** Resolve the signed-in member's own personId (active member of the org). */
async function resolveMyPersonId(page: Page): Promise<string> {
  // page must already be on the SPA so the in-page fetch carries Origin + cookies.
  const me = await apiFetch<{ id?: string; data?: { id?: string } }>(page, '/persons/me')
  expect(me.status, 'GET /persons/me succeeds').toBeLessThan(400)
  const personId = me.data?.id ?? me.data?.data?.id
  expect(personId, 'signed-in member has a person id').toBeTruthy()
  return personId as string
}

/** Search the org directory and return the raw profile list. */
async function searchDirectory(
  page: Page,
  q: string,
): Promise<{ status: number; profiles: any[] }> {
  const res = await apiFetch<{ data?: any[] }>(
    page,
    `/association/member/directory/search?q=${encodeURIComponent(q)}&limit=100`,
    { orgId: ORG_ID },
  )
  return { status: res.status, profiles: res.data?.data ?? [] }
}

// ════════════════════════════════════════════════════════════════════════════
// JOURNEY 1 — Member publishes a directory profile + the directory is searchable
// ════════════════════════════════════════════════════════════════════════════
test.describe('M-10: Directory publish → searchable (visibility respected)', () => {
  test('published profile appears in search; hiding it removes it (visibility respected)', async ({ page }) => {
    // Land on the SPA so apiFetch's in-page fetch carries a real Origin + the
    // session cookie (CSRF-aware mutations require it).
    await page.goto('/my/organizations')
    await page.waitForLoadState('domcontentloaded')

    // Use the signed-in member's OWN personId: searchWithFilters only surfaces
    // profiles whose person is an active member of the org, so the profile must
    // belong to an active member to be discoverable at all.
    const personId = await resolveMyPersonId(page)

    // Unique display name → collision-proof assertions under parallel/repeat runs.
    const displayName = `E2E Directory ${crypto.randomUUID().slice(0, 8)}`

    // ── 1. PUBLISH: create a directory profile with visibility=memberOnly ─────
    // This is the LIVE create wire the /my/profile "Publish to Directory" button
    // uses when the member has no profile yet (POST /directory/profiles).
    const created = await apiFetch<{ id?: string; visibility?: string }>(
      page,
      '/association/member/directory/profiles',
      {
        method: 'POST',
        orgId: ORG_ID,
        body: { personId, displayName, specialty: 'E2E Specialty', visibility: 'memberOnly' },
      },
    )
    expect(created.status, 'create directory profile returns 201').toBe(201)
    const profileId = created.data?.id
    expect(profileId, 'created profile has an id').toBeTruthy()
    expect(created.data?.visibility, 'profile is published memberOnly').toBe('memberOnly')

    // ── 2. SEARCHABLE: the published profile is returned by directory search ──
    const afterPublish = await searchDirectory(page, displayName)
    expect(afterPublish.status, 'directory search succeeds').toBe(200)
    const mineWhenPublished = afterPublish.profiles.find((p) => p.id === profileId)
    expect(
      mineWhenPublished,
      'the published member profile is discoverable in directory search',
    ).toBeTruthy()
    // Real data, not just presence: the row carries the display name + visibility.
    expect(mineWhenPublished.displayName, 'search row carries the published display name').toBe(
      displayName,
    )
    expect(['public', 'memberOnly']).toContain(mineWhenPublished.visibility)

    // ── 3. VISIBILITY RESPECTED: hide it → it must drop out of search ─────────
    // PATCH /directory/profiles/{id} is the LIVE update wire the profile page's
    // "Hide from Directory" button uses.
    const hidden = await apiFetch<{ visibility?: string }>(
      page,
      `/association/member/directory/profiles/${profileId}`,
      { method: 'PATCH', orgId: ORG_ID, body: { visibility: 'hidden' } },
    )
    expect(hidden.status, 'set visibility=hidden succeeds').toBe(200)
    expect(hidden.data?.visibility, 'visibility flipped to hidden').toBe('hidden')

    const afterHide = await searchDirectory(page, displayName)
    expect(afterHide.status, 'directory search still succeeds').toBe(200)
    expect(
      afterHide.profiles.find((p) => p.id === profileId),
      'a hidden profile is NOT returned by directory search (visibility respected)',
    ).toBeUndefined()

    // ── 4. cleanup: remove the test profile so seed search state stays clean ──
    await apiFetch(page, `/association/member/directory/profiles/${profileId}`, {
      method: 'DELETE',
      orgId: ORG_ID,
    })
  })

  test('UI: /my/profile Directory Profile control performs a real publish write', async ({ page }) => {
    // The /my/profile page reads the directory profile via
    // GET /api/association/member/directory/search and renders the Directory
    // Profile card. Capture that hydration to prove the wire returned data.
    const searchHydration = captureRouteHydration(
      page,
      /\/association\/member\/directory\/search/,
    )
    await page.goto('/my/profile')

    // Profile shell rendered (h1 Profile). h3 "Directory Profile" also exists,
    // so filter by level to avoid a strict-mode collision.
    await expect(
      page.getByRole('heading', { name: /^profile$/i, level: 1 }),
    ).toBeVisible({ timeout: 15000 })

    const hydration = await searchHydration
    expect(hydration?.status(), 'directory profile hydration GET returned 200').toBe(200)

    // The Directory Profile card surfaces current visibility + a publish/hide toggle.
    await expect(page.getByRole('heading', { name: /directory profile/i })).toBeVisible()

    // The card shows EITHER "Publish to Directory" (when hidden/no profile) or
    // "Hide from Directory" (when already published). Whichever is present,
    // clicking it MUST fire a real create/update on the directory/profiles wire.
    const publishBtn = page.getByRole('button', { name: /publish to directory/i })
    const hideBtn = page.getByRole('button', { name: /hide from directory/i })
    const toggle = (await publishBtn.isVisible().catch(() => false)) ? publishBtn : hideBtn
    await expect(toggle, 'directory visibility toggle is present').toBeVisible({ timeout: 10000 })

    const writeP = page.waitForResponse(
      (r) =>
        /\/api\/association\/member\/directory\/profiles/.test(r.url()) &&
        ['POST', 'PATCH'].includes(r.request().method()),
      { timeout: 15000 },
    )
    await toggle.click()
    const write = await writeP
    expect(
      write.status(),
      'directory visibility mutation succeeded on the wire (real write, not a no-op)',
    ).toBeLessThan(400)

    // Success toast confirms the visibility change was persisted.
    await expect(page.getByText(/directory visibility updated/i)).toBeVisible({ timeout: 10000 })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// JOURNEY 2 — Chapter affiliation transfer with dual approval
//   request → source-approve → target-approve → 'approved'
// ════════════════════════════════════════════════════════════════════════════
test.describe('M-16: Chapter affiliation transfer (dual approval)', () => {
  test.describe.configure({ mode: 'serial' })

  // RUN-BLOCKER FIX: the dual-approval legs (approve-source/target) + complete +
  // get all require ['association:admin','chapter:officer']; a plain member is
  // 403 (verified live). Drive the whole flow as the seeded OFFICER, who holds
  // association:admin. (J1 above stays in the file-level member context.)
  test.use({ authRole: 'officer' })

  test('member can request; officer drives dual approval + complete → affiliation MOVES', async ({
    page,
  }) => {
    await page.goto('/my/organizations')
    await page.waitForLoadState('domcontentloaded')

    // The officer's own personId — recorded as approvedBySource/approvedByTarget
    // and supplied as the required `officerId` decision-body field.
    const officerId = await resolveMyPersonId(page)

    // Synthetic transfer subject. Chapter/person columns here are NOT FK-enforced
    // (seed uses chapterId === orgId); a synthetic personId keeps this run from
    // colliding with real seed affiliations under parallel/repeat runs.
    const subjectPersonId = crypto.randomUUID()
    const fromChapterId = ORG_ID
    const toChapterId = crypto.randomUUID()

    // ── 0. SEED SOURCE AFFILIATION ───────────────────────────────────────────
    // An ACTIVE affiliation in the source chapter, so `complete` has a real row
    // to flip to 'transferred'. Asserting this flip is the "affiliation moves"
    // proof the journey is really about (not just a status enum on the request).
    const srcAff = await apiFetch<{ id?: string; status?: string }>(
      page,
      '/association/member/chapter-affiliations',
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          personId: subjectPersonId,
          chapterId: fromChapterId,
          isPrimary: true,
          affiliatedAt: new Date().toISOString(),
        },
      },
    )
    expect(srcAff.status, 'seed source affiliation returns 201').toBe(201)
    const srcAffiliationId = srcAff.data?.id
    expect(srcAffiliationId, 'seed source affiliation has an id').toBeTruthy()
    expect(srcAff.data?.status, 'source affiliation starts active').toBe('active')

    // ── 1. REQUEST ───────────────────────────────────────────────────────────
    const created = await apiFetch<{ id?: string; status?: string }>(
      page,
      '/association/member/affiliation-transfers',
      { method: 'POST', orgId: ORG_ID, body: { personId: subjectPersonId, fromChapterId, toChapterId } },
    )
    expect(created.status, 'create transfer returns 201').toBe(201)
    const transferId = created.data?.id
    expect(transferId, 'created transfer has an id').toBeTruthy()
    expect(created.data?.status, 'new transfer starts in requested state').toBe('requested')

    // ── 2. SOURCE APPROVAL → pendingTargetApproval ───────────────────────────
    // officerId is REQUIRED by TransferDecisionRequest (z.string()).
    const srcApproved = await apiFetch<{ status?: string; approvedBySource?: string | null }>(
      page,
      `/association/member/affiliation-transfers/${transferId}/approve-source`,
      { method: 'POST', orgId: ORG_ID, body: { officerId } },
    )
    expect(srcApproved.status, 'approve-source succeeds (officer)').toBe(200)
    expect(srcApproved.data?.approvedBySource, 'source approver recorded').toBeTruthy()
    expect(
      srcApproved.data?.status,
      'after first (source) approval, transfer awaits the target',
    ).toBe('pendingTargetApproval')

    // ── 3. TARGET APPROVAL → approved (dual approval complete) ────────────────
    const tgtApproved = await apiFetch<{ status?: string; approvedByTarget?: string | null }>(
      page,
      `/association/member/affiliation-transfers/${transferId}/approve-target`,
      { method: 'POST', orgId: ORG_ID, body: { officerId } },
    )
    expect(tgtApproved.status, 'approve-target succeeds (officer)').toBe(200)
    expect(tgtApproved.data?.approvedByTarget, 'target approver recorded').toBeTruthy()
    expect(
      tgtApproved.data?.status,
      'dual approval (source + target) advances the transfer to approved',
    ).toBe('approved')

    // ── 4. COMPLETE → completed + the affiliation actually MOVES ──────────────
    // This is the real state change the journey is about: the source affiliation
    // flips to 'transferred' and a NEW active affiliation appears in the target
    // chapter (carrying transferredFrom = source).
    const completed = await apiFetch<{ status?: string; completedAt?: string | null }>(
      page,
      `/association/member/affiliation-transfers/${transferId}/complete`,
      { method: 'POST', orgId: ORG_ID, body: {} },
    )
    expect(completed.status, 'complete succeeds (admin/officer)').toBe(200)
    expect(completed.data?.status, 'completed transfer reports completed').toBe('completed')
    expect(completed.data?.completedAt, 'completedAt stamped on completion').toBeTruthy()

    // ── 5. STATE PERSISTED: re-read the transfer ──────────────────────────────
    const fetched = await apiFetch<{
      status?: string
      approvedBySource?: string | null
      approvedByTarget?: string | null
    }>(page, `/association/member/affiliation-transfers/${transferId}`, { orgId: ORG_ID })
    expect(fetched.status, 'GET transfer succeeds').toBe(200)
    expect(fetched.data?.status, 'completed state is durable on re-read').toBe('completed')
    expect(fetched.data?.approvedBySource, 'source approval durable').toBeTruthy()
    expect(fetched.data?.approvedByTarget, 'target approval durable').toBeTruthy()

    // ── 6. AFFILIATION MOVED: target gains an active row, source is transferred ─
    const tgtAffs = await apiFetch<{ data?: any[] }>(
      page,
      `/association/member/chapter-affiliations?personId=${subjectPersonId}&chapterId=${toChapterId}&status=active&limit=10`,
      { orgId: ORG_ID },
    )
    expect(tgtAffs.status, 'list target affiliations succeeds').toBe(200)
    const tgtRows = tgtAffs.data?.data ?? []
    const movedIn = tgtRows.find((a) => a.chapterId === toChapterId)
    expect(movedIn, 'a new active affiliation exists in the target chapter').toBeTruthy()
    expect(movedIn.transferredFrom, 'the new affiliation records it came from the source chapter').toBe(
      fromChapterId,
    )

    const srcAffs = await apiFetch<{ data?: any[] }>(
      page,
      `/association/member/chapter-affiliations?personId=${subjectPersonId}&chapterId=${fromChapterId}&limit=10`,
      { orgId: ORG_ID },
    )
    expect(srcAffs.status, 'list source affiliations succeeds').toBe(200)
    const srcRow = (srcAffs.data?.data ?? []).find((a) => a.id === srcAffiliationId)
    expect(srcRow, 'the seeded source affiliation is still present').toBeTruthy()
    expect(srcRow.status, 'the source affiliation flipped to transferred (it moved out)').toBe(
      'transferred',
    )
  })

  test('member CANNOT drive the officer-only approval legs (403)', async ({ browser }) => {
    // Negative guard for the run-blocker: prove a plain member is forbidden from
    // the approval transitions (the reason J2 must run as officer). Uses an
    // independent member context so it doesn't perturb the officer-driven flow.
    const memberState = await freshAuthState('member')
    const ctx = await browser.newContext({ storageState: memberState })
    try {
      const mpage = await ctx.newPage()
      await mpage.goto('/my/organizations')
      await mpage.waitForLoadState('domcontentloaded')

      const memberPersonId = await resolveMyPersonId(mpage)

      // A member MAY request a transfer (member:owner).
      const req = await apiFetch<{ id?: string; status?: string }>(
        mpage,
        '/association/member/affiliation-transfers',
        {
          method: 'POST',
          orgId: ORG_ID,
          body: { personId: memberPersonId, fromChapterId: ORG_ID, toChapterId: crypto.randomUUID() },
        },
      )
      expect(req.status, 'member can request a transfer (member:owner)').toBe(201)
      const tid = req.data?.id
      expect(tid, 'member request has an id').toBeTruthy()

      // …but a member is FORBIDDEN from approving it (officer/admin only).
      const denied = await apiFetch(
        mpage,
        `/association/member/affiliation-transfers/${tid}/approve-source`,
        { method: 'POST', orgId: ORG_ID, body: { officerId: memberPersonId } },
      )
      expect(
        denied.status,
        'a plain member is forbidden from the officer approval leg (this is why J2 runs as officer)',
      ).toBe(403)
    } finally {
      await ctx.close()
    }
  })

  test('UI: transfer dialog on /my/organizations submits a real transfer request', async ({ page }) => {
    // /my/organizations hydrates via /persons/me/memberships. Capture it to prove
    // the membership list came from the backend (an Active row → Transfer button).
    const hydration = captureRouteHydration(page, /\/persons\/me\/memberships/)
    await page.goto('/my/organizations')
    const hy = await hydration
    expect(hy?.status(), 'memberships hydration returned 200').toBe(200)

    // Need at least one non-terminated membership to expose the Transfer control.
    const hasActive = await page
      .getByText(/active/i)
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    test.skip(!hasActive, 'No active membership in seed data — transfer control not rendered')

    const transferBtn = page.getByLabel('Transfer membership').first()
    await expect(transferBtn).toBeVisible()
    await transferBtn.click()

    // Dialog opens with the target-org input.
    await expect(page.getByRole('heading', { name: /transfer membership/i })).toBeVisible({
      timeout: 5000,
    })
    const input = page.locator('[role="dialog"] input').first()
    await input.fill(crypto.randomUUID())

    const submitBtn = page.getByRole('button', { name: /request transfer/i })
    await expect(submitBtn).toBeEnabled()

    // Submit → assert the REAL create fires on the affiliation-transfers wire.
    const createP = page.waitForResponse(
      (r) =>
        /\/api\/association\/member\/affiliation-transfers(\?|$)/.test(r.url()) &&
        r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await submitBtn.click()
    const createResp = await createP
    expect(
      createResp.status(),
      'transfer request POST succeeded (state-changing write, not just a dialog)',
    ).toBeLessThan(400)

    // Success toast confirms the request was accepted + the dialog closes.
    await expect(page.getByText(/transfer request submitted/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /transfer membership/i })).not.toBeVisible()
  })
})
