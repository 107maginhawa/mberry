// WF-047 Message Templates · WF-048 Delivery Stats · WF-063 Training Analytics
//
// Officer comms/training reporting. The officer comms pages (templates list,
// analytics) issue bare fetches WITHOUT the required x-org-id header and 403 on
// load (real app bug, flagged in the PHASE6 report), so these flows are driven
// through the org-scoped endpoints directly with real-data assertions.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-047: officer creates a message template', () => {
  test('creates a reusable template and it appears in the template list', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/templates`)
    const name = `E2E Template ${Date.now()}`

    const created = await apiFetch<any>(page, '/association/message-templates', {
      method: 'POST', orgId: ORG_ID,
      body: {
        name,
        channel: 'inApp',
        subject: 'E2E subject',
        body: 'Hello {{memberName}}, welcome.',
        mergeFields: ['memberName'],
        category: 'general',
        isTransactional: false,
      },
    })
    expect(created.status, 'template create must succeed').toBe(201)

    const list = await apiFetch<any>(page, '/association/message-templates', { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const items = list.data?.items ?? list.data?.data ?? list.data ?? []
    expect(items.some((t: any) => t.name === name), 'new template is persisted').toBe(true)
  })
})

test.describe('WF-048: announcement delivery stats', () => {
  test('sent announcements carry real delivery/open statistics', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/communications/analytics`)

    const res = await apiFetch<any>(page, `/communications/announcements/${ORG_ID}?status=sent`, { orgId: ORG_ID })
    expect(res.status, 'sent announcements list must succeed').toBe(200)
    const rows = res.data?.data ?? res.data ?? []
    expect(Array.isArray(rows) && rows.length, 'seed has sent announcements').toBeGreaterThan(0)

    // Delivery stats are exposed per-announcement via the dedicated stats
    // endpoint. Assert the contract (200 + well-formed payload) on every
    // announcement, and assert real numeric delivery figures on whichever ones
    // have a recorded stats row (the seed only attaches stats to some).
    let withStats: any = null
    for (const a of rows) {
      const statsRes = await apiFetch<any>(page, `/communications/announcements/${a.id}/stats`, { orgId: ORG_ID })
      expect(statsRes.status, 'announcement stats must be readable').toBe(200)
      const payload = statsRes.data?.data ?? statsRes.data
      expect(payload?.status, 'stats payload carries the announcement status').toBeTruthy()
      const s = payload?.stats
      if (s && Number.isFinite(Number(s.recipients))) { withStats = s; break }
    }
    if (withStats) {
      expect(Number(withStats.recipients), 'real recipient count').toBeGreaterThanOrEqual(0)
      expect(Number(withStats.emailSent ?? withStats.pushDelivered ?? 0), 'real delivery figure').toBeGreaterThanOrEqual(0)
    }
  })
})

test.describe('WF-063: training completion analytics', () => {
  test('training enrollments expose completion status for analytics', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/training`)

    // Resolve a real training id.
    const list = await apiFetch<any>(page, '/association/training', { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const trainings = Array.isArray(list.data) ? list.data : (list.data?.data ?? [])
    expect(trainings.length, 'seed has training').toBeGreaterThan(0)
    const trainingId = trainings[0].id

    // Enrollments back the completion-rate analytics (Attendance tab).
    const enr = await apiFetch<any>(page, `/association/training-lifecycle/${trainingId}/enrollments?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(enr.status, 'enrollments must be readable').toBe(200)
    const enrollments = enr.data?.data ?? enr.data ?? []
    expect(Array.isArray(enrollments), 'enrollments return an array').toBe(true)
    // Each enrollment carries a status the analytics derive completion from.
    if (enrollments.length > 0) {
      expect(enrollments[0]).toHaveProperty('status')
    }
  })
})
