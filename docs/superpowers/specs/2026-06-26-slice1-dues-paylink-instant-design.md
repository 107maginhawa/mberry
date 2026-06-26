# Slice-1 — Login-free dues pay-link (instant rail), consolidated & corrected

**Date:** 2026-06-26 (rev 2 — after adversarial review)
**Branch:** `feat/slice1-dues-paylink-paymongo`
**Phase:** Lean launch T9 (first vertical slice) + T7 (PayMongo adapter, test mode)
**Goal:** The critical path to the first peso — an officer creates a dues pay-link,
a member taps a login-free page, pays via PayMongo (GCash/Maya/card) into the
**org's own** PayMongo account, and the payment correctly reconciles end to end.
Production-grade for real orgs handling real money.

> Strategy is LOCKED (memory `lean-launch-strategy` + DESIGN.md). Each org brings
> its **own** PayMongo account; the founder is never in the dues money flow.

## Why this slice is "fix + consolidate," not greenfield

A T7 spike + adversarial review found the PayMongo money path **already half-exists
on main and is broken**. Slice-1 makes it correct. The defects (all verified in
code) are the work:

1. **Wrong rail at the PH checkout.** `handlers/member/duesspecialassessments/checkoutPaymentToken.ts`
   (`POST /pay/:token/checkout`, public) calls **Stripe** `billing.createPaymentIntent`
   with `connectedAccountId: gatewayConfig.publicKey` (a publishable key, not a
   Stripe `acct_` id) — wrong provider, wrong field.
2. **The PayMongo webhook is orphan code (not route-wired).** `handlePaymentWebhook.ts`
   is not in the generated registry → there is **no live PayMongo webhook at all**
   today. (It also has a key mismatch — reads `metadata['duesInvoiceId']`, never set.)
   Online dues payment is therefore non-functional for PH: a Stripe checkout with no
   PayMongo settlement path. Net-new wiring, not a fix of a live path.
3. **Ledger never settles (latent money bug on main).** `[FIX-001]` in checkout now
   creates a `pending` `duesPayments` row and passes `metadata.paymentId`, but the
   webhook ignores `paymentId` and only `invoiceRepo.markPaid(...)`. Reports read
   `duesPayments.status='completed'` (`dues-payments.repo.ts:331-364`), so collected
   money never appears in `totalCollected`/`collectionRate`.
4. **Single global PayMongo key — violates the locked per-org model.**
   `handlePaymentWebhook.ts:20-25` builds the adapter from platform-wide
   `getPaymongoConfig()` (`core/config.ts`). The per-org secret IS stored
   (`duesGatewayConfigs.encryptedSecret`, written by `upsertDuesGatewayConfig.ts`)
   but is never decrypted/used. Money would route to the platform key, not the org.
5. **No per-org webhook signing secret** column exists at all (`duesGatewayConfigs`
   has `publicKey` + `encryptedSecret` only). Per-org webhook verification is
   currently impossible.
6. **No inbound validation.** The webhook never checks event amount/currency/org
   against the token/invoice before settling → cross-org / mismatched-amount
   settlement is open.
7. **Idempotency is unsound.** `usedAt` is set at checkout creation (strands
   abandoned payers); `markUsed` is an unconditional `SET usedAt=now()` (no CAS);
   `createCheckout` sends no `Idempotency-Key`; the session is created by an external
   HTTP call *before* any DB write, so a row lock can't prevent two sessions.

**What is genuinely solid and reused:** `PayMongoAdapter.verifyWebhook` HMAC is
timing-safe with a hex-format guard (`paymongo.adapter.ts:80-87`); `payment_token`
has HMAC `tokenHash`, `amount` (centavos), `currency` (PHP), `expiresAt`, `usedAt`;
`duesPaymentStatusEnum` already defines a real settlement state machine.

## Scope

**In (instant rail):** one canonical PayMongo checkout + one canonical webhook,
per-org keys, correct atomic settlement, amount/org validation, sound idempotency.

**Out (slice-1b, additive):** async OTC bank-transfer proof. It reuses the
**existing** `duesPaymentStatusEnum` states (`submitted → underReview →
confirmed|rejected`) — no new "reconciliation status" column is invented.

**Out (locked v1):** refunds (manual, separate), late fees, partial dues,
renewals, roster import, events+pay, console org-create (later T9 slices).

## Per-org account model (B1 — the headline)

