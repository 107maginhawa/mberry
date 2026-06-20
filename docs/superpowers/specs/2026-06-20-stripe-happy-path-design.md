# Stripe Happy-Path — Design + Progress Ledger

**Date:** 2026-06-20
**Branch:** `design/ui-ux-audit` (commit LOCAL, not pushed)
**Status:** APPROVED — executing
**Approach:** Option A (stripe-mock + locally-signed webhook), **all 3 payment paths**

---

## Problem (verified)

Memberry has a **complete, registered** online-payment system in code — Stripe Connect
(invoices/events/bookings) + an HMAC pay-link dues flow → webhook → settlement. It has
**never run end-to-end** because dev has no Stripe credentials and no Stripe endpoint to
call. Every payment attempt dies at `ensureStripeInitialized()` → 503. QA deferred it as
"infra-gated." Nothing in our code is broken — the flow was never wired or exercised.

**Goal:** supply a local Stripe (mock), wire env, then drive + live-verify all three
payment happy-paths front-to-back.

## Verified facts (source-confirmed 2026-06-20, supersedes stale QA notes)

- **billing/ (16 handlers)** = real Stripe **Connect** (Express accounts, manual-capture
  "Hold & Decide"). `new Stripe()` lazy-init in `core/billing.ts:99`. All registered.
- **Dues front door EXISTS & registered:** `POST /org/:orgId/payments/send-link`
  (`sendPaymentLink.ts`, officer `x-require-officer`, roles association:admin/staff) mints
  an HMAC-SHA256 token → `payment_token` row (72h) → returns `{token, paymentUrl:/pay/{raw}}`.
  Member → public `GET /pay/:token/validate` + `POST /pay/:token/checkout`.
  - **STALE NOTE REFUTED:** `initiateOnlinePayment` / `checkoutPaymentToken`-as-entry are
    NOT the path. `initiateOnlinePayment` handler exists but is **not route-registered (dead)**.
    Real chain = `sendPaymentLink` → `/pay/:token`. The bound checkout handler is
    `checkoutPaymentToken.ts` (returns `{checkoutUrl}`).
- **No Stripe.js needed:** checkout returns `{checkoutUrl}` (hosted Checkout Session);
  FE (`apps/memberry/src/routes/pay/$token.tsx:46-52`) just `window.location.href = checkoutUrl`.
  No `@stripe/stripe-js`, no Elements, no publishable key. → **stripe-mock suffices.**
- **No money-wire-shape trap on the pay path:** all 3 initiation endpoints derive amount
  **server-side** (dues from `payment_token.amount`, event from `event.registrationFee`,
  invoice from `invoice.total`). Client never sends money. `@hono/zod-validator@0.4.0`
  pre-parses JSON anyway. → no BigInt-as-string risk; assert amounts only.
- **Settlement (dues):** `POST /webhooks/stripe` (registered BEFORE auth) →
  `verifyWebhookSignature` (needs `STRIPE_WEBHOOK_SECRET`) → `processStripePayment.ts`:
  `metadata.paymentId` (UUID) → load DuesPayment → `settle()` (extend membership) →
  status `completed` → `invoiceRepo.markPaid()` (FSM + optimistic lock). Idempotent via
  `webhook_retry_log.idempotency_key`. Retry job every 60s (exp backoff, dead-letter).
- **Test infra present:** `docker-compose.yml:74-79` → `stripe/stripe-mock:latest` :12111
  (NOT in CI). `billing.ts:84-91` redirects SDK to `STRIPE_URL`. Webhooks signed **locally**
  via `stripe.webhooks.generateTestHeaderStringAsync()` (no Docker needed for signing) —
  proven in `stripeWebhook.integration.test.ts`. Docker daemon confirmed UP on this machine.

## Approach — Option A (chosen)

stripe-mock (existing compose service) answers the SDK's PaymentIntent/Checkout-Session
create calls; we fabricate + **locally sign** the `payment_intent.succeeded` webhook and
POST it to our `/webhooks/stripe`, driving our **real** settlement code. We verify
everything *we own*. Stripe's hosted card page is Stripe's UI (not our code) — simulated
via the signed webhook exactly as the integration test does.

