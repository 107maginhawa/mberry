// AXIS-4 — Cross-actor announcement delivery (officer → member).
//
// The existing officer/communications.spec.ts proves the OFFICER-side
// create → publish transition, and member/announcements.spec.ts opens an
// already-seeded announcement detail. Neither proves the actual delivery
// hop: that an announcement an officer composes + SENDS shows up in a
// DIFFERENT user's (the member's) announcement feed with the real content.
// This spec owns that end-to-end cross-actor assertion.
//
// Flow:
//   1. Officer (President — the publish gate requires President/Secretary)
//      composes a uniquely-titled announcement at /officer/communications/new
//      and clicks "Send Now". We assert on the WIRE: the create POST returns
//      the flat resource with an id (ISSUE-029 — not { data }-wrapped), and
//      the chained .../publish POST returns 200.
//   2. Member signs in, opens /announcements. We assert the list GET
//      (?status=sent) returns 200 AND the just-sent announcement renders by
//      its unique title (real data, not a shell heading).
//   3. Member opens the announcement detail and we assert the detail GET
//      returns 200 and the real body content hydrates.
//
// REAL-FLOW: every step asserts the backend response status/shape, not only
// rendered headings. Two real personas drive the flow via UI sign-in (this is
// a two-actor journey, so it cannot use the single-role test.use({authRole})).

import { test, expect } from '../helpers/test-fixture'
import { signInAsOfficer, signInAsMember } from '../helpers/auth'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('AXIS-4: officer sends announcement → member receives it', () => {
  test('officer composes + sends; member sees it in their feed with real content', async ({
    page,
  }) => {
    const stamp = Date.now()
    const title = `AXIS4 Send Notify ${stamp}`
    const body = `AXIS4 delivery body ${stamp} — members please read this notice.`

    // ───────────────────────── ACTOR 1: OFFICER ─────────────────────────
    let announcementId: string | undefined

    await test.step('officer signs in and opens the compose form', async () => {
      await signInAsOfficer(page)
      await page.goto(`/org/${ORG_ID}/officer/communications/new`)
      await expect(page.getByText(/New Announcement/i)).toBeVisible({ timeout: 15000 })
    })

    await test.step('officer fills the announcement', async () => {
      await page.getByRole('textbox', { name: /Title/i }).first().fill(title)
      await page.locator('textarea').first().fill(body)
    })

    await test.step('officer clicks Send Now → create + publish on the wire', async () => {
      // The compose form persists the draft (POST .../announcements/:orgId)
      // then chains the publish transition (POST .../:id/publish). Capture both.
      const createP = page
        .waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            /\/communications\/announcements\/[^/]+$/.test(r.url()),
          { timeout: 20000 },
        )
        .catch(() => null)

      const publishP = page
        .waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            /\/communications\/announcements\/[^/]+\/publish$/.test(r.url()),
          { timeout: 20000 },
        )
        .catch(() => null)

      await page.getByRole('button', { name: /Send Now/i }).click()

      // CREATE: must succeed and return the flat resource with an id
      // (ISSUE-029 — createAnnouncement returns the resource, not { data }).
      const createResp = await createP
      expect(createResp, 'create POST must fire').not.toBeNull()
      expect(createResp!.status()).toBeLessThan(400)
      const createBody = await createResp!.json().catch(() => null)
      announcementId = createBody?.id ?? createBody?.data?.id
      expect(announcementId, 'create response must carry the new announcement id').toBeTruthy()

      // PUBLISH: the transition that actually "sends" it to members.
      const publishResp = await publishP
      expect(publishResp, 'publish POST must fire').not.toBeNull()
      expect(publishResp!.status()).toBe(200)

      // The form navigates back to the communications list on success.
      await page.waitForURL(/\/officer\/communications(\/?$|\?)/, { timeout: 15000 })
    })

    // ───────────────────────── ACTOR 2: MEMBER ──────────────────────────
    await test.step('member signs in and opens the announcements feed', async () => {
      await signInAsMember(page)

      // Capture the member feed's sent-announcements hydration GET.
      const listP = page
        .waitForResponse(
          (r) =>
            r.request().method() === 'GET' &&
            /\/communications\/announcements\/[^/]+\?.*status=sent/.test(r.url()),
          { timeout: 20000 },
        )
        .catch(() => null)

      await page.goto(`/org/${ORG_ID}/announcements`)

      const listResp = await listP
      expect(listResp, 'member feed must hydrate via the sent-announcements GET').not.toBeNull()
      expect(listResp!.status()).toBe(200)

      // Wire-level proof: the sent announcement is present in the member's
      // org-scoped feed payload (not just rendered chrome).
      const listBody = await listResp!.json().catch(() => null)
      const rows: Array<{ id: string; title: string }> =
        listBody?.data ?? listBody ?? []
      const delivered = rows.find((r) => r.id === announcementId || r.title === title)
      expect(
        delivered,
        'the officer-sent announcement must appear in the member feed payload',
      ).toBeTruthy()
    })

    await test.step('member sees the announcement title in the rendered feed', async () => {
      await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 })
    })

    await test.step('member opens the announcement and sees the real content', async () => {
      const detailP = page
        .waitForResponse(
          (r) =>
            r.request().method() === 'GET' &&
            /\/communications\/announcements\/detail\//.test(r.url()),
          { timeout: 20000 },
        )
        .catch(() => null)

      // Open via the feed card link (real user navigation).
      await page.getByText(title).first().click()

      const detailResp = await detailP
      expect(detailResp, 'detail GET must fire').not.toBeNull()
      expect(detailResp!.status()).toBe(200)

      // The real announcement body (composed by the officer) hydrates for the member.
      await expect(page.getByText(new RegExp(`AXIS4 delivery body ${stamp}`)).first()).toBeVisible({
        timeout: 15000,
      })
    })
  })
})
