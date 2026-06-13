# AHA Module/Group Gap Plan: Billing (Stripe)

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Billing (Stripe) |
| Module slug | billing-stripe |
| Type | API/Integration Group (Stripe Connect payment rail) |
| Output file | `docs/aha/module-gap-plans/billing-stripe-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m21-billing/MODULE_SPEC.md` (v1.1, 2026-06-02) |
| Supporting PRDs/specs used | `specs/api/src/modules/billing.md`; `docs/product/modules/m21-billing/API_CONTRACTS.md`; `docs/product/modules/m21-billing/NAVIGATION_MAP.md`; `specs/api/src/modules/billing.tsp`; `docs/product/WORKFLOW_MAP.md` §WF-128..133; `docs/ver-3/business/br-registry.json` (BR-60..BR-66) |
| PRD/spec coverage quality | Partial — strong anchor coverage (BR/WF/AC/SM IDs all exist), but m21 MODULE_SPEC §6 data model and §7 invoice state machine are **stale vs. implementation**, and it conflicts with `specs/api/src/modules/billing.md` (which matches the code) |
| Paths inspected | `services/api-ts/src/handlers/billing/` (16 handlers + 23 test files), `services/api-ts/src/handlers/billing/repos/` (schema + repo + 2 repo tests), `services/api-ts/src/core/billing.ts`, `services/api-ts/src/core/billing-types.ts` (referenced), `services/api-ts/src/app.ts` (middleware wiring L437-443), `services/api-ts/src/generated/openapi/routes.ts` (billing block L2350-2500), `services/api-ts/src/middleware/org-context.ts`, `services/api-ts/src/core/domain-event-consumers.ts`, `services/api-ts/src/seed/layer-4-cross-module.ts`, `apps/memberry/src/routes/_authenticated/my/billing.tsx`, `apps/memberry/src/features/billing/components/merchant-account-setup.tsx`, `apps/memberry/src/routes/pay/$token.tsx`, `apps/memberry/tests/e2e/billing.spec.ts`, `packages/sdk-ts/src/flows/billing-onboarding.ts`, `specs/api/tests/contract/billing*.hurl` (3 files) |
| PRDs/specs inspected | m21 MODULE_SPEC, m21 API_CONTRACTS, m21 NAVIGATION_MAP, `specs/api/src/modules/billing.md`, billing.tsp, WORKFLOW_MAP §1.23, br-registry BR-60..66 |
| KG used | Yes (status notes only — `docs/aha/kg/knowledge-graph-status.md`; KG partially stale, so direct code inspection was primary per the KG status decision) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes; product docs used as primary domain reference per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No |
| Playwright/E2E inspected | Yes (inspected `apps/memberry/tests/e2e/billing.spec.ts` — not executed) |
| Existing tests inspected | 23 unit test files in `handlers/billing/` (~206 tests incl. repo tests), 3 Hurl contract files, 1 E2E spec, SDK flow tests |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | Static review sufficient; browser tooling skipped for batch run. No live API/Stripe/stripe-mock execution. Findings depending on runtime behavior are marked `[NEEDS CONFIRMATION]`. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M21 Module Spec | `docs/product/modules/m21-billing/MODULE_SPEC.md` | MODULE_SPEC (OLI Phase B) | Partially stale | Canonical BR/WF/AC/SM anchors; but §6 entities (Invoice with `personId`, `sentAt`, statuses `sent/refunded/partially_refunded`; BillingConfig with `stripePublishableKey` column; MerchantAccount with `status` enum column) do not match the implemented schema |
| Billing module doc | `specs/api/src/modules/billing.md` | API/architecture spec | Current | Matches implementation best: customer/merchant person model, `context` idempotency, statuses draft/open/paid/void/uncollectible, Hold & Decide capture, void-threshold protection |
| M21 API Contracts | `docs/product/modules/m21-billing/API_CONTRACTS.md` | API contract scaffold | Mostly current | Endpoint inventory accurate; §3 "Domain Events Published" and §4 "Consumed" describe events that are **not implemented** (audit-grade stub, but reads as fact) |
| M21 Navigation Map | `docs/product/modules/m21-billing/NAVIGATION_MAP.md` | UI route map | Stale | Declares `route-count: 0` / NO-UI, but `apps/memberry/src/routes/_authenticated/my/billing.tsx` exists and is E2E-tested |
| TypeSpec billing module | `specs/api/src/modules/billing.tsp` | API source of truth | Current | 16 operations across 3 interfaces; generated into routes/validators |
| Workflow map | `docs/product/WORKFLOW_MAP.md` L254-259 | Workflow registry | Current | WF-128..133 registered |
| BR registry | `docs/ver-3/business/br-registry.json` | Business rules | Current | BR-60..BR-66 all present |

## 3. Expected vs Actual

Expected (per m21 spec + billing.md): Stripe Connect payment rail — merchant onboarding (person-owned Connect Express accounts), invoice lifecycle draft→open→paid with void/uncollectible/refund paths, line-item integrity, payment via Stripe Checkout/PaymentIntent with Hold & Decide manual capture, signature-verified idempotent webhooks, per-org encrypted gateway credentials, domain events for downstream modules.

Actual: 16 TypeSpec-generated handlers exist and cover the full endpoint surface. Merchant onboarding (create → onboard → dashboard, `me` alias) is implemented and is the only billing surface wired to a frontend (`/my/billing` in memberry, via `startBillingOnboarding` SDK flow). Invoice CRUD + finalize/void/uncollectible/pay/capture/refund are implemented with draft-only edit guards and customer/merchant ownership checks. Webhook handler verifies signatures (global `STRIPE_WEBHOOK_SECRET` only) and dispatches 15 event types, including platformadmin subscription sync.