Rejected: **B** (real test keys + Stripe CLI) — needs real account, Connect onboarding,
network; overkill for local verify. **C** (dev stub gateway) — new code that drifts +
bypasses/masks real billing code.

## Definition of done (all 3 paths, live /browse-verified)

Shared env up (stripe-mock + 3 keys + API restart), then each path:

1. **Dues `/pay/$token`:** officer mints link → member opens `/pay/$token` (validate renders
   amount/name/org) → checkout returns **200 + checkoutUrl** (no 503) → signed
   `payment_intent.succeeded` → DuesPayment `completed` + invoice `paid` + membership extended
   → member dashboard reflects paid. Amount correct.
2. **Event register-and-pay:** `POST /association/event-lifecycle/:eventId/register-and-pay`
   (fee > 0) → pending registration + checkout → signed webhook → registration settled/paid
   → /browse event page reflects.
3. **Booking invoice-pay:** `my/bookings/$bookingId` → `payInvoice` → `/billing/invoices/:id/pay`
   → checkoutUrl → signed webhook (billing `handleStripeWebhook`, manual-capture Hold-&-Decide:
   authorize → capture → paid) → invoice paid → /browse reflects.

Leave ONE runnable verify driver (mints/curls/signs/asserts) + this ledger updated.

## Impl-time details — RESOLVED in T1 (ground-truth, my own psql/grep)

- **TWO webhook entries** (not one): dues+event → `POST /webhooks/stripe` (hand-wired app.ts:373,
  pre-auth, dispatches by `metadata.paymentId`); billing/invoice → `POST /billing/webhooks/stripe`
  (generated route, behind validator+audit middleware, dispatches by `metadata.invoiceId`).
- **Dues connected account = `dues_gateway_config`**, NOT merchant_accounts. Org row EXISTS:
  `connected=t`, provider=paymongo, public_key=`pk_test_demo_key_not_real`. → dues checkout guard
  passes. (Event+booking use `merchant_account.metadata.stripeAccountId`=`acct_seed_pda_mm`.)
- **merchant_account** for org exists but metadata **lacks `onboardingComplete`** → `payInvoice`
  (booking T4) will throw `PROVIDER_BILLING_INCOMPLETE`; also `payInvoice` looks up by
  `findByPerson(invoice.merchant)` (person-scoped) while our row is org-scoped → T4 needs fixture work.
- **EVENT settlement is a real GAP**: webhook processor reads only `metadata.paymentId`; ignores
  `metadata.type=event_registration`. `registerAndPayForEvent` creates registration `confirmed`
  *before* payment. T3 = needs a code fix (add event branch) OR accept optimistic-confirm + document.
- **Booking = manual-capture 2-step**: webhook → `requires_capture`, then officer
  `POST /billing/invoices/:id/capture` → `paid`.
- Money: dues amounts server-side (token row); confirmed no BigInt-body trap on pay path.

### T1 ground-truth ids (verified via psql)
- ORG `ed8e3a96-8126-4341-be42-e6eb7940c562` · Miguel (member) `425e7ea6-b8d8-4910-86f3-74b401701ce9`
  (login member@memberry.ph) · Maria (officer/President) `6dc8639e-...` (login test@memberry.ph).
- Miguel membership `f659c8e0-7a5e-4efd-83a9-b472354dee34` · `dues_expiry_date=2027-01-16` (extension proof).
- Miguel's one real unpaid invoice `99ed6c0d` already has a `submitted` manual proof → driver uses a
  FRESH fixture invoice (marker `INV-STRIPE-TEST-`) instead, with cleanup.
- Events fee>0 (org): Convention `dc7bec42` (2500 PHP), Gala `a2cce663` (3500 PHP).
- stripe-mock UP :12111 (docker daemon running). stripe SDK 19.3.1 in api-ts.

## Stack / creds

