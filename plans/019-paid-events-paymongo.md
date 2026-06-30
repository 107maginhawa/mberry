# 019 — Paid Events on PayMongo (Slice 7d)

> Step-7 follow-on. The strategic money-rail unification: paid event registration paid through
> each org's **PayMongo connected account**, mirroring the shipped dues pay-link.
> Design: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> "Cross-cutting fork: paid events" + Net-new "Strategic".
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: NET-NEW, money-path, ADDITIVE engine.** Approved 2026-06-30.
>
> ## ⚠️ REVISED DESIGN (A) — 2026-06-30
> Recon found paid events ALREADY work via **Stripe**: `registerAndPayForEvent`
> (`POST /association/event-lifecycle/{eventId}/register-and-pay`) creates a registration + a
> Stripe checkout on the org's merchant account; `processStripePayment` settles by stamping
> `event_registration.paid_at` (idempotent `if (!registration.paidAt)`). So 7d = **add the
> PayMongo sibling of that existing flow**, NOT a from-scratch token pay-link.
>
> **Design A (chosen — leanest, no duplication, member self-serve = the natural + existing model):**
> - **NO migration / NO new columns / NO new table** — `paid_at` already exists and is the paid
>   signal (an earlier recon mislabeled it `amountPaid`; the table confirms `paid_at`).
> - New handler `registerAndPayForEventViaPaymongo` — clone `registerAndPayForEvent`, swap Stripe
>   `billing.createPaymentIntent` → the PayMongo `resolveCheckoutAdapter` + `createCheckout`
>   (already built for dues); metadata `{ type:'event_registration', eventId, registrationId,
>   personId, orgId, organizationId }`; returns `{ checkoutUrl, registrationId }`.
> - **`paymongoWebhook` additive event branch** (mirrors `processStripePayment:53-67`): when
>   `metadata.type === 'event_registration'` → find registration by `registrationId`, validate
>   `org` + `event.amount === event.registrationFee` (better than Stripe), stamp `paid_at`
>   idempotently. The dues path (by `paymentId`) is BYTE-UNCHANGED — reached only when type ≠
>   event_registration.
> - **`publishEvent` gate**: paid publish allowed when org has a Stripe merchant account OR a
>   PayMongo `dues_gateway_config` (additive; Stripe keeps working).
> - **FE = apps/member** (member self-serve, the natural event model the engine already favors):
>   paid-event register → `registerAndPayForEventViaPaymongo` → redirect to PayMongo checkout →
>   webhook settles → registered/paid. Officer-sent login-free pay-link (the old "Design B") is
>   dropped (it would duplicate the existing register-and-pay).
> - **Slice-5 fix** (apps/org door screen): the paid signal is `paidAt` (not `amountPaid`) — small
>   correctness fix so the officer door shows Paid once settled.
>
> The TypeSpec/handler/SDK/contract/FE/test chain below still applies; the `§Engine design`
> migration/token sections are SUPERSEDED by Design A (no migration).

## Why / sizing

~70% reuses the dues PayMongo infra (recon-verified). Reused as-is: `PayMongoAdapter.createCheckout`
(generic metadata), `resolveCheckoutAdapter` (per-org connected account — payment-agnostic keys),
`payment_token` table + claim/CAS/revoke + `verifyWebhook` + idempotency ledger. Net-new is the
thin event-specific settle + mint paths + a small migration. Est. ~2.5–3 focused days.

## Persona audit (done)

Registrant pays login-free (event title + amount on the pay page; retry on failure; no
double-charge). Officer publishes a PayMongo-gated paid event and sends pay-links / sees Paid
(Slice 5 door screen). Gaps folded: PayMongo (not Stripe) publish gate + friendly "connect
PayMongo"; double-charge guard (token single-use + claim-mutex + webhook idempotency); settle the
RIGHT registration by metadata; clear pay-page context.

## Engine design (ADDITIVE — confirm before building)

**Reuse the `payment_token` table with a discriminator (no new token table).** A token already has
nullable `invoiceId`; add a nullable **`registrationId`** column — a token settles an invoice (dues)
OR a registration (event). Migration: `ALTER TABLE payment_token ADD COLUMN registration_id uuid`.

