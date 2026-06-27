/**
 * E2E: officer flow — sign-in → roster → send pay-link (custom amount).
 *
 * All API calls are stubbed via page.route so this spec only needs the app
 * dev/preview server on :3005 — no live API, no Postgres, no seed required.
 *
 * Stub shapes match REAL handler responses (verified against use-org.ts,
 * use-roster.ts, use-send-link.ts, SendLink.tsx, sign-in.ts, lib/api.ts).
 *
 * Key shapes:
 *   - officer-role: { data: terms[] }  (ARRAY — live handler; NOT { isOfficer, positions })
 *     use-org.ts lines 85-86 has the dual-shape shim; non-empty array → isOfficer=true.
 *   - memberships: stateful — 401 pre-login (unauthed), 200 post-login (authed + org list).
 *     useSession (queryKey ['session']) and useOrgs (queryKey ['org','memberships']) both
 *     call getMyMemberships → same URL; the stateful flag covers both.
 *   - CSRF: fetched by lib/api.ts getCsrfToken() before sendPaymentLink POST.
 *     /auth/ and /pay/ are exempt; /payments/send-link is NOT exempt.
 */
import { test, expect } from '@playwright/test'

test('officer signs in, sends a pay-link', async ({ page }) => {
  // ── Stateful flag: memberships returns 401 until after sign-in ───────────
  let signedIn = false

  // CSRF token — fetched lazily by lib/api.ts interceptor before any non-exempt
  // mutating SDK call (sendPaymentLink POST is not in CSRF_EXEMPT_PREFIXES).
  await page.route('**/csrf-token', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 't' }) }),
  )

  // Sign-in — raw fetch to /api/auth/sign-in/email (not via SDK; /auth/ is CSRF-exempt).
  await page.route('**/auth/sign-in/email', (r) => {
    signedIn = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })

  // Memberships — useSession (auth probe, queryKey ['session']) + useOrgs (org list,
  // queryKey ['org','memberships']) both call getMyMemberships → same URL.
  // 401 pre-login → status='unauthed' → sign-in form visible.
  // 200 post-login → status='authed' → redirect to /.
  await page.route('**/persons/me/memberships', (r) => {
    if (signedIn) {
      r.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ organizationId: 'o1', orgName: 'Chapter A' }], total: 1 }),
      })
    } else {
      r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) })
    }
  })

  // Officer role — SCHEMA shape required here (even though live handler returns terms[]).
  // Reason: SDK's officerRoleResponseSchemaResponseTransformer runs on our stub response and
  // does `data.data.positions.map(...)`. If data.data is an array (live handler shape), this
  // throws → query errors → status='notOfficer'. We must provide { data: { isOfficer, positions } }
  // so the transformer succeeds, then use-org.ts dual-shape shim (lines 85-86) reads isOfficer.
  // The task brief's "ARRAY" note describes what the live handler sends to clients that bypass
  // the generated SDK transformer; the E2E stub goes THROUGH the transformer.
  await page.route('**/officer-role/**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: { isOfficer: true, positions: [] } }),
    }),
  )

  // Roster members — listOrgMembers → /membership/members/{orgId}
  await page.route('**/membership/members/**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'm1',
            personId: 'p1',
            firstName: 'Olive',
            lastName: 'Cruz',
            status: 'active',
            memberNumber: 'A-1',
          },
        ],
      }),
    }),
  )

  // Dues invoices — empty; forces custom-amount path in SendLink (no invoice cards rendered).
  await page.route('**/dues-invoices**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [], totalCount: 0, totalPages: 0, currentPage: 1 }),
    }),
  )

  // Send payment link — POST /api/org/:orgId/payments/send-link
  // Response shape from use-send-link.ts: { token, paymentUrl, expiresAt }.
  // state.url = window.location.origin + paymentUrl = 'http://localhost:3005/pay/TOK'.
  await page.route('**/payments/send-link', (r) =>
    r.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'TOK', paymentUrl: '/pay/TOK', expiresAt: '2026-09-01T00:00:00Z' }),
    }),
  )

  // ── 1. Visit sign-in page ────────────────────────────────────────────────
  await page.goto('/sign-in')
  // Membership probe → 401 → status='unauthed' → form renders (not spinner).
  await expect(page.getByText('Officer sign in')).toBeVisible()

  // ── 2. Fill credentials (inputs: id="email", id="password" in sign-in.tsx) ──
  await page.getByLabel('Email').fill('officer@test.com')
  await page.getByLabel('Password').fill('secret')

  // ── 3. Submit form → POST /api/auth/sign-in/email → 200; signedIn=true ──
  await page.getByRole('button', { name: 'Sign in' }).click()

  // ── 4. Wait for redirect to roster (/) ──────────────────────────────────
  // onSubmit invalidates ['session'] → re-queries memberships → 200 → 'authed'
  // → navigate({ to: '/' }). useOrgs auto-selects the single org (o1).
  await page.waitForURL('/')

  // ── 5. Roster: member "Olive Cruz" visible ───────────────────────────────
  await expect(page.getByText('Olive Cruz')).toBeVisible()

  // ── 6. Click "Send pay-link" link for Olive Cruz ─────────────────────────
  // Roster.tsx renders: <a aria-label={`Send pay-link to ${m.name}`}>Send pay-link</a>
  // href = /members/m1/send?personId=p1&name=Olive%20Cruz
  await page.getByRole('link', { name: /send pay-link to olive cruz/i }).click()

  // ── 7. Custom amount form — no invoices (empty stub) → only custom section ──
  // Input aria-label="Amount in pesos" (SendLink.tsx); button aria-label="Send custom amount link"
  await page.getByLabel('Amount in pesos').fill('2500')
  await page.getByRole('button', { name: /send custom amount link/i }).click()

  // ── 8. Result panel: pay-link URL and "Copy link" button visible ─────────
  // state.url = window.location.origin + '/pay/TOK' = 'http://localhost:3005/pay/TOK'
  // SendLink.tsx renders: <p>{state.url}</p> and <Button>Copy link</Button>
  await expect(page.getByText('/pay/TOK')).toBeVisible()
  await expect(page.getByRole('button', { name: /copy/i })).toBeVisible()
})
