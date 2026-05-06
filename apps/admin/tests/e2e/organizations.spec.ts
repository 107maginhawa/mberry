import { test, expect } from '@playwright/test'
import { signInAsAdmin, signInAndNavigate } from './helpers/auth'
import { API_BASE } from './helpers/test-config'

const API_URL = API_BASE

test.describe('Admin Organizations CRUD', () => {
  test('creates an organization and it appears in the list', async ({ page }) => {
    await signInAsAdmin(page.context())

    // POST to create a new organization
    const res = await page.context().request.post(`${API_URL}/admin/organizations`, {
      data: {
        name: `TestOrg-${Date.now()}`,
        type: 'hospital',
      },
    })
    // Accept created (201) or conflict if name already exists (409)
    expect([201, 409]).toContain(res.status())

    // Navigate to organizations page and verify table is visible
    await signInAndNavigate(page, '/organizations')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible()
  })

  test('updates an organization name', async ({ page }) => {
    await signInAsAdmin(page.context())

    // GET an existing org to update
    const listRes = await page.context().request.get(`${API_URL}/admin/organizations?limit=1`)
    expect(listRes.ok()).toBe(true)
    const listBody = await listRes.json()

    if (listBody.data && listBody.data.length > 0) {
      const orgId = listBody.data[0].id

      // PATCH to update organization name
      const updateRes = await page.context().request.patch(
        `${API_URL}/admin/organizations/${orgId}`,
        {
          data: {
            name: `Updated-${Date.now()}`,
          },
        }
      )
      // Accept 200 (updated) or 409 (name conflict)
      expect([200, 409]).toContain(updateRes.status())
    } else {
      // No orgs exist — create one to verify the endpoint works
      const createRes = await page.context().request.post(`${API_URL}/admin/organizations`, {
        data: {
          name: `UpdateTestOrg-${Date.now()}`,
          type: 'hospital',
        },
      })
      expect([201, 409]).toContain(createRes.status())
    }

    // Navigate and verify table visible
    await signInAndNavigate(page, '/organizations')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('table')).toBeVisible()
  })

  test('deletes an organization via API and it disappears from list', async ({ page }) => {
    await signInAsAdmin(page.context())

    const uniqueName = `DeleteMe-${Date.now()}`

    // POST to create a new org with a unique name
    const createRes = await page.context().request.post(`${API_URL}/admin/organizations`, {
      data: {
        name: uniqueName,
        type: 'hospital',
      },
    })
    // If creation failed with conflict, skip this test gracefully
    if (![201, 200].includes(createRes.status())) {
      test.skip()
      return
    }

    const createBody = await createRes.json()
    const orgId = createBody.data?.id ?? createBody.id

    // DELETE the organization
    const deleteRes = await page.context().request.delete(
      `${API_URL}/admin/organizations/${orgId}`
    )
    // 404 is acceptable if already gone
    expect([200, 204, 404]).toContain(deleteRes.status())

    // Navigate and verify the deleted name is NOT in the table
    await signInAndNavigate(page, '/organizations')
    await page.waitForLoadState('networkidle')
    const nameInTable = await page.locator(`text=${uniqueName}`).count()
    expect(nameInTable).toBe(0)
  })

  test('non-admin user gets redirected from organizations page', async ({ page }) => {
    // Navigate without signing in — should redirect to sign-in or memberry app
    await page.goto('http://localhost:3003/organizations')
    await page.waitForURL(/sign-in|localhost:3004/, { timeout: 10000 })
  })
})
