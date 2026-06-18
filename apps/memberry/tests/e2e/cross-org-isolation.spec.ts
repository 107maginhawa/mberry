// WF-019 — User Impersonation
// Cross-org isolation (IDOR) E2E tests
// Verifies officers from one organization cannot access another org's data
// through the full browser stack. Backend IDOR protection from Phase 12-04.
import { test, expect } from './helpers/test-fixture'
import { captureAnyApiSuccess } from './helpers/real-flow'
import { independentRead } from './helpers/independent-read'

// Clause 1: the idor officer's OWN page hydration (via the /api proxy) must
// stay clean. The cross-org probes below hit :7213 directly (pathname
// `/membership/...`, not `/api/...`) so their intentional 4xx denials are not
// flagged by the error-surface listener.
test.use({ authRole: 'idor', failOnUnexpected4xx: true, failOnConsoleError: true })
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:7213'
const ORG_A_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562' // pda-metro-manila

// Cross-origin fetch from `page.evaluate(() => fetch(API))` runs with
// Origin: null when the page hasn't navigated anywhere, and hono/cors
// rejects null-origin preflights. Land on the SPA first so subsequent
// fetches inherit the http://localhost:3004 origin that CORS_ORIGINS allows.
test.beforeEach(async ({ page }) => {
  const respP = captureAnyApiSuccess(page)
  await page.goto('/dashboard')
  const resp = await respP
  expect(resp?.status()).toBe(200)
  expect(resp?.ok()).toBe(true)
})

test.describe('Cross-Org Isolation (IDOR Prevention)', () => {
test('org B officer cannot view org A roster', async ({ page }) => {
    const status = await page.evaluate(
      async ({ apiBase, orgAId }) => {
        const res = await fetch(
          `${apiBase}/membership/members/${orgAId}`,
          { credentials: 'include' },
        )
        return res.status
      },
      { apiBase: API_BASE, orgAId: ORG_A_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('org B officer cannot view org A dues dashboard', async ({ page }) => {
    const status = await page.evaluate(
      async ({ apiBase, orgAId }) => {
        const res = await fetch(
          `${apiBase}/dues/dashboard/${orgAId}`,
          { credentials: 'include' },
        )
        return res.status
      },
      { apiBase: API_BASE, orgAId: ORG_A_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  test('org B officer cannot manage org A events', async ({ page }) => {
    const status = await page.evaluate(
      async ({ apiBase, orgAId }) => {
        const res = await fetch(`${apiBase}/association/operations/events`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgAId,
            name: 'IDOR Test Event',
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
          }),
        })
        return res.status
      },
      { apiBase: API_BASE, orgAId: ORG_A_ID },
    )
    expect(status).toBeGreaterThanOrEqual(400)
  })

  // Clause 4: from an INDEPENDENT session, org A's OWN officer CAN read org A's
  // roster — proving the cross-org 4xx above is an authorization denial, not a
  // missing/empty resource. Reads durable state, not the UI just driven.
  test('org A officer CAN read org A roster (independent session)', async () => {
    const roster = await independentRead<{ status: number; count: number }>(
      'officer',
      async (api) => {
        const res = await api.get<{ data?: unknown[] }>(`/membership/members/${ORG_A_ID}`, {
          orgId: ORG_A_ID,
        })
        return { status: res.status, count: res.data?.data?.length ?? 0 }
      },
    )
    expect(roster.status, 'org A officer reads org A roster').toBe(200)
    expect(roster.count, 'org A roster is non-empty (resource exists)').toBeGreaterThan(0)
  })
})
