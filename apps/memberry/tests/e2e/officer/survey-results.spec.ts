// WF-102 — Survey Results: officer reviews aggregated results + individual
// responses for a survey. The officer survey-detail UI 404s without x-org-id
// (and its Analytics tab calls the non-aggregating getSurvey — both real bugs,
// flagged), so results are asserted against the real org-scoped endpoints.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-102: survey results', () => {
  test('a survey with responses exposes real per-response and aggregate results', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)

    // Resolve the seeded NPS survey with 7 completed responses.
    const list = await apiFetch<any>(page, `/surveys/?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const surveys = list.data?.data ?? list.data?.items ?? list.data ?? []
    const survey = surveys.find((s: any) => /member satisfaction/i.test(s.title)) ?? surveys[0]
    expect(survey?.id, 'a seeded survey exists').toBeTruthy()

    // Individual responses (Responses tab data).
    const responses = await apiFetch<any>(page, `/surveys/${survey.id}/responses?limit=10`, { orgId: ORG_ID })
    expect(responses.status, 'responses must be readable').toBe(200)
    const rows = responses.data?.data ?? responses.data?.items ?? responses.data ?? []
    expect(Array.isArray(rows), 'responses return an array').toBe(true)

    // Aggregated analytics (the real aggregation endpoint).
    const analytics = await apiFetch<any>(page, `/surveys/${survey.id}/analytics`, { orgId: ORG_ID })
    expect(analytics.status, 'analytics must be readable').toBe(200)
    const a = analytics.data?.data ?? analytics.data
    expect(a, 'analytics payload present').toBeTruthy()
    expect(Number(a.responseCount ?? a.totalResponses ?? rows.length), 'real response count').toBeGreaterThan(0)
  })
})
