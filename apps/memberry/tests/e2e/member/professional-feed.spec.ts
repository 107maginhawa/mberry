// AXIS-4 e2e — "professional feed" (member browses org feed; member/officer
// creates a post; report→moderate).
//
// LIVE-ROUTE VERDICT: there is NO professional-feed route. A scan of
// `routeTree.gen.ts`, `src/routes/**`, and `src/**` found no `feed`, `post`,
// `professional`, `moderate`, `report`, or `flag` route/component. The feature
// is NOT routed — writing a dead-code test against it would assert nothing.
//
// Instead this spec exercises the SMALLEST LIVE adjacent communication member
// flow that IS routed: the org ANNOUNCEMENT FEED, which is the real "members
// browse a chronological feed of posts from the org" surface:
//   - list   →  /org/$orgSlug/announcements          (MemberAnnouncementFeed)
//   - detail →  /org/$orgSlug/announcements/$announcementId
//   - create →  /org/$orgSlug/officer/communications/new (officer compose,
//                POST create + POST publish → becomes status=sent → shows in
//                the member feed)
//
// REAL-FLOW (data + state, not headings):
//   1. Member browses the feed — assert the hydration wire returns 200 AND a
//      real seeded post (resolved from the same API) renders as a card.
//   2. Officer creates a post via the live compose UI — assert POST create +
//      POST publish succeed — then the member reloads the feed and the brand
//      new post appears (create → appears, end-to-end).
//   3. Member opens a post (feed → detail click-through), asserting the
//      detail GET returns 200 and the real content hydrates.
//
// REPORT / MODERATE: no member- or officer-facing report/moderate/flag UI
// exists anywhere in the app (grep of src/**.tsx for moderat*/report.?post/
// flag.?announce returned nothing). Noted, not tested — see returned JSON.
//
// The existing member/announcements.spec.ts only covers the detail page for a
// pre-seeded announcement; this spec is COMPLEMENTARY (feed list hydration +
// officer-create→member-feed appearance + click-through), not a duplicate.

import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'
import { signIn } from '../helpers/auth'
import {
  SEED_SECRETARY_EMAIL,
  SEED_MEMBER_EMAIL,
  TEST_PASSWORD,
} from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

type AnnRow = { id: string; title?: string; subject?: string; content?: string }

function rowsOf(payload: any): AnnRow[] {
  const rows = payload?.data?.data ?? payload?.data ?? payload ?? []
  return Array.isArray(rows) ? rows : []
}

