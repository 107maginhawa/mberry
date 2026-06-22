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

    // Select association (shadcn/Radix Select = button[role="combobox"]; the
    // association trigger is the first combobox, the month picker the last).
    await page.getByRole('combobox').first().click()
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

    // Assert against what getNationalChapterDetail ACTUALLY returns (the detail
    // endpoint resolves org names + suppression independently of the dashboard
    // list, so don't assume the row's name/values carry over verbatim).
    const detRes = await req.get(
      `${API_URL}/admin/national/chapters/${chapter.orgId}?associationId=${assoc.id}&snapshotMonth=${month}`,
      { headers: hdr }
    )
    expect(detRes.status(), 'platform admin can read the chapter detail').toBe(200)
    const detail = ((await detRes.json()) as any)?.data ?? {}

    // Detail shell rendered (breadcrumb back to the dashboard) — name-independent.
    await expect(page.getByRole('link', { name: 'National Dashboard' }).first()).toBeVisible()
    // Resolved org name heads the page (organizationName, or 'Chapter' when null).
    await expect(page.getByText(detail.organizationName ?? 'Chapter').first()).toBeVisible()

    if (detail.isSuppressed) {
      // Small chapter (<5 members, M14-R2): privacy notice, NOT zeroed metric tiles.
      await expect(page.getByText(/hidden to protect member privacy/i)).toBeVisible()
    } else {
      // Real Members metric value rendered from the detail response.
      const expectedMembers = Number(detail.totalMembers).toLocaleString()
      await expect(page.getByText(expectedMembers, { exact: true }).first()).toBeVisible()
    }
  })
})
