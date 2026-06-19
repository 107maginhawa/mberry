// WF-125 — Manage Suppressions: admin lists email suppressions and removal is
// org-scoped. The admin app has no suppression UI (the /communications/email
// page is a static placeholder), so this exercises the real backend management
// endpoints the workflow is built on, including auth + org-scoping.
//
// Limitation: there is no HTTP endpoint to add a suppression and the seed has
// none, so the happy-path removal of a real row is covered by the backend
// integration test (suppression.repo.integration.test.ts); here we assert the
// live list contract, the org-context guard, and org-scoped delete semantics.
import { test, expect } from '@playwright/test'
import { signInAsAdmin, csrfHeaders } from './helpers/auth'
import { ADMIN_BASE } from './helpers/test-config'

const API_URL = `${ADMIN_BASE}/api`
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe('WF-125: admin manage email suppressions', () => {
  test('admin lists suppressions for an org (real list contract)', async ({ page }) => {
    await signInAsAdmin(page.context())
    const res = await page.context().request.get(`${API_URL}/email/suppressions?limit=50`, {
      headers: { Origin: ADMIN_BASE, 'x-org-id': ORG_ID },
    })
    expect(res.status(), 'suppression list must succeed for an org-scoped admin').toBe(200)
    const body = (await res.json()) as { data?: unknown[] }
    expect(Array.isArray(body.data), 'list returns a data array').toBe(true)
  })

  test('suppression list requires org context (403 without x-org-id)', async ({ page }) => {
    await signInAsAdmin(page.context())
    const res = await page.context().request.get(`${API_URL}/email/suppressions`, {
      headers: { Origin: ADMIN_BASE },
    })
    expect(res.status(), 'no org context must be rejected').toBe(403)
  })

  test('removing a suppression is org-scoped (404 for an id absent in the org)', async ({ page }) => {
    await signInAsAdmin(page.context())
    const headers = await csrfHeaders(page.context())
    const bogusId = '00000000-0000-4000-8000-000000000000'
    const res = await page.context().request.delete(`${API_URL}/email/suppressions/${bogusId}`, {
      headers: { ...headers, 'x-org-id': ORG_ID },
    })
    expect(res.status(), 'deleting an id not in this org must 404').toBe(404)
  })
})
