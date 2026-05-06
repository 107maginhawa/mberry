import type { Page } from '@playwright/test'
import { API_BASE } from './test-config'

/**
 * Create a test user via the API.
 * Returns { email, firstName, lastName, status, data }.
 */
export async function createTestUser(page: Page, overrides?: { email?: string; firstName?: string; lastName?: string }) {
  const email = overrides?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@memberry.ph`
  const firstName = overrides?.firstName ?? 'Test'
  const lastName = overrides?.lastName ?? 'User'
  const result = await page.evaluate(async ({ email, firstName, lastName, apiBase }) => {
    const res = await fetch(`${apiBase}/persons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstName, lastName, contactInfo: { email } }),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }, { email, firstName, lastName, apiBase: API_BASE })
  return { email, firstName, lastName, ...result }
}

/**
 * Create a test organization via the API.
 * Returns { orgName, status, data }.
 */
export async function createTestOrg(page: Page, name?: string) {
  const orgName = name ?? `TestOrg-${Date.now()}`
  const result = await page.evaluate(async ({ orgName, apiBase }) => {
    const res = await fetch(`${apiBase}/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: orgName, type: 'association' }),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }, { orgName, apiBase: API_BASE })
  return { orgName, ...result }
}

/**
 * Create a test membership via the API.
 * Returns { status, data }.
 */
export async function createTestMember(page: Page, orgId: string, personId: string) {
  const result = await page.evaluate(async ({ orgId, personId, apiBase }) => {
    const res = await fetch(`${apiBase}/organizations/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ personId, role: 'member', status: 'active' }),
    })
    return { status: res.status, data: await res.json().catch(() => null) }
  }, { orgId, personId, apiBase: API_BASE })
  return result
}

/**
 * Best-effort cleanup of test data.
 * Does not fail tests if cleanup fails.
 */
export async function cleanupTestData(page: Page, resources: { type: string; id: string }[]) {
  for (const resource of resources) {
    await page.evaluate(async ({ type, id, apiBase }) => {
      await fetch(`${apiBase}/${type}/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
    }, { ...resource, apiBase: API_BASE })
  }
}
