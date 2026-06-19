// WF-036 — Member Transfer: an admin initiates an inter-chapter affiliation
// transfer request and it is durably created. Idempotent across runs: a pending
// transfer for the same person may already exist (409) — either way the request
// row is asserted present.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'
import { independentRead } from '../helpers/independent-read'

test.use({ authRole: 'officer' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-036: member affiliation transfer', () => {
  test('admin creates an inter-chapter transfer request (durable)', async ({ page }) => {
    const memberPid = await independentRead<string | undefined>('member', async (api) => {
      const me = await api.get<any>('/persons/me', { orgId: ORG_ID })
      return me.data?.data?.id ?? me.data?.id
    })
    expect(memberPid, 'member personId').toBeTruthy()

    await page.goto(`/org/${ORG_ID}/officer/dashboard`)

    // Resolve a different chapter (pda-cebu) as the transfer target.
    const orgs = await apiFetch<any>(page, '/admin/organizations?limit=100', { orgId: ORG_ID })
    expect(orgs.status).toBe(200)
    const orgList = orgs.data?.data ?? orgs.data ?? []
    const target = orgList.find((o: any) => o.slug === 'pda-cebu') ?? orgList.find((o: any) => o.id !== ORG_ID)
    expect(target?.id, 'a target chapter exists').toBeTruthy()

    const created = await apiFetch<any>(page, '/association/member/affiliation-transfers', {
      method: 'POST', orgId: ORG_ID,
      body: { personId: memberPid, fromChapterId: ORG_ID, toChapterId: target.id },
    })
    expect([201, 409], 'transfer create accepted or already pending').toContain(created.status)

    // Durable read: a transfer request for this person → target chapter exists.
    const list = await apiFetch<any>(page, '/association/member/affiliation-transfers', { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const transfers = list.data?.data ?? list.data ?? []
    expect(
      transfers.some((t: any) => t.personId === memberPid && (t.toChapterId === target.id || t.toOrganizationId === target.id)),
      'the transfer request is durably recorded',
    ).toBe(true)
  })
})