**`event_registration` payment columns** (migration): add nullable `payment_id uuid`,
`amount_paid bigint`, `payment_method varchar`. (`paid_at` already exists.)

**One PayMongo webhook per connected account → parameterize the existing `paymongoWebhook`**
(additive branch): if the settled token carries `invoiceId` → existing `settleOnlinePayment` (dues,
unchanged); if `registrationId` → new `settleEventRegistrationPayment`. The dues branch is byte-for-
byte preserved; the event branch is purely additive. (A separate webhook route is NOT possible —
PayMongo posts to one URL per account.)

**New repo method `settleEventRegistrationPayment`** (lock registration row; set `paidAt` +
`paymentId` + `amountPaid` + `paymentMethod='online'`; mark token used; idempotent via the
`gatewayEventId` ledger). No invoice marking.

**Cloned thin handlers** (mirror dues, swap invoiceId→registrationId): `mintEventPaymentLink`
(officer-gated, for a registration), and `validatePaymentToken`/`checkoutPaymentToken`
**parameterized** to return/charge event context when the token is a registration token (pay page
shows "Event: {title}" + amount). `createPendingPayment` gains an event variant (no `dues_payment`
row — the registration itself is the ledger, settled in place).

**`publishEvent` gate** (additive change to a frozen handler): publish a paid event when the org has
**a Stripe merchant account OR a PayMongo `dues_gateway_config`** (today: Stripe only). 5-line change,
keeps Stripe working.

**Money invariants (BR-extract):** single-use token; claim-then-call mutex (one checkout per token);
webhook idempotent on `gatewayEventId`; settle amount/currency must match the token; double-tap →
exactly one settlement; never settle a revoked/expired/used token.

## Full chain (plans/000 §b net-new) — vertical, money-path rigor

`/br-extract` (BR-EVT-PAY-1..n) → `/typespec` (mint + parameterized validate/checkout ops) →
`cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → **RED real-PG
integration tests first** (`createScratch`: mint → checkout(claim-mutex, single session) → webhook
settle registration; double-tap=1 settlement; wrong amount rejected; revoked/expired token; dues
webhook still settles unchanged) → `/handler` (GREEN) → `/db-migrate` (token.registration_id +
event_registration cols; reference `docs/security/MIGRATION_SAFETY_CHECKLIST.md`; no `DELETE`) →
`/test-api` → regen SDK → `/contract-scaffold` → `/test-contract` (Hurl: mint + validate + 402-no-
gateway + settle) → `/frontend-design` (apps/org event-detail door: unpaid paid-event registrant →
"Send pay-link"; the login-free pay page renders event context) → E2E real-flow → `/module-review`
→ requesting-code-review → `/pre-commit` → `/commit`.

## Scope locks honored

ADDITIVE only: new columns + new handlers + one additive webhook branch + a 5-line gate change.
**Dues pay-link path byte-unchanged** (the dues webhook/settle/mint untouched; only an event branch
added). No breaking handler/schema changes. Migration adds columns (no `DELETE`/`WHERE`). Spec-first
+ SDK regen. Real-PG money tests mandatory. Double-charge guard is the headline invariant.

## Out of scope (named)

Event refunds (legacy Stripe `refundEventRegistration` stays); member-app self-serve event checkout
(v1 = officer-sent event pay-link + reused login-free pay page); capacity-on-payment coupling;
walk-up cash mark-paid = Slice 7c (rides this slice's new columns).

## Verification (step d)

Engine: `services/api-ts` real-PG suite GREEN incl. the new money tests AND the unchanged dues
suite; `bun run test:contract`. FE: officer publishes a paid event (PayMongo-gated); a registrant
opens the pay-link → sees event + amount → pays (PayMongo test mode) → webhook settles → door
screen shows Paid; double-tap pays once; a paid event with no PayMongo config is blocked at publish
with a friendly "connect PayMongo". Gates: contract, migration-safety, br-coverage (+BR-EVT-PAY),
coverage-matrix, lint:no-skips/shallow, SDK git-diff. Existing engine byte-safe.
