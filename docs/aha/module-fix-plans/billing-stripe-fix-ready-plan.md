# AHA Fix-Ready Plan: Billing (Stripe)

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Billing (Stripe) |
| Module slug | billing-stripe |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/billing-stripe-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md` |
| Audit decision | FAIL (carried from gap plan §24: 2 P0 + 6 P1 blocking gaps) |
| Superpowers used | No (organizer ran without the Superpowers agent; reasoning was sufficient from the raw gap plan + targeted file references) |
| Organizer decision | PARTIALLY READY |
| Reason | The P0 cluster and the handler-local P1 cluster are fully evidence-backed, root-cause-classified, and safely batchable now. Several P2/V1-RECOMMENDED items are gated behind product decisions (per-org config, capture model, officer roles, default currency, dues/billing unification) or environment (stripe-mock in CI), so the module cannot reach READY in a single pass — but the high-value blockers are ready to execute immediately. |
| Limitations | Static review only — no live API/Stripe/stripe-mock execution. Runtime-dependent findings (`createInvoice` 500 on missing org context, org-UUID mis-binding, Stripe `2025-10-29.clover` refund payload shape) carry `[NEEDS CONFIRMATION]` and are kept out of the first batch. Line/file references are from the gap plan (2026-06-11) and may have drifted with active dev; the `04` fix prompt must re-locate exact lines before editing. |

## 2. Fix Strategy Summary

**Fix first:** the two P0 safety/integrity defects in their own isolated batches, because they touch the shared `core/billing.ts` service and webhook correlation logic that money-state depends on:
- P0-A: remove the plaintext Stripe secret-key log line (`core/billing.ts:93-96`) — one-line, zero behavior change, shared file.
- P0-B: replace the five `findAll()` (`limit(500)`) webhook invoice scans with an indexed `findByStripePaymentIntentId` JSONB-predicate lookup (pattern already exists at `billing.repo.ts:306-316`) + an expression index migration.

**Fix next:** the P1 handler-local cluster (Batch B) — each is independently shippable and has a named RED test: payInvoice status guard + failed-retry, voidInvoice unpaid-void, updateInvoice transactional line-item replacement, listInvoices filter self-scoping, and webhook event-ID idempotency. Webhook idempotency must not regress the platformadmin subscription handlers (which already dedupe).

**Then:** selected P2 / V1-RECOMMENDED completeness items that are NOT gated on a product decision (Batch C) — actor-field population (`authorizedAt/authorizedBy/paidBy/voidedBy`), cumulative partial-refund tracking, invoice-number race hardening, and explicit-400-on-missing-org-context (handler-level, avoiding the shared middleware). Test hardening lands as Batch D (mostly written as RED ahead of Batches A–C, then a few regression-only adds).

**What NOT to fix now:** anything gated by a product decision (per-org billing config, capture-method honoring, officer billing roles, default currency, dues/billing unification) or environment (stripe-mock contract/integration scenarios). The doc-staleness items (m21 §6/§7, API_CONTRACTS §3/§4, NAVIGATION_MAP, AC error-code names, healthcare notification copy) are cheap but are doc-only and may bundle into a low-priority later pass — they are V1 RECOMMENDED but carry no reliability risk, so they sit at the back of the queue.

**Major risks:** `core/billing.ts` is shared by dues `checkoutPaymentToken`, events `registerAndPayForEvent`, and dues jobs — any service-method change (capture method) needs cross-module regression; the secret-log removal does not. The webhook handler is a cross-module integration point (platformadmin subscriptions, booking invoice creation) — idempotency/lookup refactors must keep those green.

**One pass or multiple:** multiple batches. Batch A (P0) and Batch B (P1) can run in one `04` pass if scoped tightly, but P0 is recommended first and standalone to land the safety fix fast. Shared/platform (Batch E) and database/schema (Batch F) work is isolated.

## 3. Active Fix Scope

Only P0 / P1 / selected P2 / V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Stripe secret key logged in plaintext at SDK init | P0 | V1 REQUIRED | Batch A | Live secret exfiltratable from any log sink; violates m21 §11.4 + platform secret rules; affects every module using billing service | `core/billing.ts:93-96` (`this.logger.info({ key: this.config.secretKey, … }, 'stripe.initialize')`) `[SHARED DEPENDENCY]` |
| FIX-002 | Webhook invoice correlation capped at `findAll()` `limit(500)` + in-memory JSONB filter | P0 | V1 REQUIRED | Batch A | Past 500 invoices, `charge.succeeded` silently fails to find the invoice → money taken, invoice never marked paid, Stripe gets 200 OK | `billing.repo.ts:46-50`; `handleStripeWebhook.ts:385,491,561,712,746` |
| FIX-003 | `listInvoices` non-admin can pass `?merchant=<any-uuid>` and list another merchant's invoices | P1 | V1 REQUIRED | Batch B | Any authenticated user enumerates another merchant's invoices (amounts, customer person IDs), cross-org because org filter is fail-open | `listInvoices.ts:82-89` |
| FIX-004 | No webhook idempotency for invoice payment events (AC-M21-004) | P1 | V1 REQUIRED | Batch B | Stripe redelivery → duplicate notifications + repeated metadata overwrites/transitions; subscriptions already dedupe but invoice events do not | `handleStripeWebhook.ts:183-247,369-471`; contrast `:798-801` (`lastStripeEventId`) |
| FIX-005 | `payInvoice` never checks `invoice.status` — draft/void/uncollectible invoices are payable (BR-61) | P1 | V1 REQUIRED | Batch B | Unfinalized/terminal invoices can be charged against unsaved totals | `payInvoice.ts:61-114` (only `paymentStatus` checked at L94) |
| FIX-006 | Failed payment permanently blocks invoice (`paymentStatus !== 'pending'` → 409, no retry) | P1 | V1 REQUIRED | Batch B | Card decline → member can never pay that invoice; contradicts m21 §1 retry responsibility | `payInvoice.ts:94-96` |
| FIX-007 | `updateInvoice` recomputes totals but never persists replacement line-item rows (AC-M21-002) | P1 | V1 REQUIRED | Batch B | Invoice charged on `total` from line items that were never saved → audit/receipt mismatch, totals diverge from stored rows | `updateInvoice.ts:106-136`; TypeSpec "Replace all line items (draft only)" `billing.tsp:289-290` |
| FIX-008 | Unpaid invoices cannot be voided — `voidInvoice` requires `paymentStatus === 'requires_capture'` (SM-M21-INVOICE) | P1 | V1 REQUIRED | Batch B | No cancellation path for mistaken/duplicate open invoices → forced into mark-uncollectible misuse | `voidInvoice.ts:98-103`; m21 §7; billing.md §Invoice States |
| FIX-009 | Financial actor columns not populated: `authorizedAt/authorizedBy` (never written), `paidBy` (webhook-paid), `voidedBy` (void) | P2 | V1 RECOMMENDED | Batch C | Audit-trail gap for financial actions; void-threshold spec depends on `authorizedAt` (always null today) | `captureInvoicePayment.ts:229-230`; `voidInvoice.ts:154-159`; `handleStripeWebhook.ts:406-411` |
| FIX-010 | Partial-refund-then-refund blocked; refund cap = `invoice.total` without netting prior refunds (WF-131) | P2 | V1 RECOMMENDED | Batch C | Real-world multi-step refunds impossible; any prior refund blocks further partials | `refundInvoicePayment.ts:91-96,113-114` |
| FIX-011 | Invoice-number generation read-then-insert race + global (not per-org) numbering | P2 | V1 RECOMMENDED | Batch F | Concurrent creates collide on global unique constraint → 500s; m21 says per-org numbering | `billing.repo.ts:189-209` called at `:218-220` |
| FIX-012 | `createInvoice` 500s (notNull violation) when org context missing; `x-org-id` undocumented | P2 | V1 RECOMMENDED | Batch C | Confusing 500 instead of a clear 400; org-UUID heuristic can mis-bind from path UUIDs `[NEEDS CONFIRMATION]` | `app.ts:437-443`; `org-context.ts:165-233,182-184`; `createInvoice.ts:57` |
| FIX-013 | `charge.refunded` reads `charge.refunds.data[0]` (likely absent on API `2025-10-29.clover`) → dashboard refunds never synced | P2 | V1 RECOMMENDED | Batch C | Externally-initiated refunds not reflected locally; use `charge.amount_refunded` instead | `handleStripeWebhook.ts:573`; API version `core/billing.ts:80` `[NEEDS CONFIRMATION]` |
| FIX-014 | Test hardening: add the named RED tests that lock FIX-001..008 before fixing, plus regression coverage | P1 (test gap that makes safe fixing possible) | V1 REQUIRED | Batch D | Several existing tests encode the buggy behavior as correct (`payInvoice`, `voidInvoice`); webhook tests mock `findAll` and cannot catch P0/idempotency gaps | gap plan §20 "Before" rows; §19 confidence notes |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A | P0 core-workflow / safety blockers (secret-log removal + indexed webhook lookup) | FIX-001, FIX-002 | Medium — FIX-001 touches shared `core/billing.ts` (zero behavior change); FIX-002 swaps webhook lookup + adds a migration/index and re-mocks webhook tests | run in current `04` pass — execute FIRST |
| Batch B | P1 reliability / trust / permission gaps (handler-local) | FIX-003, FIX-004, FIX-005, FIX-006, FIX-007, FIX-008 | Medium — each handler-local and independently shippable; FIX-004 must not regress platformadmin subscription dedupe; FIX-007 needs a transactional repo method | run in current `04` pass after Batch A, or split into a second `04` pass |
| Batch C | Selected P2 V1-RECOMMENDED completeness (no product decision required) | FIX-009, FIX-010, FIX-012, FIX-013 | Low–Medium — FIX-013 needs payload-shape confirmation; FIX-012 prefers handler-level validation over shared-middleware change | split into a separate `04` pass after A+B |
| Batch D | Test hardening / regression coverage | FIX-014 (RED tests written ahead of A/B/C; regression-only adds during) | Low — tests only; some new RED tests must be authored first by the `04` prompt | tests written first within the relevant batch; standalone regression adds run during A/B/C |
| Batch E | Shared/platform dependency fix | (none isolated — FIX-001 lives in shared `core/billing.ts` but is a pure log redaction; any capture-method service change is DEFERRED behind a product decision) | — | not run yet — only if a deferred product decision later forces a `core/billing.ts` behavior change (then needs dues/events regression) |
| Batch F | Database/schema dependency fix | FIX-011 (invoice-number generation: advisory-lock/sequence + decide per-org prefix) + the expression-index migration that supports FIX-002 | Medium — schema/migration via standard db-migrate workflow; module-local tables only | run after Batch A (the FIX-002 index migration may land alongside A); FIX-011 number-gen can run with Batch C or its own pass |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Assert `stripe.initialize` log call contains no secret material (no full key) | backend/unit (regression) | The redaction holds and cannot be reintroduced | New test or extend `handlers/billing/` service-init coverage (no current `core/billing.ts` test — add `services/api-ts/src/core/billing.test.ts` or a focused regression in `handlers/billing/`) |
| FIX-002 | Repo lookup of invoice by `stripePaymentIntentId` beyond the 500-row window (and that webhook handlers use the new method, not `findAll`) | backend/unit + data/schema | The indexed lookup finds invoices at any scale; webhook correlation no longer depends on `findAll` | Extend `handlers/billing/repos/billing.repo.test.ts`; update `handleStripeWebhook.test.ts` mocks to the new method |
| FIX-003 | Non-admin with foreign `?merchant=<uuid>` → 403; foreign `?customer=` → 403 | permission/RBAC | Cross-merchant/customer enumeration is denied for non-admins | Extend `handlers/billing/accessControl.test.ts` and `listInvoices.test.ts` |
| FIX-004 | Same webhook `event.id` delivered twice → single notification + single transition | backend/unit | Idempotency: duplicate redelivery is a no-op for invoice payment events | Extend `handlers/billing/handleStripeWebhook.test.ts` |
| FIX-005 | Pay on draft/void/uncollectible invoice → 422 | backend/unit | Only `status === 'open'` invoices are payable (BR-61) | Update `handlers/billing/payInvoice.test.ts` (currently encodes missing guard as correct) |
| FIX-006 | Pay → simulate `paymentStatus='failed'` → pay again → 200 | backend/unit | Failed/canceled payments are retryable | Update `handlers/billing/payInvoice.test.ts` |
| FIX-007 | `updateInvoice` line-items → reload rows == request, totals == sum of rows | backend/unit | Line-item rows are transactionally replaced and totals match persisted rows (AC-M21-002) | Update `handlers/billing/updateInvoice.test.ts` + repo test for the new `replaceLineItems` method |
| FIX-008 | Finalize → void (no payment) → 200/void | backend/unit | Unpaid open invoices can be voided; authorized-payment void path stays intact | Update `handlers/billing/voidInvoice.test.ts` (currently asserts spec-divergent behavior) |
| FIX-009 | Assert `authorizedAt/authorizedBy` set on `payment_intent.succeeded`, `paidBy` on webhook-paid, `voidedBy` on void | backend/unit | Financial actor trail is populated consistently | Extend `handleStripeWebhook.test.ts`, `voidInvoice.test.ts`, `captureInvoicePayment.test.ts` |
| FIX-010 | Two partial refunds summing below total both succeed; refund beyond remaining → rejected | backend/unit | Cumulative refunded amount is tracked and netted against the cap | Extend `handlers/billing/refundInvoicePayment.test.ts` |
| FIX-011 | Concurrent `createInvoice` → no invoice-number unique-violation; numbers monotonic | data/schema | Number generation is collision-safe under concurrency | Extend `handlers/billing/repos/billing.repo.test.ts` |
| FIX-012 | `createInvoice` with no resolvable org context → explicit 400 (not 500) | backend/unit | Missing org context returns a clear client error | Extend `handlers/billing/createInvoice.test.ts` |
| FIX-013 | `charge.refunded` with `amount_refunded` set but `refunds.data` absent → refund recorded | backend/unit | Refund sync uses `amount_refunded`, not the refunds list | Extend `handleStripeWebhook.test.ts` |
| FIX-014 | Deterministic webhook signature-invalid → 400 contract assertion (replace `HTTP *` wildcards) | contract (Hurl) | AC-M21-003 is asserted at the contract layer, not just unit | Extend `specs/api/tests/contract/billing-extended-flow.hurl` / `billing.hurl` (note: full pay→capture→refund contract flow is `[BLOCKED BY ENVIRONMENT]` until stripe-mock) |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/core/billing.ts` (~L93-96) | shared/platform | dues `checkoutPaymentToken`, events `registerAndPayForEvent`, dues jobs — but redaction-only, no behavior change → effectively zero |
| FIX-002 | `handlers/billing/repos/billing.repo.ts` (new `findByStripePaymentIntentId`, retire/limit `findAll`), `handlers/billing/handleStripeWebhook.ts` (5 call sites), new migration in `src/generated/migrations/` (expression/GIN index) | module-local + database/schema | webhook is a cross-module integration point (platformadmin subscriptions, booking invoice creation) — keep those tests green |
| FIX-003 | `handlers/billing/listInvoices.ts` (~L79-90) | module-local | invoice list read scope only |
| FIX-004 | `handlers/billing/handleStripeWebhook.ts` (PI/charge handlers), possibly invoice metadata or a `stripe_webhook_events` table | module-local (+ database/schema if a dedupe table is added) | platformadmin subscription handlers already dedupe — do not regress |
| FIX-005 | `handlers/billing/payInvoice.ts` (~L61-114) | module-local | pay flow only |
| FIX-006 | `handlers/billing/payInvoice.ts` (~L94-96) | module-local | pay flow only |
| FIX-007 | `handlers/billing/updateInvoice.ts` (~L106-136), `handlers/billing/repos/billing.repo.ts` (new transactional `replaceLineItems`) | module-local | update flow + repo; booking imports `InvoiceRepository` → run booking tests |
| FIX-008 | `handlers/billing/voidInvoice.ts` (~L98-103, set `voidedBy`) | module-local | void flow only |
| FIX-009 | `handlers/billing/captureInvoicePayment.ts`, `voidInvoice.ts`, `handleStripeWebhook.ts` | module-local | actor-field writes only |
| FIX-010 | `handlers/billing/refundInvoicePayment.ts` (~L91-96,113-114), refund metadata/column | module-local (possibly database/schema if promoting refund amount to a column) | refund flow only |
| FIX-011 | `handlers/billing/repos/billing.repo.ts` (~L189-220), possibly a sequence migration | module-local + database/schema | invoice creation across billing + booking |
| FIX-012 | `handlers/billing/createInvoice.ts` (~L57) — prefer handler-level validation | module-local (avoid touching shared `middleware/org-context.ts`) | create flow; do NOT change shared fail-open middleware (9 route prefixes) |
| FIX-013 | `handlers/billing/handleStripeWebhook.ts` (~L573) | module-local | refund webhook branch only |
| FIX-014 | `handlers/billing/*.test.ts`, `repos/billing.repo.test.ts`, `specs/api/tests/contract/billing*.hurl` | module-local (tests) | none (tests) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform | `core/billing.ts` (BillingService) used by billing, dues `checkoutPaymentToken`, events `registerAndPayForEvent`, dues jobs (`app.ts:675`) | Edit is in a shared file; redaction-only so no consumer behavior changes — document as `[SHARED DEPENDENCY]` | No prerequisite; just label and confirm no behavior change |
| FIX-002 | database/schema | New JSONB expression/GIN index migration via standard db-migrate workflow | Indexed lookup must perform at scale; module-local table only | Index migration should land with the FIX-002 code (same batch) |
| FIX-002, FIX-004, FIX-007 | cross-module | platformadmin `subscriptions` table + `booking.repo.ts` direct `InvoiceRepository` import | Webhook/lookup/line-item refactors ripple into platformadmin subscription sync and booking invoice creation | Run platformadmin subscription tests + booking invoice tests as regression during these fixes |
| FIX-004 | shared/platform | `notifs` NotificationService called in webhook handlers (`:222-247,426-470`) | Idempotency must gate notification sends so duplicates don't double-notify | Account for during FIX-004 |
| FIX-012 | shared/platform | `middleware/org-context.ts` fail-open block (`app.ts:437-443`, 9 route prefixes) | Hardening must NOT alter shared middleware (would break booking/comms/storage) | Prefer handler-level validation; do not touch the shared middleware |
| FIX-011 | database/schema | Possible sequence/advisory-lock migration for invoice numbering | Concurrency-safe numbering may need a DB sequence; module-local table | Migration in Batch F |
| FIX-014 (stripe-mock) | environment/tooling | stripe-mock not wired into CI (pilot-tier1 TODO); `billing-extended-flow.hurl` is `HTTP *` smoke only | Real pay→capture→refund contract/integration assertions need stripe-mock or test keys | `[BLOCKED BY ENVIRONMENT]` — deterministic signature-400 assertion can land now; full payment-flow contract tests are blocked |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| V1 payment model: single platform Stripe (Connect) via env, or per-org credentials via `billing_config`? | `[NEEDS PRODUCT DECISION]` | (blocks per-org config wiring — not in active scope) | Decides whether to wire or descope orphaned `billing_config` table + encryption util + per-org webhook secret | Founder/product decides before any per-org config work; meanwhile do not expand |
| Should `paymentCaptureMethod: automatic` auto-capture, or is Hold & Decide the only V1 model? | `[NEEDS PRODUCT DECISION]` | (blocks capture-method honoring — not in active scope) | Determines payInvoice/createPaymentIntent change + dues/events regression scope | Defer capture-method change until decided |
| Should org officers (Treasurer/President) create/refund/void org billing invoices (vs only global `admin`)? | `[NEEDS PRODUCT DECISION]` | FIX-003 (role model context only — fix self-scopes regardless) | m21 §5 says officers; code requires global admin or merchant-self; affects whether `x-require-officer`/`x-require-position` extensions are added | Decide before adding officer billing roles; FIX-003 self-scoping is safe to ship without it |
| Default currency: USD (code) or PHP (m21 spec)? | `[NEEDS PRODUCT DECISION]` | (doc/config alignment — not in active scope) | Wrong default risks mis-denominated invoices in a PH association context | Founder/product decides platform default |
| Is dues-vs-billing invoice duplication intentional (two rails) or transitional? | `[NEEDS PRODUCT DECISION]` | (governs investment level — not a fix) | Determines how much to invest in billing-invoice features vs dues | Founder/product; unification is V2 at most |
| Does Stripe API `2025-10-29.clover` omit `charge.refunds.data` in webhook payloads? | `[NEEDS CONFIRMATION]` | FIX-013 | Confirms/denies the refund-sync gap before fixing | Eng verifies against Stripe docs/stripe-mock; gate FIX-013 on this |
| Does `createInvoice` actually 500 on missing org context, and can a platform-admin org context mis-bind from a path UUID? | `[NEEDS CONFIRMATION]` | FIX-012 | Confirms the runtime behavior the fix targets | Eng runtime check before FIX-012 |
| When will stripe-mock be wired into CI (pilot-tier1 TODO)? | `[BLOCKED BY ENVIRONMENT]` | FIX-014 (full payment-flow contract tests) | Gate for integration-test gaps in §20 | Eng/CI; deterministic signature-400 assertion can land now |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Per-org billing config wiring (`billing_config` table + AES-256-GCM encryption util + runtime consumer) — BR-65/AC-M21-007 | `[NEEDS PRODUCT DECISION]` | Whether the V1 model is per-org Stripe creds or a single global Connect platform account is undecided; building either way risks wrong architecture | Founder/product decides the payment model |
| Honor `paymentCaptureMethod` (automatic capture) in `createPaymentIntent` | `[NEEDS PRODUCT DECISION]` | Hardcoded `capture_method: 'manual'` may be the intended Hold & Decide-only model; changing it alters dues/events flows via the shared service | Product decides automatic-vs-Hold-and-Decide; then needs dues/events regression |
| Officer/treasurer billing roles (add `x-require-officer`/`x-require-position` to `billing.tsp`) | `[NEEDS PRODUCT DECISION]` | m21 §5 says officers manage org billing; code requires global admin or merchant-self — product intent unconfirmed | Product confirms org-officer billing scope |
| Full stripe-mock-backed pay→webhook→capture→refund contract/integration scenarios | `[BLOCKED BY ENVIRONMENT]` | stripe-mock not wired into CI; `billing-extended-flow.hurl` only does `HTTP *` smoke asserts | stripe-mock wired into CI (pilot-tier1 TODO) |
| Void-threshold protection alignment (capture-on-late-void vs reject; `authorizedAt` basis) | `[NEEDS PRODUCT DECISION]` | Spec (billing.md) and code disagree on direction; requires deciding which behavior is correct before fixing | Product/eng decides capture-on-late-void vs reject (FIX-009 sets `authorizedAt` as a prerequisite enabler) |
| Default-currency change (USD↔PHP) | `[NEEDS PRODUCT DECISION]` | Changing the default affects all callers that omit currency | Product decides default |

