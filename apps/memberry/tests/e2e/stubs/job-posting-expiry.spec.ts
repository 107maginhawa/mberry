import { test, expect } from '../helpers/test-fixture'
import { SEED_OFFICER_EMAIL, TEST_PASSWORD, API_BASE } from '../helpers/test-config'
import { authStateFile } from '../helpers/auth-state'


test.use({ storageState: authStateFile('officer') })
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

// Backend coverage: 14 unit tests in br-37.job-posting-expiry.test.ts
// BACKEND/CONTRACT-ONLY — the M15 job board has no FE yet, so there is no UI
// journey to drive. Expiry / public-board exclusion / extend / 3-day reminder
// are covered on real PG by jobs/jobPostingExpiry.integration.test.ts and
// jobs/extendJobPosting.test.ts. These remain `.skip` (NOT pending) until a
// job-board FE exists. See docs/ver-3/remediation (BR-37).

test.describe('BR-37: Job Posting Expiry', () => {
test('unauthenticated request returns 401', async ({ page }) => {
    const response = await page.evaluate(async ({ orgId }) => {
      const res = await fetch(`${API_BASE}/association/jobs/expired?organizationId=${orgId}`)
      return { status: res.status }
    }, { orgId: ORG_ID })
    expect(response.status).toBe(401)
  })

  test.fixme('BR-37: job posting defaults to 30-day expiry', async ({ page }) => {
    // Role: officer creating a job posting
    // Create a new job posting without specifying expiry.
    // Expected: expiry date auto-set to 30 days from creation.
    // Expiry duration is configurable per individual posting at creation time.
  })

  test.fixme('BR-37: expired posting removed from public board, retained in history', async ({ page }) => {
    // Role: public viewer + officer
    // After expiry, posting no longer visible on public job board.
    // Officer can still see it in their posting history for record-keeping.
  })

  test.fixme('BR-37: 3-day pre-expiry reminder notification sent', async ({ page }) => {
    // Role: job poster
    // 3 days before expiry, poster receives reminder notification.
    // Notification includes option to extend.
  })

  test.fixme('BR-37: extension calculates from expiry date, not from today', async ({ page }) => {
    // Edge case: extension math
    // Posting created day 0, expiry day 30. Extended on day 28.
    // New expiry = day 30 + 30 = day 60. NOT day 28 + 30 = day 58.
    // Extensions reset the clock from the CURRENT expiry, not today.
  })

  test.fixme('BR-37: poster can extend posting with single action', async ({ page }) => {
    // Role: job poster
    // From posting detail or reminder notification, click Extend.
    // Expected: posting extended for another 30 days with one click.
  })
})
