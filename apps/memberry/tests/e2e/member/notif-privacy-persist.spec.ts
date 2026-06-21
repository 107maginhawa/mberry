// AXIS-4 — Notification preferences + Privacy/directory-visibility persistence
//
// REAL-FLOW persistence proof (not a render smoke test). The existing
// tests/e2e/settings.spec.ts covers these surfaces for a FRESH sign-up that
// has NO org membership, so:
//   - its privacy test only asserts the empty "join an organization" state
//     (effectiveSettings.length === 0 → no toggles exist to persist), and
//   - its notification persist-on-reload test is `test.fixme`'d (flaky on an
//     org-less account whose PATCH 400s because notif-prefs are keyed by
//     organizationId — see updateMyNotificationPreferences.ts).
//
// This spec fills BOTH gaps using the SEEDED `member` persona, who DOES have
// an active membership in the test org (ed8e3a96-8126-4341-be42-e6eb7940c562)
// and therefore renders REAL privacy toggles + persists notif-pref PATCHes.
// Verified against the live API (member@memberry.ph):
//   GET /persons/me/notification-preferences → 5 categories w/ real state
//   GET /persons/me/privacy → 1 row for the test org (real visibility flags)
//
// ── Run-blockers fixed (vs the original broken spec) ─────────────────────
//
// (1) HYDRATION TIMING. /my/settings opens on the `general` tab (Radix
//     `defaultValue="general"`). Radix unmounts inactive <TabsContent>, so the
//     Notifications / Privacy sections — and the `useQuery` that fires their
//     GET — DO NOT mount on initial load. The GET fires only when the tab is
//     ACTIVATED. The original spec awaited captureRouteHydration() right after
//     page.goto() but BEFORE clicking the tab, so it captured nothing (the
//     request never happened) → resp was undefined. Fix: attach the capture,
//     navigate, CLICK THE TAB, then await — so the assertion targets the wire
//     call the tab activation actually triggers.
//
// (2) PRIVACY WIRE KEY. GET /persons/me/privacy returns Drizzle rows keyed
//     `organizationId` (NOT `orgId`) — verified live. Any wire derivation must
//     read `organizationId`. (This same mismatch is also the root of the real
//     bug pinned below.)
//
// ── PRIVACY toggle: real persistence (bug fixed) ──────────────────────────
//
//   The PrivacySection toggle used to be a DEAD CONTROL: GET /persons/me/privacy
//   rows are keyed `organizationId`, but the section read `privacy.orgId`
//   (undefined) so `toggle()` early-returned before issuing the PATCH. That is
//   now fixed in src/routes/_authenticated/my/settings.tsx — it derives orgId as
//   `organizationId ?? orgId`, so toggling a privacy switch fires the PATCH and
//   persists. The privacy test below now asserts that REAL flow, mirroring the
//   notification test: flip → PATCH 2xx → reload → assert persisted (wire + UI)
//   → restore the original value.
//
// Each test captures the live initial aria-checked, flips it, waits for the
// PATCH to land (2xx), RELOADS, re-opens the tab, and asserts the EXACT toggled
// state persisted (off the wire AND in the UI), then restores the original
// value so the shared seed stays idempotent across reruns.
//
// Auth: member role via test-fixture programmatic-auth (SEED_MEMBER_EMAIL).

import { test, expect } from '../helpers/test-fixture'
import type { Locator, Page } from '@playwright/test'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'member' })

// ── Helpers ──────────────────────────────────────────────────────────

// The seeded NPS prompt renders as a fixed bottom-right card that can overlap
// the settings column. Dismiss it (X button, aria-label="Dismiss survey") if
// it appeared, so it never intercepts a toggle click. No-op when absent.
async function dismissNpsIfPresent(page: Page): Promise<void> {
  const x = page.getByRole('button', { name: /dismiss survey/i })
  if (await x.count()) {
    await x.first().click().catch(() => {})
    await expect(x).toHaveCount(0).catch(() => {})
  }
}

async function openSettingsTab(page: Page, tab: 'Notifications' | 'Privacy'): Promise<void> {
  await page.getByRole('tab', { name: tab }).click()
  await dismissNpsIfPresent(page)
}

// Scope to a single settings row by its (unique) label text, then return the
// switch at `switchIndex` within that row. Notification rows have two switches
// (Push=0, Email=1); privacy rows have one (index 0). Filtering on the
// `justify-between` row container keeps the locator robust to sibling rows.
function rowSwitch(page: Page, rowLabel: string, switchIndex = 0): Locator {
  const row = page.locator('div.justify-between').filter({ hasText: rowLabel })
  return row.getByRole('switch').nth(switchIndex)
}

async function readChecked(sw: Locator): Promise<'true' | 'false'> {
  await expect(sw).toBeVisible({ timeout: 10000 })
  const v = await sw.getAttribute('aria-checked')
  expect(['true', 'false']).toContain(v)
  return v as 'true' | 'false'
}

// ── Notification preference persistence ──────────────────────────────