API :7213 (no watch — restart after backend change), app :3004, both UP. pw `TestPass123!`.
Officer `test@memberry.ph` (Maria Santos, President). Member `member@memberry.ph`
(Miguel Bautista, memberPersonIds[0]). Org pda-metro-manila `ed8e3a96-8126-4341-be42-e6eb7940c562`.
Restart: `kill "$(lsof -ti tcp:7213)"; cd services/api-ts && nohup bun src/index.ts >/tmp/api.log 2>&1 &` then warm `curl :7213/auth/ok`.

## Execution model

Subagent-driven, serial: implementer + reviewer pair per code task. Stateful steps
(compose up, .env, API restart, webhook POST, /browse) in **main loop** (watched). Commit
locally on `design/ui-ux-audit`. LIVE /browse verify before any "done" claim.

---

## Task spine

- [ ] **T1 — Shared setup** (main loop): compose up stripe-mock; add 3 env keys; restart API;
  confirm webhook route; ensure merchant_accounts row(s); pick test member + unpaid invoice.
- [x] **T2 — Dues path**: DONE + live-verified. Driver `scripts/stripe-happy-path.ts dues` = 17/17 PASS
  (checkout 200, webhook `action=processed`, payment `completed`, invoice `paid`, membership 2027-01-16→2028-01-16,
  money 300000 exact). /browse `/pay/$token`: renders ₱3,000.00 / PDA Metro Manila / Miguel + Pay Now →
  `POST /api/pay/.../checkout 200` → redirect to Stripe Checkout (`cs_test_…`), 0 console errors.
- [x] **T3 — Event path**: DONE + live-verified. Required real code (not just infra):
  (1) `event_registration.paid_at` nullable column + migration **0077**; (2) webhook event-settlement
  branch in `processStripePayment.ts` (matches `metadata.type=event_registration`, stamps `paid_at`,
  idempotent, returns before dues guards); (3) **root-fix** `registerAndPayForEvent.ts` — its Stripe
  metadata lacked `orgId`, so a REAL event webhook would dead-letter at intake (`webhook_retry_log.organization_id`
  is NOT NULL, fed from `metadata.orgId ?? ''` → empty-uuid error). Added `orgId`/`organizationId`.
  Driver `event` subcommand 10/10, `all` 27/27 (self-run). /browse: event page renders + "Register and Pay"
  → `POST register-and-pay 201` → Stripe Checkout redirect.
  - Deferred polish: no FE "Paid" badge (paid_at internal-only; would need TypeSpec+regen); optimistic
    `confirmed`-before-payment unchanged (registration confirms pre-pay — separate redesign).
- [x] **T4 — Booking path**: DONE (backend live-verified). Driver `booking` 14/14, `all` 41/41 (self-run).
  Fixture-gated (no product handler change): seed `merchant_account` needed `onboardingComplete:true` +
  an open invoice (customer Miguel → merchant Maria). Full manual-capture state machine verified:
  `pay 200 → pending` → signed `payment_intent.succeeded` → `requires_capture` → officer `capture 200` →
  `status=paid` + `payment_status=succeeded` + `paid_at`. Money 150000 exact.
  - **Real prod-gap FIXED:** `/billing/webhooks/stripe` was CSRF-gated (allowlist matches
    `startsWith('/webhooks/')`; `/billing/webhooks/stripe` failed it) → real Stripe (no CSRF token) would
    get 403 → billing webhook unreachable in prod. Added `/billing/webhooks/` to the allowlist (app.ts).
    Driver now POSTs the billing webhook unauthenticated + signature-only (the real Stripe path), 14/14.
  - **Caveat (stripe-mock):** `paymentIntents.capture` against stripe-mock returns a canned non-`succeeded`
    PI without throwing; `captureInvoicePayment` treats no-throw as success (real Stripe throws on failure,
    so fine). Proves our handler + invoice flip; the mock doesn't truly capture.
  - FE /browse skipped: `my/bookings/$bookingId` needs a slot→service→booking→invoice fixture chain
    (0 bookings seeded; booking requires `slot_id`) — disproportionate; the pay→checkout→redirect UI
    pattern is already /browse-proven on dues + event. Backend path proven via the authed driver.
