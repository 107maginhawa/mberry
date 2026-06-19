// WF-072 — Public Verification: anyone (unauthenticated) verifies a real
// certificate/credential by its number via the public /verify/$id route, which
// calls the public verify endpoint. Uses a real seeded certificate number.
import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3004'
// Seeded certificate number (services/api-ts/src/seed/layer-4-cross-module.ts).
const SEED_CERT = 'CERT-2025-0001'

test.describe('WF-072: public credential/certificate verification', () => {
  test('verifying a real seeded certificate returns its status', async ({ page }) => {
    // Public route — no auth context.
    const respP = page.waitForResponse(
      (r) => /\/certificates\/verify\//.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    )
    await page.goto(`${BASE}/verify/${SEED_CERT}`)

    const resp = await respP
    expect(resp.status(), 'public certificate verify GET must succeed').toBe(200)
    const body = await resp.json().catch(() => null)
    const data = body?.data ?? body
    expect(data?.certificateNumber, 'verify returns the real certificate number').toBe(SEED_CERT)

    // The result card surfaces the verified certificate number.
    await expect(page.getByText(SEED_CERT).first()).toBeVisible({ timeout: 15000 })
  })

  test('an unknown certificate shows a not-found state', async ({ page }) => {
    await page.goto(`${BASE}/verify/CERT-9999-9999`)
    await expect(page.getByText(/not found|could not|invalid|no .*found/i).first()).toBeVisible({ timeout: 15000 })
  })
})
