// Matrix C — officer detail routes that used to 403 because their SDK/api-lib
// queries omitted x-org-id. Now that the org header is injected globally they
// hydrate real data. (officer survey detail, comms templates list, payment detail)
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Officer detail routes unblocked by x-org-id', () => {
  test('survey detail hydrates a real survey', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/surveys`)
    const list = await apiFetch<any>(page, `/surveys/?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    const surveys = list.data?.data ?? list.data?.items ?? list.data ?? []
    test.skip(!surveys.length, 'no seed surveys')
    const survey = surveys.find((s: any) => /member satisfaction/i.test(s.title)) ?? surveys[0]

    await page.goto(`/org/${ORG_ID}/officer/surveys/${survey.id}`)
    await expect(page.getByText(/survey not found|failed to load/i)).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByText(new RegExp(survey.title.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first()).toBeVisible({ timeout: 15000 })
  })

  test('comms templates list hydrates real templates', async ({ page }) => {
    const respP = page.waitForResponse(
      (r) => /\/message-templates/.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    ).catch(() => null)
    await page.goto(`/org/${ORG_ID}/officer/communications/templates`)

    const resp = await respP
    if (resp) expect(resp.status(), 'templates list GET no longer 403').toBe(200)
    await expect(page.getByRole('heading', { name: /templates/i }).first()).toBeVisible({ timeout: 15000 })
  })

  test('payment detail hydrates a real payment', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/payments`)
    const list = await apiFetch<any>(
      page,
      `/association/member/dues-payments?organizationId=${ORG_ID}&status=completed&limit=1`,
      { orgId: ORG_ID },
    )
    const payments = list.data?.data ?? list.data ?? []
    test.skip(!payments.length, 'no completed payments seeded')
    const paymentId = payments[0].id

    await page.goto(`/org/${ORG_ID}/officer/payments/${paymentId}`)
    await expect(page.getByText(/unable to load payment/i)).toHaveCount(0, { timeout: 15000 })
    await expect(page.getByText(/Amount:/i)).toBeVisible({ timeout: 15000 })
  })
})