Each org owns its PayMongo account and its API + webhook secrets, stored encrypted
per org. Resolution:

- **Checkout:** decrypt `duesGatewayConfigs.encryptedSecret` for the token's org;
  construct `PayMongoAdapter(orgSecret, orgWebhookSecret)`; the checkout session is
  created on the org's account. The founder/platform key is never used for dues.
- **Webhook → org routing (verify-before-trust):** each org registers its PayMongo
  webhook to a **per-org URL**: `POST /webhooks/paymongo/:orgId`. Intake resolves
  `:orgId` → that org's `encryptedWebhookSecret` → `verifyWebhook`. The org id comes
  from the URL the org configured, and the signature is verified with *that org's*
  secret, so a forged body for another org fails verification. No trust is extended
  before the HMAC check.
- **Schema add:** `duesGatewayConfigs.encrypted_webhook_secret` (PayMongo's webhook
  signing secret is distinct from the API secret).
- **Provider selection:** `duesGatewayConfigs.provider` (today read-but-dead at
  `getGatewayConfig`, `dues-payments.repo.ts:659`) now branches: `paymongo` → this
  path. `stripe` remains only for orgs explicitly on Stripe (not the PH default).

> Test mode: each org's stored secret is a PayMongo **test** key until G2 clears.
> The design is identical for live; only the key value changes.

## Architecture

```
Officer (apps/org, later)              Member (login-free page, later)
   POST .../paylinks  create            GET /pay/:token        (public)
        │                                    │ POST /pay/:token/checkout (public)
        ▼                                    ▼
  createPaymentToken                    startCheckout
   payment_token row                     - load token (active? else 410/409)
   (HMAC hash, amount+currency           - decrypt org secret (B1)
    from invoice, TTL, officer,          - claim-or-reuse session (R1/R2)
    idempotency_key)                     - PayMongoAdapter(orgKey).createCheckout
                                           with Idempotency-Key header
                                         - store paymongo_session_id
                                         → redirect to PayMongo checkout_url
                                ┌──────────────────────────────┐
                                │  PayMongo (org account)      │
                                │  GCash / Maya / card         │
                                └──────────────┬───────────────┘
                                               │ signed webhook
                                               ▼
        POST /webhooks/paymongo/:orgId
          → resolve org → org webhook secret → verifyWebhook (HMAC, timing-safe)
          → webhookRetryLogs idempotency key (dedupe redelivery)
          → VALIDATE event.amount==token.amount, currency match, org match (B4)
          → ONE tx: duesPayments pending→completed  (by metadata.paymentId)
                    + duesInvoices → paid (if invoiceId)
                    + payment_token.usedAt = now()  (CAS)
```

### Canonical handlers — exactly one live checkout + one live webhook

Route reality (generated registry): the **only** live online-dues route is
`POST /pay/:token/checkout` → `checkoutPaymentToken` (Stripe). `validatePaymentToken`
(`GET /pay/:token/validate`) is live and reused by the member pay page. Everything
else PayMongo-flavored — `handlePaymentWebhook`, `initiateOnlinePayment`,
`generatePaymentLink`, `validatePaymentLink`, dues `stripeWebhook` — is **unrouted
orphan code**.

- `startCheckout` **re-points `POST /pay/:token/checkout`** off Stripe onto canonical
  PayMongo via the org's key; `usedAt` NOT set here.
- `paymongoWebhook` is **net-new** at `POST /webhooks/paymongo/:orgId` (no live
  PayMongo webhook exists today); per-org secret, binds by `metadata.paymentId`,
  validates, settles atomically.

Per CLAUDE.md the **module diet is deferred and test-guarded** — the orphan handlers
are NOT deleted in this slice. They are already off every route, so they are not
parallel *live* money paths; they are inventoried here and left for the later diet.
The Stripe `billing` service stays for the org→founder subscription only (untouched).

## Settlement model (B3 — match the real tables)

Source of truth for "money collected" is the **`duesPayments`** row, not the invoice.

- Checkout creates `duesPayments` `pending` (kept from `[FIX-001]`) and carries its
  id as `metadata.paymentId`.
- Webhook settles by `paymentId`: `duesPayments` `pending → completed`
  (`duesPaymentStatusEnum`, transition guarded by `DUES_PAYMENT_VALID_TRANSITIONS`),
  set `paidAt`, gateway event id. If the token has an `invoiceId`, also move the
  invoice `generated|sent → paid` (`duesInvoiceStatusEnum`; **there is no `pending`
  invoice status** — the rev-1 spec was wrong). All in one transaction.

