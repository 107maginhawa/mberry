/**
 * T3 — GDPR personal data export creates a Ready row in the export list.
 *
 * Real UI: signs in as the seeded member, opens /my/data-export, clears
 * localStorage to bypass the per-browser 24h rate limit, clicks
 * "Request Data Export", waits for the /persons/me/export POST to
 * succeed, then asserts the "Previous Exports" table renders a new row
 * with a "Ready" status badge AND a Download link.
 *
 * Critical-gap proof: the existing member/data-export.spec only covers
 * the /settings/account variant (download-on-click). The dedicated
 * /my/data-export surface (Previous Exports list + rate limit) had no
 * happy-path coverage proving the post-create row actually shows up.
 */

import { test, expect } from '../helpers/test-fixture'
import { signUp } from '../helpers/auth'

test.describe.configure({ mode: 'serial' })

test.describe('T3 — Data export request appears in Previous Exports', () => {
  test('member requests export, sees Ready row + Download link', async ({ page }) => {
    // Fresh user so the server-side 24h rate-limit (BR M2-R4 in
    // exportMyData.ts) is guaranteed clean — running against the seeded
    // member would intermittently 429 across consecutive runs.
    await signUp(page)

    // Clear the localStorage rate-limit sentinel before the page mounts
    // so this spec is deterministic regardless of prior runs.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('data_export_last_request')
      } catch {
        /* localStorage may not be available in setup contexts */
      }
    })

    await page.goto('/my/data-export')

    await expect(
      page.getByRole('heading', { name: /export my data/i }),
    ).toBeVisible({ timeout: 15000 })

    const requestBtn = page.getByRole('button', { name: /request data export/i })
    await expect(requestBtn).toBeEnabled({ timeout: 10000 })

    // Click + wait for the GET that builds the JSON blob to succeed.
    // (The handler is `app.get('/persons/me/export', …)` — see
    // services/api-ts/src/handlers/person/exportMyData.ts.)
    const exportReq = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        r.url().endsWith('/api/persons/me/export') &&
        r.status() === 200,
      { timeout: 20000 },
    )
    await requestBtn.click()
    const resp = await exportReq
    expect(resp.status()).toBe(200)

    // Sonner toast confirms the categories were exported.
    await expect(page.getByText(/export ready/i).first()).toBeVisible({
      timeout: 10000,
    })

    // Previous Exports section now renders with one Ready row.
    await expect(
      page.getByRole('heading', { name: /previous exports/i }),
    ).toBeVisible({ timeout: 10000 })

    // The row's status badge says "Ready" and the Download link is
    // present (proves the blob URL was attached to the new record).
    await expect(
      page.getByText(/^Ready$/).first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(
      page.getByRole('link', { name: /download/i }).first(),
    ).toBeVisible({ timeout: 10000 })

    // The button text mutates to the rate-limit message so we know
    // localStorage was written too.
    await expect(
      page.getByRole('button', { name: /next export available in/i }),
    ).toBeVisible({ timeout: 10000 })
  })
})
