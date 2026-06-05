/**
 * Per-spec isolated fixture helper (G10).
 *
 * Each spec that mutates shared seeded state should grab a fresh org +
 * tier + N test members via this helper in beforeAll, then tear it down
 * in afterAll. Removes all shared-state coupling under parallel workers.
 *
 * Backed by POST /test/isolated-fixture (handlers/test-isolation.ts).
 * Guarded by NODE_ENV !== 'production' on the server.
 *
 * Usage:
 *   import { test } from '../helpers/test-fixture'
 *   import { withIsolatedFixture } from '../helpers/isolated-fixture'
 *
 *   const fx = withIsolatedFixture(test, { memberCount: 3 })
 *   test('roster lists members', async ({ page }) => {
 *     await page.goto(`/org/${fx().orgId}/officer/roster`)
 *     // …assertions against fx().personIds
 *   })
 */

import type { Page, TestType } from '@playwright/test'
import { API_BASE } from './test-config'

export interface IsolatedFixture {
  orgId: string
  slug: string
  tierId?: string
  personIds: string[]
  /**
   * person.id of the seeded officer granted a President officer-term on
   * the new org. Returned only when `officerEmail` resolves to an
   * existing better-auth user (default 'test@memberry.ph' → seeded
   * president). Use this id when a spec needs to assert "the officer
   * persona shows up on the new org's leadership list".
   */
  officerPersonId?: string
  positionId?: string
}

export interface IsolatedFixtureOptions {
  /** Number of members to seed into the fresh org (default 3). */
  memberCount?: number
  /**
   * Seeded user email to elevate to officer on the new org (default:
   * 'test@memberry.ph' — the seeded president whose storageState file
   * is `.auth/officer.json`). Pass `null` to skip officer-term creation
   * entirely (use for specs that test the "no officer" path).
   */
  officerEmail?: string | null
}

/**
 * Direct API call — no page context needed. Used by both the helper
 * below and any test/before hook that wants ad-hoc isolation.
 */
export async function createIsolatedFixture(
  opts: IsolatedFixtureOptions = {},
): Promise<IsolatedFixture> {
  const payload: Record<string, unknown> = {
    memberCount: opts.memberCount ?? 3,
  }
  // Only forward officerEmail when caller specified it (including null
  // to opt out). Undefined means "use server default".
  if (opts.officerEmail !== undefined) {
    payload['officerEmail'] = opts.officerEmail
  }
  const res = await fetch(`${API_BASE}/test/isolated-fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(
      `createIsolatedFixture failed: ${res.status} ${await res.text()}`,
    )
  }
  return (await res.json()) as IsolatedFixture
}

export async function deleteIsolatedFixture(orgId: string): Promise<void> {
  await fetch(`${API_BASE}/test/isolated-fixture/${orgId}`, {
    method: 'DELETE',
    headers: { Origin: 'http://localhost:3004' },
  }).catch(() => {})
}

/**
 * Per-describe fixture: creates one fresh org for the whole describe
 * block and cleans up after. Returns a getter so tests can read the
 * IDs without dealing with a Promise.
 */
export function withIsolatedFixture(
  testFn: TestType<{}, {}>,
  opts: IsolatedFixtureOptions = {},
): () => IsolatedFixture {
  let fx: IsolatedFixture | null = null

  testFn.beforeAll(async () => {
    fx = await createIsolatedFixture(opts)
  })

  testFn.afterAll(async () => {
    if (fx?.orgId) await deleteIsolatedFixture(fx.orgId)
    fx = null
  })

  return () => {
    if (!fx) throw new Error('Isolated fixture not initialised (use inside beforeAll-scoped test)')
    return fx
  }
}

/**
 * Convenience: signs in a fresh user via the SPA UI and returns their
 * person id. Useful when a test needs an authenticated actor outside the
 * shared storageState personas.
 */
export async function signedInFreshUser(page: Page): Promise<{
  email: string
  password: string
  personId: string
}> {
  const { signUp } = await import('./auth')
  const { email, password } = await signUp(page)
  await page.goto('/dashboard') // ensure SPA origin for the apiFetch below
  const me = await fetch(`${API_BASE}/persons/me`, {
    credentials: 'include',
  })
  const data = (await me.json()) as { id?: string }
  if (!data.id) throw new Error('signedInFreshUser: /persons/me returned no id')
  return { email, password, personId: data.id }
}