## 10. Deferred Items

Items not included in the active fix sequence.

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Platform fee calculation (`platformAmount = 0`) | §9, §23 | ~~V2 DEFERRED~~ → **RESOLVED — not a gap (2026-06-13, CONTINUE-49)** | Founder locked the revenue model: platform revenue = **tiered SaaS subscription** (org pays platform), member dues = **per-org direct charges with NO skim**. `platformAmount = 0` is therefore **correct by design**, and the prior `[BLOCKED BY MISSING SPEC]` fee-policy block is moot for V1 (it was the skim model the founder did not choose). Platform subscription billing BUILT — see row below + `billing-stripe-fix-report.md` § "Platform Subscription Billing — re-scoped task 7 build (2026-06-13, CONTINUE-49)". |
| Tax calculation by jurisdiction | §9, §23 | V2 DEFERRED | Explicitly deferred (`createInvoice.ts:129`); m21 delegates to Stripe |
| Recurring invoices / subscription billing for member dues | §9, §23 | V2 DEFERRED | m21 §1 out-of-scope; platformadmin subscriptions cover platform revenue |
| **Platform subscription billing (org → pricing tier)** | §9, §23 | **✅ DONE (2026-06-13, CONTINUE-49)** | `createSubscription` handler + member-count→tier validation (`tier-fit.ts`) + Stripe-stubbed `provisionStripeSubscription` + `invoice.payment_failed`→`past_due` webhook transition. TypeSpec-modeled, SDK hook regenerated. 698 platformadmin+billing tests green; tsc clean ×5. Stub-only Stripe call; live = `[BLOCKED BY ENVIRONMENT]`. |
| Invoice management UI in memberry/admin (member view/pay invoices) | §9, §12, §16 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | No persona currently needs it; dues `/pay/$token` UI covers member finance |
| Unifying dues invoices with billing invoices | §3, §16, §21, §23 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` `[DO NOT OVERBUILD]` | Real duplication, but unification is a re-architecture, not a gap fix |
| Per-org Stripe credential management UI + key-rotation flows | §9, §23 | V2 DEFERRED | Build only after the global-vs-per-org decision |
| m21 domain-event emission (InvoicePaid/InvoiceRefunded/PaymentFailed/MerchantOnboarded) | §5, §8, §10 | V2 DEFERRED `[NEEDS PRODUCT DECISION]` | Downstream M06/M07/M03 contracts are aspirational; emit or descope in spec is a product call, not a reliability blocker |
| Doc refresh: m21 §6/§7 data model, API_CONTRACTS §3/§4, NAVIGATION_MAP route count | §5 (P3), §17 | V1 RECOMMENDED (deferred to a later doc-only pass) | Cheap and high confusion-reduction but doc-only, zero reliability risk — sits at back of queue |
| AC error-code name alignment (`MERCHANT_NOT_CONFIGURED`, `INVALID_REFUND_STATE`) | §5 (P3), §14 | V1 RECOMMENDED (deferred) | Cosmetic/contract-text alignment; pick one source of truth |
| Re-word healthcare-template notification copy ("patient/provider/held until service completed") | §15 (P3), §17 | V1 RECOMMENDED (deferred) | Member-facing trust polish; cosmetic batch |
| `invoice_line_item.organizationId` nullable while parent notNull | §13 (P3) | V2 DEFERRED `[DO NOT OVERBUILD]` | Backfill + tighten when convenient |
| Amounts `integer` cents (not bigint per m21 §6) | §13 (P3) | DO NOT ADD (note in spec) | Acceptable for PHP dues scale |
| Refund state in metadata JSONB as decimal string | §13 (P2) | V1 RECOMMENDED (folds into FIX-010 if a column is added) | Money-as-string is fragile; promote during FIX-010 only if needed, else defer |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Webhook dead-letter queue / replay tooling | §13, §23 | Stripe's retry + structured logs suffice for V1 `[DO NOT OVERBUILD]` |
| Multi-currency conversion | §23 | billing.md lists as future; no V1 evidence |
| Generic payment-gateway abstraction layer (Stripe+PayMongo polymorphism) in billing module | §6, §23 | PayMongo lives in the dues flow; premature abstraction `[DO NOT OVERBUILD]` |
| Org-owned (vs person-owned) merchant account model | §17, §23 | Domain mismatch noted but speculative remodel with no driving workflow `[DO NOT OVERBUILD]` |
| Expanding subscription/transfer webhook handlers | §6, §26 | Cross-module (platformadmin) logic that already works + dedupes; do not expand until a payout-reconciliation requirement exists |
| Removing/expanding PayMongo enum or `getPaymentIntent` service method | §6, §12 | Possibly consumed by other modules' flows; do not touch without confirming consumers `[DO NOT OVERBUILD]` |
| Relocating marketplace/advertising AC tests out of the billing dir | §6, §19 | Test-placement confusion only; at most a later cleanup pass, not a V1 fix |
| Append-only refund-attempt history table | §15 (P3) | Audit events already capture each refund; acceptable for V1 `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Secret deliberately included in the structured log object; remove the field — no downstream logic depends on it |
| FIX-002 | Root cause | Webhook correlation relies on an unindexed paginated `findAll(limit 500)` + in-memory filter; the real fix is an indexed predicate lookup (`findByStripePaymentIntentId`), not raising the limit |
| FIX-003 | Root cause | Filter-scoping guard only fires when `filters.customer` is set; merchant-only queries are left unscoped — fix the authorization branch, not a per-symptom patch |
| FIX-004 | Root cause | Invoice payment events lack the `lastStripeEventId`-style dedupe the subscription path already has; add the same dedupe pattern (no symptom workaround) |
| FIX-005 | Root cause | `payInvoice` only inspects `paymentStatus`, never `status`; add the missing state-machine guard |
| FIX-006 | Root cause | Retry blocked because any non-`pending` payment state 409s; widen the allowed re-pay states (failed/canceled) at the source |
| FIX-007 | Root cause | Update path computes new totals but omits the line-item row replacement; add transactional `replaceLineItems` — totals divergence is the symptom |
| FIX-008 | Root cause | Void requires `requires_capture`, omitting the no-payment branch; add the Draft/Open→Void transition |
| FIX-009 | Root cause | Actor columns simply never written; populate at the correct lifecycle points |
| FIX-010 | Root cause | Refund guard treats any prior refund as terminal and caps at full total without netting; track cumulative refunded amount |
| FIX-011 | Root cause | Read-then-insert outside a serializable boundary races on a global unique constraint; replace with sequence/advisory-lock generation |
| FIX-012 | Unclear (`[NEEDS CONFIRMATION]`) | Likely root cause is fail-open org middleware surfacing as a notNull 500; confirm runtime behavior, then add handler-level 400 validation (do not patch shared middleware) |
| FIX-013 | Unclear (`[NEEDS CONFIRMATION]`) | If the API version omits `refunds.data`, reading `amount_refunded` is the root-cause fix; confirm payload shape first |
| FIX-014 | Root cause (test integrity) | Existing tests encode buggy behavior as correct; rewriting them RED-first prevents fake-green and locks each fix |

