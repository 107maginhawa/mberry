# C3 — MONEY Modules Review (billing, dues, platformadmin)

Date: 2026-06-16
Scope: `services/api-ts/src/handlers/billing/`, `…/dues/`, `…/platformadmin/` plus the dues
payment handlers that actually exercise the dues repos (`…/member/duesspecialassessments/`,
`…/association:member/` settlement utils — the `dues/` dir is repos-only).

Money is integer cents throughout (`integer`/`bigint` columns). No float columns found on amounts.
The handlers are generally well-defended (prior FIX-002…008 hardening is visible). Findings below
are the residual gaps, ranked.

---

## billing/

### handleStripeWebhook.ts:163-178 — **[P1][Cross]** Webhook idempotency is best-effort, not durable; throws 500 on infra error → Stripe retries a partially-applied event
The main billing webhook dedupes by stamping `metadata.lastStripeEventId` on the **invoice** row
(e.g. `handlePaymentIntentSucceeded` L206, `handleChargeSucceeded` L414). That guard only fires if
the *same* event id was previously persisted **on that invoice**. But the status update + the
`lastStripeEventId` write happen in a single `updateOneById` with no surrounding transaction or
unique-event ledger. If the handler throws *after* a side effect but *before* the metadata write
(e.g. notification path is fine since wrapped, but a DB blip between two awaits), the catch at
L163-178 rethrows `BusinessLogicError` → non-200 → Stripe redelivers → the dedup check misses
(metadata never stamped) → **double processing**. The sibling dues webhook (`stripeWebhook.ts` +
`webhookRetryProcessor`) uses a dedicated `webhook_retry_log` table with a UNIQUE
`idempotency_key` — the billing webhook does not.

Why it matters: charge.succeeded fan-out sends customer + merchant notifications and flips invoice
to `paid`; a redelivery after a transient error re-notifies and could re-trigger downstream.

Fix: route billing events through the same durable ledger the dues path already has. Minimal:
insert the event id into a unique table *first*, short-circuit on conflict.
```ts
// at top of try block, before switch:
try {
  await db.insert(webhookRetryLogs).values({
    idempotencyKey: event.id, provider: 'stripe', eventType: event.type,
    payload: event.data.object as Record<string, unknown>,
    organizationId: event.data.object?.metadata?.orgId ?? '',
  });
} catch (e) {
  if (isUniqueViolation(e)) return ctx.json({ received: true, duplicate: true }, 200);
  throw e;
}
```

### handleStripeWebhook.ts:605-639 — **[P1][Intra]** `charge.refunded` records the refund but never reconciles `paymentStatus`/no fund/AR reversal, and stores refund amount as a decimal string
L609 `(charge.amount_refunded / 100).toFixed(2)` stores `refundAmount` as a **decimal string**
("12.34") in invoice metadata. Everywhere else amounts are integer cents. The handler comment
(L623) admits it deliberately keeps `paymentStatus: 'succeeded'` because the enum lacks a refunded
state, so a fully-refunded invoice still reports `succeeded`/`paid`. There is no reconciliation back
to any ledger. Result: a refunded invoice is indistinguishable from a paid one in any query that
keys off `paymentStatus`, and the decimal-string `refundAmount` can be silently re-parsed wrong.

Why: reporting/reconciliation reads `paymentStatus` and will overstate net revenue by the refunded
amount. Mixed cents/decimal representation invites a `parseFloat` rounding bug downstream
(refundInvoicePayment.ts:94 already does `parseFloat(refundAmount) > 0` to detect prior refunds —
brittle).

Fix: store `refundedAmountCents: charge.amount_refunded` (integer) and add a `refunded` /
`partially_refunded` payment status (or a dedicated `refundedAt`/`refundedAmount` column on the
invoice) so status queries are correct. Stop using `.toFixed(2)` for stored money.

### refundInvoicePayment.ts:88-96 — **[P1][Intra]** Double-refund guard relies on parsing a decimal string in JSONB; not atomic
L94 `if ((refundAmount && parseFloat(refundAmount) > 0) || refundStatus)` is the only thing
preventing a second refund. It (a) parses the decimal string written by the webhook/handler and
(b) is a read-then-Stripe-call-then-write with no lock. Two concurrent refund requests both read
metadata with no `refundAmount`, both call `billing.createRefund`, both write — **double refund**.

Fix: gate the refund behind an atomic conditional UPDATE (compare-and-set on a real column) before
calling Stripe, or wrap in a `SELECT … FOR UPDATE` transaction. e.g.
```ts
const claimed = await db.update(invoices)
  .set({ paymentStatus: 'refund_pending' })
  .where(and(eq(invoices.id, invoiceId), eq(invoices.paymentStatus, 'succeeded')))
  .returning();
if (claimed.length === 0) throw new ConflictError('Invoice has already been refunded');
// only now call billing.createRefund(...)
```

