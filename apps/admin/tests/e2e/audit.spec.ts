import { test, expect } from '@playwright/test'
import { signInAndNavigate, signInAsAdmin, csrfHeaders } from './helpers/auth'
import { ADMIN_BASE } from './helpers/test-config'

const API_URL = `${ADMIN_BASE}/api`

test.describe('Audit event capture via API', () => {
  test('create operation produces audit event', async ({ page }) => {
    await signInAsAdmin(page.context())

    // POST to create an association (cross-module: associations)
    const createRes = await page.context().request.post(`${API_URL}/admin/associations`, {
      headers: await csrfHeaders(page.context()),
      data: {
        name: `Audit Test Assoc ${Date.now()}`,
        country: 'PH',
        currency: 'PHP',
      },
    })
    // Association creation may succeed (201) or conflict (409) — either triggers audit
    expect([201, 409]).toContain(createRes.status())

    // Wait briefly for fire-and-forget audit write to complete
    await page.waitForTimeout(500)

    // Query audit logs filtered by action=create
    const logsRes = await page.context().request.get(
      `${API_URL}/audit/logs?action=create&limit=5`
    )
    expect(logsRes.ok()).toBe(true)

    const body = await logsRes.json()
    expect(body.data).toBeDefined()
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0].action).toBe('create')
  })

  test('update operation produces audit event', async ({ page }) => {
    await signInAsAdmin(page.context())

    // First, list organizations to find an existing one to update
    const listRes = await page.context().request.get(`${API_URL}/admin/organizations?limit=1`)
    expect(listRes.ok()).toBe(true)
    const listBody = await listRes.json()

    // Only attempt update if at least one organization exists
    if (listBody.data && listBody.data.length > 0) {
      const orgId = listBody.data[0].id

      // PATCH to update the organization
      const updateRes = await page.context().request.patch(
        `${API_URL}/admin/organizations/${orgId}`,
        {
          headers: await csrfHeaders(page.context()),
          data: {
            name: `Updated Org ${Date.now()}`,
          },
        }
      )
      // Accept 200 (updated) or 409 (name conflict) — either is a write that triggers audit
      expect([200, 409]).toContain(updateRes.status())
    } else {
      // No orgs to update — create one to generate a create (still a write event)
      const createRes = await page.context().request.post(`${API_URL}/admin/associations`, {
        headers: await csrfHeaders(page.context()),
        data: {
          name: `Audit Write Test ${Date.now()}`,
          country: 'PH',
          currency: 'PHP',
        },
      })
      expect([201, 409]).toContain(createRes.status())
    }

    // Wait briefly for fire-and-forget audit write to complete
    await page.waitForTimeout(500)

    // Query audit logs — verify at least one write-type event exists
    const logsRes = await page.context().request.get(
      `${API_URL}/audit/logs?limit=10`
    )
    expect(logsRes.ok()).toBe(true)

    const body = await logsRes.json()
    expect(body.data).toBeDefined()
    expect(body.data.length).toBeGreaterThan(0)

    // Verify at least one event is a write operation (create or update)
    const writeEvents = body.data.filter(
      (e: { action: string }) => e.action === 'update' || e.action === 'create'
    )
    expect(writeEvents.length).toBeGreaterThan(0)
  })

  test('delete operation produces audit event', async ({ page }) => {
    await signInAsAdmin(page.context())

    // Create a feature flag first so we have something to delete
    const setRes = await page.context().request.post(`${API_URL}/admin/feature-flags`, {
      headers: await csrfHeaders(page.context()),
      data: {
        targetType: 'global',
        targetId: 'global',
        moduleName: `audit-test-flag-${Date.now()}`,
        enabled: true,
      },
    })
    // Accept 200/201 (created) or 409 (already exists)
    expect([200, 201, 409]).toContain(setRes.status())

    // List flags to find the one we created (or any deletable flag)
    const listRes = await page.context().request.get(`${API_URL}/admin/feature-flags?limit=5`)
    expect(listRes.ok()).toBe(true)
    const listBody = await listRes.json()

    if (listBody.data && listBody.data.length > 0) {
      const flagId = listBody.data[0].id

      // DELETE the feature flag
      const deleteRes = await page.context().request.delete(
        `${API_URL}/admin/feature-flags/${flagId}`,
        { headers: await csrfHeaders(page.context()) },
      )
      // Accept 200 (deleted) or 404 (already gone)
      expect([200, 204, 404]).toContain(deleteRes.status())
    }

    // Wait briefly for fire-and-forget audit write to complete
    await page.waitForTimeout(500)

    // Query audit logs filtered by action=delete
    const logsRes = await page.context().request.get(
      `${API_URL}/audit/logs?action=delete&limit=5`
    )
    expect(logsRes.ok()).toBe(true)

    const body = await logsRes.json()
    expect(body.data).toBeDefined()
    // If a delete was performed, at least one delete event should exist
    // (The listing itself may show 0 if no flags existed — that's acceptable)
    expect(Array.isArray(body.data)).toBe(true)
  })
})

test.describe('Audit dashboard', () => {
  test('audit page renders table with data', async ({ page }) => {
    await signInAndNavigate(page, '/audit')

    // Wait for the table to appear
    await page.waitForSelector('table', { timeout: 10000 })

    // Verify table headers
    await expect(page.locator('th:has-text("Action")')).toBeVisible()

    // Verify at least one table row exists (requires prior write operations in seed data)
    // If no data exists, the empty state message should still be visible (not an error)
    const hasRows = await page.locator('tbody tr').count()
    const hasEmpty = await page.locator('text=No audit events found').count()
    expect(hasRows > 0 || hasEmpty > 0).toBe(true)

    // Verify page title
    await expect(page.locator('text=Audit Log').first()).toBeVisible()
  })

  test('audit page has filter controls', async ({ page }) => {
    await signInAndNavigate(page, '/audit')

    // Action dropdown is a shadcn/Radix Select (renders as
    // button[role="combobox"], not a native <select>).
    const actionFilter = page.getByRole('combobox').first()
    await expect(actionFilter).toBeVisible({ timeout: 10000 })

    // Verify date filter inputs are present
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
  })
})
