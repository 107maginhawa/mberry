# Slice-1 — Login-free dues pay-link (instant rail)

**Date:** 2026-06-26
**Branch:** `feat/slice1-dues-paylink-paymongo`
**Phase:** Lean launch T9 (first vertical slice) + T7 (PayMongo adapter, test mode)
**Goal:** The critical path to the first peso — an officer creates a dues pay-link,
a member taps a login-free page, pays via PayMongo (GCash/Maya/card), and the
payment auto-reconciles. Production-grade for real orgs handling real money.

> Strategy is LOCKED (see memory `lean-launch-strategy` + DESIGN.md). This spec
> is the technical design for the first money-path slice only.

## Scope

**In:** instant rail only — PayMongo checkout (GCash/Maya/card) + webhook
auto-reconcile (`pending → paid`). Officer creates link; member pays login-free.

**Out (slice-1b, additive follow-up):** async OTC bank-transfer proof state
machine (`pending → proof_submitted → officer_verified → reconciled`). The
reconciliation status column is provisioned to hold those states now, so 1b is
additive with no migration churn or rework of the token/reconcile core.

**Out (locked v1 scope):** refunds (officer-initiated manual, separate),
late fees, partial dues. Signup is a post-payment OTP upsell, not part of pay.

## Key reality (from the T7 spike, 2026-06-26)

The doc assumed greenfield. It is not. The following already exist and are real:

- `handlers/association:member/utils/gateway-adapter.ts` — `GatewayAdapter`
  interface (`createCheckout`, `verifyWebhook`, `getPaymentStatus`).
- `handlers/association:member/utils/paymongo.adapter.ts` — `PayMongoAdapter`
  hitting real PayMongo `/v1/checkout_sessions`; `verifyWebhook` is HMAC-SHA256
  with **timing-safe compare + hex-format guard**. Has tests.
- `handlers/dues/repos/payment-token.schema.ts` — `payment_token` table: HMAC
  `tokenHash` (raw never stored), `amount` (centavos), `currency` default `PHP`,
  `expiresAt` (72h), `usedAt` (single-use), org/person/officer refs.
- `webhookRetryLogs` (idempotency key, unique constraint, retry state) — reused
  verbatim for PayMongo webhook intake.

So T7 here is **wire + harden + prove**, not build-from-scratch. The adapter is
not yet wired into the live checkout, and `duesGatewayConfigs.provider` is read
but nothing branches on it.

## Architecture

```
Officer (apps/org, later)            Member (login-free page, later)
        │ POST create pay-link              │ GET /pay/:token  (public, no auth)
        ▼                                   ▼
  createPaymentToken handler          getPayLink handler → checkout handler
        │ insert payment_token              │ branch on duesGatewayConfigs.provider
        │ (HMAC hash, fixed amount,         │ → PayMongoAdapter.createCheckout()
        │  72h TTL, officer-stamped)        │ → store sessionId on token
        ▼                                   ▼ redirect to PayMongo checkout_url
                                     ┌──────────────────────────────┐
                                     │  PayMongo (GCash/Maya/card)   │
                                     └──────────────┬───────────────┘
                                                    │ webhook (signed)
                                                    ▼
                          POST /webhooks/paymongo  → verifyWebhook (HMAC, timing-safe)
                                                    → webhookRetryLogs (idempotency key)
                                                    → mark token usedAt + invoice pending→paid
```

### Components (each independently testable)

1. **`payment_token` model + repo** (exists) — extended with `revokedAt` and
   `paymongoSessionId`. Pure data; no provider knowledge.
2. **Provider selection** — a thin factory reading `duesGatewayConfigs.provider`
   → returns the right `GatewayAdapter`. Today: `paymongo` for PH orgs. The only
   new branching code; isolates provider choice from handlers.
3. **`PayMongoAdapter`** (exists) — unchanged except as bugfixes surface from
   tests. Owns all PayMongo HTTP + signature logic.
4. **Pay-link handlers** — `createPaymentToken` (officer), `getPayLink` +
   `startCheckout` (public), `paymongoWebhook` (reconcile). Each thin; delegates
   to repo + adapter.
5. **Reconcile** — webhook → idempotency-keyed → flips `payment_token.usedAt`
   and the dues invoice `pending → paid`. Reuses `webhookRetryLogs`.

## Data flow + state

- **Token states:** `active` (unused, unexpired, unrevoked) → `used` (`usedAt`
  set on confirmed payment) | `expired` (`expiresAt` past) | `revoked`
  (`revokedAt` set by officer).
- **Invoice/payment reconciliation status:** `pending → paid` for instant.
  Column typed to also hold `failed`, `expired`, and (slice-1b) `proof_submitted`,
  `officer_verified`, `reconciled` — provisioned now, unused until 1b.

### Idempotency (no double-charge — the production-critical invariant)

- **One active checkout session per token.** `startCheckout` on an `active`
  token with a stored `paymongoSessionId` returns the **same** `checkout_url`
  (re-fetch by sessionId), never creates a second session. First call with no
  stored session creates one and persists `paymongoSessionId` atomically.
