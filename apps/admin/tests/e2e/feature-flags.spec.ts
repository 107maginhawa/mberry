// WF-018 — Feature Flag Management: admin sets a module × target override and it
// appears in the matrix; removing it cleans up. Driven against the real admin
// feature-flag endpoints (the /feature-flags page is wired to these).
import { test, expect } from '@playwright/test'
import { signInAsAdmin, csrfHeaders } from './helpers/auth'
import { ADMIN_BASE } from './helpers/test-config'

const API_URL = `${ADMIN_BASE}/api`
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-018: feature flag management', () => {
  test('admin creates a per-org module override and it appears in the matrix', async ({ page }) => {
    await signInAsAdmin(page.context())
    const req = page.context().request
    const headers = await csrfHeaders(page.context())

    const created = await req.post(`${API_URL}/admin/feature-flags`, {
      headers,
      data: { targetType: 'organization', targetId: ORG_ID, moduleName: 'events', enabled: true },
    })
    expect(created.status(), 'flag create must succeed').toBeGreaterThanOrEqual(200)
    expect(created.status()).toBeLessThan(300)
    const flag = (await created.json()) as any
    const flagId = (flag?.data ?? flag)?.id

    // Read-back: the override is in the matrix for this org.
    const list = await req.get(`${API_URL}/admin/feature-flags?targetType=organization&targetId=${ORG_ID}`, {
      headers: { Origin: ADMIN_BASE },
    })
    expect(list.status()).toBe(200)
    const flags = (await list.json()) as any
    const rows = flags?.data ?? flags ?? []
    expect(
      rows.some((f: any) => f.moduleName === 'events' && f.targetId === ORG_ID),
      'the new override is present in the matrix',
    ).toBe(true)

    // Cleanup so the override doesn't leak into other suites.
    if (flagId) {
      await req.delete(`${API_URL}/admin/feature-flags/${flagId}`, { headers })
    }
  })
})
