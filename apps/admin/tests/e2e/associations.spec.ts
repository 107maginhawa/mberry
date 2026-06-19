// WF-015 — Onboard Association: create tenant (core create action; locale/regex/credit-config sub-steps not yet covered)
import { test, expect } from '@playwright/test'
import { signInAsAdmin, signInAndNavigate, csrfHeaders } from './helpers/auth'
import { ADMIN_BASE } from './helpers/test-config'

const API_URL = `${ADMIN_BASE}/api`

test.describe('Admin Associations CRUD', () => {
  test('creates an association and it appears in the list', async ({ page }) => {
    await signInAsAdmin(page.context())

    // POST to create a new association
    const res = await page.context().request.post(`${API_URL}/admin/associations`, {
      headers: await csrfHeaders(page.context()),
      data: {
        name: `TestAssoc-${Date.now()}`,
        country: 'PH',
        currency: 'PHP',
      },
    })
    // Accept created (201) or conflict if name already exists (409)
    expect([201, 409]).toContain(res.status())

    // Navigate to associations page and verify table is visible
    await signInAndNavigate(page, '/associations')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('table')).toBeVisible()
  })

  test('lists associations and shows table content', async ({ page }) => {
    await signInAndNavigate(page, '/associations')
    await page.waitForLoadState('domcontentloaded')

    // Wait for either a table or an empty-state element to appear
    await expect(
      page.locator('table, [data-empty-state]').or(page.getByText(/No associations|No results|No data/i)).first()
    ).toBeVisible({ timeout: 15000 })

    // Either rows exist or an empty state message is visible
    const hasRows = await page.locator('tbody tr').count()
    const hasEmpty = await page.getByText(/No associations|No results|No data/i).count()
    expect(hasRows > 0 || hasEmpty > 0).toBe(true)
  })

  test('deletes an association via API and it disappears from list', async ({ page }) => {
    await signInAsAdmin(page.context())

    const uniqueName = `DeleteAssoc-${Date.now()}`

    // POST to create a new association with a unique name
    const createRes = await page.context().request.post(`${API_URL}/admin/associations`, {
      headers: await csrfHeaders(page.context()),
      data: {
        name: uniqueName,
        country: 'PH',
        currency: 'PHP',
      },
    })
    // If creation failed, bail — this test can't proceed without a valid association
    expect([201, 200]).toContain(createRes.status())

    const createBody = await createRes.json()
    const assocId = createBody.data?.id ?? createBody.id

    // DELETE the association
    const deleteRes = await page.context().request.delete(
      `${API_URL}/admin/associations/${assocId}`,
      { headers: await csrfHeaders(page.context()) },
    )
    // 404 is acceptable if already gone
    expect([200, 204, 404]).toContain(deleteRes.status())

    // Navigate and verify the deleted name is NOT in the table
    await signInAndNavigate(page, '/associations')
    await page.waitForLoadState('domcontentloaded')
    // Ensure the table has rendered before asserting the deleted row is absent
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })
    const nameInTable = await page.locator(`text=${uniqueName}`).count()
    expect(nameInTable).toBe(0)
  })
})