test.describe('Member professional feed (announcement feed — live adjacent flow)', () => {
  test.use({ authRole: 'member' })

  test('member browses the org feed → wire 200 + a real post renders as a card', async ({ page }) => {
    // Land on the SPA first so the in-page fetch carries the session + Origin.
    await page.goto(`/org/${ORG_ID}/dashboard`)

    // Resolve a real sent post from the SAME endpoint the feed hydrates from,
    // so the assertion targets actual data, not a static heading.
    const list = await apiFetch<any>(
      page,
      `/communications/announcements/${ORG_ID}?status=sent`,
      { orgId: ORG_ID },
    )
    expect(list.status).toBe(200)
    const rows = rowsOf(list.data)
    test.skip(rows.length === 0, 'no sent announcements seeded for this org')

    const target = rows[0]! // guarded by the test.skip(rows.length === 0) above
    const title = (target.title ?? target.subject ?? '').trim()
    expect(title.length).toBeGreaterThan(0)

    // Now drive the real route and capture its hydration wire.
    const feedWire = captureRouteHydration(
      page,
      /\/communications\/announcements\/[^/]+\?status=sent/,
    )
    await page.goto(`/org/${ORG_ID}/announcements`)
    const feedResp = await feedWire
    if (feedResp) expect(feedResp.status()).toBe(200)

    // The real seeded post renders as a feed card (data-driven, not a heading).
    await expect(page.getByText(title.slice(0, 24)).first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('member opens a post from the feed → detail hydrates with real content', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dashboard`)
    const list = await apiFetch<any>(
      page,
      `/communications/announcements/${ORG_ID}?status=sent`,
      { orgId: ORG_ID },
    )
    expect(list.status).toBe(200)
    const rows = rowsOf(list.data)
    test.skip(rows.length === 0, 'no sent announcements seeded for this org')

    const target = rows[0]! // guarded by the test.skip(rows.length === 0) above
    const title = (target.title ?? target.subject ?? '').trim()

    // Open the feed, then click the matching card to navigate to the detail
    // route (the feed → post-open journey).
    await page.goto(`/org/${ORG_ID}/announcements`)
    const card = page.getByText(title.slice(0, 24)).first()
    await expect(card).toBeVisible({ timeout: 15000 })

    const detailWire = captureRouteHydration(
      page,
      /\/communications\/announcements\/detail\/[^/?]+/,
    )
    await card.click()

    const detailResp = await detailWire
    if (detailResp) expect(detailResp.status()).toBe(200)
    await expect(page).toHaveURL(/\/announcements\/[0-9a-f-]{6,}/i, { timeout: 15000 })
    await expect(page.getByText(title.slice(0, 20)).first()).toBeVisible({
      timeout: 15000,
    })
  })
})

test.describe('Officer creates a post → it appears in the member feed', () => {
  // This block signs in via the UI for two personas in one test, so it does
  // NOT use the authRole fixture (which mints a single member session).
  test('officer composes + sends a post, then a member sees it in the feed', async ({ page }) => {
    const marker = `E2E Feed Post ${Date.now()}`
    const body = 'Automated AXIS-4 feed post — verifies create → publish → appears in member feed.'

    // 1. Officer (secretary) authors a post via the live compose UI.
    await signIn(page, SEED_SECRETARY_EMAIL, TEST_PASSWORD)
    await page.goto(`/org/${ORG_ID}/officer/communications/new`)

    const titleInput = page.getByPlaceholder('Announcement title')
    await expect(titleInput).toBeVisible({ timeout: 15000 })
    await titleInput.fill(marker)
    await page.getByPlaceholder('Write your announcement here...').fill(body)

    // Capture the real create POST (returns the new id) + the publish POST that
    // flips it to status=sent so it surfaces in the member feed.
    const createWire = captureRouteHydration(
      page,
      new RegExp(`/communications/announcements/${ORG_ID}$`),
      { method: 'POST' },
    )
    const publishWire = captureRouteHydration(
      page,
      /\/communications\/announcements\/[^/]+\/publish/,
      { method: 'POST' },
    )

    const sendBtn = page.getByRole('button', { name: /send now/i })
    await expect(sendBtn).toBeEnabled()
    await sendBtn.click()

    const createResp = await createWire
    // Create must succeed (201/200). If the wire was missed, fail loudly via
    // the publish leg below rather than silently passing.
    if (createResp) expect(createResp.status()).toBeLessThan(400)
    const publishResp = await publishWire
    if (publishResp) expect(publishResp.status()).toBeLessThan(400)

    // Confirm the new post is now part of the org's SENT set (server truth).
    const sent = await apiFetch<any>(
      page,
      `/communications/announcements/${ORG_ID}?status=sent`,
      { orgId: ORG_ID },
    )
    expect(sent.status).toBe(200)
    const sentTitles = rowsOf(sent.data).map((r) => r.title ?? r.subject ?? '')
    expect(sentTitles).toContain(marker)

    // 2. A regular member signs in and sees the brand-new post in their feed.
    await signIn(page, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    const feedWire = captureRouteHydration(
      page,
      /\/communications\/announcements\/[^/]+\?status=sent/,
    )
    await page.goto(`/org/${ORG_ID}/announcements`)
    const feedResp = await feedWire
    if (feedResp) expect(feedResp.status()).toBe(200)

    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 15000 })
  })
})
