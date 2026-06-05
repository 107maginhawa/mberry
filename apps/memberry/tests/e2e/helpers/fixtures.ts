import type { Page } from '@playwright/test'
import { apiFetch } from './api-fetch'

/**
 * Test fixture helpers.
 *
 * All API calls below route through `apiFetch` (helpers/api-fetch.ts) so they:
 *   - mint a fresh CSRF token in the page and attach `x-csrf-token`
 *   - carry the page's SPA Origin (callers MUST `page.goto(...)` first)
 *   - send the session cookie via `credentials: 'include'`
 *
 * Callers should land on the SPA (e.g. `await page.goto('/dashboard')`)
 * before invoking these helpers, otherwise the in-page fetch runs with
 * `Origin: null` and hono/cors rejects it.
 */

/**
 * Create a test user via the API.
 * Returns { email, firstName, lastName, status, data }.
 */
export async function createTestUser(
  page: Page,
  overrides?: { email?: string; firstName?: string; lastName?: string },
) {
  const email =
    overrides?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@memberry.ph`
  const firstName = overrides?.firstName ?? 'Test'
  const lastName = overrides?.lastName ?? 'User'
  const result = await apiFetch(page, '/persons', {
    method: 'POST',
    body: { firstName, lastName, contactInfo: { email } },
  })
  return { email, firstName, lastName, ...result }
}

/**
 * Create a test organization via the API.
 * Returns { orgName, status, data }.
 */
export async function createTestOrg(page: Page, name?: string) {
  const orgName = name ?? `TestOrg-${Date.now()}`
  const result = await apiFetch(page, '/organizations', {
    method: 'POST',
    body: { name: orgName, type: 'association' },
  })
  return { orgName, ...result }
}

/**
 * Create a test membership via the API.
 * Returns { status, data }.
 */
export async function createTestMember(page: Page, orgId: string, personId: string) {
  return apiFetch(page, `/organizations/${orgId}/members`, {
    method: 'POST',
    orgId,
    body: { personId, role: 'member', status: 'active' },
  })
}

/**
 * Best-effort cleanup of test data.
 * Does not fail tests if cleanup fails.
 */
export async function cleanupTestData(
  page: Page,
  resources: { type: string; id: string }[],
) {
  for (const resource of resources) {
    await apiFetch(page, `/${resource.type}/${resource.id}`, { method: 'DELETE' }).catch(
      () => {},
    )
  }
}

/**
 * Delete draft announcements matching a title pattern.
 * Only deletes drafts (API only allows deleting drafts).
 * Best-effort — does not fail tests if cleanup fails.
 */
export async function cleanupAnnouncements(
  page: Page,
  orgId: string,
  titlePattern: RegExp,
) {
  try {
    const list = await apiFetch<{ data?: Array<{ id: string; title: string; status: string }> }>(
      page,
      `/communications/announcements/${orgId}?pageSize=100`,
      { orgId },
    )
    for (const ann of list.data?.data ?? []) {
      if (titlePattern.test(ann.title) && ann.status === 'draft') {
        await apiFetch(page, `/communications/announcements/${ann.id}`, {
          method: 'DELETE',
          orgId,
        }).catch(() => {})
      }
    }
  } catch {
    /* best-effort */
  }
}
