// WF-033 Membership Categories (officer creates a category) + Matrix C coverage
// of the institutional-memberships list.
//
// Deferred from this pass (genuine backend/seed gaps, not test gaps — flagged in
// the PHASE6 report + commit message by WF id, not faked here; the ids are kept
// OUT of this file so the Matrix-B grep does not count them as covered):
//   • Invite Member — POST /invite is gated on the bare "officer" role, but the
//     seed officer carries "association:officer" → 403. Role-config gap.
//   • Officer Credit Adjustment — POST /association/member/credits/adjust 500s on
//     the credit_entry insert for the seed member (backend precondition; covered
//     by the adjustCreditEntry handler unit tests).
//   • Member Transfer — needs a second real chapter id as the transfer target;
//     resolution is non-trivial and creates persistent pending state.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-033: officer creates a membership category', () => {
  test('upserts a new category and it appears in the org category list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/settings/membership-categories`)
    const name = `E2E Cat ${Date.now()}`

    const saved = await apiFetch<any>(page, `/association/member/membership-categories/${ORG_ID}`, {
      method: 'PUT', orgId: ORG_ID,
      body: {
        name,
        description: 'E2E coverage category',
        applicableTiers: [],
        duesAmount: 150000,
        billingCycle: 'annual',
        sortOrder: 99,
        active: true,
      },
    })
    expect(saved.status, 'category upsert must succeed').toBeGreaterThanOrEqual(200)
    expect(saved.status).toBeLessThan(300)

    // Read-back: the new category is in the org's category list.
    const list = await apiFetch<any>(page, `/association/member/membership-categories?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const cats = list.data?.data ?? list.data ?? []
    expect(cats.some((c: any) => c.name === name), 'new category is persisted').toBe(true)
  })
})

test.describe('Institutional memberships list', () => {
  test('list route hydrates real data (rows or empty state)', async ({ page }) => {
    const respP = captureRouteHydration(page, /\/institutional-memberships/)
    await page.goto(`/org/${ORG_ID}/officer/institutional-memberships`)

    const resp = await respP
    expect(resp?.status(), 'institutional-memberships GET must succeed').toBe(200)
    await expect(
      page.getByText(/no institutional memberships/i)
        .or(page.locator('a[href*="/officer/institutional-memberships/"]'))
        .first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
