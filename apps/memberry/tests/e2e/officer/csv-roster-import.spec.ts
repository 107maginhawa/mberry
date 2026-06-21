// WF-009 / WF-031 — Bulk CSV Import: match-or-create + roster persistence
/**
 * Real-flow companion to `roster-csv-import.spec.ts`.
 *
 * That sibling proves the UI happy path stops at the success banner
 * (upload → preview → Import → "Imported N"). It never verifies the
 * imported members actually LANDED — nor the BR-22 match-or-create
 * (skip-already-a-member) leg the import handler implements
 * (`importRosterMembers.ts`: `findByPersonAndOrg` → skipped++).
 *
 * This spec adds those two missing legs as data+state assertions on the
 * live officer route `/org/$slug/officer/roster/import`:
 *
 *   Test 1 — Imported members APPEAR in the roster.
 *     Import 2 fresh members → open the roster, search by each member's
 *     unique email, and assert the member's row/card actually renders
 *     with that name + email. Proves the membership row persisted to the
 *     org, not just that a banner flashed.
 *
 *   Test 2 — Match-or-create skips existing members (re-import dedup).
 *     Re-upload the SAME CSV into the SAME org → the handler matches the
 *     persons it created and finds them already enrolled, so the banner
 *     reads "Imported 0 · skipped 2 (already members)". Proves the
 *     preview/import match-or-create logic, not a blind re-insert.
 *
 * Both run serial against one isolated, member-free org so the counts are
 * deterministic and the assertions can't collide with seeded roster data.
 *
 * Drives the hidden <input id="csv-input"> via setInputFiles (the upload
 * card is a div click-handler; setInputFiles bypasses the OS picker).
 */

import { test, expect } from '../helpers/test-fixture'
import type { Page } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { withIsolatedFixture } from '../helpers/isolated-fixture'

test.describe.configure({ mode: 'serial' })

/** Dismiss the NPS auto-prompt if it sits over a control (NpsProvider). */
async function dismissNpsIfPresent(page: Page) {
  const npsDismiss = page.getByRole('button', { name: /dismiss survey/i })
  if (await npsDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
    await npsDismiss.click()
    await expect(npsDismiss).toBeHidden({ timeout: 5000 }).catch(() => {})
  }
}

/**
 * Upload `csv` on the import page, pick the first tier, click Import, and
 * wait for the POST to land 2xx. Returns the parsed JSON body so callers
 * can assert imported/skipped counts (the wire truth behind the banner).
 */
async function runImport(
  page: Page,
  slug: string,
  csv: string,
  fileName: string,
  expectedRows: number,
): Promise<{ imported: number; skipped: number; failed: number }> {
  await page.goto(`/org/${slug}/officer/roster/import`)
  await expect(
    page.getByRole('heading', { name: /import roster/i }),
  ).toBeVisible({ timeout: 15000 })

  await dismissNpsIfPresent(page)

  const fileInput = page.locator('input#csv-input')
  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  })

  // Preview banner confirms the client parser ran.
  await expect(
    page.getByText(new RegExp(`\\(${expectedRows} rows\\)`, 'i')),
  ).toBeVisible({ timeout: 10000 })

  // A tier MUST be selected before import (button gated on selectedTierId).
  await page.locator('#import-tier').click()
  await page.getByRole('option').first().click()

  const importBtn = page.getByRole('button', {
    name: new RegExp(`import ${expectedRows} members`, 'i'),
  })
  await expect(importBtn).toBeEnabled({ timeout: 5000 })

  const importReqP = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      r.url().includes('/association/member/roster/import'),
    { timeout: 20000 },
  )
  await importBtn.click()
  const resp = await importReqP
  expect(resp.status(), 'roster import POST should succeed').toBeLessThan(400)

  // Body shape: { imported, skipped, failed, errors } (handler returns flat).
  const json = await resp.json().catch(() => ({}))
  const body = (json?.data ?? json ?? {}) as {
    imported?: number
    skipped?: number
    failed?: number
  }
  return {
    imported: body.imported ?? 0,
    skipped: body.skipped ?? 0,
    failed: body.failed ?? 0,
  }
}

test.describe('CSV roster import — match-or-create + roster persistence', () => {
  // Fresh, member-free org → deterministic counts, no seeded-roster collisions.
  const fx = withIsolatedFixture(test, { memberCount: 0 })

  // Shared across the two serial tests: the exact CSV imported in test 1 is
  // re-imported in test 2 to exercise the skip-existing dedup path.
  const uniqueTag = Date.now().toString(36)
  const email1 = `csv-roster-1-${uniqueTag}@test.local`
  const email2 = `csv-roster-2-${uniqueTag}@test.local`
  const lastName1 = `One${uniqueTag}`
  const lastName2 = `Two${uniqueTag}`
  const csv = [
    'First Name,Last Name,Email,License Number,Member Number',
    `Roster,${lastName1},${email1},LIC-${uniqueTag}-1,MEM-${uniqueTag}-1`,
    `Roster,${lastName2},${email2},LIC-${uniqueTag}-2,MEM-${uniqueTag}-2`,
  ].join('\n')

  test('imported members actually appear in the roster', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: await freshAuthState('officer'),
    })
    const page = await ctx.newPage()

    const result = await runImport(
      page,
      fx().slug,
      csv,
      `roster-${uniqueTag}.csv`,
      2,
    )

    // Wire truth: both fresh rows created persons + memberships.
    expect(result.imported, 'two fresh rows should import').toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.failed).toBe(0)

    // Persistence proof: open the roster and find each imported member by a
    // key the SERVER-SIDE roster search actually matches. The handler
    // (listRosterMembers → listMembersWithOfficerStatus) filters on
    // persons.firstName / persons.lastName / memberships.memberNumber via
    // ILIKE — it does NOT match email. So we search by the row's unique last
    // name, then assert the rendered row carries that name AND the imported
    // email (the membership row persisted to the org with its PII), not just
    // that a banner flashed. This is the leg the sibling banner-only spec
    // never checks.
    await page.goto(`/org/${fx().slug}/officer/roster`)
    await expect(
      page.getByRole('heading', { name: /member roster/i }),
    ).toBeVisible({ timeout: 15000 })
    await dismissNpsIfPresent(page)

    const search = page.getByPlaceholder(/search/i).first()
    await expect(search).toBeVisible({ timeout: 10000 })

    // Member 1 — search by the unique last name (server-matched), then assert
    // both the name and the imported email surface on the persisted row.
    await search.fill(lastName1)
    await expect(page.getByText(lastName1, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(email1, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    })

    // Member 2 — independent search confirms the second row persisted too.
    await search.fill(lastName2)
    await expect(page.getByText(lastName2, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText(email2, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    })

    await ctx.close()
  })

  test('re-importing the same CSV skips already-enrolled members (match-or-create)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      storageState: await freshAuthState('officer'),
    })
    const page = await ctx.newPage()

    // Same CSV, same org → every row matches a person already enrolled, so
    // the import handler's findByPersonAndOrg short-circuits to skipped.
    const result = await runImport(
      page,
      fx().slug,
      csv,
      `roster-${uniqueTag}-again.csv`,
      2,
    )

    expect(result.imported, 're-import should create no new members').toBe(0)
    expect(result.skipped, 'both rows already members → skipped').toBe(2)
    expect(result.failed).toBe(0)

    // UI truth: the persistent result banner names the skipped count
    // ("Imported 0 · skipped 2 (already members)").
    await expect(
      page.getByText(/skipped 2 \(already members\)/i),
    ).toBeVisible({ timeout: 15000 })

    await ctx.close()
  })
})
