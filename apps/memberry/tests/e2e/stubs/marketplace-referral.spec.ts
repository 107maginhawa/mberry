import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD, API_BASE } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Backend coverage: 9 unit tests in br-38.marketplace-disclosure.test.ts
// DEFERRED to v2.0 — module M17 (Marketplace) is not built. These are
// intentional `.skip` placeholders (NOT pending). See docs/ver-3/remediation (BR-38).

test.describe('BR-38: Marketplace Referral Disclosure', () => {
test('unauthenticated request returns 401', async ({ page }) => {
    const response = await page.evaluate(async ({ orgId }) => {
      const res = await fetch(`${API_BASE}/association/marketplace/referrals?organizationId=${orgId}`)
      return { status: res.status }
    }, { orgId: ORG_ID })
    expect(response.status).toBe(401)
  })

  test.fixme('BR-38: referral disclosure shown on vendor product detail page', async ({ page }) => {
    // Role: association officer browsing marketplace
    // Navigate to vendor product detail page.
    // Expected: referral/commission disclosure visible before
    // any interaction (adoption, application) is possible.
  })

  test.fixme('BR-38: association must acknowledge disclosure before vendor interaction', async ({ page }) => {
    // Role: association officer
    // Attempt to adopt/apply for vendor listing.
    // Expected: acknowledgment prompt shown. Cannot proceed until
    // disclosure is acknowledged.
  })

  test.fixme('BR-38: association can opt out of vendor listings', async ({ page }) => {
    // Role: association officer
    // Navigate to vendor listing, choose to opt out.
    // Expected: vendor's listings no longer visible to the association.
  })

  test.fixme('BR-38: post-launch term update requires re-acknowledgment within 30 days', async ({ page }) => {
    // Edge case: referral terms change after listing goes live
    // When a referral arrangement is added/changed for an existing vendor,
    // existing associations must be notified within 30 days.
    // Until they re-acknowledge, they cannot interact with the listing.
  })

  test.fixme('BR-38: interaction blocked until updated disclosure acknowledged', async ({ page }) => {
    // Edge case: stale acknowledgment
    // After terms update, association's previous acknowledgment is invalidated.
    // Adoption/application flows blocked until new disclosure acknowledged.
  })
})