- **Single-use:** `usedAt` is set only by the webhook on confirmed payment; once
  set, the token is spent and `startCheckout` refuses.
- **Webhook idempotency:** `webhookRetryLogs` unique key dedupes redelivery — a
  replayed `paid` webhook is a no-op.
- **Concurrency:** the create-session write is guarded (insert-once / row lock)
  so two simultaneous taps cannot both create a session. Proven by a concurrent
  double-tap real-PG test.

### Amount + currency

- Token amount is **fixed** from the dues invoice at creation. The member cannot
  alter it (PayMongo line-item amount is server-set), so **overpayment is
  structurally impossible** for pay-links. The doc's "overpayment clamp" does
  not apply to this surface; it is stated explicitly, not silently skipped.
- Currency is `PHP` end-to-end. The one real schema gap is `duesInvoices` having
  no `currency` column — added in this slice's migration.

## Error handling

- Expired token → `410 Gone` (link dead, officer re-issues).
- Revoked token → `410 Gone`.
- Used token → `409 Conflict` (already paid).
- Bad/absent webhook signature → `verifyWebhook` returns null → `400`, no state
  change, logged. Never trust an unsigned webhook (trust-boundary BR).
- PayMongo API failure on checkout → `502`, token stays `active` (retryable).
- Unknown/duplicate webhook event → idempotency key swallows it, `200`.

## Schema changes (one migration, shown before it runs)

1. `duesInvoices` — add `currency varchar(3) NOT NULL DEFAULT 'PHP'`.
2. `payment_token` — add `revoked_at timestamptz NULL`,
   `paymongo_session_id varchar NULL`.
3. Reconciliation status column — ensure it is an enum/varchar wide enough for
   the full instant+OTC state set (additive; no data rewrite).

Migration follows the project gate: `bun run db:generate` → review SQL →
`DELETE`+`WHERE` one-line rule (N/A here, additive only) → PR references
`docs/security/MIGRATION_SAFETY_CHECKLIST.md`.

## Business rules (extracted → `br-registry`, ratcheted same PR)

- **BR (pay-link single-use):** a token is spendable at most once; `usedAt`
  set on confirmed payment makes it permanently spent.
- **BR (pay-link TTL):** a token past `expiresAt` is unusable; re-issue creates
  a new token. TTL tunable (default 72h).
- **BR (pay-link revocable):** an officer may revoke an unused token; revoked
  tokens are unusable.
- **BR (pay-link idempotent — no double-charge):** repeated taps of one token
  never produce more than one checkout session or more than one settled payment.
- **BR (webhook signature trust boundary):** payment state changes only on a
  webhook whose PayMongo HMAC signature verifies; unsigned/forged webhooks
  cause no state change.
- **BR (PHP currency):** dues money is denominated in PHP, stored in centavos.
- **BR (exact-amount link):** the member pays exactly the invoice amount; the
  amount is server-set and not member-modifiable (no overpayment surface).

Each maps a WORKFLOW_MAP entry re-pointed to the lean flow + drops its
`KNOWN_INCOMPLETE` waiver in `br-coverage.ts` once the lean test lands.

## Testing (VERTICAL_TDD: spec → RED → GREEN, real-PG where money moves)

Real-PG (`createScratch`) integration tests, written RED first:

1. Create pay-link → `payment_token` row with correct hash/amount/TTL/officer.
2. **Double-tap idempotency** (concurrent) → exactly one PayMongo session;
   second tap returns the same `checkout_url`. (The money-safety test.)
3. Webhook `paid` → token `usedAt` set, invoice `pending → paid`.
4. Webhook redelivery (same idempotency key) → no second settlement.
5. Expired token → `410`, no checkout.
6. Revoked token → `410`, no checkout.
7. Used token → `409`.
8. Bad webhook signature → `400`, no state change (signed-fixture test).

PayMongo runs in **test mode** (test keys); webhook tests use signed fixtures so
no live PayMongo call is needed. The `createCheckout` HTTP call is the only
external boundary — stubbed at the fetch layer for unit, exercised against
PayMongo test mode for the adapter contract test.

## Definition of done

- TypeSpec ops for the pay-link flow built; OpenAPI + types + routes + SDK
  regenerated (no generated-file drift; CI git-diff gate green).
- Migration generated, SQL reviewed, applies clean.
- All 8 real-PG tests green; double-tap idempotency proven.
- BRs registered; their WORKFLOW_MAP entries re-pointed to lean; matching
  `KNOWN_INCOMPLETE` waivers removed; `br-coverage` + journey gates green.
- `PayMongoAdapter` wired into the live checkout via provider selection.
- Full engine suite + contract suite green; typecheck green.

## Explicitly deferred

- OTC bank-transfer proof rail (slice-1b).
- The officer UI (`apps/org`) and the member pay page UI — this slice is the
  API + money engine; the UIs consume it next on `packages/ui` + the SDK.
- Refunds, late fees, partial dues, renewals, roster import, events+pay,
  console org-create (later T9 slices).
