// Matrix C — member announcement detail route. Resolves a real announcement id
// from the org feed, opens its detail page, and asserts the real announcement
// content hydrates (the detail GET is id-only, so it renders even though the
// org-scoped list query elsewhere needs x-org-id).
import { test, expect } from '../helpers/test-fixture'
import { apiFetch } from '../helpers/api-fetch'

test.use({ authRole: 'member' })

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('Member announcement detail', () => {
  test('opens a real announcement and shows its content', async ({ page }) => {
    await page.goto(`/org/${ORG_ID}/dashboard`)
    const list = await apiFetch<any>(page, `/communications/announcements/${ORG_ID}?status=sent`, { orgId: ORG_ID })
    expect(list.status).toBe(200)
    const rows = list.data?.data ?? list.data ?? []
    const hasAnnouncements = Array.isArray(rows) && rows.length > 0
    test.skip(!hasAnnouncements, 'no sent announcements seeded')
    const ann = rows[0]
    const title: string = ann.title ?? ann.subject

    const detailP = page.waitForResponse(
      (r) => /\/communications\/announcements\/detail\//.test(r.url()) && r.request().method() === 'GET',
      { timeout: 20000 },
    ).catch(() => null)
    await page.goto(`/org/${ORG_ID}/announcements/${ann.id}`)

    const detail = await detailP
    if (detail) expect(detail.status()).toBe(200)
    // The real announcement title renders on the detail page.
    await expect(page.getByText(title.slice(0, 20)).first()).toBeVisible({ timeout: 15000 })
  })
})
