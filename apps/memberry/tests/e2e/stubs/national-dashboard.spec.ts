import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD, API_BASE } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Backend coverage: 12 unit tests in br-36.national-dashboard.test.ts
// E2E stubs below define user-facing scenarios for when module M14 is built.

test.describe('BR-36: National Dashboard Access', () => {
test('unauthenticated request returns 401', async ({ page }) => {
    const response = await page.evaluate(async ({ orgId }) => {
      const res = await fetch(`${API_BASE}/association/dashboard/national?organizationId=${orgId}`)
      return { status: res.status }
    }, { orgId: ORG_ID })
    expect(response.status).toBe(401)
  })

  test.fixme('BR-36: platform admin can access national dashboard', async ({ page }) => {
    // Role: platform admin
    // Navigate to national dashboard.
    // Expected: dashboard loads with cross-chapter aggregate data.
  })

  test.fixme('BR-36: chapter officer blocked from national dashboard', async ({ page }) => {
    // Role: chapter-level officer (not national officer)
    // Attempt to access national dashboard.
    // Expected: 403. Chapter officers cannot view data from other chapters.
  })

  test.fixme('BR-36: dashboard shows aggregated data only, no individual members', async ({ page }) => {
    // Role: platform admin or national officer
    // View national dashboard.
    // Expected: all data is aggregated per chapter. No individual
    // member-level data exposed unless chapter has granted explicit consent.
  })

  test.fixme('BR-36: chapters with <5 members rolled into "Small chapters" category', async ({ page }) => {
    // Edge case: re-identification prevention
    // When a chapter has fewer than 5 members, its data is NOT shown
    // individually. Instead, it's combined into a "Small chapters"
    // aggregate category to prevent statistical re-identification.
  })

  test.fixme('BR-36: designated national officer can access dashboard', async ({ page }) => {
    // Role: national officer (configured per association by platform admin)
    // Expected: access granted. National officer designation is
    // association-specific, not a system-wide role.
  })
})
