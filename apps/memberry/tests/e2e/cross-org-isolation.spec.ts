// WF-019 — User Impersonation
// Cross-org isolation (IDOR) E2E tests
// Verifies officers from one organization cannot access another org's data
// through the full browser stack. Backend IDOR protection from Phase 12-04.
import { test, expect } from './helpers/test-fixture'
import { SEED_IDOR_EMAIL, TEST_PASSWORD } from './helpers/test-config'
import { authStateFile } from './helpers/auth-state'


test.use({ storageState: authStateFile('idor') })
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:7213'
const ORG_A_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562' // pda-metro-manila

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
})
