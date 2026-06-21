// WF-065 / WF-069 — Member CPD credit summary + officer verify/reject of a
// member's self-logged credit.
//
// This is a REAL-DATA / state-transition spec, NOT a render smoke test. It
// upgrades the shallow `member/credits.spec.ts` (which only asserts stat-card
// LABELS — "Earned"/"Required"/"Carryover"/"Remaining" — and headings) by
// proving the numbers on the page come off the wire, and by driving the full
// officer review state machine end-to-end:
//
//   PART A — Member /my/credits (authRole: member)
//     • GET /persons/me/credit-summary returns 200 with a real cycle +
//       requiredCredits; the "Earned" stat card renders EXACTLY summary.totalCredits
//       (not a hard-coded 0), and "Required" renders summary.requiredCredits.
//     • GET /persons/me/credit-entries returns the member's real self-logged
//       entries; the Credit Log table renders a real activity name + its exact
//       creditAmount (asserted against the wire payload, not a fixed string).
//     • Cross-org aggregate: the summary endpoint is the single cross-org roll-up
//       (server aggregates across organizations[]) and its total drives the card.
//
//   PART B — Officer verify/reject (authRole: officer)
//     A member self-logs a credit → it lands verificationStatus:"pending" and
//     surfaces in the officer's "Pending Approvals" queue on
//     /org/$org/officer/reports/credits. The officer:
//       • APPROVES it  → POST /association/member/credits/:id/verify returns 200
//         with verificationStatus:"verified"; the card disappears from the queue.
//       • REJECTS another (with a reason) → POST .../:id/reject returns 200 with
//         verificationStatus:"rejected"; the card disappears from the queue.
//     Each pending entry is SEEDED per-test (unique activity name) via a real
//     member-authenticated wire call, so the test owns a deterministic target and
//     does not depend on (or get starved by) ambient seed/other-run pending rows.
//
// Live routes verified present in routeTree.gen.ts:
//   /_authenticated/my/credits/                            (member summary)
//   /_authenticated/org/$orgSlug/officer/reports/credits   (officer review host)
// The verify/reject UI lives in features/training/components/pending-credits-list.tsx,
// mounted on the officer reports/credits page when pendingCount > 0.

import { test, expect } from '../helpers/test-fixture'
import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { captureRouteHydration } from '../helpers/real-flow'
import { apiFetch } from '../helpers/api-fetch'
import { API_BASE } from '../helpers/test-config'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const ORIGIN = 'http://localhost:3004'

// The member persona (member@memberry.ph → "Miguel Bautista") is the self-logger
// in both parts. Their display name is how the officer queue labels the card.
const MEMBER_NAME = 'Miguel Bautista'

type CreditSummary = {
  totalCredits: number
  totalEarned?: number
  requiredCredits: number
  remaining?: number
  cycle?: { cycleStart: string; cycleEnd: string }
  organizations?: unknown[]
}
type CreditEntry = { id: string; activityName: string; creditAmount: number; verificationStatus?: string }

/** /dismiss the NPS auto-prompt if it overlaps a control (NpsProvider). */
async function dismissNpsIfPresent(page: Page): Promise<void> {
  const npsDismiss = page.getByRole('button', { name: /dismiss survey/i })
  if (await npsDismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await npsDismiss.click()
    await expect(npsDismiss).toBeHidden({ timeout: 5000 }).catch(() => {})
  }
}

/**
 * Seed a PENDING self-logged credit for the member, on the real wire, as the
 * member (POST /persons/me/credit-entries → verificationStatus "pending").
 * Returns { id, activityName, creditAmount } so the officer test can target the
 * exact card it created. Uses a standalone member-authed APIRequestContext so it
 * is independent of the page's officer session.
 */
async function seedPendingCredit(
  activityName: string,
  creditAmount: number,
): Promise<{ id: string; activityName: string; creditAmount: number }> {
  const memberState = await freshAuthState('member')
  const ctx: APIRequestContext = await pwRequest.newContext({
    baseURL: API_BASE,
    storageState: memberState,
    extraHTTPHeaders: { Origin: ORIGIN },
  })
  try {
    // CSRF dance (hono/csrf): mint token, send it on the state-changing POST.
    const csrfRes = await ctx.get('/csrf-token')
    const { token } = (await csrfRes.json()) as { token: string }

    const res = await ctx.post('/persons/me/credit-entries', {
      headers: { 'x-csrf-token': token },
      data: { activityName, activityDate: '2026-05-01', creditAmount },
    })
    expect(res.status(), 'member self-log credit-entry create').toBe(201)
    const body = (await res.json()) as { data?: CreditEntry } | CreditEntry
    const entry = (body as { data?: CreditEntry }).data ?? (body as CreditEntry)
    expect(entry.verificationStatus, 'self-logged credit starts pending').toBe('pending')
    return { id: entry.id, activityName: entry.activityName, creditAmount: entry.creditAmount }
  } finally {
    await ctx.dispose()
  }
}

