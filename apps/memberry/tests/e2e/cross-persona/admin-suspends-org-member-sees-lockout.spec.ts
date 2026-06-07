// WF-023 — Org Suspension/Cancellation
/**
 * Cross-persona: Platform admin reads org state; member reads their
 *                membership for same org. The full "suspend → member
 *                lockout cascade" requires a non-destructive isolated
 *                org (we shouldn't actually suspend pda-metro-manila
 *                mid-suite). Smoke test verifies BOTH actors can read
 *                the same org without state-divergence.
 *
 * Personas: P1 (platform admin) → P6 (member)
 *
 * Once G10 (isolated-fixture) is adopted here this test will spin up a
 * private org, suspend it, then assert the member sees the lockout.
 */

import { test, expect } from '@playwright/test'
import { authStateFile } from '../helpers/auth-state'
import { apiFetch } from '../helpers/api-fetch'
import { signIn } from '../helpers/auth'
import { SEED_MEMBER_EMAIL, TEST_PASSWORD } from '../helpers/test-config'
import { captureAnyApiSuccess } from '../helpers/real-flow'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: admin suspends org → member sees lockout', () => {
  test('admin org status visible to both actors', async ({ browser }) => {
    // ---- Admin context ----
    const adminCtx = await browser.newContext({
      storageState: authStateFile('officer'),
    })
    const adminPage = await adminCtx.newPage()
    const adminHydration = captureAnyApiSuccess(adminPage)
    await adminPage.goto('/dashboard')
    const adminResp = await adminHydration
    expect(adminResp?.status()).toBe(200)
    expect(adminResp?.ok()).toBe(true)

    const orgRead = await apiFetch<{
      status?: string
      data?: { status?: string }
    }>(adminPage, `/public/org/pda-metro-manila`)
    expect(orgRead.status, 'admin can read org').toBeLessThan(500)
    const adminStatus =
      (orgRead.data as { status?: string })?.status ??
      (orgRead.data as { data?: { status?: string } })?.data?.status
    expect(adminStatus, 'org status surfaced to admin').toBeTruthy()
    await adminCtx.close()

    // ---- Member context ----
    const memberCtx = await browser.newContext()
    const memberPage = await memberCtx.newPage()
    await signIn(memberPage, SEED_MEMBER_EMAIL, TEST_PASSWORD)

    const memberRead = await apiFetch<{
      status?: string
      data?: { status?: string }
    }>(memberPage, `/public/org/pda-metro-manila`)
    expect(memberRead.status, 'member can read org').toBeLessThan(500)
    const memberStatus =
      (memberRead.data as { status?: string })?.status ??
      (memberRead.data as { data?: { status?: string } })?.data?.status
    expect(memberStatus, 'org status surfaced to member matches admin view').toBe(adminStatus)
    await memberCtx.close()
  })
})
