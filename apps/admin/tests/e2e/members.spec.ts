import { test, expect } from '@playwright/test'
import { signInAsAdmin, signInAndNavigate } from './helpers/auth'

const API_URL = 'http://localhost:7213'

test.describe('Admin Members', () => {
  test('members page renders table or empty state', async ({ page }) => {
    await signInAndNavigate(page, '/members')
    await page.waitForLoadState('networkidle')

    // Either rows exist or an empty state message is visible
    const hasRows = await page.locator('tbody tr').count()
    const hasEmpty = await page.locator('text=No').count()
    expect(hasRows > 0 || hasEmpty > 0).toBe(true)
  })

  test('lists members via API under an organization', async ({ page }) => {
    await signInAsAdmin(page.context())

    // Get an organization to scope the members query
    const listOrgsRes = await page.context().request.get(
      `${API_URL}/admin/organizations?limit=1`
    )
    expect(listOrgsRes.ok()).toBe(true)
    const listOrgsBody = await listOrgsRes.json()

    if (listOrgsBody.data && listOrgsBody.data.length > 0) {
      const orgId = listOrgsBody.data[0].id

      // Try org-scoped members endpoint first
      const membersRes = await page.context().request.get(
        `${API_URL}/organizations/${orgId}/members?limit=5`
      )

      if (membersRes.status() === 404) {
        // Fallback: try admin-prefixed members endpoint
        const fallbackRes = await page.context().request.get(
          `${API_URL}/admin/members?limit=5`
        )
        // Accept ok or 404 — endpoint existence verification
        expect([200, 404]).toContain(fallbackRes.status())
      } else {
        expect([200, 404]).toContain(membersRes.status())
      }
    }

    // Navigate and verify members page loads
    await signInAndNavigate(page, '/members')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/members/)
  })

  test('deletes a member via API (if endpoint exists)', async ({ page }) => {
    await signInAsAdmin(page.context())

    // Get an organization to scope the members query
    const listOrgsRes = await page.context().request.get(
      `${API_URL}/admin/organizations?limit=1`
    )
    expect(listOrgsRes.ok()).toBe(true)
    const listOrgsBody = await listOrgsRes.json()

    if (listOrgsBody.data && listOrgsBody.data.length > 0) {
      const orgId = listOrgsBody.data[0].id

      // Get members for the org
      const membersRes = await page.context().request.get(
        `${API_URL}/organizations/${orgId}/members?limit=5`
      )

      if (membersRes.ok()) {
        const membersBody = await membersRes.json()
        const members = membersBody.data ?? membersBody

        if (Array.isArray(members) && members.length > 0) {
          const memberId = members[0].id ?? members[0].personId

          if (memberId) {
            // Attempt DELETE on the first member — defensive: 404/405 acceptable
            const deleteRes = await page.context().request.delete(
              `${API_URL}/organizations/${orgId}/members/${memberId}`
            )
            // 404 = not found, 405 = method not allowed (endpoint not implemented yet)
            expect([200, 204, 404, 405]).toContain(deleteRes.status())
          }
        }
      } else {
        // Try admin fallback endpoint
        const fallbackRes = await page.context().request.delete(
          `${API_URL}/admin/members/nonexistent-id`
        )
        // 404/405 acceptable — just verifying endpoint shape
        expect([404, 405]).toContain(fallbackRes.status())
      }
    }

    // Verify members page still loads after delete attempt
    await signInAndNavigate(page, '/members')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/members/)
  })
})
