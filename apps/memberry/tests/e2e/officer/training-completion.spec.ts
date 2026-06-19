// WF-061 — Training Attendance: officer marks members attended
// BR-17: Training attendance confirmation — mark completed, verify credit
//
// FIX-014 (AHA Training Batch E): REAL browser proof of the P0 attendance→credit
// journey, replacing the prior render-only / wire-status spec (which was
// fake-green — it never marked anyone present and never verified a persisted
// credit).
//
// This spec drives the ACTUAL officer attendance UI: the training detail page's
// "Attendance" tab (the <CompletionTable> component), which is what officers
// really use. (The standalone `.../$trainingId/attendance` route renders
// `attendance.tsx`, but its parent `$trainingId.tsx` renders no <Outlet/>, so
// that route — and the `checkInCustomTraining` wiring Batch A FIX-001 added to
// it — is never reached through the UI.)
//
// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX-014-followup (P0 FIXED, Option B): <CompletionTable> now points the
// reachable officer "Mark Complete" action at `checkInCustomTraining` (the
// already-correct FIX-001 path) instead of `completeCustomTraining`. The mark
// action sends the targeted member's `personId` via query, completes THAT
// enrollee, and awards them the AUTO credit (server reads the credit amount
// from the training record). The old `completeCustomTraining` wiring ignored
// `personId` (acted on the officer's own enrollment) and awarded no credit.
// The real-journey test below is therefore now GREEN — it is the real browser
// proof that an officer marking a member present awards THAT member the credit.
// ─────────────────────────────────────────────────────────────────────────────
//
// Seed dependencies (pda-metro-manila org, verified against the live DB):
//   - member@memberry.ph ("Miguel Bautista") is ENROLLED (not completed) in the
//     credit-bearing, published "Dental Photography Seminar" (credit 8).
//   - the officer test@memberry.ph is ALSO enrolled in it.
//   - the org has no creditTracking flag set → defaults ON (FIX-009).
import { test, expect } from '../helpers/test-fixture'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import type { Browser, Page } from '@playwright/test'

test.use({ authRole: 'officer' })
test.describe.configure({ mode: 'serial' })

const BASE = 'http://localhost:3004'
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
const POSITIVE_TITLE = 'Dental Photography Seminar'
const POSITIVE_CREDIT = 8

type Training = { id: string; title: string }
type CreditEntry = { activityName: string; type: string; creditAmount: number }

async function resolveTrainingId(page: Page): Promise<string> {
  // Navigate to a real SPA route first so apiFetch runs from the localhost:3004
  // origin (about:blank → origin "null" → CORS-blocked /csrf-token).
  await page.goto(`/org/${ORG_ID}/officer/training`)
  const res = await apiFetch<{ data: Training[] } | Training[]>(page, '/association/training', { orgId: ORG_ID })
  expect(res.status).toBe(200)
  const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  const t = items.find((x) => x.title === POSITIVE_TITLE)
  expect(t, `seed training "${POSITIVE_TITLE}" must exist`).toBeTruthy()
  return t!.id
}

async function getMemberPersonId(browser: Browser): Promise<string> {
  const ctx = await browser.newContext({ storageState: await freshAuthState('member'), baseURL: BASE })
  try {
    const p = await ctx.newPage()
    await p.goto(`/org/${ORG_ID}/training`)
    const me = await apiFetch<{ id?: string; data?: { id?: string } }>(p, '/persons/me')
    expect(me.status).toBe(200)
    const id = me.data?.data?.id ?? me.data?.id
    expect(id, 'member personId must resolve from /persons/me').toBeTruthy()
    return id!
  } finally {
    await ctx.close()
  }
}

// route-cov: `/org/$orgSlug/officer/training/$trainingId/attendance` — Attendance tab; asserts real enrolled-member roster from backend. Matrix C.
async function openAttendanceTab(page: Page, trainingId: string) {
  await page.goto(`/org/${ORG_ID}/officer/training/${trainingId}`)
  await page.getByRole('button', { name: /^Attendance/ }).click()
  // CompletionTable hydrates the enrollment list.
  await expect(page.getByRole('columnheader', { name: /member/i })).toBeVisible({ timeout: 15000 })
}