test.describe('AXIS-4: Notification preferences persist across reload', () => {
  test('toggling a category channel persists exactly after reload', async ({ page }) => {
    await page.goto('/my/settings')

    // The Notifications section (and its hydration GET) only mounts when the
    // tab is ACTIVATED — Radix unmounts inactive tab content. Attach the
    // capture, click the tab, THEN await the GET it triggers (run-blocker #1).
    const prefsResp = captureRouteHydration(page, /\/persons\/me\/notification-preferences(\?|$)/)
    await openSettingsTab(page, 'Notifications')
    const resp = await prefsResp
    expect(resp?.status(), 'notification-preferences hydration GET is 200').toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(page.getByText('Dues & Payments')).toBeVisible()

    // Target the "Dues & Payments" row's EMAIL switch (index 1).
    const emailSwitch = rowSwitch(page, 'Dues & Payments', 1)
    const initial = await readChecked(emailSwitch)
    const target = initial === 'true' ? 'false' : 'true'

    // Flip and wait for the PATCH to actually land (2xx = persisted server-side).
    const patchP = page.waitForResponse(
      (r) =>
        /\/persons\/me\/notification-preferences(\?|$)/.test(r.url()) &&
        r.request().method() === 'PATCH',
      { timeout: 10000 },
    )
    await emailSwitch.click()
    const patch = await patchP
    expect(patch.status(), 'notif PATCH persisted (2xx)').toBeLessThan(300)

    // RELOAD — the strongest persistence assertion. State must come from the
    // server's GET on a clean page, not optimistic local React state. Attach
    // the reload-GET capture, reload, re-open the tab (which fires the GET),
    // then await it.
    const reloadGetP = captureRouteHydration(
      page,
      /\/persons\/me\/notification-preferences(\?|$)/,
    )
    await page.reload()
    await openSettingsTab(page, 'Notifications')
    const reloadGet = await reloadGetP
    expect(reloadGet?.status(), 'reload re-fetches notif prefs').toBe(200)

    // Assert the persisted value off the wire too (DB-of-record check).
    const persisted = (await reloadGet!.json()) as { category: string; emailEnabled: boolean }[]
    const duesPref = persisted.find((p) => p.category === 'dues')
    expect(String(duesPref?.emailEnabled), 'wire reflects toggled emailEnabled').toBe(target)

    // And assert the UI re-renders the persisted state after reload.
    await expect(page.getByText('Dues & Payments')).toBeVisible()
    const afterReload = await readChecked(rowSwitch(page, 'Dues & Payments', 1))
    expect(afterReload, 'toggled notif state persisted on reload').toBe(target)

    // Restore the original value so the shared seed stays idempotent.
    const restoreP = page.waitForResponse(
      (r) =>
        /\/persons\/me\/notification-preferences(\?|$)/.test(r.url()) &&
        r.request().method() === 'PATCH',
      { timeout: 10000 },
    )
    await rowSwitch(page, 'Dues & Payments', 1).click()
    await restoreP
  })
})

// ── Privacy / directory-visibility persistence ───────────────────────

test.describe('AXIS-4: Privacy / directory visibility persists across reload', () => {
  test('toggling a directory-visibility flag persists exactly after reload', async ({
    page,
  }) => {
    await page.goto('/my/settings')

    // Privacy section + its hydration GET mount on tab activation (run-blocker
    // #1): attach, click the tab, then await.
    const privacyResp = captureRouteHydration(page, /\/persons\/me\/privacy(\?|$)/)
    await openSettingsTab(page, 'Privacy')
    const resp = await privacyResp
    expect(resp?.status(), 'privacy hydration GET is 200').toBe(200)
    expect(resp?.ok()).toBe(true)

    // Wire returns rows keyed `organizationId` (run-blocker #2). Confirm at
    // least one row for the test org and grab its server-side addressVisible —
    // the value the UI must reflect after a reload.
    const rows = (await resp!.json()) as { organizationId?: string; addressVisible?: boolean }[]
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length, 'seeded member has at least one privacy row (test org)').toBeGreaterThan(0)
    const serverAddressVisible = String(rows[0]?.addressVisible)
    expect(['true', 'false']).toContain(serverAddressVisible)

    // The seeded member HAS an org membership → real toggles render (NOT the
    // org-less empty state the existing settings.spec covers).
    await expect(
      page.getByText(/join an organization/i),
      'seeded member must render real privacy toggles, not the empty state',
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()

    // Target the "Address" directory-visibility row (single switch). Its
    // rendered state must match the wire's server value.
    const addressSwitch = rowSwitch(page, 'Address', 0)
    const initial = await readChecked(addressSwitch)
    expect(initial, 'rendered Address switch matches server addressVisible').toBe(
      serverAddressVisible,
    )
    const target = initial === 'true' ? 'false' : 'true'

    // Flip and wait for the PATCH to actually land (2xx = persisted server-side).
    const patchP = page.waitForResponse(
      (r) => /\/persons\/me\/privacy(\?|$)/.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 10000 },
    )
    await addressSwitch.click()
    const patch = await patchP
    expect(patch.status(), 'privacy PATCH persisted (2xx)').toBeLessThan(300)

    // RELOAD — the strongest persistence assertion. State must come from the
    // server's GET on a clean page, not optimistic local React state. Attach
    // the reload-GET capture, reload, re-open the tab (which fires the GET),
    // then await it.
    const reloadGetP = captureRouteHydration(page, /\/persons\/me\/privacy(\?|$)/)
    await page.reload()
    await openSettingsTab(page, 'Privacy')
    const reloadGet = await reloadGetP
    expect(reloadGet?.status(), 'reload re-fetches privacy settings').toBe(200)

    // Assert the persisted value off the wire too (DB-of-record check).
    const reloadRows = (await reloadGet!.json()) as { addressVisible?: boolean }[]
    expect(
      String(reloadRows[0]?.addressVisible),
      'wire reflects toggled addressVisible',
    ).toBe(target)

    // And assert the UI re-renders the persisted state after reload.
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible()
    const afterReload = await readChecked(rowSwitch(page, 'Address', 0))
    expect(afterReload, 'toggled privacy state persisted on reload').toBe(target)

    // Restore the original value so the shared seed stays idempotent.
    const restoreP = page.waitForResponse(
      (r) => /\/persons\/me\/privacy(\?|$)/.test(r.url()) && r.request().method() === 'PATCH',
      { timeout: 10000 },
    )
    await rowSwitch(page, 'Address', 0).click()
    await restoreP
  })
})
