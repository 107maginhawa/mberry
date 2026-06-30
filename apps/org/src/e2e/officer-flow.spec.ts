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
 *   - memberships: stateful — 401 pre-login (unauthed), 200 post-login (authed + org list).
 *     useSession (queryKey ['session']) and useOrgs (queryKey ['org','memberships']) both
 *     call getMyMemberships → same URL; the stateful flag covers both.
 *   - roster: listRosterMembers returns members → engine enforces officer/admin 403 server-side.
 *     No client-side officer pre-gate (useIsOfficer removed; getMyOfficerRole not called).
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

  // Sign-in is passwordless email-OTP — raw fetches to /auth/* (not via SDK; /auth/ is CSRF-exempt).
  // Request OTP — CSRF-exempt /auth/*; just acknowledge.
  await page.route('**/auth/email-otp/send-verification-otp', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  )

  // Verify OTP — session-creating passwordless sign-in. Flip signedIn here.
  await page.route('**/auth/sign-in/email-otp', (r) => {
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

  // Roster members — the directory now reads listRosterMembers → GET /association/member/roster
  // (handler shape { data, totalCount }). No officer-role stub: engine 403 is the authz gate.
  await page.route('**/association/member/roster**', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'm1',
            personId: 'p1',
            name: 'Olive Cruz',
            firstName: 'Olive',
            lastName: 'Cruz',
            status: 'active',
            memberNumber: 'A-1',
          },
        ],
        totalCount: 1,
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

  // ── 2. Step 1: enter email, request code (input id="email" in SignInForm.tsx) ──
  // → POST /auth/email-otp/send-verification-otp → 200 → form advances to step 2.
  await page.getByLabel('Email address').fill('officer@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()

  // ── 3. Step 2: enter the 6-digit code, verify (input id="otp") ───────────
  // → POST /auth/sign-in/email-otp → 200; signedIn=true; creates session.
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()

  // ── 4. Wait for redirect to roster (/) ──────────────────────────────────
  // onSubmit invalidates ['session'] → re-queries memberships → 200 → 'authed'
  // → navigate({ to: '/' }). useOrgs auto-selects the single org (o1).
  await page.waitForURL('/')

  // ── 5. Roster: member "Olive Cruz" visible ───────────────────────────────
  await expect(page.getByText('Olive Cruz')).toBeVisible()

  // ── 6. Go to the send flow ───────────────────────────────────────────────
  // The directory row now opens member detail; the dedicated send flow lives at
  // /members/$id/send (reached from detail's "Send pay-link"). The row→detail→send
  // chain is covered in member-detail-flow.spec.ts; here we deep-link to the mint.
  await expect(page.getByRole('link', { name: /view olive cruz/i })).toBeVisible()
  await page.goto('/members/m1/send?personId=p1&name=Olive%20Cruz')

  // ── 7. Custom amount form — no invoices (empty stub) → only custom section ──
  // Input aria-label="Amount in pesos" (SendLink.tsx); button aria-label="Send custom amount link"
  await page.getByLabel('Amount in pesos').fill('2500')
  await page.getByRole('button', { name: /send custom amount link/i }).click()
  // Money-step ConfirmDialog (SendLink.tsx, confirmLabel: 'Send pay-link') — confirm to mint.
  await page.getByRole('button', { name: 'Send pay-link' }).click()

  // ── 8. Result panel: pay-link URL and "Copy link" button visible ─────────
  // state.url = window.location.origin + '/pay/TOK' = 'http://localhost:3005/pay/TOK'
  // SendLink.tsx renders: <p>{state.url}</p> and <Button>Copy link</Button>
  await expect(page.getByText('/pay/TOK')).toBeVisible()
  await expect(page.getByRole('button', { name: /copy/i })).toBeVisible()
})