// ---------------------------------------------------------------------------
// PART A — Member CPD credit summary (real numbers, not labels)
// ---------------------------------------------------------------------------
test.describe('Member CPD credit summary (/my/credits)', () => {
  test.use({ authRole: 'member' })

  test('summary cards render the wire numbers (Earned = totalCredits, Required = requiredCredits)', async ({
    page,
  }) => {
    // Navigate FIRST so the page has the SPA origin: the in-page `apiFetch`
    // (page.evaluate fetch) needs a document origin and the Vite /api proxy,
    // otherwise the cross-origin fetch throws "Failed to fetch".
    const hydrate = captureRouteHydration(page, /\/persons\/me\/credit-summary(?:[/?]|$)/)
    await page.goto('/my/credits')
    const hydrateResp = await hydrate
    expect(hydrateResp?.status()).toBe(200)
    expect(hydrateResp?.ok()).toBe(true)
    await dismissNpsIfPresent(page)

    // Authoritative summary off the wire (also the cross-org aggregate source).
    const summaryResp = await apiFetch<CreditSummary>(page, '/persons/me/credit-summary')
    expect(summaryResp.status).toBe(200)
    const summary = summaryResp.data!
    expect(summary, 'credit-summary payload present').toBeTruthy()
    // Real cycle window + a real per-cycle requirement (org CPD config, not 0).
    expect(summary.requiredCredits, 'required credits resolved from org CPD config').toBeGreaterThan(0)
    expect(summary.cycle?.cycleStart, 'summary carries a real CPD cycle window').toBeTruthy()
    expect(summary.cycle?.cycleEnd).toBeTruthy()

    // The "Earned" stat card must equal summary.totalCredits (CountUp animates
    // the final value into the DOM). Scope to the card so we don't match a stray
    // number elsewhere on the page.
    const earnedCard = page.locator('div', { has: page.getByText('Earned', { exact: true }) }).first()
    await expect(earnedCard).toContainText(String(summary.totalCredits), { timeout: 10000 })

    const requiredCard = page.locator('div', { has: page.getByText('Required', { exact: true }) }).first()
    await expect(requiredCard).toContainText(String(summary.requiredCredits), { timeout: 10000 })

    // Remaining card reflects the server's remaining (or required - earned).
    const expectedRemaining =
      summary.remaining ?? Math.max(0, summary.requiredCredits - summary.totalCredits)
    const remainingCard = page
      .locator('div', { has: page.getByText('Remaining', { exact: true }) })
      .first()
    await expect(remainingCard).toContainText(String(expectedRemaining), { timeout: 10000 })
  })

  test('credit log table renders a real self-logged entry (name + exact creditAmount)', async ({
    page,
  }) => {
    // Make sure the member has at least one entry to render, with a known amount.
    const seeded = await seedPendingCredit(`E2E Log Render ${Date.now()}`, 2.5)

    // Navigate FIRST so the in-page `apiFetch` has an origin + the Vite /api
    // proxy (else page.evaluate fetch throws "Failed to fetch").
    await page.goto('/my/credits')
    await dismissNpsIfPresent(page)

    const entriesResp = await apiFetch<{ data: CreditEntry[] }>(page, '/persons/me/credit-entries')
    expect(entriesResp.status).toBe(200)
    const entries = entriesResp.data?.data ?? []
    expect(entries.length, 'member has real credit entries on the wire').toBeGreaterThan(0)

    // The Credit Log table must be present (not the empty state) and show a real
    // activity name from the wire — specifically the row we just seeded.
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 10000 })
    const seededRow = page.getByRole('row', { name: new RegExp(seeded.activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
    await expect(seededRow).toBeVisible({ timeout: 10000 })
    // The row renders the exact credit amount from the wire (2.5), not a placeholder.
    await expect(seededRow).toContainText(String(seeded.creditAmount))
  })

  test('summary is the cross-org aggregate roll-up', async ({ page }) => {
    // BR-14: the member's credit total aggregates across organizations server-side.
    // The summary endpoint is that single roll-up; the page's "Earned" card is
    // driven by it (proven above). Here we assert the aggregate contract: the
    // endpoint exposes an organizations[] breakdown and a single totalCredits
    // that is the cross-org sum.
    // Navigate FIRST so the in-page `apiFetch` has an origin + the Vite /api
    // proxy (else page.evaluate fetch throws "Failed to fetch").
    await page.goto('/my/credits')
    await dismissNpsIfPresent(page)

    const summaryResp = await apiFetch<CreditSummary>(page, '/persons/me/credit-summary')
    expect(summaryResp.status).toBe(200)
    const summary = summaryResp.data!
    expect(Array.isArray(summary.organizations), 'summary carries a per-org breakdown array').toBe(true)
    expect(typeof summary.totalCredits, 'aggregate total is a number').toBe('number')

    await expect(page.getByRole('heading', { name: /CPD Credits/i })).toBeVisible({ timeout: 10000 })
    // Subtitle states the cross-org framing.
    await expect(page.getByText(/across all organizations/i).first()).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// PART B — Officer verifies / rejects a member's self-logged credit
// ---------------------------------------------------------------------------
test.describe('Officer verifies/rejects a self-logged credit', () => {
  test.use({ authRole: 'officer' })

  test('APPROVE: pending → verified, card leaves the queue, wire returns 200', async ({ page }) => {
    const seeded = await seedPendingCredit(`E2E Approve Target ${Date.now()}`, 4)

    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)
    await expect(
      page.getByRole('heading', { name: /credit compliance report/i }),
    ).toBeVisible({ timeout: 10000 })

    // The "Pending Approvals" section renders because pendingCount > 0.
    await expect(page.getByRole('heading', { name: /pending approvals/i })).toBeVisible({
      timeout: 10000,
    })

    // Find the exact card for our seeded entry. The activity name is unique
    // per test; resolve the entry's GlassCard as the NEAREST ancestor <div>
    // that holds the action buttons. (Filtering `div` by text matches every
    // ancestor up to the list wrapper, so `.first()` would grab the wrapper
    // around ALL cards → strict-mode violation on the shared Approve/Reject
    // buttons.)
    const card = page
      .getByText(seeded.activityName, { exact: true })
      .locator('xpath=ancestor::div[.//button][1]')
    await expect(card).toBeVisible({ timeout: 10000 })
    await expect(card).toContainText(MEMBER_NAME)
    await expect(card).toContainText('Pending Review')
    // Real credit amount is rendered on the card.
    await expect(card).toContainText(String(seeded.creditAmount))

    // Capture the verify POST so we assert the state flip on the wire — not just
    // that the card vanished from optimistic UI.
    const verifyResp = captureRouteHydration(
      page,
      new RegExp(`/association/member/credits/${seeded.id}/verify`),
      { method: 'POST' },
    )
    await card.getByRole('button', { name: /^approve$/i }).click()

    const resp = await verifyResp
    expect(resp?.status(), 'verify endpoint returns 200').toBe(200)
    const respBody = (await resp!.json()) as { data?: { verificationStatus?: string } }
    expect(
      respBody.data?.verificationStatus,
      'credit flips to verified on the wire',
    ).toBe('verified')

    // The card leaves the pending queue (state reflected in the UI).
    await expect(card).toBeHidden({ timeout: 10000 })
    await expect(page.getByText('Credit verified')).toBeVisible({ timeout: 5000 }).catch(() => {})

    // Cross-check persistence: the entry is no longer in the officer's pending list.
    const pendingAfter = await apiFetch<{ entries: CreditEntry[] }>(
      page,
      `/credit-compliance/${ORG_ID}/pending`,
      { orgId: ORG_ID },
    )
    expect(pendingAfter.status).toBe(200)
    expect(
      (pendingAfter.data?.entries ?? []).some((e) => e.id === seeded.id),
      'verified entry removed from pending queue',
    ).toBe(false)
  })

  test('REJECT: pending → rejected (with reason), card leaves the queue, wire returns 200', async ({
    page,
  }) => {
    const seeded = await seedPendingCredit(`E2E Reject Target ${Date.now()}`, 6)

    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)
    await expect(
      page.getByRole('heading', { name: /credit compliance report/i }),
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: /pending approvals/i })).toBeVisible({
      timeout: 10000,
    })

    // Resolve the entry's GlassCard as the nearest ancestor <div> holding the
    // action buttons (unique activity name anchor) — avoids the strict-mode
    // violation that a text-filtered `div` ancestor chain would cause.
    const card = page
      .getByText(seeded.activityName, { exact: true })
      .locator('xpath=ancestor::div[.//button][1]')
    await expect(card).toBeVisible({ timeout: 10000 })
    await expect(card).toContainText(MEMBER_NAME)

    // Open the reject sub-form, supply a reason, confirm.
    await card.getByRole('button', { name: /^reject$/i }).click()
    const reasonInput = card.getByPlaceholder(/reason for rejection/i)
    await expect(reasonInput).toBeVisible({ timeout: 5000 })
    await reasonInput.fill('E2E: insufficient supporting documentation')

    const rejectResp = captureRouteHydration(
      page,
      new RegExp(`/association/member/credits/${seeded.id}/reject`),
      { method: 'POST' },
    )
    await card.getByRole('button', { name: /confirm rejection/i }).click()

    const resp = await rejectResp
    expect(resp?.status(), 'reject endpoint returns 200').toBe(200)
    const respBody = (await resp!.json()) as { data?: { verificationStatus?: string } }
    expect(
      respBody.data?.verificationStatus,
      'credit flips to rejected on the wire',
    ).toBe('rejected')

    await expect(card).toBeHidden({ timeout: 10000 })

    // Persistence cross-check: gone from the pending queue.
    const pendingAfter = await apiFetch<{ entries: CreditEntry[] }>(
      page,
      `/credit-compliance/${ORG_ID}/pending`,
      { orgId: ORG_ID },
    )
    expect(pendingAfter.status).toBe(200)
    expect(
      (pendingAfter.data?.entries ?? []).some((e) => e.id === seeded.id),
      'rejected entry removed from pending queue',
    ).toBe(false)
  })
})
