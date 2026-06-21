// WF-074 / WF-072 — Certificate + public QR verification (real-flow).
//
// Two surfaces, one journey:
//   1. Member certificate surface (/my/certificates → /my/certificates/:id):
//      the member lists their issued training certificates and opens one. We
//      assert the list/detail hydrates over the real wire (GET 200) and that
//      the detail card surfaces real cert content — a "CERT-…" number plus the
//      public verification URL ("/verify/<number>") that the printed QR encodes.
//   2. Public QR-verify route (/verify/$id): the same verification URL, hit
//      unauthenticated (as a scanner would), validates a real seeded certificate
//      (issued → "Valid"; revoked → "REVOKED") and rejects an unknown id (404 →
//      "Certificate Not Found").
//
// This is a real-flow spec: it asserts on the backend response status + body
// and the rendered cert content, NOT just page headings. The public-verify
// assertions use deterministic seeded certificate numbers from
// services/api-ts/src/seed/layer-4-cross-module.ts:
//   CERT-2025-0001 → status "revoked"  (isValid:false)
//   CERT-2025-0002 → status "issued"   (isValid:true)
//
// Business Rules: [BR-18] [BR-19] [BR-20]
import { test, expect } from '../helpers/test-fixture'
import { captureRouteHydration } from '../helpers/real-flow'

const BASE = 'http://localhost:3004'

// Member-cert hydration: /my/certificates and the detail page both hydrate via
// the org-scoped certificates API; /persons/me is the shared profile fetch.
const CERT_OR_PERSON = /\/(certificates|persons\/me)(?:[/?]|$)/
// Public-verify wire: GET /certificates/verify/:certificateNumber (no /api on
// the backend — the Vite proxy strips it). Used to assert the verify result.
const VERIFY_GET = /\/certificates\/verify\//

// Seeded certificate numbers (layer-4-cross-module.ts). 0001 is revoked, 0002
// is a valid "issued" certificate.
const SEED_CERT_VALID = 'CERT-2025-0002'
const SEED_CERT_REVOKED = 'CERT-2025-0001'
const UNKNOWN_CERT = 'CERT-9999-9999'

// ───────────────────────────────────────────────────────────────────────────
// 1. Member certificate surface — list + detail real-flow
// ───────────────────────────────────────────────────────────────────────────

