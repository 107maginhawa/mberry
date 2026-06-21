/**
 * AXIS-4 — GDPR / DPA data portability: request → Ready → Download (real),
 * plus cross-person download denial (404 / IDOR firewall).
 *
 * This file was UPGRADED from a shallow happy-path (heading + visible
 * "Download" link on /my/data-export) into a real-flow spec that proves
 * the wire actually moves a payload and that ownership is enforced.
 *
 * Three layers, all real-data assertions (not headings):
 *
 *   T3  (UI, kept + extended) — member opens /my/data-export, clicks
 *       "Request Data Export", and the GET /persons/me/export that builds
 *       the export blob returns 200. The Previous Exports table shows a
 *       "Ready" row. NEW: we read the Download link's blob: href, fetch its
 *       bytes from the page context, and assert they parse to the DPA export
 *       envelope (real `categories` + `profile` keys) — i.e. the link is
 *       payload-bearing, not just present.
 *
 *   SERVER async lifecycle (new) — the dedicated server-side export
 *       endpoints (hand-wired in services/api-ts/src/app.ts:533-535):
 *         POST /persons/me/data-export            → 202 { status:'ready', downloadUrl }
 *         GET  /persons/me/data-export/:id         → 200 { status:'ready' }
 *         GET  /persons/me/data-export/:id/download→ 200 JSON attachment
 *       We drive the full request → Ready → Download chain and assert the
 *       downloaded body is the real `buildMyDataExport` envelope (FIX-008:
 *       same shape as the sync path). Previously ZERO e2e coverage.
 *
 *   CROSS-PERSON 404 (new) — person B signs up fresh and tries to read and
 *       download person A's export id. Both the status read and the
 *       download MUST 404 (getDataExportStatus / getDataExportDownload throw
 *       NotFoundError when row.personId !== session person). Proves the
 *       IDOR firewall: an authenticated stranger can't pull someone else's
 *       personal-data dump even with a valid export UUID.
 *
 * Why the async path matters: the /my/data-export UI today builds its
 * download blob client-side from GET /persons/me/export — it never touches
 * the server's stored-payload download endpoint. So the request→Ready→
 * Download chain with ownership scoping lived entirely outside e2e until now.
 */

import { test, expect } from '../helpers/test-fixture'
import type { Page } from '@playwright/test'
import { signUp } from '../helpers/auth'
import { API_BASE } from '../helpers/test-config'

test.describe.configure({ mode: 'serial' })

/** Dismiss the NPS auto-prompt if it overlaps a control (NpsProvider). */
async function dismissNpsIfPresent(page: Page) {
  const npsDismiss = page.getByRole('button', { name: /dismiss survey/i })
  if (await npsDismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await npsDismiss.click()
    await expect(npsDismiss).toBeHidden({ timeout: 5000 }).catch(() => {})
  }
}

/**
 * CSRF-aware authenticated request from inside the page context.
 * Returns status + parsed JSON (null when not JSON) + raw text + the
 * content-disposition header (so download assertions can prove the
 * attachment was served).
 */