## 13. Recommended First Fix Batch

**Batch name:** Batch A — P0 core-workflow / safety blockers

**Included Fix IDs:** FIX-001 (remove plaintext Stripe secret-key log), FIX-002 (indexed `findByStripePaymentIntentId` webhook lookup + expression-index migration, replacing all 5 `findAll()` scans).

**Why this batch comes first:**
- FIX-001 is a one-line, zero-behavior-change redaction of a live credential leaking into every log sink — highest safety value, lowest risk, ship immediately.
- FIX-002 fixes silent financial-integrity loss (invoices >500 never marked paid while money is captured and Stripe receives 200 OK). It is the most dangerous correctness bug and a prerequisite for trusting any downstream webhook behavior (including the Batch B idempotency fix). The lookup pattern already exists in the repo (`billing.repo.ts:306-316`), so the fix is mechanical + a migration.

**Tests to write first (RED, before code):**
- FIX-001: assert `stripe.initialize` log call carries no secret material (regression guard).
- FIX-002: repo lookup by `stripePaymentIntentId` beyond the 500-row window in `repos/billing.repo.test.ts`; update `handleStripeWebhook.test.ts` mocks to the new method so the 500-scan can no longer pass.

**Explicit out-of-scope for Batch A:**
- All Batch B P1 handler fixes (FIX-003..008) — separate batch.
- All product-decision-gated work: per-org billing config, capture-method honoring, officer billing roles, default currency, dues/billing unification, domain-event emission.
- All environment-gated work: full stripe-mock pay→capture→refund contract/integration tests.
- All deferred doc/cosmetic items (m21 spec refresh, AC error-code names, notification copy).
- Do NOT expand subscription/transfer webhook handlers, PayMongo enum, `getPaymentIntent`, or touch the shared `middleware/org-context.ts` fail-open block.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Billing (Stripe)
- **Exact module slug:** billing-stripe
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md`
- **Raw gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/billing-stripe-gap-plan.md`
- **Exact batch to execute first:** Batch A — P0 core-workflow / safety blockers (FIX-001, FIX-002). Do only this batch; do not roll into Batch B in the same pass unless explicitly instructed.
- **Tests to prioritize (write RED first):**
  - FIX-001: regression assertion that `stripe.initialize` logs no secret material.
  - FIX-002: `repos/billing.repo.test.ts` lookup by `stripePaymentIntentId` beyond the 500-row window; update `handleStripeWebhook.test.ts` mocks to the new repo method.