## Idempotency — no double-charge (B4 + R1/R2/R3)

The invariant: **repeated taps of one token never produce more than one PayMongo
session or more than one settled payment.**

- **Single-winner claim (real mutex, with lease).** Before calling PayMongo, claim
  the exclusive right to create a session AND mint a fresh per-attempt key in one
  atomic statement:
  `UPDATE payment_token SET checkout_started_at=now(), idempotency_key=$newKey
   WHERE id=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now()
   AND paymongo_session_id IS NULL
   AND (checkout_started_at IS NULL OR checkout_started_at < now() - interval '2 minutes')
   RETURNING idempotency_key`.
  The `paymongo_session_id IS NULL` + stale-`checkout_started_at` predicate make this
  a true mutex: only one concurrent tap gets a row. The winner calls PayMongo with
  `Idempotency-Key: <idempotency_key>` and persists `paymongo_session_id`.
- **Loser / re-tap paths.** A tap that gets **no row** is one of:
  (a) session already exists → read `paymongo_session_id`, return the **same**
  `checkout_url`; (b) another tap is mid-flight inside the 2-minute lease and no
  session yet → return `202` "checkout starting, retry". The 2-minute lease also
  **reclaims a stranded claim**: if the winner's PayMongo call 502s after claiming,
  the claim goes stale and the next tap re-wins — closing the failure-strand
  (consistent with "PayMongo failure → token stays active, retryable"). On a PayMongo
  error the handler also best-effort clears `checkout_started_at` so recovery is
  immediate, not lease-delayed.
- **Per-attempt Idempotency-Key (not per-token).** The key is regenerated on every
  successful claim and stored on the row. Concurrent taps of one attempt never both
  call PayMongo (the mutex guarantees one winner), so the key is belt-only there; its
  real job is to **change on remint** so PayMongo's sticky (~24h) idempotency does not
  replay a dead session.
- **`usedAt` set only on confirmed payment** (webhook), via CAS
  `UPDATE ... SET used_at=now() WHERE id=$1 AND used_at IS NULL RETURNING`. Abandoned
  checkouts leave the token active and re-tappable (fixes R2).