async function authReq(
  page: Page,
  path: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<{
  status: number
  json: any
  text: string
  contentDisposition: string | null
  contentType: string | null
}> {
  return page.evaluate(
    async ({ apiBase, path, init }) => {
      const csrfRes = await fetch(`${apiBase}/csrf-token`, { credentials: 'include' })
      const { token } = (await csrfRes.json()) as { token: string }
      const res = await fetch(`${apiBase}${path}`, {
        method: init.method ?? 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: init.body != null ? JSON.stringify(init.body) : undefined,
      })
      const text = await res.text()
      let json: any = null
      try {
        json = JSON.parse(text)
      } catch {
        json = null
      }
      return {
        status: res.status,
        json,
        text,
        contentDisposition: res.headers.get('content-disposition'),
        contentType: res.headers.get('content-type'),
      }
    },
    { apiBase: API_BASE, path, init },
  )
}

/** Assert a parsed object is the real DPA export envelope, not an empty shell. */
function assertExportEnvelope(payload: any) {
  expect(payload).toBeTruthy()
  // categories is the fixed manifest from buildMyDataExport — its presence
  // proves we got the aggregated envelope, not an error body.
  expect(Array.isArray(payload.categories)).toBe(true)
  expect(payload.categories).toEqual(
    expect.arrayContaining(['profile', 'memberships', 'payments', 'certificates']),
  )
  // The data-category arrays must exist (real aggregation ran), and the
  // profile projection must be an object (EF-M01 GDPR field projection).
  expect(typeof payload.profile).toBe('object')
  expect(Array.isArray(payload.memberships)).toBe(true)
  expect(Array.isArray(payload.payments)).toBe(true)
  expect(Array.isArray(payload.certificates)).toBe(true)
  expect(typeof payload.exportedAt).toBe('string')
}

test.describe('AXIS-4 — GDPR data export: request → Ready → download + cross-person 404', () => {
  test('UI: request export, Ready row, and Download link yields a payload-bearing file', async ({
    page,
  }) => {
    // Fresh user so the server-side 24h rate-limit (M2-R4 in exportMyData.ts)
    // is guaranteed clean across consecutive runs.
    await signUp(page)

    // Clear the per-browser localStorage rate-limit sentinel before mount so
    // the request button is enabled regardless of prior runs.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('data_export_last_request')
      } catch {
        /* localStorage may be unavailable in setup contexts */
      }
    })

    await page.goto('/my/data-export')
    await dismissNpsIfPresent(page)

    await expect(
      page.getByRole('heading', { name: /export my data/i }),
    ).toBeVisible({ timeout: 15000 })

    const requestBtn = page.getByRole('button', { name: /request data export/i })
    await expect(requestBtn).toBeEnabled({ timeout: 10000 })

    // The GET that aggregates the JSON export must succeed (real wire).
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

    // The GET 200 body is the real export envelope — assert on the wire data,
    // not just the toast/heading.
    const wirePayload = await resp.json().catch(() => null)
    assertExportEnvelope(wirePayload)

    // Previous Exports now renders one Ready row with a Download link.
    await expect(
      page.getByRole('heading', { name: /previous exports/i }),
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/^Ready$/).first()).toBeVisible({ timeout: 10000 })

    const downloadLink = page.getByRole('link', { name: /download/i }).first()
    await expect(downloadLink).toBeVisible({ timeout: 10000 })

    // UPGRADE: prove the link is payload-bearing, not just present. The UI
    // (data-export.tsx) builds a `blob:` object URL from the GET payload and
    // sets it as the anchor href (no `download` attribute — so a click would
    // navigate the page to the blob, not fire a Playwright download event).
    // We read that exact href and fetch its bytes from the page context: a
    // working link must hand back a blob whose contents parse to the same DPA
    // envelope. This asserts on the real wire data the href carries.
    const downloadHref = await downloadLink.getAttribute('href')
    expect(downloadHref).toBeTruthy()
    expect(downloadHref!.startsWith('blob:')).toBe(true)

    const blobText = await page.evaluate(async (href) => {
      const res = await fetch(href)
      return res.text()
    }, downloadHref!)
    expect(blobText.length).toBeGreaterThan(0)

    const downloadedPayload = JSON.parse(blobText)
    assertExportEnvelope(downloadedPayload)

    // The button mutates to the rate-limit message → localStorage was written.
    await expect(
      page.getByRole('button', { name: /next export available in/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('SERVER: async request → Ready status → download returns the stored envelope', async ({
    page,
  }) => {
    // Fresh user keeps the 24h shared ledger clean (the async POST and the sync
    // GET share the rate-limit window per person).
    await signUp(page)
    // Navigate to the SPA so page-context fetch carries the session cookie +
    // an Origin the CSRF/CORS middleware accepts.
    await page.goto('/dashboard')

    // 1. Request the async export → 202 ready with a download URL.
    // NB: API_BASE is the raw API origin (:7213) which serves /persons/me/...
    // directly — the /api prefix only exists on the SPA's Vite proxy (:3004).
    const created = await authReq(page, '/persons/me/data-export', { method: 'POST' })
    expect(created.status).toBe(202)
    expect(created.json).toBeTruthy()
    expect(created.json.status).toBe('ready')
    expect(typeof created.json.exportId).toBe('string')
    expect(created.json.exportId.length).toBeGreaterThan(0)
    expect(typeof created.json.downloadUrl).toBe('string')
    expect(created.json.downloadUrl).toContain(created.json.exportId)
    // 7-day TTL is set.
    expect(typeof created.json.expiresAt).toBe('string')

    const exportId: string = created.json.exportId

    // 2. Poll the status endpoint — ownership-scoped read returns Ready.
    const status = await authReq(page, `/persons/me/data-export/${exportId}`)
    expect(status.status).toBe(200)
    expect(status.json.id).toBe(exportId)
    expect(status.json.status).toBe('ready')
    expect(typeof status.json.downloadUrl).toBe('string')

    // 3. Download the stored payload → 200 JSON attachment carrying the real
    //    envelope (FIX-008: identical shape to the sync GET path).
    const dl = await authReq(page, `/persons/me/data-export/${exportId}/download`)
    expect(dl.status).toBe(200)
    expect(dl.contentType).toContain('application/json')
    // NB: the handler DOES set `Content-Disposition: attachment; filename=...`
    // (getDataExportDownload.ts), but this fetch runs in the SPA page context
    // (:3004) against the API origin (:7213). Content-Disposition is NOT a
    // CORS-safelisted response header and the API's CORS config only exposes
    // X-Request-ID (middleware/security.ts exposeHeaders), so the browser hides
    // it from JS here. We therefore assert on the observable cross-origin
    // surface — status, content-type, and the real envelope body — which is
    // what proves the download is payload-bearing.
    if (dl.contentDisposition) {
      // If a future CORS change exposes it, keep the stronger assertion honest.
      expect(dl.contentDisposition).toContain('attachment')
      expect(dl.contentDisposition).toContain(exportId)
    }
    assertExportEnvelope(dl.json)
  })

  test('SECURITY: a different person cannot read or download another person export (404)', async ({
    browser,
  }) => {
    // Person A (owner) — sign up + create a real export, capturing its id.
    const ctxA = await browser.newContext()
    const pageA = await ctxA.newPage()
    await signUp(pageA)
    await pageA.goto('/dashboard')

    const createdA = await authReq(pageA, '/persons/me/data-export', { method: 'POST' })
    expect(createdA.status).toBe(202)
    const aExportId: string = createdA.json.exportId
    expect(typeof aExportId).toBe('string')

    // Sanity: A can download A's own export (baseline the 404 is meaningful).
    const aOwn = await authReq(pageA, `/persons/me/data-export/${aExportId}/download`)
    expect(aOwn.status).toBe(200)
    await ctxA.close()

    // Person B — a different fresh, authenticated session.
    const ctxB = await browser.newContext()
    const pageB = await ctxB.newPage()
    await signUp(pageB)
    await pageB.goto('/dashboard')

    // B reads A's export STATUS by id → 404 (ownership-scoped NotFoundError).
    const bStatus = await authReq(pageB, `/persons/me/data-export/${aExportId}`)
    expect(bStatus.status).toBe(404)

    // B downloads A's export by id → 404. This is the IDOR firewall: a valid
    // export UUID held by a stranger must not leak another member's data dump.
    const bDownload = await authReq(pageB, `/persons/me/data-export/${aExportId}/download`)
    expect(bDownload.status).toBe(404)
    // The 404 body must NOT contain A's exported personal data.
    expect(bDownload.text).not.toContain('"categories"')
    expect(bDownload.text).not.toContain('"profile"')

    await ctxB.close()
  })
})
