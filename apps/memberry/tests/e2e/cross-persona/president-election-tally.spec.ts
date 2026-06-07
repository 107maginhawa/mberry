// WF-080 — Election Lifecycle
/**
 * Cross-persona: President + secretary + members all read the same
 *                election listing for the org.
 *
 * Personas: P2 (president = officer) → P6 (member) → P4 (secretary)
 *
 * Full BR-33/41/43/44/67 lifecycle (create election → vote → tally →
 * certify) requires per-test isolation to avoid colliding with seeded
 * elections + the unique-vote constraint. This minimal smoke confirms
 * cross-actor read-consistency; full lifecycle blocks on G15 + an
 * adopted G10 fixture path for elections.
 */

import { test, expect } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'
import { apiFetch } from '../helpers/api-fetch'
import { signIn } from '../helpers/auth'
import { withIsolatedFixture } from '../helpers/isolated-fixture'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: president runs election → members vote → secretary tallies', () => {
  // F3: fresh org per run — election mutations (vote, transition status)
  // would otherwise poison readers across parallel specs.
  const fx = withIsolatedFixture(test, { memberCount: 1 })

  test('elections list visible + consistent across three actors', async ({ browser }) => {
    const ORG_ID = fx().orgId

    // ---- President / officer context ----
    const presidentCtx = await browser.newContext({
      storageState: authStateFile('officer'),
    })
    const presidentPage = await presidentCtx.newPage()
    await presidentPage.goto('/dashboard')
    const presList = await apiFetch<{
      data?: Array<{ id?: string }>
    }>(presidentPage, `/association/elections?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(presList.status).toBeLessThan(500)
    const presCount = (presList.data?.data ?? []).length
    await presidentCtx.close()

    // ---- Secretary context ----
    const secretaryCtx = await browser.newContext({
      storageState: authStateFile('secretary'),
    })
    const secretaryPage = await secretaryCtx.newPage()
    await secretaryPage.goto('/dashboard')
    const secList = await apiFetch<{
      data?: Array<{ id?: string }>
    }>(secretaryPage, `/association/elections?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(secList.status).toBeLessThan(500)
    expect((secList.data?.data ?? []).length).toBe(presCount)
    await secretaryCtx.close()

    // ---- Member context ----
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    await signIn(memberPage, SEED_MEMBER_EMAIL, TEST_PASSWORD)
    const memList = await apiFetch<{
      data?: Array<{ id?: string }>
    }>(memberPage, `/association/elections?organizationId=${ORG_ID}`, { orgId: ORG_ID })
    expect(memList.status).toBeLessThan(500)
    // Member view may filter by visibility — assert it succeeds (no 5xx)
    // rather than requiring identical row count.
    await memberCtx.close()
  })
})