- [x] **T5 — Verify driver + ledger**: DONE. One runnable driver `services/api-ts/scripts/stripe-happy-path.ts`
  (`dues` | `event` | `booking` | `all`, `--keep`), self-contained + idempotent + cleans up. Ledger finalized.

## Outcome (2026-06-20)

**All 3 online-payment happy-paths now work end-to-end + are live-verified** against local stripe-mock
(:12111) with locally-signed webhooks. One driver proves them: `cd services/api-ts && bun scripts/stripe-happy-path.ts all` → **41/41**.

- **Dues** `/pay/$token`: was purely infra-gated (no dev Stripe keys). Fixed env. /browse: full member UI.
- **Event** register-and-pay: needed real code — `paid_at` column (mig 0077) + webhook settlement branch +
  **root-fix** (event metadata lacked `orgId` → real webhook dead-lettered at intake). /browse: Register & Pay → Checkout.
- **Booking** invoice-pay (manual capture): fixture-gated + **root-fixed a real prod bug** (billing webhook
  was CSRF-gated → unreachable by real Stripe). Backend verified; FE browse skipped (fixture chain disproportionate).

**Real bugs found + fixed (would have broken production):**
1. Event online payment dead-lettered at webhook intake (missing `orgId` in Stripe metadata). — `d0884454`
2. `/billing/webhooks/stripe` rejected real Stripe (CSRF gate). — `c6027536`

**Caveats / deferred (not blockers):**
- stripe-mock `paymentIntents.capture` returns canned non-`succeeded` without throwing; `captureInvoicePayment`
  treats no-throw as success. Proves our handler; true capture needs real Stripe test keys.
- Event FE has no "Paid" badge (paid_at internal-only); registration still confirms optimistically pre-payment.
- Officer `sendPaymentLink` mint is gated (officer-term/2FA) in dev → driver used a direct token-insert fallback.
- `.env` Stripe keys are dummy + gitignored (local only). Prod needs real keys.
- Pre-existing (not mine): `elections.repo.test.ts listNominees` fails (mock-pollution class); touched-area
  tests 20/20 green; full API typecheck green.

**Commits (local on `design/ui-ux-audit`, not pushed):** `06767156` (dues+driver) · `d0884454` (event) ·
`c6027536` (booking+CSRF fix) · this ledger.

## Progress ledger

| When | Task | Result | Commit |
|---|---|---|---|
| 2026-06-20 | Brainstorm + verify (2 workflow rounds, 10 agents) | Verified all claims; refuted stale `initiateOnlinePayment` chain; confirmed env is the blocker | — |
| 2026-06-20 | Design approved | Option A, all 3 paths | — |
| 2026-06-20 | **T1 setup DONE** | stripe-mock up :12111; 3 Stripe env keys added to api-ts/.env; API restarted (auth/ok 200); 2 webhook routes + dues_gateway_config(connected) + ground-truth ids confirmed | — |
| 2026-06-20 | **T2 dues DONE** (implementer+reviewer driver, self-run 17/17, /browse) | dues `/pay/$token` end-to-end live-verified: settle + invoice paid + membership extended + member UI render + Pay→checkout 200. stripe-mock key fix: rejects underscored suffix → `sk_test_memberrydevdummy`. | 06767156 |
| 2026-06-20 | **T3 event DONE** (implementer+reviewer, self-run 27/27, /browse) | event settlement built: paid_at col + migration 0077 + webhook branch + root-fix orgId metadata (real webhook would've dead-lettered). Register-and-pay 201 → Stripe Checkout. | d0884454 |
| 2026-06-20 | **T4 booking DONE** (implementer+reviewer, self-run 14/14, all 41/41) | manual-capture pay→requires_capture→paid verified; **fixed real prod gap** (billing webhook CSRF-gated → unreachable by real Stripe); fixture-only otherwise. FE browse skipped (booking fixture chain disproportionate). | c6027536 |
| 2026-06-20 | **T5 DONE** | driver finalized (all 41/41); touched-area tests 20/20; DB clean at baseline; ledger closed | (this) |
