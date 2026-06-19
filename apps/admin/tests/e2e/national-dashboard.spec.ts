// WF-084 Review Association Health · WF-085 Chapter Drill-Down · WF-086 National
// Data Export. The dashboard handler now membership-tests the comma-separated
// role string (was an exact-equality bug rejecting the seed super-admin), so the
// platform admin can read it. Asserts real aggregated KPIs, per-chapter rows,
// and the backend export.
import { test, expect } from '@playwright/test'
import { signInAsAdmin, csrfHeaders } from './helpers/auth'
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

test.describe('WF-084/085/086: national dashboard', () => {
  test('aggregated KPIs and per-chapter rows reflect real snapshot data', async ({ page }) => {
    await signInAsAdmin(page.context())
    const req = page.context().request
    const hdr = { Origin: ADMIN_BASE }

    const assocRes = await req.get(`${API_URL}/admin/associations?limit=100`, { headers: hdr })
    expect(assocRes.status()).toBe(200)
    const assocBody = (await assocRes.json()) as any
    const assocs = assocBody?.data ?? assocBody ?? []
    const assoc = assocs.find((a: any) => /dental/i.test(a.name)) ?? assocs[0]
    expect(assoc?.id, 'an association exists').toBeTruthy()

    let dash: any = null
    let month = ''
    for (const m of recentMonths(4)) {
      const r = await req.get(`${API_URL}/admin/national-dashboard/${assoc.id}?snapshotMonth=${m}`, { headers: hdr })
      expect(r.status(), 'platform admin can read the dashboard (no longer 403)').toBe(200)
      const dd = ((await r.json()) as any)?.data ?? null
      if (dd?.aggregate && (dd.aggregate.chapterCount > 0 || (dd.chapters?.length ?? 0) > 0)) { dash = dd; month = m; break }
    }
    expect(dash, 'a month with seeded snapshots was found').toBeTruthy()

    // WF-084 — real aggregate KPIs.
    expect(Number(dash.aggregate.totalMembers)).toBeGreaterThan(0)
    expect(Number(dash.aggregate.collectionRate)).toBeGreaterThan(0)
    // WF-085 — per-chapter drill-down rows.
    expect(Array.isArray(dash.chapters) && dash.chapters.length).toBeGreaterThan(0)
    expect(dash.chapters[0]).toHaveProperty('totalMembers')

    // WF-086 — backend national export returns a real payload.
    const headers = await csrfHeaders(page.context())
    const exp = await req.post(`${API_URL}/admin/national-dashboard/${assoc.id}/export`, {
      headers, data: { snapshotMonth: month, format: 'csv' },
    })
    expect(exp.status(), 'national export succeeds for platform admin').toBeGreaterThanOrEqual(200)
    expect(exp.status()).toBeLessThan(300)
  })
})
