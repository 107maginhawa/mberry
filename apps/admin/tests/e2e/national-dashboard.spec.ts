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

  // WF-085 drill-down: exact-value assertions against the deterministic seeded
  // chapter_snapshot rows (seed/layer-7-platform.ts). The two seeded snapshots
  // for the PDA Metro Manila Chapter org carry known aggregates, so the
  // suppression flag + the cents/percentage/compliance math computed in
  // getNationalChapterDetail.ts can be pinned to real persisted data rather than
  // the prior `> 0` smoke check. Keyed by month so the assertion stays exact as
  // daysAgo(30)/daysAgo(60) roll forward; we pick whichever seeded month is live.
  test('chapter drill-down returns exact computed metrics for the seeded snapshot', async ({ page }) => {
    const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'
    // Mirrors seed/layer-7-platform.ts: total/active/grace/lapsed/suspended,
    // collectionRate (rate*100), creditCompliance (cpd*100), compliant
    // (round(cpd*total)), totalRevenueCents (toCents = collected*100), eventCount.
    // daysAgo(60) snapshot — rate 0.79, cpd 0.72, collected 950000, total 120
    const OLDER = {
      totalMembers: 120, active: 95, grace: 10, lapsed: 12, suspended: 3,
      collectionRate: 79, creditCompliance: 72, compliant: Math.round(0.72 * 120),
      totalRevenueCents: 95000000, eventCount: 210,
    }
    // daysAgo(30) snapshot — rate 0.81, cpd 0.75, collected 1040000, total 128
    const NEWER = {
      totalMembers: 128, active: 104, grace: 8, lapsed: 13, suspended: 3,
      collectionRate: 81, creditCompliance: 75, compliant: Math.round(0.75 * 128),
      totalRevenueCents: 104000000, eventCount: 245,
    }
    await signInAsAdmin(page.context())
    const req = page.context().request
    const hdr = { Origin: ADMIN_BASE }

    // Platform admins must pass associationId explicitly (resolveAssociationAccess
    // in utils/national-access.ts). Resolve it from the associations list so we
    // don't hardcode a seed UUID.
    const assocRes = await req.get(`${API_URL}/admin/associations?limit=100`, { headers: hdr })
    expect(assocRes.status()).toBe(200)
    const assocBody = (await assocRes.json()) as any
    const assocs = assocBody?.data ?? assocBody ?? []
    const assoc = assocs.find((a: any) => /dental/i.test(a.name)) ?? assocs[0]
    expect(assoc?.id, 'an association exists for the seeded org').toBeTruthy()

    // The two seeded months are daysAgo(30) and daysAgo(60); probe recent months
    // and assert against whichever seeded snapshot is live. We map a live month to
    // its seeded tuple by total_members (120 => older, 128 => newer).
    let found: { month: string; data: any } | null = null
    for (const m of recentMonths(4)) {
      const r = await req.get(
        `${API_URL}/admin/national/chapters/${ORG_ID}?snapshotMonth=${m}&associationId=${assoc.id}`,
        { headers: hdr },
      )
      if (r.status() !== 200) continue
      const d = ((await r.json()) as any)?.data
      if (d && Number(d.totalMembers) > 0) { found = { month: m, data: d }; break }
    }
    expect(found, 'a seeded chapter snapshot was found for the org').toBeTruthy()
    const d = found!.data

    expect([120, 128]).toContain(d.totalMembers)
    const expected = d.totalMembers === 120 ? OLDER : NEWER

    // Real persisted aggregates read back through DashboardRepository.getChapterSnapshot.
    expect(d.organizationName).toBe('PDA Metro Manila Chapter')
    expect(d.isSuppressed).toBe(false) // 120/128 are well above the SMALL_CHAPTER_THRESHOLD (5)
    expect(d.totalMembers).toBe(expected.totalMembers)
    expect(d.activeMembers).toBe(expected.active)
    expect(d.memberStatusBreakdown).toEqual({
      active: expected.active, grace: expected.grace, lapsed: expected.lapsed, suspended: expected.suspended,
    })
    // collectionRate = rate * 100 (getNationalChapterDetail.ts:69)
    expect(d.collectionRate).toBe(expected.collectionRate)
    // creditCompliance = cpdComplianceRate * 100 (:71)
    expect(d.creditCompliance).toBe(expected.creditCompliance)
    // compliant = round(cpd * total); nonCompliant = total - compliant (:51,:74)
    expect(d.creditComplianceBreakdown).toEqual({
      compliant: expected.compliant,
      nonCompliant: expected.totalMembers - expected.compliant,
      exempt: 0,
    })
    // totalRevenueCents = toCents(totalCollected) = collected * 100 (:70)
    expect(d.totalRevenueCents).toBe(expected.totalRevenueCents)
    // eventCount = activityCount90d (:75)
    expect(d.eventCount).toBe(expected.eventCount)
  })
})