- **Session re-fetch / remint on expiry (R3).** On re-tap with a stored session,
  re-fetch it; if PayMongo reports expired/cancelled, atomically release it
  (`UPDATE ... SET paymongo_session_id=NULL, checkout_started_at=NULL
   WHERE id=$1 AND paymongo_session_id=$expiredSession`, guarded on the expired id so
  it can't race a concurrent settlement) and fall through to a fresh claim → new key
  → new session. A live session is reused; a dead one is replaced — the link never
  becomes permanently unpayable before token TTL, and remint is not defeated by the
  idempotency key.
- **Webhook redelivery** deduped via `webhookRetryLogs` unique idempotency key
  (ported from the Stripe path — `handleStripeWebhook.ts:79-127` — not "reused
  verbatim"; the live PayMongo webhook doesn't touch it today). Org-FK NOT NULL is
  satisfied by the `:orgId` from the URL.
- **Binding key (R5).** Bind the webhook to the payment by `metadata.paymentId`
  (the adapter's `checkout_session_id` extraction is unreliable on `payment.paid`).
  A slice task verifies in PayMongo **test mode** that checkout metadata round-trips
  onto the `payment.paid` resource; if not, carry the id another supported way.

## Amount + currency

- Token amount is **fixed** from the invoice; PayMongo line-item amount is server-set
  → the member cannot overpay on the **outbound** side. The **inbound** webhook is
  now validated (`event.amount === token.amount`, currency + org match) before
  settling — so a tampered/mismatched signed event cannot settle (closes B4).
- Currency PHP end to end, centavos. One real schema gap: `duesInvoices` has no
  `currency` column — added here. (`duesInvoices.totalAmount` is `bigint` vs
  `integer` centavos elsewhere — noted; no change this slice.)

## Error handling

- Invalid/unknown token → `400`. Expired → `410`. Revoked → `410`. Already
  used/paid → `409`. Org not connected / no decryptable secret → `400`.
- Checkout already starting (claim held, no session yet, within lease) → `202`.
- Bad/absent webhook signature → `verifyWebhook` null → `400`, no state change.
- Amount/currency/org mismatch on a verified event → `409`, logged, no settle.
- PayMongo API failure at checkout → `502`, token stays active (retryable).
- Duplicate webhook (idempotency key seen) → `200`, no-op.

## Schema changes (one migration; SQL reviewed before it runs)

1. `dues_gateway_configs` — add `encrypted_webhook_secret` (per-org webhook secret).
2. `payment_token` — add `revoked_at timestamptz NULL`,
   `paymongo_session_id varchar NULL`, `checkout_started_at timestamptz NULL`,
   `idempotency_key varchar NULL`.
3. `dues_invoices` — add `currency varchar(3) NOT NULL DEFAULT 'PHP'`.

All additive (no `DELETE`). `bun run db:generate` → review SQL → PR references
`docs/security/MIGRATION_SAFETY_CHECKLIST.md`.

## Business rules (→ `br-registry`, waivers ratcheted same PR)

- Pay-link **single-use** (`usedAt` permanent once set on confirmed payment).
- Pay-link **TTL** (unusable past `expiresAt`; re-issue mints new; default 72h, tunable).
- Pay-link **revocable** (officer sets `revokedAt`; revoked unusable).
- Pay-link **idempotent** (≤1 session, ≤1 settlement per token, under concurrency).
- **Webhook signature trust boundary** (state changes only on a per-org-HMAC-verified
  event).
- **Inbound amount/org validation** (settle only when event amount+currency+org match
  the token).
- **Per-org settlement** (dues route to the org's own PayMongo account; platform key
  never used for dues).
- **PHP currency**, centavos.

## Testing (VERTICAL_TDD: spec → RED → GREEN, real-PG where money moves)

`createScratch` real-PG integration tests, RED first:

1. Create pay-link → correct `payment_token` row.
2. **Concurrent double-tap** → exactly one claim wins, exactly one PayMongo session
   (adapter `createCheckout` call count == 1); loser gets the same `checkout_url` or
   `202`. (The money-safety test.)
2b. **Reclaim after checkout failure** → winner's PayMongo call fails; a later tap
   (after lease/clear) re-wins and creates the one session; token never strands.
3. Webhook `paid` (valid amount/org) → `duesPayments pending→completed`,
   invoice→paid, `usedAt` set — in one tx; reports' `totalCollected` moves
   (regression test for bug #3).
4. Webhook redelivery (same idempotency key) → no second settlement.
5. Webhook with **mismatched amount** → `409`, no settle (B4).
6. Webhook for **wrong org** (verified with org A's secret, invoice of org B) →
   rejected, no settle.
7. Expired token checkout → `410`; revoked → `410`; used → `409`.
8. Bad webhook signature → `400`, no state change (signed-fixture test).
9. Per-org key: checkout decrypts org A's secret, not the platform key (assert the
   adapter is constructed with the org's secret).

PayMongo in **test mode**; webhook tests use signed fixtures (no live call). The
`createCheckout` HTTP boundary is stubbed for unit tests and exercised against
PayMongo test mode in one adapter contract test (which also verifies the metadata
round-trip from R5).

## Definition of done

- Exactly one live online-dues checkout route (`/pay/:token/checkout`, re-pointed to
  PayMongo) + one live webhook route (`/webhooks/paymongo/:orgId`, net-new). Orphan
  handlers inventoried, left unrouted for the deferred module diet (not deleted).
- Per-org secret used for checkout; per-org webhook secret verifies the webhook;
  platform key not used for dues.
- Ledger settles correctly (`duesPayments → completed`); the report-collection
  regression test passes.
- Concurrent double-tap proven to mint one session; amount/org validation enforced.
- TypeSpec ops built; OpenAPI + types + routes + SDK regenerated (no generated-file
  drift; CI git-diff gate green).
- Migration reviewed + applies clean.
- BRs registered; WORKFLOW_MAP entries re-pointed lean; matching `KNOWN_INCOMPLETE`
  waivers removed; `br-coverage` + journey gates green.
- Full engine suite + contract suite + typecheck green.

## Explicitly deferred

- OTC bank-transfer proof rail (slice-1b; reuses existing `submitted/underReview/
  confirmed/rejected` states).
- Officer UI (`apps/org`) + member pay page UI — this slice is the API + money
  engine; UIs consume it next on `packages/ui` + the SDK.
- Refunds, late fees, partial dues, renewals, roster import, events+pay, console
  org-create.
```
