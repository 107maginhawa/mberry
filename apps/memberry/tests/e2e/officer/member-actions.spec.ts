// WF-033 Membership Categories (officer creates a category) + Matrix C coverage
// of the institutional-memberships list.
//
// Deferred (kept out of specs so Matrix-B doesn't mis-count; ids in commit trail):
//   • Member Transfer — needs a second real chapter id + persistent pending state.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { captureRouteHydration } from '../helpers/real-flow'
import { independentRead } from '../helpers/independent-read'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-008: officer invites a member', () => {
  test('creates a pending invite (validatable by token) and rejects duplicates', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/officer/roster`)
    const email = `wf008-${Date.now()}@example.test`

    const created = await apiFetch<any>(page, '/invite', { method: 'POST', orgId: ORG_ID, body: { email } })
    expect(created.status, 'invite must be created').toBe(201)
    const token = (created.data?.data ?? created.data)?.token
    expect(token, 'invite returns a one-time token').toBeTruthy()

    // The invite durably exists — validate its token (public endpoint).
    const validate = await apiFetch<any>(page, `/invite/validate/${token}`)
    expect(validate.status).toBe(200)

    // A second active invite for the same email is rejected.
    const dup = await apiFetch<any>(page, '/invite', { method: 'POST', orgId: ORG_ID, body: { email } })
    expect(dup.status, 'duplicate active invite is rejected').toBe(409)
  })
})

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

test.describe('WF-067: officer adjusts member credits', () => {
  test('awards then deducts credits with a mandatory reason; short reason rejected', async ({ page }) => {
    const memberPid = await independentRead<string | undefined>('member', async (api) => {
      const me = await api.get<any>('/persons/me', { orgId: ORG_ID })
      return me.data?.data?.id ?? me.data?.id
    })
    expect(memberPid, 'member personId').toBeTruthy()
    await page.goto(`/org/${ORG_ID}/officer/reports/credits`)

    const stamp = Date.now()
    const award = await apiFetch<any>(page, '/association/member/credits/adjust', {
      method: 'POST', orgId: ORG_ID,
      body: { personId: memberPid, creditAmount: 5, reason: 'E2E WF-067 award for coverage', idempotencyKey: `wf067-a-${stamp}` },
    })
    expect(award.status, 'award accepted').toBe(201)
    expect(Number((award.data?.data ?? award.data)?.creditAmount)).toBe(5)

    // Deduct the same back so the member balance nets to zero across runs.
    const deduct = await apiFetch<any>(page, '/association/member/credits/adjust', {
      method: 'POST', orgId: ORG_ID,
      body: { personId: memberPid, creditAmount: -5, reason: 'E2E WF-067 deduct for coverage', idempotencyKey: `wf067-d-${stamp}` },
    })
    expect(deduct.status, 'deduct accepted').toBe(201)

    // Mandatory-reason guard.
    const bad = await apiFetch<any>(page, '/association/member/credits/adjust', {
      method: 'POST', orgId: ORG_ID,
      body: { personId: memberPid, creditAmount: 1, reason: 'short', idempotencyKey: `wf067-b-${stamp}` },
    })
    expect(bad.status, 'short reason rejected').toBe(400)
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
