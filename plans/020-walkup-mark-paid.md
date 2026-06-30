# 020 — Walk-up Door Charge / Mark-Paid (Slice 7c)

> Final Step-7 follow-on. Officer records walk-up **cash** for a paid-event attendee at the door —
> manually mark a registration paid.
> Design: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> Screen 4 (door cash collection, line 258-259) + Round-2 B "walk-up at the door" (line 323).
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> Context: [`plans/019-paid-events-paymongo.md`](./019-paid-events-paymongo.md) — Slice 7d settles
> `event_registration.paid_at` via PayMongo/Stripe webhooks; the door screen reads `paidAt`.
> **Classification: NET-NEW, money-path, ADDITIVE engine. NO migration (sign-off 2026-06-30).**

## Engine design (signed off — `paid_at` only, NO migration)

Recon facts (codegraph-verified):
- `event_registration` has `paid_at` only — NO `payment_method`/`amount_paid` columns. Design A
  (019) dropped those. The online rail (`settleEventRegistrationPayment`) also only stamps `paidAt`.
- No mark-paid endpoint exists. `updateEventRegistration` is a wide-open passthrough
  (`z.record(z.string(), z.unknown())`, no org check, raw body → `updateOneById`) — **unsafe to
  reuse for a money action**.

Decision: **stamp `paid_at`; record the cash method in the AUDIT EVENT (officer + timestamp), not a
column.** Nothing in v1 scope reads cash-vs-online per registration; the door screen only shows
Paid/Unpaid. No reconciliation column = no migration on a frozen engine (YAGNI).

New officer-gated handler `markEventRegistrationPaid`:
- Path: `PATCH /association/events/registrations/{registrationId}/mark-paid`
- Roles: `association:admin`, `association:staff` (mirror `updateEventRegistration`).
- Guards (money path — explicit, unlike the open passthrough):
  - registration exists (404) and **org owns it** (`organizationId === ctx organizationId`, else 404).
  - registration status not terminal (`cancelled`/`refunded`) → 409.
  - event `registrationFee > 0` (marking a free event paid is meaningless) → 422.
  - **idempotent**: if `paidAt` already set → return the row 200, no re-stamp (double-tap safe).
- On stamp: `paidAt = now`, `updatedBy = officer.id`. Audit: "Event registration marked paid
  (walk-up cash)".

ADDITIVE only: one new handler + one new route + spec op. Engine byte-unchanged elsewhere. No
schema/migration. Dues + online-event paths untouched.

## BR-extract (BR-EVT-CASH-1..n)

- BR-EVT-CASH-1: only an officer (`association:admin`/`staff`) of the owning org may mark a
  registration paid.
- BR-EVT-CASH-2: a registration may only be marked paid for a **paid event** (`registrationFee>0`).
- BR-EVT-CASH-3: mark-paid is **idempotent** — a second call never re-stamps or errors hard.
- BR-EVT-CASH-4: a terminal registration (`cancelled`/`refunded`) cannot be marked paid.
- BR-EVT-CASH-5: every mark-paid emits an audit event (who/when) — the cash trail.

## Full chain (plans/000 §b net-new) — vertical, money-path rigor

`/br-extract` → `/typespec` (mark-paid op) → `cd specs/api && bun run build` →
`cd services/api-ts && bun run generate` → **RED real-PG integration test first** (`createScratch`:
mark unpaid paid-event reg → paidAt set; double-call = still one paidAt, no error; free event → 422;
cancelled reg → 409; cross-org → 404) → `/handler` (GREEN) → `/test-api` → regen SDK →
`/contract-scaffold` → `/test-contract` (Hurl: mark-paid 200 + idempotent + 422 free) →
`/frontend-design` (apps/org door screen: unpaid paid-attendee → "Record cash payment" +
ConfirmDialog) → `/impeccable` the action → E2E real-flow → `/module-review` →
requesting-code-review → `/pre-commit` → `/commit`.

## Out of scope (named)

Partial payments; amount override (door charge = the event fee); GCash/check method distinction for
events (cash-only at the door v1; method enum is dues-only); per-registration payment-method
reporting (no column); refunds (legacy Stripe `refundEventRegistration`).

## Verification (step d)

Engine real-PG suite GREEN incl. new mark-paid tests + unchanged event/dues suites;
`bun run test:contract`. FE: officer opens a paid event's door screen → unpaid attendee shows
"Record cash payment" → confirm → row flips Paid; double-tap pays once; free event shows no action.
Gates: contract, migration-safety (no migration), br-coverage (+BR-EVT-CASH), coverage-matrix,
lint:no-skips/shallow, SDK git-diff.