test.describe('Member certificate surface (/my/certificates)', () => {
  test.use({ authRole: 'member' })

  test('member certificate list hydrates over the real wire', async ({ page }) => {
    const respP = captureRouteHydration(page, CERT_OR_PERSON)
    await page.goto('/my/certificates')

    const resp = await respP
    expect(resp?.status(), 'certificate list must hydrate via a 200 GET').toBe(200)
    expect(resp?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'My Certificates' }),
    ).toBeVisible({ timeout: 10000 })

    // Real outcome — either issued cert cards (each carries a CERT-… number) or
    // the explicit empty state. Never a crash / blank shell.
    await expect(
      page
        .getByText(/CERT-\d{4}-\d{4}/)
        .or(page.getByText(/no certificates issued yet/i))
        .first(),
    ).toBeVisible({ timeout: 10000 })
  })

  test('opening a certificate shows real cert content + its QR verify URL', async ({ page }) => {
    const respP = captureRouteHydration(page, CERT_OR_PERSON)
    await page.goto('/my/certificates')
    expect((await respP)?.ok()).toBe(true)

    await expect(
      page.getByRole('heading', { name: 'My Certificates' }),
    ).toBeVisible({ timeout: 10000 })

    // The seeded member may or may not own a certificate. If a card is present,
    // drive the real list→detail navigation and assert the detail renders the
    // SAME real certificate number plus the public verification URL that the
    // printed QR encodes. If empty, the empty state is the correct real outcome
    // and there is nothing to open.
    const firstCertNumber = page.getByText(/CERT-\d{4}-\d{4}/).first()
    const hasCert = await firstCertNumber
      .isVisible()
      .catch(() => false)

    if (!hasCert) {
      await expect(
        page.getByText(/no certificates issued yet/i),
      ).toBeVisible({ timeout: 10000 })
      return
    }

    const certNumber = (await firstCertNumber.textContent())?.trim() ?? ''
    expect(certNumber).toMatch(/^CERT-\d{4}-\d{4}$/)

    // Navigate into the detail page via the real card link.
    const detailRespP = captureRouteHydration(page, CERT_OR_PERSON)
    await page
      .getByRole('link')
      .filter({ hasText: certNumber })
      .first()
      .click()
    await page.waitForURL(/\/my\/certificates\/[^/]+$/, { timeout: 10000 })
    expect((await detailRespP)?.ok()).toBe(true)

    // Detail card surfaces the real cert content: the SAME certificate number…
    await expect(
      page.getByText('Certificate of Completion').first(),
    ).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(certNumber).first()).toBeVisible({ timeout: 10000 })

    // …and the public verification URL the QR encodes (/verify/<number>),
    // proving the member surface and the public verify route share one id.
    await expect(
      page.getByText(new RegExp(`/verify/${certNumber}`)).first(),
    ).toBeVisible({ timeout: 10000 })

    // Download action is reachable (PDF export of the certificate).
    await expect(
      page.getByRole('button', { name: /download pdf/i }),
    ).toBeVisible({ timeout: 10000 })
  })

  test('missing certificate id shows a not-found state, not a crash', async ({ page }) => {
    await page.goto('/my/certificates/00000000-0000-0000-0000-000000000000')
    await expect(
      page.getByText(/certificate not found|do not have permission/i).first(),
    ).toBeVisible({ timeout: 10000 })
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 2. Public QR-verify route (/verify/$id) — unauthenticated scanner
// ───────────────────────────────────────────────────────────────────────────

test.describe('Public QR verification (/verify/$id)', () => {
  // No authRole — public route, exactly as a QR scanner would hit it.

  test('a valid seeded certificate verifies as Valid with its real content', async ({ page }) => {
    const respP = page.waitForResponse(
      (r) => VERIFY_GET.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.goto(`${BASE}/verify/${SEED_CERT_VALID}`)

    const resp = await respP
    expect(resp.status(), 'public verify GET must succeed').toBe(200)

    const body = await resp.json().catch(() => null)
    const data = body?.data ?? body
    expect(data?.certificateNumber, 'verify returns the real cert number').toBe(SEED_CERT_VALID)
    expect(data?.isValid, 'an issued certificate is valid').toBe(true)
    expect(data?.status).toBe('issued')

    // Result card surfaces the Valid badge + the verified certificate number.
    await expect(page.getByText(/valid certificate/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(SEED_CERT_VALID).first()).toBeVisible({ timeout: 15000 })
    // "Scan to verify" QR self-reference renders on the result card.
    await expect(page.getByText(/scan to verify/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('a revoked seeded certificate verifies but shows REVOKED', async ({ page }) => {
    const respP = page.waitForResponse(
      (r) => VERIFY_GET.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.goto(`${BASE}/verify/${SEED_CERT_REVOKED}`)

    const resp = await respP
    expect(resp.status()).toBe(200)
    const body = await resp.json().catch(() => null)
    const data = body?.data ?? body
    expect(data?.certificateNumber).toBe(SEED_CERT_REVOKED)
    expect(data?.isValid, 'a revoked certificate is not valid').toBe(false)
    expect(data?.status).toBe('revoked')

    // Card surfaces the REVOKED badge (not the Valid path) for the real number.
    await expect(page.getByText(/revoked/i).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(SEED_CERT_REVOKED).first()).toBeVisible({ timeout: 15000 })
  })

  test('an unknown certificate id is rejected (404 + Not Found card)', async ({ page }) => {
    const respP = page.waitForResponse(
      (r) => VERIFY_GET.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.goto(`${BASE}/verify/${UNKNOWN_CERT}`)

    const resp = await respP
    expect(resp.status(), 'unknown cert must 404 on the wire').toBe(404)

    await expect(
      page.getByText(/certificate not found/i).first(),
    ).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(UNKNOWN_CERT).first()).toBeVisible({ timeout: 15000 })
  })
})