### payInvoice.ts:131-132 / createInvoice.ts:129 — **[P2][Intra]** Platform fee and tax hardcoded to 0
`platformAmount = 0` (payInvoice L132) and `tax = 0` (createInvoice L129) are deferred to "billing
v2". Acceptable as documented gaps, but flag: every PaymentIntent is created with
`platformFeeAmount: 0`, so the platform collects nothing on Connect charges today. Confirm this is
intended for the current pilot, not silently shipping free processing.

### createInvoice.ts:114-130 — **[P2][Intra]** No per-line-item / total amount guards (zero, negative, overflow)
`subtotal += quantity * item.unitPrice` with `quantity = item.quantity || 1`. There is no check
that `unitPrice >= 0`, that `quantity > 0`, or that `total > 0`. A negative `unitPrice` or a
zero-total invoice is creatable and later payable (payInvoice only checks status, not amount).
Stripe will reject `amount <= 0`, but the failure surfaces late and opaquely, and negative line
items could net to a positive total that misrepresents the charge.

Fix: validate each `unitPrice >= 0`, `quantity >= 1`, and reject `total <= 0` before insert
(`throw new ValidationError('Invoice total must be greater than 0')`).

### handleStripeWebhook.ts:36-39 / stripeWebhook.ts:52-56 — **[OK]** Signature verification present
Both billing and dues Stripe webhooks require `stripe-signature`, verify via
`billing.verifyWebhookSignature`, and 400 on failure. Signature value is never logged (explicit
comment L43). PayMongo adapter uses `timingSafeEqual` + hex-format guard. Good.

---

## dues/  (repos only — ZERO direct tests; logic lives in member/ + association:member/)

### dues-payments.repo.ts:232-245 / recordDuesPayment.ts:36-38 — **[P1][Intra]** Duplicate-payment guard is warn-only, not enforced
`findRecentPaymentForPerson` (5-min window) is consumed at recordDuesPayment L37-38 purely to set
`hasConcurrentWarning` in the response `meta`. Nothing blocks the second insert. Two officers (or a
double-submit) recording the same cash payment both succeed → **duplicate dues payment, duplicate
fund allocations, double membership extension**. Receipt numbers differ (atomic counter), so the
unique constraint does not catch it.

Fix: either enforce (reject within window unless an explicit `force`/`allowDuplicate` flag), or add
an idempotency key on the payment (e.g. unique on org+person+referenceNumber when present). At
minimum the manual-cash path needs an operator confirmation step that maps to a server-side guard.

### refundDuesPayment.ts:61-101 — **[P1][Intra]** Over-refund guard reads `refundedAmount` outside the transaction → read-modify-write race
`alreadyRefunded = payment.refundedAmount` is read at L61 (outside the tx opened at L80). The new
total is computed at L97 `newRefundedAmount = payment.refundedAmount + refundAmount` from that stale
read and written inside the tx. Two concurrent partial-refund requests both read
`refundedAmount = 0`, both pass `validateRefundEligibility`, both reverse fund allocations, and the
second write clobbers the first → **cumulative refunds exceed the original payment**, and fund
reversals double. The careful eligibility cap (refund-validation.ts) is defeated by the stale read.

Fix: re-read the payment *inside* the transaction with `FOR UPDATE`, or apply the increment with a
guarded atomic statement:
```ts
const [row] = await tx.update(duesPayments)
  .set({ refundedAmount: sql`${duesPayments.refundedAmount} + ${refundAmount}` })
  .where(and(
    eq(duesPayments.id, paymentId),
    sql`${duesPayments.refundedAmount} + ${refundAmount} <= ${payment.amount}`,
  ))
  .returning();
if (!row) throw new BusinessLogicError('Over-refund', 'EXCEEDS_REFUNDABLE');
// then reverse funds using row values
```

### dues-payments.repo.ts:191-217 — **[P2][Intra]** `updatePaymentStatus` is not optimistic-locked
The status transition (`assertValidTransition` + UPDATE) does not check a version/expected-current
in the WHERE clause. The transition validity is asserted against the *passed-in* `currentStatus`
(caller-supplied), not against the row at write time. Concurrent transitions (e.g. confirm vs
reject of a `submitted` proof) can both pass their local assertion and both write; last-writer-wins,
and two contradictory rows land in `duesPaymentStatusHistory`.

Fix: add `eq(duesPayments.status, currentStatus)` (and ideally version) to the UPDATE `where`, and
treat a 0-row result as a conflict.

### Fund allocation math — **[OK]** (fund-math.ts allocateFunds)
`Math.floor` on all funds except the last, last fund absorbs the remainder
(`amountCents - allocated`). Sum is conserved exactly; no cents lost or created. Reversal uses
`-Math.round(a.amount * refundRatio)` (membership-lifecycle.ts) — proportional, integer. The only
risk is the `refundRatio` `Math.round` not summing exactly to `refundAmount` across funds on a
partial refund (per-fund rounding, no last-fund remainder absorption on the reversal path). Verify
reversal sum == refundAmount; add remainder absorption on the last reversal if it can drift.

