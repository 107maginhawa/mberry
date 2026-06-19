// WF-009 — Bulk CSV Import with Member Matching (M01 framing)
// WF-031 — Bulk CSV Import: upload, validate, preview, import with matching (M05 framing)
/**
 * T5 — Officer uploads a CSV roster, the import succeeds + success banner shows.
 *
 * Real UI: officer (seeded president) on /org/$slug/officer/roster/import.
 * Drives the hidden file input via setInputFiles with an in-memory CSV
 * buffer, clicks "Import N Members" once the preview mounts, waits for
 * POST /association/member/roster/import to return 2xx, then asserts
 * the "Successfully imported N members" banner renders.
 *
 * Critical-gap proof: roster import had no E2E coverage despite being
 * the primary onboarding path for chapter-bound rosters.
 */

import { test, expect } from '../helpers/test-fixture'
import { freshAuthState } from '../helpers/programmatic-auth'
import { withIsolatedFixture } from '../helpers/isolated-fixture'

test.describe.configure({ mode: 'serial' })

test.describe('T5 — Officer CSV roster import succeeds end-to-end', () => {
  // Fresh org keeps the imported members out of seeded data.
  const fx = withIsolatedFixture(test, { memberCount: 0 })

  test('upload CSV → preview → Import → success banner', async ({ browser }) => {
    const ctx = await browser.newContext({
      storageState: await freshAuthState('officer'),
    })
    const page = await ctx.newPage()

    await page.goto(`/org/${fx().slug}/officer/roster/import`)

    await expect(
      page.getByRole('heading', { name: /import roster/i }),
    ).toBeVisible({ timeout: 15000 })

    // Build a deterministic CSV that the server's BR-22 matcher can
    // consume — needs at least one of email/licenseNumber per row.
    const uniqueTag = Date.now().toString(36)
    const csv = [
      'First Name,Last Name,Email,License Number,Member Number',
      `Roster,One ${uniqueTag},roster-1-${uniqueTag}@test.local,LIC-${uniqueTag}-1,MEM-${uniqueTag}-1`,
      `Roster,Two ${uniqueTag},roster-2-${uniqueTag}@test.local,LIC-${uniqueTag}-2,MEM-${uniqueTag}-2`,
    ].join('\n')

    // The hidden <Input id="csv-input" type="file"> is opened by a div
    // click handler. setInputFiles bypasses that — set the buffer
    // directly on the input element.
    const fileInput = page.locator('input#csv-input')
    await fileInput.setInputFiles({
      name: `roster-${uniqueTag}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    })

    // Preview banner ("({n} rows)") confirms parser ran client-side.
    await expect(page.getByText(/\(2 rows\)/i)).toBeVisible({
      timeout: 10000,
    })

    const importBtn = page.getByRole('button', { name: /import 2 members/i })
    await expect(importBtn).toBeEnabled({ timeout: 5000 })

    // Click → wait for the POST to land.
    const importReq = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/association/member/roster/import') &&
        r.status() < 400,
      { timeout: 20000 },
    )
    await importBtn.click()
    const importResp = await importReq
    expect(importResp.status()).toBeLessThan(400)

    // Sonner toast + success banner with the imported count.
    await expect(
      page.getByText(/successfully imported \d+ members/i).first(),
    ).toBeVisible({ timeout: 15000 })

    await ctx.close()
  })
})