- **Files likely to touch (re-locate exact lines first — references are from 2026-06-11 and may have drifted):**
  - `services/api-ts/src/core/billing.ts` (~L93-96) — shared file, redaction only.
  - `services/api-ts/src/handlers/billing/repos/billing.repo.ts` (add `findByStripePaymentIntentId`, retire/limit `findAll`; pattern at ~L306-316).
  - `services/api-ts/src/handlers/billing/handleStripeWebhook.ts` (5 call sites: ~L385, L491, L561, L712, L746).
  - New migration in `services/api-ts/src/generated/migrations/` for the JSONB expression/GIN index (via `bun run db:generate` — never hand-edit generated migrations).
- **Shared/database cautions:**
  - `core/billing.ts` is shared by dues `checkoutPaymentToken`, events `registerAndPayForEvent`, and dues jobs (`app.ts:675`). FIX-001 is redaction-only (no behavior change) — confirm no consumer depends on the logged field. Do NOT make any capture-method or other behavior change to this service in Batch A.
  - The webhook handler is a cross-module integration point (platformadmin `subscriptions` table; `booking.repo.ts` imports `InvoiceRepository` directly). Run platformadmin subscription tests and booking invoice-creation tests as regression after FIX-002.
  - Generate the index migration through the standard db-migrate workflow; module-local `invoice` table only.
- **Items NOT to implement in this pass:**
  - Any Batch B/C/F fix (FIX-003..013) — later batches.
  - Per-org billing config, automatic capture honoring, officer billing roles, default-currency change, dues/billing unification, domain-event emission (all `[NEEDS PRODUCT DECISION]`).
  - Full stripe-mock contract/integration scenarios (`[BLOCKED BY ENVIRONMENT]`).
  - Do-Not-Build items: webhook DLQ/replay, multi-currency conversion, gateway abstraction, org-owned merchant model, expanding subscription/transfer/PayMongo/`getPaymentIntent`.
  - Do NOT touch the shared `middleware/org-context.ts` fail-open block.

---

Next recommended step:
Module/group: Billing (Stripe)
Module slug: billing-stripe
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/billing-stripe-fix-ready-plan.md
Recommended batch: Batch A — P0 core-workflow / safety blockers (FIX-001, FIX-002)