### Receipt sequence — **[OK]** getNextReceiptSequence (dues-payments.repo.ts:258-270)
Atomic upsert with `nextSequence + 1` RETURNING — race-safe, per-(org, year). Unique constraint is
per-org (FIX-003). Good.

---

## platformadmin/  (pricing tiers, subscriptions)

### createPricingTier.ts / updatePricingTier.ts — **[OK→P2][Intra]** Authz solid; create lacks duplicate-slug guard
Both require `session`, `platformAdmin`, and `requireAdminTier(SUPER_ONLY)` (L23-27) — pricing
mutations are super-admin only. Prices validated as non-negative integers (cents) at create
(L49-58). `updatePricingTier` does **not** re-validate `monthlyPrice`/`annualPrice >= 0` on the
update path (L69-70 blindly assign). A super-admin could PATCH a negative price.
- Fix: apply the same `>= 0` guard in `updatePricingTier` for `monthlyPrice`/`annualPrice`.
- `createPricingTier` inserts on `slug` with no pre-check / no unique-violation catch — a duplicate
  slug surfaces as a raw 500. Add a unique constraint + friendly `ConflictError`.

### updatePricingTier.ts:6-8,89 — **[OK]** Price-change semantics documented and inert
Price changes apply to new subscriptions only; existing subs retain price until upgrade. Handler
only writes the tier row (no retroactive re-pricing). Correct and well-noted.

---

## TESTING — dues/ is the #1 gap (0 tests)

The `dues/` repos have no co-located tests. The behavior they encode is exercised only indirectly
via `member/duesspecialassessments/*` (which *do* have some tests) and `association:member`. Each of
the 5 dues source files needs direct coverage:

1. **dues-payments.repo.ts** (`DuesRepository`)
   - `getNextReceiptSequence`: happy (first call → 1, second → 2); **concurrency** (N parallel calls
     yield N distinct sequences, no gaps/dupes); per-(org, year) isolation.
   - `createPayment` + `createFundAllocations`: fund split sums back to amount; **zero amount**
     (should be rejected upstream — assert repo doesn't silently accept 0/negative); single-fund
     and multi-fund remainder absorption.
   - `updatePaymentStatus`: valid transition logged to history; **invalid transition rejected**;
     **concurrent confirm-vs-reject** loses one (currently no lock — test should fail → drive fix).
   - `findRecentPaymentForPerson`: returns a payment inside window, none outside; **duplicate
     payment** scenario (two records in window — proves guard is warn-only).
   - Dashboard/report SQL: `getDashboardStats`/`getFullDashboardStats` collectionRate bounds 0-100;
     overpayment row (refundedAmount > 0) excluded/handled in totals.

2. **dues-payments.schema.ts** — constraint tests: per-org receipt uniqueness (same number, two
   orgs OK; same number same org → violation); amount/refundedAmount are integer columns
   (insert a float → coerced/rejected).

3. **dues.schema.ts** (`duesInvoices`) — `totalAmount` bigint integer; status enum transitions used
   by dashboard; reminder-log idempotency unique (person+schedule+period+offset) blocks duplicate
   reminder.

4. **payment-token.repo.ts** — `findByTokenHash` (hit/miss); `markUsed` flips `usedAt` once;
   **single-use**: a used/expired token must be rejected by the consumer (test the validate path);
   wrong-hash returns undefined (no token enumeration).

5. **payment-token.schema.ts** — `tokenHash` unique; `amount` integer cents; expiry default 72h;
   never stores raw token (only hash).

Edge cases to cover across the above (per brief): **zero amount** (reject), **overpayment** (amount
> invoice total — assert behavior is defined, not silently allocated), **duplicate payment** (window
guard proven non-blocking → drives P1 fix), **fund insufficient / percentages not summing to 100**
(allocateFunds with funds summing <100 or >100 — assert remainder handling and no negative last
fund).

---

## Top 3 Critical (C3)

1. **refundDuesPayment.ts:61-101 — over-refund race (read-modify-write outside tx).** Stale
   `refundedAmount` read lets concurrent partial refunds cumulatively exceed the original payment and
   double-reverse fund allocations. Fix with an atomic guarded UPDATE / `FOR UPDATE` re-read.

2. **handleStripeWebhook.ts (billing) — non-durable idempotency + 500-on-error → Stripe retry
   double-processes.** Per-invoice `lastStripeEventId` stamping is not transactional and misses on a
   pre-stamp failure, unlike the dues path's unique `webhook_retry_log` ledger. Route billing events
   through the same durable, unique-keyed ledger.

3. **dues has ZERO tests over money-mutating repos** (receipt sequence concurrency, fund allocation
   conservation, status-transition locking, duplicate-payment guard, refund caps). This is the
   highest-leverage gap: the two race bugs above are exactly what a concurrency test would have
   caught. Add the per-file suites listed under TESTING, concurrency cases first.