Material divergences:
- The Stripe **secret key is logged in plaintext** at SDK init (`core/billing.ts:93-96`).
- Webhook→invoice correlation uses `InvoiceRepository.findAll()` (hard `limit(500)`) with in-memory JSONB filtering — payment confirmation silently stops working past 500 invoices.
- No idempotency for invoice payment webhook events (subscription events have `lastStripeEventId`; invoice events do not), violating AC-M21-004.
- `payInvoice` never checks `invoice.status` (draft/void/uncollectible invoices are payable) and permanently blocks retry after a failed payment (`paymentStatus !== 'pending'` → 409).
- `updateInvoice` recomputes totals from replacement line items but **never persists the new line-item rows** — stored line items and invoice totals diverge (AC-M21-002 broken on update).
- `voidInvoice` only works when `paymentStatus === 'requires_capture'` — the spec'd Draft→Void / Open→Void (pre-payment cancellation) transition is unreachable via API.
- Per-org billing config (`billing_config` table, BR-65/AC-M21-007) is dead: only the seed writes it, no handler encrypts/reads it, `BillingService` uses env credentials exclusively.
- `paymentCaptureMethod` is stored but ignored — `createPaymentIntent` hardcodes `capture_method: 'manual'`, so "automatic" invoices still require an explicit capture call.
- m21 §9 domain events (InvoicePaid, InvoiceRefunded, MerchantOnboarded, PaymentFailed) are not emitted anywhere (`grep domainEvents handlers/billing/` → none).
- Dues (M06) does **not** use billing invoices — it has its own `DuesInvoiceRepository` (`handlers/association:member/repos/dues.repo`), contradicting m21 §1 "Provides the payment rail that other modules (M06 Dues…) use". Booking creates billing invoices directly via repo import. [CROSS-MODULE RISK]

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-128 Onboard Merchant (BR-60) | Create Connect account, onboarding link, status round-trip | Implemented: create/onboard/dashboard handlers, `account.updated` webhook sync | `/my/billing` route + `MerchantAccountSetup` | `createMerchantAccount.ts`, `onboardMerchantAccount.ts`, `getMerchantDashboard.ts`, `handleStripeWebhook.ts:612-662` | `merchant_account` table | `createMerchantAccount.test.ts`, `onboardMerchantAccount.test.ts`, webhook account.updated tests, `billing-lifecycle.hurl` L31-68, `billing.spec.ts` E2E | Implemented | Minor (status in metadata JSONB, not enum per m21 §6) |
| WF-129 Create Invoice (BR-66, M21-R7, AC-M21-002) | Server-computed totals from line items | Implemented on create; **broken on update** (totals recomputed, line-item rows not replaced) | None (no invoice UI) | `createInvoice.ts:114-131`, `updateInvoice.ts:106-136` | `invoice`, `invoice_line_item` | `createInvoice.test.ts` (14), `updateInvoice.test.ts` (3) | Partially Implemented | Yes — P1 |
| WF-130 Pay Invoice (BR-60, BR-61, AC-M21-001) | Recipient pays; merchant required; double-payment blocked; failed payments retryable (m21 §1 "retry failed payments") | PaymentIntent/Checkout created; merchant-onboarding gate present; **invoice.status never checked; failed payment → permanent 409** | `/pay/$token` page is dues-module flow, not billing invoices | `payInvoice.ts:89-114` (no status guard; L94 blocks retry) | `invoice.payment_status` | `payInvoice.test.ts` (24), `billing-lifecycle.hurl` L135-141 (422 without merchant) | Partially Implemented | Yes — P1 ×2 |
| WF-131 Refund (BR-64, AC-M21-005) | Refund only captured payments; full or partial | Implemented with `paymentStatus === 'succeeded'` guard; **any prior refund blocks further partial refunds**; cap doesn't net prior refunds | None | `refundInvoicePayment.ts:80-117` | refund data in `invoice.metadata` JSONB only | `refundInvoicePayment.test.ts` (3) | Partially Implemented | Yes — P2 |
| WF-132 Webhook (BR-62, BR-63, AC-M21-003, AC-M21-004) | Signature verified; invalid → 400; idempotent processing | Signature verified (400 on failure) ✓; **no idempotency for invoice payment events**; invoice lookup capped at 500 rows | n/a | `handleStripeWebhook.ts:35-53` (sig), `:385,491,561,712,746` (`findAll()` scans), `billing.repo.ts:48-50` (`limit(500)`) | — | `handleStripeWebhook.test.ts` (30; no duplicate-event test) | Partially Implemented | Yes — P0 + P1 |
| WF-133 View Invoices | Role-filtered list/get | Implemented; **non-admin can list any merchant's invoices via `?merchant=` filter** | None | `listInvoices.ts:79-90`, `getInvoice.ts:60` | org/customer/merchant indexes | `listInvoices.test.ts` (5), `accessControl.test.ts` (7) | Partially Implemented | Yes — P1 |
| M21-R2/BR-61 terminal-state guard | `paid`/`void` invoices reject payment/edit | Edit/delete draft-only ✓; finalize draft-only ✓; pay has **no** status guard | n/a | `finalizeInvoice.ts:67-73`, `updateInvoice.ts:74`, `deleteInvoice.ts:67`, `payInvoice.ts` (absent) | enum `invoice_status` | `lifecycle.test.ts` (7) | Partially Implemented | Yes — P1 |
| M21-R6/BR-65/AC-M21-007 encrypted per-org keys | Org Stripe creds AES-256 encrypted at rest, used at runtime | Table + repo exist; no write/encrypt handler; no runtime consumer; `BillingService` uses `STRIPE_SECRET_KEY` env only; **secret key logged in plaintext at init** | None | `core/billing.ts:64-97` (env + key logging), `billing.repo.ts:385-440` (unused repo), seed `layer-4-cross-module.ts:315-325` (placeholder ciphertext) | `billing_config` table | `billing-config.repo.test.ts` (7, repo-only) | Partially Implemented | Yes — P0 (logging) + P2 (unwired config) |
| AC-M21-006 onboarding round-trip emits MerchantOnboarded | status pending→active + event | Status synced via `account.updated` webhook into metadata; **no event emitted** | `/my/billing` polls status | `handleStripeWebhook.ts:612-662` | metadata JSONB | webhook account.updated tests | Partially Implemented | Yes — P2 |
| m21 §9 Domain Events (InvoicePaid/InvoiceRefunded/PaymentFailed/MerchantOnboarded) | Events emitted for M06/M07/M03 | Not emitted; direct `notificationService` calls in webhook substitute for M07 only | n/a | no `domainEvents` usage in `handlers/billing/` | — | — | Missing | Yes — P2 |
| m21 §7 SM-M21-INVOICE Draft/Sent→Void | Pre-payment cancellation | `voidInvoice` requires `paymentStatus === 'requires_capture'` → unpaid invoices cannot be voided | n/a | `voidInvoice.ts:98-103` | — | `voidInvoice.test.ts` (11, tests current behavior) | Missing (transition) | Yes — P1 |
| billing.md §Void Threshold Protection | Void within threshold after auth → auto-capture then void | Inverted: void rejected if `minutesSincePaid > threshold`; no auto-capture; uses `paidAt` not `authorizedAt` | n/a | `voidInvoice.ts:76-85` | `void_threshold_minutes`, `authorized_at` | partial in `voidInvoice.test.ts` | Partially Implemented | Yes — P2 |
| billing.md §Automatic Capture | `automatic` invoices captured immediately on pay | `capture_method: 'manual'` hardcoded for all payments | n/a | `core/billing.ts:257,287`; `payInvoice.ts` ignores `paymentCaptureMethod` | `payment_capture_method` column stored | none | Missing | Yes — P2 `[NEEDS PRODUCT DECISION]` |
| billing.md §Context idempotency | One invoice per business context | Implemented (pre-check + DB unique) | n/a | `createInvoice.ts:106-112` | `invoices_context_unique` | `createInvoice.test.ts` | Implemented | No |
| m21 §6 invoice statuses `sent/refunded/partially_refunded` | per m21 data model | Schema uses Stripe-aligned `open/uncollectible`; refunds tracked in metadata | n/a | `billing.schema.ts:23-29` | enum | — | Unclear (spec conflict — billing.md wins) | Doc fix |
| m21 §6 "invoiceNumber unique per org" | Per-org numbering | Global unique + race-prone generator (non-tx read-then-insert) | n/a | `billing.repo.ts:189-209,218-220` | `invoices_invoice_number_unique` (global) | `billing.repo.test.ts` | Partially Implemented | Yes — P2 |
| Multi-tenant scoping (m21 §11.7) | All queries scope by organizationId | `organizationId` notNull on tables; org context is **fail-open optional** (`app.ts:437-443`); `getInvoice` has no org filter; create 500s without `x-org-id` `[NEEDS CONFIRMATION]` | n/a | `app.ts:437`, `org-context.ts:165-233`, `createInvoice.ts:57` | notNull columns | `cross-org-isolation.spec.ts` (E2E, app-level) | Partially Implemented | Yes — P2 |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Secrets never logged (m21 §11.4; CLAUDE.md PII rules) | Full Stripe secret key logged at SDK init | P0 | V1 REQUIRED | `core/billing.ts:93-96` — `this.logger.info({ key: this.config.secretKey, stripeOptions }, 'stripe.initialize')` `[SHARED DEPENDENCY]` (core file, also used by dues/events flows) | Remove `key` field from the log line (log only key prefix/mode if needed) |
| BR-63 webhook marks invoices paid reliably | `findAll()` capped at `limit(500)` + in-memory JSONB filter for charge.succeeded/failed/refunded + transfer events — payment confirmation silently lost past 500 invoices | P0 | V1 REQUIRED | `billing.repo.ts:48-50`; `handleStripeWebhook.ts:385-390,491-496,561-566,712-717,746-751` | Add repo method `findByStripePaymentIntentId` using JSONB SQL predicate (pattern already exists: `merchantAccounts.metadata->>'stripeAccountId'` at `billing.repo.ts:306-316`) + GIN/expression index |
| WF-133 role-filtered listing | Non-admin can pass `?merchant=<any-uuid>` (no `customer` filter) and list another person's invoices — guard only fires when `filters.customer` is set; cross-org because org filter is fail-open | P1 | V1 REQUIRED | `listInvoices.ts:82-89` — `if (filters.customer && …)` then `if (!filters.customer && !filters.merchant)` leaves merchant-only queries unscoped | Deny or self-scope `merchant`/`customer` filters that aren't `user.id` for non-admins |
| AC-M21-004 idempotent webhooks | No event-ID dedupe for invoice payment events → duplicate notifications and repeated transitions on Stripe redelivery | P1 | V1 REQUIRED | `handleStripeWebhook.ts:183-247,369-471` (no `event.id` check); contrast subscriptions `:798-801` (`lastStripeEventId`) | Persist processed `event.id` (invoice metadata or webhook-events table) and skip duplicates |
| BR-61/M21-R2 on pay | `payInvoice` never checks `invoice.status` — draft, void, uncollectible invoices accept payment | P1 | V1 REQUIRED | `payInvoice.ts:61-114` (only `paymentStatus` checked at L94) | Require `status === 'open'` before creating PaymentIntent |
| m21 §1 "retry failed payments" | `paymentStatus === 'failed'` → 409 "Payment already exists" — failed payment permanently blocks the invoice | P1 | V1 REQUIRED | `payInvoice.ts:94-96` | Allow re-pay when `paymentStatus` ∈ {failed, canceled} |
| AC-M21-002 on update | `updateInvoice` recomputes subtotal/total from request line items but never deletes/inserts line-item rows → invoice totals diverge from stored line items | P1 | V1 REQUIRED | `updateInvoice.ts:106-136` (only `updateData.subtotal/tax/total` set); TypeSpec promise "Replace all line items (draft only)" `billing.tsp:289-290` | Replace line items transactionally alongside totals |
| SM-M21-INVOICE Draft/Open→Void | Unpaid invoices cannot be voided (handler demands `requires_capture` payment) — officers cannot cancel a mistaken open invoice | P1 | V1 REQUIRED | `voidInvoice.ts:98-103`; m21 §7; billing.md §Invoice States ("Void: cancelled before payment") | Branch: no payment → straight status void; authorized payment → cancel PI then void |
| BR-65/AC-M21-007 per-org encrypted creds | `billing_config` table is write-orphaned (seed only), never read at runtime; no encryption code exists; platform uses single global Stripe account via env | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `core/billing.ts:64-74` (env only); `grep BillingConfigRepository` → only repo file; seed `layer-4-cross-module.ts:315-325` | Decide: (a) per-org Stripe needed for V1 multi-association → wire config + AES-256-GCM util; (b) global Connect platform account is the model → update m21 spec and drop/repurpose table |
| billing.md §Automatic Capture | `paymentCaptureMethod` stored but ignored; all payments authorized-only (`capture_method: 'manual'` hardcoded) | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `core/billing.ts:257,287`; `billing.schema.ts:85` | Pass invoice's capture method through `createPaymentIntent`, or document Hold & Decide as the only model |
| billing.md §Void Threshold Protection | Spec: void within threshold after authorization → capture then void. Code: reject void after threshold since `paidAt`; no capture-on-void path; wrong timestamp basis | P2 | V1 RECOMMENDED | `voidInvoice.ts:76-85` vs `specs/api/src/modules/billing.md:149-157` | Align implementation or spec; use `authorizedAt` |
| WF-131 partial refunds | Any recorded refund (`refundStatus`/`refundAmount` in metadata) blocks all further refunds; cap = `invoice.total` without netting prior refunds | P2 | V1 RECOMMENDED | `refundInvoicePayment.ts:91-96,113-114` | Track cumulative refunded amount; allow until total reached |
| BR-63 external refunds sync | `charge.refunded` handler reads `charge.refunds.data[0]` — on API version `2025-10-29.clover` the refunds list is not included by default → dashboard-initiated refunds never recorded `[NEEDS CONFIRMATION]` | P2 | V1 RECOMMENDED | `handleStripeWebhook.ts:573`; API version at `core/billing.ts:80` | Use `charge.amount_refunded` (present) instead of refunds list |
| m21 §6 invoice numbering | `generateInvoiceNumber` read-then-insert race (reads via `this.db` even inside tx) → concurrent creates collide on global unique constraint; numbering is global, spec says per-org | P2 | V1 RECOMMENDED | `billing.repo.ts:189-209` called at `:218-220` | Sequence/advisory-lock based generation; decide per-org prefix |
| m21 §11.7 multi-tenant | `organizationId` resolved by fail-open optional middleware; absent header/body → insert violates notNull → 500; header not in TypeSpec contract `[NEEDS CONFIRMATION]` | P2 | V1 RECOMMENDED | `app.ts:437-443`; `org-context.ts:165-233`; `createInvoice.ts:57`; note: path-UUID heuristic at `org-context.ts:182-184` treats the invoice UUID as candidate orgId | Validate org context in create handlers → 400 with clear error; document `x-org-id` |
| m21 §9 / API_CONTRACTS §3 domain events | InvoicePaid/InvoiceRefunded/PaymentFailed/MerchantOnboarded not emitted | P2 | V1 RECOMMENDED | no `domainEvents` in `handlers/billing/`; `core/domain-event-consumers.ts` has no billing-emitted events | Emit on paid/refund/failed/onboarded transitions; or mark §3 as aspirational |
| AC-M21-001/005 error codes | `MERCHANT_NOT_CONFIGURED` → actual 404/`PROVIDER_BILLING_INCOMPLETE`; `INVALID_REFUND_STATE` → actual `PAYMENT_NOT_CAPTURED` | P3 | V1 RECOMMENDED | `payInvoice.ts:100-114`; `refundInvoicePayment.ts:80-85` vs m21 §11b | Align AC text or error codes (pick one source of truth) |
| m21 §6 data model & §7 statuses | Spec entities/statuses don't match schema (`sent/refunded/partially_refunded`, `stripePaymentIntentId` column, BillingConfig publishable-key column, MerchantAccount status enum) | P3 | V1 RECOMMENDED | `billing.schema.ts:23-29,46-161,203-238` vs m21 §6-§7 | Refresh m21 spec from code (doc-only fix) |
| NAVIGATION_MAP m21 | Says `route-count: 0` / NO-UI; `/my/billing` route exists and is E2E-tested | P3 | V1 RECOMMENDED | `NAVIGATION_MAP.md` vs `apps/memberry/src/routes/_authenticated/my/billing.tsx` | Regenerate navigation map |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Subscription lifecycle webhook handlers (customer.subscription.updated/deleted, invoice.payment_succeeded/failed → platformadmin `subscriptions` table) | `handleStripeWebhook.ts:121-136,772-985`; imports `platformadmin/repos/platform-admin.schema` | Anchored to UJ-M03 (platformadmin), not m21 | Cross-module logic living inside billing's webhook handler; billing audit events fire for platformadmin mutations | Keep but clarify `[CROSS-MODULE RISK]` — document ownership in m21 API_CONTRACTS; these handlers DO have idempotency (good reference pattern) |
| `transfer.created` / `transfer.failed` handlers (log-only) | `handleStripeWebhook.ts:704-770` | Not in m21 spec | Uses the same `findAll()` 500-row scan; transfer.failed only logs "requires manual review" with no surfacing | Keep but clarify; do not expand until a payout-reconciliation requirement exists |
| PayMongo provider enum in billing_config | `billing.schema.ts:198-201` (`gateway_provider`: stripe, paymongo) | No PRD reference in m21 | Dead enum value; PayMongo integration lives in dues `pay/` flow | `[NEEDS CONFIRMATION]` — keep if dues gateway converges here, else do not expand |
| `getPaymentIntent` service method | `core/billing.ts:495-537` | No handler/endpoint calls it (billing module) | Dead-ish code | Keep (used by other modules' flows) `[NEEDS CONFIRMATION]`; do not expand |
| Marketplace/advertising AC tests inside billing dir | `handlers/billing/ac-m16.advertising.test.ts`, `ac-m17.marketplace.test.ts`, `br-38.marketplace-disclosure.test.ts` | m16/m17 specs, not m21 | Test-placement confusion only | Keep but clarify (move during a cleanup pass; not a V1 blocker) |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Merchant onboarding (WF-128) | Member/officer who charges for services | User opens `/my/billing` | create account → Stripe Express link → return → status sync via `account.updated` | Implemented end-to-end incl. UI + SDK flow + E2E | Minor: no MerchantOnboarded event; status only in metadata | `my/billing.tsx`, `onboardMerchantAccount.ts`, `billing.spec.ts` |
| Invoice lifecycle (WF-129/133) | Merchant/admin (API-only) | createInvoice | draft → finalize(open) → pay/void/uncollectible | Implemented; draft-only guards on update/delete; **void unreachable for unpaid invoices; update breaks line-item integrity** | Yes — P1 ×2 | `finalizeInvoice.ts`, `voidInvoice.ts:98-103`, `updateInvoice.ts:106-136` |
| Pay invoice (WF-130) | Customer (invoice recipient) | POST /pay | merchant gate → PaymentIntent/Checkout (manual capture) → webhook `payment_intent.succeeded` → `requires_capture` → merchant captures → paid | Implemented as Hold & Decide; **no status guard, no failed-payment retry, automatic capture unimplemented** | Yes — P1 ×2, P2 | `payInvoice.ts`, `captureInvoicePayment.ts:101-164`, `core/billing.ts:257,287` |
| Refund (WF-131) | Merchant/admin | POST /refund | validate captured → Stripe refund → record metadata | Implemented; single-shot only; no status change; external refunds unsynced | Yes — P2 ×2 | `refundInvoicePayment.ts:91-96`; `handleStripeWebhook.ts:547-607` |
| Webhook processing (WF-132) | System (Stripe) | Stripe POST | verify sig → dispatch 15 event types → update invoice/merchant/subscription | Implemented; sig verification solid; **lookup scaling + idempotency gaps** | Yes — P0, P1 | `handleStripeWebhook.ts` |
| Dues payment (member journey) | Member | `/pay/$token` link | token validate → checkout → dues webhook | **Not billing-module invoices** — dues has parallel invoice tables + own webhook | `[CROSS-MODULE RISK]` — audit under dues-payments | `routes/pay/$token.tsx`, `handlers/member/duesspecialassessments/`, `association:member/repos/dues.repo` |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Merchant: create account | Owner-only, 1 per person | Implemented | `createMerchantAccount.ts:67-69`; `merchant_accounts_person_unique` | V1 REQUIRED | done |
| Merchant: onboarding link | Generate/refresh Stripe link | Implemented | `onboardMerchantAccount.ts:84-160` | V1 REQUIRED | done |
| Merchant: status sync | Webhook updates charges/payouts/onboardingComplete | Implemented | `handleStripeWebhook.ts:612-662` | V1 REQUIRED | done |
| Merchant: deauthorization | Deactivate on `account.application.deauthorized` | Implemented | `handleStripeWebhook.ts:667-699` | V1 RECOMMENDED | done |
| Invoice: create with computed totals | Server-side sum | Implemented | `createInvoice.ts:114-131` | V1 REQUIRED | done |
| Invoice: update replaces line items | Rows replaced + totals recomputed | Partially Implemented | `updateInvoice.ts:106-136` (totals only) | V1 REQUIRED | P1 fix |
| Invoice: finalize draft→open | Draft-only, positive total | Implemented | `finalizeInvoice.ts:67-80` | V1 REQUIRED | done |
| Invoice: void unpaid | Draft/Open→Void without payment | Missing | `voidInvoice.ts:98-103` | V1 REQUIRED | P1 fix |
| Invoice: void authorized payment | Cancel PI then void | Implemented | `voidInvoice.ts:139-159` | V1 REQUIRED | done |
| Invoice: void-threshold capture | Late void → capture per spec | Partially Implemented (inverted) | `voidInvoice.ts:76-85` | V1 RECOMMENDED | align spec/code |
| Pay: status guard | Only `open` invoices payable | Missing | `payInvoice.ts` | V1 REQUIRED | P1 fix |
| Pay: merchant-ready gate | Block when onboarding incomplete | Implemented | `payInvoice.ts:99-114` | V1 REQUIRED | done |
| Pay: retry after failure | failed → retryable | Missing | `payInvoice.ts:94-96` | V1 REQUIRED | P1 fix |
| Capture authorized payment | requires_capture → paid | Implemented | `captureInvoicePayment.ts:101-164` | V1 REQUIRED | done |
| Webhook: signature verify → 400 | Mandatory | Implemented | `handleStripeWebhook.ts:35-53` | V1 REQUIRED | done + tested |
| Webhook: idempotent invoice events | Duplicate event → no-op | Missing | no event.id dedupe for PI/charge events | V1 REQUIRED | P1 fix |
| Webhook: invoice lookup by PI id | Indexed lookup at any scale | Missing (500-row scan) | `billing.repo.ts:48-50` | V1 REQUIRED | P0 fix |
| Refund: cumulative partials | Up to total across multiple refunds | Missing | `refundInvoicePayment.ts:91-96` | V1 RECOMMENDED | P2 |
| Domain events emission | m21 §9 events | Missing | no emits | V1 RECOMMENDED | P2 |
| Per-org gateway config | Encrypted creds used at runtime | Missing (table orphaned) | `core/billing.ts:64-74` | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | P2 |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Member connects Stripe to receive payments | Member | `/my/billing` onboarding round-trip | Implemented | No | V1 REQUIRED | route + flow + E2E |
| Merchant views Stripe dashboard | Merchant | Express login link, owner-only | Implemented | No | V1 REQUIRED | `getMerchantDashboard.ts:75-128` |
| Officer/system invoices a person | Merchant/admin (API) | Create + finalize | Implemented | No | V1 REQUIRED | handlers + lifecycle.hurl |
| Recipient pays an open invoice | Customer | Checkout → captured → paid | Partially Implemented | Yes (status guard, retry, capture model) | V1 REQUIRED | `payInvoice.ts` |
| Officer cancels a mistaken unpaid invoice | Merchant/admin | Void draft/open | Missing | Yes | V1 REQUIRED | `voidInvoice.ts:98-103` |
| Write off bad debt | Merchant/admin | mark-uncollectible | Implemented | No | V1 RECOMMENDED | `markInvoiceUncollectible.ts`, lifecycle.hurl L160-166 |
| Refund a captured payment | Merchant/admin | Full/partial refund | Partially Implemented | Yes (cumulative partials) | V1 REQUIRED | `refundInvoicePayment.ts` |
| Reconcile Stripe state asynchronously | System | Webhooks update invoices reliably at scale | Partially Implemented | Yes (P0 scan limit, P1 idempotency) | V1 REQUIRED | `handleStripeWebhook.ts` |
| Member views own invoices in app | Member | Invoice list UI | Missing (API only; no UI consumer of invoice endpoints in memberry/admin) | `[NEEDS PRODUCT DECISION]` — dues UI covers member-facing finance today | V2 DEFERRED | grep: no `useListInvoices`/invoice hooks in apps |
| Org admin configures own Stripe keys | Org admin | Per-org gateway config UI/API | Missing | `[NEEDS PRODUCT DECISION]` | V1 RECOMMENDED (decision) / V2 DEFERRED (build) | orphaned `billing_config` |
| Platform fee collection | Platform | application_fee on payments | Stubbed at 0 | No (explicitly deferred) | V2 DEFERRED | `payInvoice.ts:119` "Deferred: platform fee — billing v2" |
| Tax calculation | System | Per-jurisdiction tax | Stubbed at 0 | No (explicitly deferred) | V2 DEFERRED | `createInvoice.ts:129`, `updateInvoice.ts:126` |
| Recurring invoices/subscriptions for orgs | System | m21 "Out of scope (future)" | Missing by design | No | V2 DEFERRED | billing.md §Future Enhancements |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| Stripe secret key logged in plaintext on every SDK init | Security / secrets | P0 | V1 REQUIRED | `core/billing.ts:93-96` `[SHARED DEPENDENCY]` | Live secret exfiltratable from any log sink; violates m21 §11.4 and platform PII/secret rules; affects every module using the billing service | Delete `key` from log payload |
| Webhook invoice correlation capped at 500 rows | Financial integrity | P0 | V1 REQUIRED | `billing.repo.ts:48-50` (`findAll` → `limit(500)`); used at `handleStripeWebhook.ts:385,491,561,712,746` | Once >500 invoices exist, `charge.succeeded` silently fails to find the invoice → invoice never marked paid, no error returned to Stripe (200 OK), money taken but state lost | JSONB-predicate query by `stripePaymentIntentId` (+ index), mirroring `findByStripeAccountId` |
| Non-admin invoice listing leak via `?merchant=` filter | Permissions / financial privacy | P1 | V1 REQUIRED | `listInvoices.ts:82-89` | Any authenticated user can enumerate another merchant's invoices (amounts, customer person IDs) across orgs | Enforce self-scope for non-admin merchant/customer filters |
| No webhook idempotency for invoice payment events (AC-M21-004) | Reliability | P1 | V1 REQUIRED | `handleStripeWebhook.ts` (PI/charge handlers); contrast `:798-801` | Stripe retries → duplicate customer/merchant notifications, repeated metadata overwrites | Event-ID dedupe before mutation |
| `payInvoice` missing invoice-status guard (BR-61) | State machine | P1 | V1 REQUIRED | `payInvoice.ts:61-114` | Draft (unfinalized totals), void, and uncollectible invoices can be charged | Require `status === 'open'` |
| Failed payment permanently blocks invoice (no retry) | Core payment workflow | P1 | V1 REQUIRED | `payInvoice.ts:94-96` | Card decline → member can never pay that invoice; contradicts m21 §1 retry responsibility | Allow re-pay from failed/canceled |
| `updateInvoice` totals diverge from stored line items (AC-M21-002) | Data integrity | P1 | V1 REQUIRED | `updateInvoice.ts:106-136` | Invoice charged on `total` computed from line items that were never saved; audit/receipt mismatch | Transactional line-item replacement |
| Unpaid invoices cannot be voided (SM-M21-INVOICE) | Lifecycle | P1 | V1 REQUIRED | `voidInvoice.ts:98-103` | No cancellation path for mistaken/duplicate open invoices → forced into mark-uncollectible misuse | Support void without payment |
| Per-org billing config dead; global env creds only | Multi-tenancy / config | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `core/billing.ts:64-74`; orphaned `billing_config` | m21 in-scope item unimplemented; blocks per-association Stripe accounts if that's the product model | Product decision, then wire or descope |
| `paymentCaptureMethod` ignored — all captures manual | Payment model | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | `core/billing.ts:257,287` | "Automatic" invoices stall in `requires_capture` unless merchant manually captures | Honor capture method or document Hold & Decide only |
| Void-threshold protection inverted vs spec | Lifecycle | P2 | V1 RECOMMENDED | `voidInvoice.ts:76-85` vs billing.md:149-157 | Merchant charge-protection feature doesn't do what the spec promises | Align spec/code |
| Partial-refund-then-refund blocked; cap not netted | Refunds | P2 | V1 RECOMMENDED | `refundInvoicePayment.ts:91-96,113-114` | Real-world multi-step refunds impossible | Cumulative tracking |
| `charge.refunded` reads absent `refunds.data` on current API version | Webhook/refund sync | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | `handleStripeWebhook.ts:573`; API version `core/billing.ts:80` | Dashboard refunds never reflected locally | Use `amount_refunded` |
| Invoice number race + global numbering | Concurrency | P2 | V1 RECOMMENDED | `billing.repo.ts:189-220` | Concurrent creates → unique-violation 500s; per-org numbering spec unmet | Sequence or advisory lock |
| Org context fail-open → 500 on create without header; header undocumented | API contract | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | `app.ts:437-443`; `org-context.ts:165-233`; `createInvoice.ts:57` | Confusing 500s; org-UUID heuristic can mis-bind from path UUIDs | Explicit 400 + document `x-org-id` |
| m21 domain events not emitted | Integration | P2 | V1 RECOMMENDED | no `domainEvents` in module | Downstream M06/M07/M03 contracts in spec are fiction | Emit or descope in spec |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Member's card declined → retries payment | Second `POST /billing/invoices/{id}/pay` succeeds | 409 `Payment already exists for this invoice` forever | `payInvoice.ts:94-96` | P1 | backend/unit: pay → simulate `paymentStatus='failed'` → pay again expects 200 |
| Officer voids an open unpaid invoice | `POST /billing/invoices/{id}/void` → 200, status void | 422 `PAYMENT_NOT_AUTHORIZED` | `voidInvoice.ts:98-103` | P1 | backend/unit: finalize → void (no payment) expects 200 |
| Stripe confirms charge for invoice #501+ | Invoice marked paid | Handler finds no invoice (500-row scan), logs warn, returns 200 to Stripe | `billing.repo.ts:48-50`; `handleStripeWebhook.ts:385-394` | P0 | backend/unit: repo lookup by PI id beyond pagination window |
| Officer edits draft invoice line items, member later pays | Charged amount == saved line items | Charged `total` from request; DB still holds old line items | `updateInvoice.ts:106-136` | P1 | backend/unit: update lineItems → reload → rows match totals |
| Curious member calls `GET /billing/invoices?merchant=<officer-uuid>` | 403 | 200 with the officer's full invoice list | `listInvoices.ts:82-89` | P1 | backend/unit + contract: non-admin foreign-merchant filter → 403 |
| Stripe redelivers `charge.succeeded` | Single notification, single transition | Duplicate notifications to customer + merchant | `handleStripeWebhook.ts:369-471` | P1 | backend/unit: same event twice → one notification call |
| Member pays a draft (never finalized) invoice | 400/422 — not payable | PaymentIntent created against draft totals | `payInvoice.ts` (no status check) | P1 | backend/unit: pay draft → 422 |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `billing_config` table + `BillingConfigRepository` | Schema + repo with no runtime consumer | Only seed writes (`layer-4-cross-module.ts:315-325`, placeholder ciphertext); `grep BillingConfigRepository` → repo file only | Implies per-org credential capability that doesn't exist; seed comment claims "encrypted at the handler layer" but no such handler exists | `[NEEDS PRODUCT DECISION]` — wire or descope; do not expand meanwhile |
| `invoice.paymentCaptureMethod` column | Field saved but not enforced | `billing.schema.ts:85`; never read by `payInvoice`/`core/billing.ts` | Callers believe they chose automatic capture | Honor or remove from create/update contract |
| `invoice.authorizedAt` / `authorizedBy` | Fields never written | `grep authorizedAt handlers/billing/*.ts` → only response echoes; `captureInvoicePayment.ts:229-230` returns hardcoded null | Void-threshold spec depends on `authorizedAt`; always null | Set on `payment_intent.succeeded` |
| `invoice.voidedBy` / `paidBy` | Spotty population | `voidInvoice.ts:154-159` sets `voidedAt` but not `voidedBy`; webhook paid path sets no `paidBy` | Audit-trail gap for financial actions | Populate consistently |
| Invoice endpoints (create/list/get/pay/refund/void/finalize/capture/uncollectible) | APIs with no frontend consumers | No `useCreateInvoice`/`usePayInvoice`/etc. in `apps/memberry` or `apps/admin`; only booking repo + contract tests consume | Backend-only surface; UI claims in m21 §1 ("Member — view/pay invoices") unmet | Acknowledge API-only status for V1; member payments flow through dues `pay/` route `[CROSS-MODULE RISK]` |
| `BillingService.getPaymentIntent` | Service method unused by billing handlers | `core/billing.ts:495-537` | Dead within module | Keep (shared service); verify external consumers before removal |
| `MerchantAccountSetup` doc-example hooks | Comment references non-existent `use-billing` hooks module | `merchant-account-setup.tsx:66-71` vs actual `getMerchantAccountOptions` usage | Misleading example for future devs | Doc-comment fix (P3) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Refund state lives only in metadata JSONB (`refundAmount` as decimal **string**, `refundStatus`) — no schema columns, no status enum value | schema/model | `billing.schema.ts:261-273`; `refundInvoicePayment.ts:154-171` | P2 | Promote refunded amount to integer-cents column or typed metadata; string-decimal money is fragile (`parseFloat` at `refundInvoicePayment.ts:94`) |
| `findAll()` hard `limit(500)` labeled "used by webhook handlers to search by metadata" | backend/service | `billing.repo.ts:46-50` | P0 (see §10) | Replace with predicate query + index |
| Invoice status enum lacks any refund representation; m21 SM expects Refunded/PartiallyRefunded states | schema/model vs spec | `billing.schema.ts:23-29` vs m21 §7 | P3 (doc) / P2 (if reporting needs it) | Resolve spec conflict; billing.md (Stripe-aligned) is the better model |
| `invoice_line_item.organizationId` nullable while parent notNull | schema | `billing.schema.ts:169` | P3 | Backfill + tighten when convenient |
| Amounts are `integer` cents (max ~21M in major units) not bigint per m21 §6 | schema | `billing.schema.ts:77-79` vs m21 §6 "Bigint" | P3 | Acceptable for PHP dues scale; note in spec |
| Webhook returns 200 for `BusinessLogicError` but 422/500 for unexpected errors → Stripe retries (good), but no dead-letter/alert path for repeated failures | API | `handleStripeWebhook.ts:162-177` | P3 | Log-based alerting is enough for V1 `[DO NOT OVERBUILD]` |
| Org-context heuristic can capture the first path UUID as candidate orgId on `/billing/invoices/{uuid}` | state management | `org-context.ts:182-184` | P2 `[SHARED DEPENDENCY]` `[NEEDS CONFIRMATION]` | Membership check fails closed (context just not set), but verify no admin-bypass path sets `organizationId` = invoice id (admin branch at `org-context.ts:202-216` sets it unconditionally for platform admins) |
| `updateInvoice` response shows old line items with new totals | API | `updateInvoice.ts:136-180` | P1 (same root cause as §10) | Fix with line-item replacement |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Stripe secret key in logs | Secrets handling | `core/billing.ts:93-96` | P0 | Remove immediately |
| `listInvoices` foreign-merchant enumeration | Invoice read scope | `listInvoices.ts:82-89` | P1 | Self-scope non-admins |
| `isAdmin` derived from `user.role.includes('admin')` (global platform role) — org officers/treasurers have no billing role mapping; spec says "Officers create for org members" | Role model | `createInvoice.ts:93-97`; m21 §5; no `x-require-officer`/`x-require-position` extensions in `billing.tsp` | P2 `[NEEDS PRODUCT DECISION]` | Decide whether org officers should manage org billing invoices; if yes, add officer extension per P1.5 pattern |
| Webhook route public by design, signature-gated; registered without auth in generated routes | Webhook auth | `routes.ts:2496-2501`; `billing.tsp:570-584` | OK (by design) | None — keep signature pattern test |
| Merchant account/dashboard/onboard owner-only (no admin read path despite API_CONTRACTS "owner / admin") | Merchant access | `getMerchantAccount.ts:85`, `getMerchantDashboard.ts:75-76` | P3 | Align API_CONTRACTS doc or add admin read |
| `getInvoice` allows customer, merchant, or global admin; no org-scope check | Invoice read | `getInvoice.ts:60` | P3 | Acceptable (party-scoped); document |
| CSRF/origin handled platform-wide; billing relies on bearer/session auth middleware | Platform | `routes.ts:2364-2454` (authMiddleware on all non-webhook billing routes) | OK | None |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Per-route audit extensions present on all 13 mutating billing ops (financial.* event subtypes) — good | Audit events | `billing.tsp` `@extension("x-audit", …)` throughout; handlers set `auditResourceId/Description/Details` | OK | None |
| `voidedBy`/`paidBy` actor columns not populated on void/webhook-paid paths | Financial actor trail | `voidInvoice.ts:154-159`; `handleStripeWebhook.ts:406-411` | P2 | Populate (`paidBy` = customer on webhook-paid; `voidedBy` = session user) |
| Refund audit detail relies on metadata overwrite (no append-only history of refund attempts) | Refund history | `refundInvoicePayment.ts:157-171` | P3 | Audit events already capture each refund; acceptable for V1 `[DO NOT OVERBUILD]` |
| Webhook processing has audit middleware, but failed processing of a found invoice still returns 200 with only logs | Reconciliation trail | `handleStripeWebhook.ts:162-171` | P3 | Logged with traceId; acceptable for V1 |
| Notifications use healthcare-template copy ("held until the service is completed", "patient", "provider") in financial messages | Member-facing trust | `handleStripeWebhook.ts:225,447,518` comments+copy | P3 | Re-word for association domain |

## 16. Knowledge Graph Findings

KG (`.understand-anything/knowledge-graph.json`, 2026-06-06) used as secondary evidence only per `docs/aha/kg/knowledge-graph-status.md`; all wiring claims below re-verified by direct inspection.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Billing handlers consumed by generated route registry only; webhook additionally touches platformadmin `subscriptions` | `handleStripeWebhook.ts:10,121-136`; `routes.ts:2350-2501` | Webhook handler is a cross-module integration point — blast radius of changes includes platformadmin subscription sync | Regression-test subscription handlers when fixing webhook idempotency `[CROSS-MODULE RISK]` |
| `booking.repo.ts` imports `InvoiceRepository` directly (repo-to-repo coupling, not API) | `handlers/booking/repos/booking.repo.ts:42,171` | Invoice schema changes ripple into booking | Include booking invoice-creation test in any schema fix `[CROSS-MODULE RISK]` |
| Dues/events payment flows use `ctx.get('billing')` Stripe service but NOT billing invoices | `handlers/member/duesspecialassessments/checkoutPaymentToken.ts`, `handlers/association:operations/registerAndPayForEvent.ts`, `app.ts:675` | Two parallel invoice systems (billing.invoice vs dues tables); `core/billing.ts` fixes affect all three flows | Fix P0 key-logging once in core; do not attempt invoice-system unification here `[DO NOT OVERBUILD]` |
| `/my/billing` is the only frontend consumer; invoice endpoints have zero UI consumers | grep across `apps/` | NAVIGATION_MAP stale; member "view/pay invoices" UI claim unmet | Doc fix + product decision (§9) |
| `person.deleted` cascade deactivates merchant accounts (BR-32 preserves invoices) | `core/domain-event-consumers.ts:1364+` | Deletion safety handled outside module — good | None |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Billing module is a vertical-neutral "payment rail" inherited from the Monobase template (Hold & Decide model built for service bookings, "patient/provider" vocabulary), while Memberry's actual member-money workflows (dues, assessments) bypass it | webhook notification copy; booking integration; dues parallel tables | m21 spec describes billing as the rail for M06 dues, but the domain reality is: billing = Connect onboarding + booking payments; dues = separate rail | Update m21 §1/§10 to reflect actual module relationships before planning fixes `[NEEDS PRODUCT DECISION]` |
| The merchant in Memberry's domain is typically the association (org), but the model is strictly person-owned merchant accounts | `merchant_account.person` unique; m21 §1 "Organization Admin — onboard merchant account" | Org-level treasury semantics (who owns the org's Stripe account when the treasurer changes?) unmodeled | Flag for product; do not build org-merchant model speculatively `[DO NOT OVERBUILD]` |
| PHP currency default in m21 §6 vs `USD` default in schema/TypeSpec | `billing.schema.ts:82`; `billing.tsp:236` vs m21 §6 "Default 'PHP'" | Wrong-currency invoices if callers omit currency in a PH association context | Low-cost alignment: decide platform default `[NEEDS PRODUCT DECISION]` |
| Subscription webhook events (UJ-M03) are platform-revenue domain (org→platform), distinct from member→org payments, but share the webhook endpoint and secret | `handleStripeWebhook.ts:121-136` | One endpoint serving two trust domains is fine for V1 but complicates per-org webhook secrets later | Note in m21; no action now |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. Existing Playwright spec inspected (not executed):

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| `/my/billing` has 3 E2E tests: response-shape (200/404), loading-state hygiene, onboard-error retry UI | Playwright (inspected) | `apps/memberry/tests/e2e/billing.spec.ts:9-74` | Merchant-onboarding page protected against stuck-skeleton regressions | Keep; no invoice-journey E2E exists (none needed while invoice UI doesn't exist) |
| No E2E or browser journey exists for any invoice operation | Playwright (inspected) | grep `billing/invoices` in `apps/*/tests` → none | Consistent with API-only invoice surface | Do not add browser tests for UI that doesn't exist `[DO NOT OVERBUILD]` |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/billing/handleStripeWebhook.test.ts` (30) | backend/unit (mocked) | Signature verify, all PI/charge/refund/account/transfer branches, unknown events, log fields | Medium — mocks repo `findAll`; cannot catch the 500-row scan or missing idempotency |
| `handlers/billing/payInvoice.test.ts` (24) | backend/unit | Auth, merchant gates, PI creation, error paths | Medium — encodes the missing status-guard behavior as correct |
| `handlers/billing/createInvoice.test.ts` (14) | backend/unit | Totals computation, context conflict, validation, auth | High for covered scope |
| `handlers/billing/voidInvoice.test.ts` (11) | backend/unit | requires_capture gating, threshold rejection, conflicts | Medium — asserts the spec-divergent behavior |
| `handlers/billing/lifecycle.test.ts` (7) | backend/unit | draft→open→… transition guards | Medium |
| `handlers/billing/accessControl.test.ts` (7) | backend/unit | Billing access control matrix | Medium — did not catch listInvoices merchant-filter leak |
| `captureInvoicePayment` (5) / `refundInvoicePayment` (3) / `finalizeInvoice` (3) / `updateInvoice` (3) / `deleteInvoice` (4) / `getInvoice` (4) / `listInvoices` (5) / `markInvoiceUncollectible` (3) tests | backend/unit | Per-handler happy + error paths | Medium |
| `createMerchantAccount` (2) / `getMerchantAccount` (4) / `getMerchantDashboard` (3) / `onboardMerchantAccount` (5) tests | backend/unit | Merchant CRUD/onboard/dashboard | Medium |
| `repos/billing.repo.test.ts` (36) | data/schema | Repo filters, invoice-number generation, line-item batching | High for covered scope |
| `repos/billing-config.repo.test.ts` (7) | data/schema | Config filters, findActiveConfig | High (but feature unwired) |
| `ac-m16.advertising.test.ts` (6), `ac-m17.marketplace.test.ts` (15), `br-38.marketplace-disclosure.test.ts` (9) | backend/unit | Marketplace/advertising ACs (other modules, located in billing dir) | Unknown — out of scope `[CROSS-MODULE RISK]` |
| `specs/api/tests/contract/billing-lifecycle.hurl` | contract | merchant create/get/onboard, invoice create/finalize, pay-without-merchant 422, uncollectible, list | Medium |
| `specs/api/tests/contract/billing-extended-flow.hurl` | contract | capture/refund/void/dashboard/webhook — **all `HTTP *` wildcard asserts** | Low — smoke only |
| `specs/api/tests/contract/billing.hurl` | contract | auth gate (401) + signup | Medium |
| `apps/memberry/tests/e2e/billing.spec.ts` (3) | E2E | `/my/billing` shape + loading + error retry | Medium |
| `packages/sdk-ts/src/flows/billing-onboarding.test.ts` | frontend/unit | startBillingOnboarding branching | High |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Webhook duplicate-event delivery → single notification/transition (AC-M21-004) | backend/unit | Locks idempotency fix; currently zero duplicate-delivery coverage | Before (RED) |
| Repo lookup of invoice by `stripePaymentIntentId` with >500 invoices (or: lookup not via `findAll`) | backend/unit + data/schema | Proves the P0 scan fix; current tests mock `findAll` | Before (RED) |
| `payInvoice` on draft/void/uncollectible invoice → 422 | backend/unit | Locks BR-61 status guard | Before |
| `payInvoice` retry after `paymentStatus='failed'` → succeeds | backend/unit | Locks retry fix | Before |
| `updateInvoice` line-item replacement persisted (reload rows == request; totals match) | backend/unit | Locks AC-M21-002 fix | Before |
| `voidInvoice` on open invoice with no payment → 200/void | backend/unit | Locks lifecycle fix | Before |
| `listInvoices` non-admin with foreign `?merchant=` → 403 (and foreign `?customer=` → 403) | permission/RBAC | Locks the privacy fix; extend `accessControl.test.ts` | Before |
| Assert no secret material in `stripe.initialize` log call | backend/unit (regression) | Prevents reintroduction of P0 key logging | During |
| Webhook signature-invalid → 400 contract assertion (deterministic, not `HTTP *`) | contract (Hurl) | AC-M21-003 currently only unit-tested; extended-flow asserts nothing | During |
| Stripe-mock-backed pay→webhook→capture→refund integration | integration | Known TODO (memory: pilot-tier1 "stripe-mock integration"); contract suite skips all Stripe-dependent flows | During/after (separate batch) `[BLOCKED BY ENVIRONMENT]` until stripe-mock wired in CI |
| `charge.refunded` with `amount_refunded` but absent `refunds.data` (current API shape) | backend/unit | Validates the refund-sync fix against real payload shape | Before that fix |
| Concurrent `createInvoice` invoice-number collision | data/schema | Demonstrates and locks number-generation fix | Before that fix |
| createInvoice without org context → explicit 400 (not 500) | backend/unit | Locks org-context hardening | Before that fix |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `core/billing.ts` (BillingService) | shared/platform | Used by billing handlers, dues `checkoutPaymentToken`, events `registerAndPayForEvent`, dues jobs (`app.ts:675`) | P0 key-logging fix and any capture-method change affect three modules | `[SHARED DEPENDENCY]` — fix logging here once; capture-method change needs dues/events regression check |
| platformadmin `subscriptions` table | cross-module | `handleStripeWebhook.ts:10,121-136,772-985` | Webhook refactors (idempotency, routing) can break platform-revenue sync | `[CROSS-MODULE RISK]` — keep subscription handler tests green |
| booking → `InvoiceRepository` direct import | cross-module | `booking.repo.ts:42,168-175` | Invoice schema/contract changes ripple into booking creation | `[CROSS-MODULE RISK]` — run booking tests with billing fixes |
| Dues parallel invoice system | cross-module / product decision | `association:member/repos/dues.repo` (`DuesInvoiceRepository`), `/pay/$token` flow | Duplicate "invoice" sources of truth platform-wide; m21 spec claims M06 uses billing | `[NEEDS PRODUCT DECISION]` — document; unification is V2 at most `[DO NOT OVERBUILD]` |
| `middleware/org-context.ts` fail-open block | shared/platform | `app.ts:437-443` applies to 9 route prefixes | Hardening billing org-context must not break booking/comms/storage routes | `[SHARED DEPENDENCY]` — prefer handler-level validation over middleware change |
| `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` env config | environment/tooling | `core/billing.ts:64-74,460-469`; `core/config.ts` billing section | Contract/integration tests for Stripe flows need stripe-mock or test keys | `[BLOCKED BY ENVIRONMENT]` for integration-test gap until stripe-mock wired (memory: pilot-tier1 TODO) |
| `notifs` NotificationService | shared/platform | webhook handlers `:222-247,426-470` | Idempotency fix must gate notification sends | `[SHARED DEPENDENCY]` |
| Drizzle migrations for any schema change (refund columns, indexes) | database/schema | `services/api-ts/src/generated/migrations/` | P0 lookup fix wants a JSONB expression index | Standard db-migrate workflow; module-local tables only |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Remove secret key from `stripe.initialize` log | §10 key logging | P0 | V1 REQUIRED | log-redaction regression test | One-line fix in `core/billing.ts:93-96` `[SHARED DEPENDENCY]` |
| `InvoiceRepository.findByStripePaymentIntentId()` (JSONB predicate + index) and replace all 5 `findAll()` webhook scans | §10 scan limit | P0 | V1 REQUIRED | repo lookup test; webhook handler tests updated to mock new method | Pattern exists at `billing.repo.ts:306-316`; add migration for expression index |
| Self-scope `listInvoices` filters for non-admins | §10 listing leak | P1 | V1 REQUIRED | RBAC tests (foreign merchant/customer → 403) | Small change at `listInvoices.ts:79-90` |
| Webhook event-ID dedupe for invoice events | AC-M21-004 | P1 | V1 REQUIRED | duplicate-delivery test | Store `lastStripeEventId`-style marker in invoice metadata or a `stripe_webhook_events` table; reuse subscription pattern `handleStripeWebhook.ts:798-801` |
| `payInvoice`: require `status === 'open'`; allow retry from failed/canceled | §10 status guard + retry | P1 | V1 REQUIRED | 4 unit tests (draft/void/uncollectible rejected; failed retryable) | Single handler |
| `updateInvoice`: transactional line-item replacement | AC-M21-002 | P1 | V1 REQUIRED | persistence test | Add repo method `replaceLineItems(invoiceId, items)` in tx with totals |
| `voidInvoice`: support unpaid void (no PI → status-only void) | SM-M21-INVOICE | P1 | V1 REQUIRED | open-unpaid void test; keep authorized-void tests | Also set `voidedBy` |
| Set `authorizedAt/authorizedBy` on `payment_intent.succeeded`; `paidBy` on webhook-paid; `voidedBy` on void | §12/§15 actor fields | P2 | V1 RECOMMENDED | field-population assertions | Low risk |
| Fix `charge.refunded` to use `charge.amount_refunded` | §10 refund sync | P2 | V1 RECOMMENDED | payload-shape test | Verify against Stripe API 2025-10-29 first `[NEEDS CONFIRMATION]` |
| Cumulative refund tracking (allow multiple partials up to total) | §10 refunds | P2 | V1 RECOMMENDED | multi-partial-refund test | Consider integer-cents metadata or column |
| Align void-threshold behavior with spec (or rewrite spec) | §10 threshold | P2 | V1 RECOMMENDED | threshold-window tests | Needs decision: capture-on-late-void vs reject `[NEEDS PRODUCT DECISION]` |
| Invoice-number generation via advisory lock/sequence | §10 race | P2 | V1 RECOMMENDED | concurrency test | Keep format `INV-YYYY-NNNNNN` |
| Explicit 400 when org context missing on create endpoints; document `x-org-id` | §10 org context | P2 | V1 RECOMMENDED | missing-org test | Handler-level; avoid touching shared middleware |
| Emit `invoice.paid` / `invoice.refunded` / `payment.failed` / `merchant.onboarded` domain events | m21 §9 | P2 | V1 RECOMMENDED | event-emission tests | Or descope in spec — decide with product `[NEEDS PRODUCT DECISION]` |
| Honor `paymentCaptureMethod` in `createPaymentIntent` | §10 capture model | P2 | V1 RECOMMENDED `[NEEDS PRODUCT DECISION]` | automatic-capture flow test | Affects dues/events flows via shared service — regression needed |
| Refresh m21 MODULE_SPEC §6/§7, API_CONTRACTS §3/§4, NAVIGATION_MAP from code | doc staleness | P3 | V1 RECOMMENDED | n/a | Doc-only batch |
| Re-word healthcare notification copy; fix AC error-code names | §15/§5 | P3 | V1 RECOMMENDED | copy assertions optional | Cosmetic batch |
| Wire stripe-mock into contract/CI for pay→capture→refund flows; replace `HTTP *` asserts in `billing-extended-flow.hurl` | §20 integration gap | P2 | V1 RECOMMENDED | new Hurl scenarios | `[BLOCKED BY ENVIRONMENT]` until stripe-mock available in CI (memory: pilot-tier1 TODO) |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Platform fee calculation (`platformAmount = 0`) | `V2 DEFERRED` | Explicitly deferred in code (`payInvoice.ts:119`); no V1 revenue requirement |
| Tax calculation by jurisdiction | `V2 DEFERRED` | Explicitly deferred (`createInvoice.ts:129`); m21 delegates to Stripe |
| Recurring invoices / subscription billing for member dues | `V2 DEFERRED` | m21 §1 out-of-scope; platformadmin subscriptions cover platform revenue |
| Unifying dues invoices with billing invoices | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | Real architectural duplication, but unification is a re-architecture, not a gap fix `[DO NOT OVERBUILD]` |
| Per-org Stripe credential management UI + key-rotation flows | `V2 DEFERRED` (pending product decision on per-org model) | Build only after the global-vs-per-org decision; encrypted-config plumbing alone is V1 RECOMMENDED at most |
| Org-owned (vs person-owned) merchant account model | `[NEEDS PRODUCT DECISION]` | Domain mismatch noted in §17; speculative remodel without a driving workflow `[DO NOT OVERBUILD]` |
| Invoice management UI in memberry/admin | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | No persona currently needs it; dues UI covers member finance |
| Webhook dead-letter queue / replay tooling | `DO NOT ADD` | Stripe's retry + logs suffice for V1 `[DO NOT OVERBUILD]` |
| Multi-currency conversion | `DO NOT ADD` | billing.md lists as future; no V1 evidence |
| Generic payment-gateway abstraction layer (Stripe+PayMongo polymorphism) in billing module | `DO NOT ADD` | PayMongo lives in dues flow; premature abstraction `[DO NOT OVERBUILD]` |

## 24. Audit Decision

**FAIL**

The endpoint surface is complete, signature verification is solid, merchant onboarding works end-to-end with UI and tests — but the module has 2 P0 and 6 P1 gaps that block reliable V1 use of its core financial workflows:

- P0: the live Stripe secret key is logged in plaintext (`core/billing.ts:93-96`), and webhook payment confirmation silently breaks past 500 invoices (`billing.repo.ts:48-50`).
- P1: failed payments permanently lock invoices, unpaid invoices can't be voided, draft/void invoices can be charged, invoice edits desync totals from line items, webhook events aren't idempotent, and any user can list another merchant's invoices.

Most fixes are small and handler-local; the module is close to PARTIAL PASS once the P0s and the pay/void/update/list P1 cluster land.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Is the V1 payment model a single platform Stripe (Connect) account via env, or per-org credentials via `billing_config`? | `[NEEDS PRODUCT DECISION]` | Decides whether to wire or descope the orphaned config table, encryption util, and webhook-secret strategy | Founder/product |
| Should `paymentCaptureMethod: automatic` actually auto-capture, or is Hold & Decide the only V1 model? | `[NEEDS PRODUCT DECISION]` | Determines payInvoice/createPaymentIntent changes and dues/events regression scope | Founder/product |
| Should org officers (Treasurer/President) be able to create/refund/void billing invoices for their org (vs only global `admin` role)? | `[NEEDS PRODUCT DECISION]` | m21 §5 says officers; code requires global admin or merchant-self | Founder/product |
| Does Stripe API `2025-10-29.clover` omit `charge.refunds.data` in webhook payloads (making the refund-sync handler a no-op)? | `[NEEDS CONFIRMATION]` | Confirms/denies the P2 refund-sync gap before fixing | Eng (verify against Stripe docs/stripe-mock) |
| Does `createInvoice` actually 500 (DB notNull) when no `x-org-id`/org membership resolves, and can a platform-admin's org context get mis-bound from a path UUID? | `[NEEDS CONFIRMATION]` | Confirms two P2s rooted in fail-open org middleware | Eng (runtime check) |
| Is dues-vs-billing invoice duplication intentional architecture (two rails) or transitional? | `[NEEDS PRODUCT DECISION]` | Governs how much to invest in billing-invoice features vs dues | Founder/product |
| When will stripe-mock be wired into CI (pilot-tier1 TODO) so contract tests can assert real payment flows? | `[BLOCKED BY ENVIRONMENT]` | Gate for integration-test gaps in §20 | Eng/CI |
| Default currency: USD (code) or PHP (m21 spec)? | `[NEEDS PRODUCT DECISION]` | Wrong default risks mis-denominated invoices | Founder/product |

## 26. Notes for Gap Plan Organizer

- **Fix first, tiny and safe:** P0 secret-key log removal (`core/billing.ts:93-96`) — one line, shared file, justify as `[SHARED DEPENDENCY]`; zero behavior change.
- **P0 batch 2:** webhook invoice lookup (`findByStripePaymentIntentId` + index, replace 5 `findAll()` call sites). Write the repo-lookup RED test first; webhook unit tests will need their `findAll` mocks swapped.
- **P1 cluster (handler-local, independently shippable):** payInvoice status guard + failed-retry; voidInvoice unpaid-void; updateInvoice line-item replacement; listInvoices filter scoping; webhook idempotency. Each has a named RED test in §20. Webhook idempotency must not regress the platformadmin subscription handlers (they already have dedupe).
- **Blocked by product decisions (do not schedule):** per-org billing config wiring, automatic-capture honoring, officer-role billing permissions, dues/billing unification, default currency. List them as blocked items.
- **Blocked by environment:** stripe-mock contract/integration scenarios (`billing-extended-flow.hurl` is `HTTP *` smoke only).
- **Doc-only batch (cheap, high confusion-reduction):** refresh m21 §6/§7 data model, API_CONTRACTS §3/§4 event claims, NAVIGATION_MAP route count; fix AC error-code names; re-word healthcare notification copy.
- **Do not expand:** subscription/transfer webhook handlers, PayMongo enum, getPaymentIntent service method, marketplace tests in billing dir (relocate at most), webhook DLQ, gateway abstraction.
- **Tests to write before fixes:** all rows marked "Before" in §20 — especially duplicate-webhook, >500-invoice lookup, pay-status-guard, unpaid-void, line-item persistence, foreign-merchant-403.
- **Cross-module regression set when touching shared code:** dues `checkoutPaymentToken`, events `registerAndPayForEvent`, booking invoice creation, platformadmin subscription sync.

---

Next recommended step:
Module/group: Billing (Stripe)
Module slug: billing-stripe
Primary PRD/spec: docs/product/modules/m21-billing/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/billing-stripe-gap-plan.md