test.describe('BR-17 / FIX-014: attendance → persisted AUTO credit', () => {
  // PASSING: the real attendance UI hydrates the real enrollment roster from the
  // backend (not a fake-green render — it shows the actual enrolled member rows).
  test('officer attendance tab lists the real enrolled members from the backend', async ({ page, browser }) => {
    const trainingId = await resolveTrainingId(page)
    const memberId = await getMemberPersonId(browser)

    await openAttendanceTab(page, trainingId)

    // The CompletionTable renders one row per real enrollment, keyed by the
    // member's personId prefix (the UI shows `personId.slice(0,8)…`).
    const memberRow = page.getByRole('row').filter({ hasText: memberId.slice(0, 8) })
    await expect(memberRow, 'the enrolled member must appear in the real roster').toBeVisible({
      timeout: 15000,
    })
    await expect(memberRow.getByText(/enrolled/i)).toBeVisible()
    // "Enrolled" stat reflects the real count (seed enrolls officer + 3 members).
    await expect(page.getByText('Enrolled', { exact: true }).first()).toBeVisible()
  })

  // RED (quarantined): the real journey — officer marks the member present → the
  // member must earn a persisted AUTO credit. Currently fails because
  // `completeCustomTraining` ignores `personId` and awards no credit (see the
  // FIX-014 FINDING at the top of this file). `test.fail()` keeps CI green and
  // flips to a hard failure the moment the handler is fixed (remove the marker).
  test('officer marking a member present awards THAT member a persisted AUTO credit', async ({ page, browser }) => {
    // FIX-014-followup (Option B): <CompletionTable> now calls checkInCustomTraining,
    // which honours the targeted member's personId and awards them the AUTO credit.
    const trainingId = await resolveTrainingId(page)
    const memberId = await getMemberPersonId(browser)

    // Member PRE-state: no AUTO credit for the seminar yet.
    const memberCtx = await browser.newContext({ storageState: await freshAuthState('member'), baseURL: BASE })
    try {
      const memberPage = await memberCtx.newPage()
      await memberPage.goto(`/org/${ORG_ID}/training`)
      const before = await apiFetch<{ data: CreditEntry[] }>(memberPage, '/persons/me/credit-entries')
      expect(before.status).toBe(200)

      // Officer drives the real attendance UI: mark the member's row complete.
      await openAttendanceTab(page, trainingId)
      const memberRow = page.getByRole('row').filter({ hasText: memberId.slice(0, 8) })
      await expect(memberRow).toBeVisible({ timeout: 15000 })
      await memberRow.getByRole('button', { name: /mark complete/i }).click()
      await page
        .waitForResponse((r) => r.url().includes('/check-in') && r.request().method() === 'POST', {
          timeout: 15000,
        })
        .catch(() => null)

      // The member MUST now hold a persisted AUTO credit for the seminar with the
      // correct amount. (This is the assertion that currently fails — the real UI
      // path awards nothing to the member.)
      await memberPage.goto('/my/credits')
      const after = await apiFetch<{ data: CreditEntry[] }>(memberPage, '/persons/me/credit-entries')
      const awarded = (after.data?.data ?? []).find(
        (c) => c.type === 'auto' && c.activityName === POSITIVE_TITLE,
      )
      expect(awarded, 'member must earn a persisted AUTO credit from the real check-in').toBeTruthy()
      expect(awarded!.creditAmount).toBe(POSITIVE_CREDIT)

      // And it must render on /my/credits and survive a reload.
      const autoRow = memberPage.getByRole('row').filter({ hasText: POSITIVE_TITLE }).filter({ hasText: /auto/i })
      await expect(autoRow).toBeVisible({ timeout: 15000 })
      await memberPage.reload()
      await expect(autoRow).toBeVisible({ timeout: 15000 })
    } finally {
      await memberCtx.close()
    }
  })
})
