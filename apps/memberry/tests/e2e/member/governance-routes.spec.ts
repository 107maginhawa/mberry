// Matrix C — member election routes, now that the SDK/api-lib inject x-org-id
// (getElection used to 403 → "Unable to load ballot/election"). Asserts each
// route hydrates real election data, not the error shell.
//
// NOTE: the /governance LANDING additionally calls searchDocuments, whose route
// requires the bare "member" role the seed member doesn't carry (it has
// "association:member") → still 403. Left for the auth role-scheme fix.
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'member' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member election routes', () => {
  test('election detail hydrates a real election', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dashboard`)
    const list = await apiFetch<any>(page, `/association/member/elections?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const elections = list.data?.data ?? list.data ?? []
    test.skip(!elections.length, 'no seed elections')
    const el = elections[0]

    await page.goto(`/org/${ORG_ID}/elections/${el.id}`)
    await expect(page.getByText(/unable to load ballot|failed to load election/i)).toHaveCount(0, { timeout: 15000 })
    // Real election content: status/type chip + the election title.
    await expect(page.getByText(/draft|nominations|voting|published|awaiting|officer|bylaw/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('election vote page hydrates the ballot (no error shell)', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dashboard`)
    const list = await apiFetch<any>(page, `/association/member/elections?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    const elections = list.data?.data ?? list.data ?? []
    const votable = elections.find((e: any) => e.status === 'votingOpen') ?? elections[0]
    test.skip(!votable, 'no seed elections')

    await page.goto(`/org/${ORG_ID}/elections/${votable.id}/vote`)
    await expect(page.getByText(/unable to load ballot/i)).toHaveCount(0, { timeout: 15000 })
    await expect(
      page.getByRole('heading', { name: /cast your vote|vote/i })
        .or(page.getByText(/voting is not open|already voted|no candidates|review & submit/i))
        .first(),
    ).toBeVisible({ timeout: 15000 })
  })
})
