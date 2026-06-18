// WF-035 — Record Payment
/**
 * Cross-persona: Treasurer records a manual dues payment for a member;
 *                that member's /persons/me/dues call reflects the new
 *                payment.
 *
 * Personas: P3 (treasurer) → P6 (member)
 *
 * API-driven multi-actor — UI path tested separately in officer/payments
 * + my/dues specs. The cross-persona contract this verifies is that a
 * treasurer-recorded payment propagates to the member's read model.
 *
 * Strategy: pull a seeded member id via /membership/members/{orgId} as
 * the treasurer, POST a payment, then re-read /persons/me/dues via a
 * second context signed in as that same seeded member (member@memberry.ph).
 */

import { test, expect } from '@playwright/test'
import { freshAuthState } from '../helpers/programmatic-auth'
import { apiFetch } from '../helpers/api-fetch'
import { captureAnyApiSuccess } from '../helpers/real-flow'
import { attachErrorSurface } from '../helpers/error-surface'
import { independentRead } from '../helpers/independent-read'

const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'

test.describe.configure({ mode: 'serial' })

test.describe('cross-persona: treasurer records dues, member sees receipt', () => {
  test('manual payment propagates from treasurer to member', async ({ browser }) => {
    // ---- Clause 4 setup: resolve the member's id from an INDEPENDENT member
    //      session so the payment targets the SAME person we later re-read as.
    //      (The old spec targeted a random active roster row, which is why it
    //      could only assert "surface responded" — it never knew if the row it
    //      paid matched the row it read.) ----
    const memberId = await independentRead<string | undefined>('member', async (api) => {
      const me = await api.get<{ id?: string; data?: { id?: string } }>('/persons/me')
      expect(me.status, 'member /persons/me readable').toBe(200)
      return me.data?.id ?? me.data?.data?.id
    })
    expect(memberId, 'seeded member has a person id').toBeTruthy()

    // ---- Treasurer (driving session): record a payment for that member ----
    const treasurerCtx = await browser.newContext({
      storageState: await freshAuthState('treasurer'),
    })
    const treasurerPage = await treasurerCtx.newPage()
    // Clause 1: fail on any silent error surface during the treasurer's path.
    const assertTreasurerClean = attachErrorSurface(treasurerPage, {
      failOnUnexpected4xx: true,
      failOnConsoleError: true,
    })
    const treasurerHydration = captureAnyApiSuccess(treasurerPage)
    await treasurerPage.goto('/dashboard')
    const treasurerResp = await treasurerHydration
    // Clause 3: dashboard hydration must succeed.
    expect(treasurerResp?.status(), 'treasurer dashboard hydrated').toBe(200)

    // Unique amount-by-second so re-runs don't false-positive on a stale row.
    const uniqueCents = Date.now() % 100000
    const amount = 100 + uniqueCents / 100
    const payment = await apiFetch<{ id?: string; data?: { id?: string } }>(
      treasurerPage,
      `/dues/payments`,
      {
        method: 'POST',
        orgId: ORG_ID,
        body: {
          organizationId: ORG_ID,
          personId: memberId,
          amount,
          method: 'cash',
          paymentDate: new Date().toISOString().split('T')[0],
        },
      },
    )
    // Clause 3: the mutation MUST succeed — no `< 500` tolerance. A 404 here
    // is a real break (wrong endpoint shape), not an acceptable skip.
    expect(
      [200, 201],
      `POST /dues/payments succeeded (got ${payment.status} ${JSON.stringify(payment.data).slice(0, 200)})`,
    ).toContain(payment.status)

    assertTreasurerClean()
    await treasurerCtx.close()

    // ---- Clause 2 + 4: re-read dues from a SEPARATE member session and assert
    //      the RECORDED payment is present (goal state, not "a row exists").
    //      ⚠ Phase-D validation: confirm /persons/me/dues surfaces recorded
    //      payments by amount; if it returns invoices/obligations instead,
    //      switch this oracle to the payments-list endpoint. ----
    const dues = await independentRead<{ status: number; rows: Array<{ amount?: number }> }>(
      'member',
      async (api) => {
        const res = await api.get<{ data?: Array<{ amount?: number }> }>('/persons/me/dues')
        return { status: res.status, rows: res.data?.data ?? [] }
      },
    )
    expect(dues.status, 'member can read /persons/me/dues').toBe(200)
    expect(
      dues.rows.some((r) => r.amount === amount),
      `member's dues reflect the treasurer-recorded payment of ${amount}`,
    ).toBe(true)
  })
})
