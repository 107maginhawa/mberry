import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

// BR-40 Survey Anonymity (M18) is LIVE. This is a REAL e2e (lives outside the
// ignored stubs/ dir so it actually runs) that exercises the contract through
// the full auth -> API -> DB path. The anonymity GUARANTEE (null responder_id /
// audit cols) + the UI warnings are covered by the component + real-PG tests
// referenced in the skip below.

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('BR-40: Survey Anonymity', () => {
  test('BR-40: anonymity flag is nested under settings, never flat (contract end-to-end)', async ({ page }) => {
    // apiFetch needs a hydrated SPA page on the right origin (same pattern as
    // officer/survey-results.spec.ts).
    await page.goto(`/org/${ORG_ID}/officer/surveys`)

    // Officer lists org surveys through the full auth -> API -> DB path.
    const res = await apiFetch<{
      data: Array<{ id: string; settings?: { anonymous?: boolean }; anonymous?: unknown }>
    }>(page, `/surveys/?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(res.status).toBe(200)

    const surveys = res.data?.data ?? []
    expect(surveys.length, 'org has seeded surveys').toBeGreaterThan(0)

    // R1-1 contract (seed-independent): on EVERY real survey the anonymity flag
    // lives nested under `settings`, NEVER as a flat top-level field. A flat
    // `anonymous` is exactly the divergence that shipped broken 3x.
    for (const s of surveys) {
      expect(s.anonymous, `survey ${s.id} must NOT carry a flat 'anonymous' field`).toBeUndefined()
      expect(
        s.settings === undefined || (typeof s.settings === 'object' && s.settings !== null),
        `survey ${s.id} settings must be the nested object shape`,
      ).toBe(true)
    }
  })

  // NOTE: the rest of BR-40 is covered without a UI journey, so it is NOT
  // stubbed here (no silent skips):
  // - respondent free-text warning + creator <10 small-pool warning →
  //   survey-flow.test.tsx / survey-results.test.tsx `[BR-40]` cases.
  // - anonymous rows null created_by/updated_by (no audit-column deanonymization)
  //   → submitSurveyResponse.integration.test.ts + listSurveyResponses.test.ts.
})
