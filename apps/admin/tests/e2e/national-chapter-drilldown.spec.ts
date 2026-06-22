// WF-085 Chapter Drill-Down (frontend). Signs in as platform admin, opens the
// national dashboard, selects the dental association + a month that has seeded
// snapshots, CLICKS a chapter row, and asserts the dedicated detail route renders
// REAL data — the chapter name plus a metric value (totalMembers) that matches the
// number shown in the row it was launched from. Mirrors national-dashboard.spec.ts:
// API month-probe to pick a live month, then real-data (not heading-only) assertions.
import { test, expect } from '@playwright/test'
import { signInAsAdmin } from './helpers/auth'
import { ADMIN_BASE } from './helpers/test-config'

const API_URL = `${ADMIN_BASE}/api`

function recentMonths(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

test.describe('WF-085: national dashboard chapter drill-down', () => {
  test('clicking a chapter row opens the detail with real metrics matching the row', async ({
    page,
  }) => {
    await signInAsAdmin(page.context())
    const req = page.context().request
    const hdr = { Origin: ADMIN_BASE }

    // Resolve the dental association (don't hardcode a seed UUID).
    const assocRes = await req.get(`${API_URL}/admin/associations?limit=100`, { headers: hdr })
    expect(assocRes.status()).toBe(200)
    const assocBody = (await assocRes.json()) as any
    const assocs = assocBody?.data ?? assocBody ?? []
    const assoc = assocs.find((a: any) => /dental/i.test(a.name)) ?? assocs[0]
    expect(assoc?.id, 'an association exists').toBeTruthy()

    // Probe for a month with seeded chapter snapshots and capture a real chapter row.
    let month = ''
    let chapter: any = null
    for (const m of recentMonths(4)) {
      const r = await req.get(
        `${API_URL}/admin/national-dashboard/${assoc.id}?snapshotMonth=${m}`,
        { headers: hdr }
      )
      if (r.status() !== 200) continue
      const dd = ((await r.json()) as any)?.data ?? null
      const chapters = dd?.chapters ?? []
      const real = chapters.find((c: any) => c.orgId && Number(c.totalMembers) > 0)
      if (real) {
        month = m
        chapter = real
        break
      }
    }
    expect(chapter, 'a month with seeded chapter snapshots was found').toBeTruthy()

    // Drive the UI: open the dashboard, pick the association + month, click the row.
    await page.goto(`${ADMIN_BASE}/national-dashboard`)

    // Select association.
    await page.getByText('Select association').click()
    await page.getByRole('option', { name: assoc.name }).click()

    // Select the probed month (the month picker lists YYYY-MM values verbatim).
    const monthTrigger = page.locator('button[role="combobox"]').last()
    await monthTrigger.click()
    await page.getByRole('option', { name: month, exact: true }).click()

    // Wait for the chapter row to render, then click it to drill in.
    const chapterName: string = chapter.chapterName ?? chapter.orgId
    const rowLink = page.getByRole('link', { name: chapterName }).first()
    await expect(rowLink).toBeVisible({ timeout: 15_000 })
    await rowLink.click()

    // Detail route is loaded.
    await expect(page).toHaveURL(new RegExp(`/national-dashboard/chapters/${chapter.orgId}`))

    // Real data — the chapter name heading AND the real Members metric value.
    await expect(page.getByRole('heading', { name: chapterName })).toBeVisible()
    const expectedMembers = Number(chapter.totalMembers).toLocaleString()
    await expect(page.getByText(expectedMembers, { exact: true }).first()).toBeVisible()

    // Suppression contract: a small chapter (<5 members) must show the privacy
    // notice instead of zeroed tiles. If the seeded row is small, assert it.
    if (Number(chapter.totalMembers) < 5) {
      await expect(
        page.getByText(/hidden to protect member privacy/i)
      ).toBeVisible()
    }
  })
})
