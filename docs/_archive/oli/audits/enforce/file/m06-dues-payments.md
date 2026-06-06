# File Enforcement: m06-dues-payments

> Generated: 2026-05-28 | Auditor: oli-enforce-file | Module: M06 Dues & Payments
> Directories: `services/api-ts/src/handlers/dues/`, `services/api-ts/src/handlers/billing/`
> Supersedes: 2026-05-27 report (corrected file counts, added schema traceability)

---

## 1. Spec Artifacts Used

| Artifact | Path | Version |
|----------|------|---------|
| MODULE_SPEC | `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` | v2.0, 2026-05-21 |
| API_CONTRACTS | `docs/product/modules/m06-dues-payments/API_CONTRACTS.md` | v2.0, 2026-05-21 |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | v1.0 |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | v1.0 |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | v1.0 |

---

## 2. File Classification

### 2a. Dues Directory (`services/api-ts/src/handlers/dues/`)

| # | File | Role | Spec Trace | Notes |
|---|------|------|------------|-------|
| 1 | `checkoutPaymentToken.ts` | controller | WF-038, S10 POST /org/:id/payments/checkout | Creates Stripe checkout from token. Uses `(gatewayConfig as any)` casts. |
| 2 | `sendPaymentLink.ts` | controller | WF-038 (support) | Officer sends payment link. Not in S10 API table. |
| 3 | `validatePaymentToken.ts` | controller | S10 GET /pay/:token | Public: validates token, returns payment details. |
| 4 | `getDuesDashboard.ts` | controller | WF-043, S10 GET /org/:id/reports/financial | Dashboard stats. Cross-module import from association:member. |
| 5 | `downloadReceipt.ts` | controller | WF-045, S10 GET /org/:id/payments/:id/receipt, M6-R6 | Renders HTML receipt. Checks officer access. Completed/confirmed payments only. |
| 6 | `stripeWebhook.ts` | controller | WF-038, S10 POST /webhooks/:provider, M6-R8 | Hand-wired BEFORE auth middleware. Stripe only. |
| 7 | `repos/dues-payments.schema.ts` | entity | S7 (6 entities: DuesPayment, DuesOrgConfig, DuesCategoryOverride, DuesFund, DuesFundAllocation, DuesGatewayConfig, DuesReminderSchedule, WebhookRetryLog) | Primary schema. All spec entities except DuesPaymentStatusHistory. |
| 8 | `repos/dues-payments.repo.ts` | repository | S7 | CRUD, fund allocations, receipt sequencing, report aggregations. |
| 9 | `repos/dues.schema.ts` | entity | Legacy | `dues_config`, `dues_invoice`, `aging_bucket`, `dues_reminder_log`. JSONB fund allocations. |
| 10 | `repos/payment-token.schema.ts` | entity | WF-038 (support) | `payment_token` table. HMAC-SHA256 hash, expiry, single-use. |
| 11 | `repos/payment-token.repo.ts` | repository | WF-038 | Token persistence: create, find by hash, mark used. |
| 12 | `utils/payment-token.ts` | utility | WF-038 | HMAC-SHA256 token generation, hashing, expiry check. |
| 13 | `jobs/index.ts` | registry | WF-042 | Job registration: reminderProcessor (daily), webhookRetryProcessor (60s). |
| 14 | `jobs/autoInvoiceGenerator.ts` | service | WF-038 | Auto-generates invoices approaching billing cycle. |
| 15 | `jobs/processStripePayment.ts` | service | WF-038, WF-039 | Processes Stripe payment, creates fund allocations. |
| 16 | `jobs/reminderProcessor.ts` | service | WF-042, M6-R5 | Processes dues reminders. Deduplicates via reminder_log. |
| 17 | `jobs/webhookRetryProcessor.ts` | service | M6-R8, AC-M06-002 | Exponential backoff retry. Dead-letters after max retries. Circuit breaker. |
| 18 | `checkoutPaymentToken.test.ts` | test | -- | Token checkout tests. |
| 19 | `downloadReceipt.test.ts` | test | -- | Receipt download tests. |
| 20 | `sendPaymentLink.test.ts` | test | -- | Send-link tests. |
| 21 | `validatePaymentToken.test.ts` | test | -- | Token validation tests. |
| 22 | `getDuesDashboard.test.ts` | test | -- | Dashboard tests. |
| 23 | `stripeWebhook.test.ts` | test | -- | Webhook unit tests. |
| 24 | `stripeWebhook.integration.test.ts` | test | -- | Webhook integration tests. |
| 25 | `dues-config.test.ts` | test | WF-040 | **Orphan**: test without handler. |
| 26 | `bulkRecordPayments.test.ts` | test | WF-044? | **Orphan**: test without handler. |
| 27 | `jobs/index.test.ts` | test | -- | Job registration tests. |
| 28 | `jobs/autoInvoiceGenerator.test.ts` | test | -- | Auto-invoice tests. |
| 29 | `jobs/processStripePayment.test.ts` | test | -- | Stripe payment processing tests. |
| 30 | `utils/fund-math.test.ts` | test | BR-05, M6-R1 | Fund allocation math tests. |
| 31 | `utils/payment-token.test.ts` | test | -- | Token utility tests. |
| 32 | `utils/expiry-extension.test.ts` | test | BR-07 | Expiry extension tests. |
| 33 | `utils/settle-payment.test.ts` | test | -- | Payment settlement tests. |

### 2b. Cross-Module Files (`services/api-ts/src/handlers/association:member/repos/`)

| # | File | Role | Spec Trace | Notes |
|---|------|------|------------|-------|
| 34 | `dues-payment-status-history.schema.ts` | entity | S7 DuesPaymentStatusHistory | **Mislocated**: should be in `dues/repos/`. Imports from `dues/repos/dues-payments.schema`. |
| 35 | `dues.schema.ts` | re-export | -- | Re-exports from `dues/repos/dues.schema.ts` (BCI-01 backward compat). |
| 36 | `dues-payments.schema.ts` | entity | Needs audit | Exists in association:member. May duplicate or re-export. |
| 37 | `dunning.schema.ts` | entity | WF-042 | Dunning-specific tables. Related to reminder/escalation flow. |
| 38 | `dunning.repo.ts` | repository | WF-042 | Dunning repository. |
| 39 | `dues.repo.ts` | repository | Legacy | Legacy dues repo in association:member. |
| 40 | `dues-payments.repo.ts` | repository | -- | Association:member dues payments repo. |
| 41 | `dues-payments.repo.test.ts` | test | -- | Repo tests. |
| 42 | `dues-schema.test.ts` | test | -- | Schema tests. |

### 2c. Billing Directory (`services/api-ts/src/handlers/billing/`)

| # | File | Role | Spec Trace | Notes |
|---|------|------|------------|-------|
| 43 | `createInvoice.ts` | controller | -- | Platform billing (separate from M06 dues). TypeSpec-aligned. |
| 44 | `updateInvoice.ts` | controller | -- | Updates draft invoices. |
| 45 | `deleteInvoice.ts` | controller | -- | Soft-deletes drafts. |
| 46 | `finalizeInvoice.ts` | controller | -- | Draft -> open. Creates Stripe PaymentIntent. |
| 47 | `getInvoice.ts` | controller | -- | Single invoice read. |
| 48 | `listInvoices.ts` | controller | -- | Paginated invoice list. |
| 49 | `payInvoice.ts` | controller | -- | Records payment / creates Stripe checkout. |
| 50 | `captureInvoicePayment.ts` | controller | -- | Captures authorized PaymentIntent. |
| 51 | `refundInvoicePayment.ts` | controller | -- | Creates Stripe refund for platform invoice. |
| 52 | `markInvoiceUncollectible.ts` | controller | -- | Marks uncollectible. 3 TODO comments. |
| 53 | `voidInvoice.ts` | controller | -- | Voids invoice + cancels PaymentIntent. |
| 54 | `createMerchantAccount.ts` | controller | -- | Stripe Connect account creation. |
| 55 | `onboardMerchantAccount.ts` | controller | -- | Onboarding link / status check. |
| 56 | `getMerchantAccount.ts` | controller | -- | Merchant account with Stripe balance. |
| 57 | `getMerchantDashboard.ts` | controller | -- | Merchant analytics. |
| 58 | `handleStripeWebhook.ts` | controller | WF-038 (bridge) | Platform Stripe events. No bridge to dues module. |
| 59 | `repos/billing.schema.ts` | entity | -- | invoices, invoice_line_items, merchant_accounts, billing_configs. |
| 60 | `repos/billing.repo.ts` | repository | -- | InvoiceRepository + MerchantAccountRepository. |
| 61-80 | 20 test files | test | -- | Full test coverage for all billing handlers + repos. |

**Totals:** 80 files (33 dues + 9 cross-module + 38 billing). ~30 source files, ~50 test files.

---

## 3. Entity-to-Schema Traceability

| Spec Entity (S7) | Schema File | Table Name | Status |
|-------------------|-------------|------------|--------|
| DuesPayment | `dues/repos/dues-payments.schema.ts` | `dues_payment` | PRESENT |
| DuesOrgConfig | `dues/repos/dues-payments.schema.ts` | `dues_org_config` | PRESENT |
| DuesCategoryOverride | `dues/repos/dues-payments.schema.ts` | `dues_category_override` | PRESENT |
| DuesFund | `dues/repos/dues-payments.schema.ts` | `dues_fund` | PRESENT |
| DuesFundAllocation | `dues/repos/dues-payments.schema.ts` | `dues_fund_allocation` | PRESENT |
| DuesGatewayConfig | `dues/repos/dues-payments.schema.ts` | `dues_gateway_config` | PRESENT |
| DuesReminderSchedule | `dues/repos/dues-payments.schema.ts` | `dues_reminder_schedule` | PRESENT |
| DuesPaymentStatusHistory | `association:member/repos/dues-payment-status-history.schema.ts` | `dues_payment_status_history` | **MISLOCATED** |
| WebhookRetryLog | `dues/repos/dues-payments.schema.ts` | `webhook_retry_log` | PRESENT |

**Entity coverage: 9/9 (100%)**. All spec entities have schema definitions. 1 mislocated.

---

## 4. API Endpoint-to-Handler Traceability

| Spec Endpoint (S10) | Handler File | Status |
|----------------------|-------------|--------|
| POST `/org/:id/payments/manual` | -- | **MISSING** |
| POST `/org/:id/payments/checkout` | `dues/checkoutPaymentToken.ts` | PARTIAL (token-based) |
| POST `/webhooks/:provider` | `dues/stripeWebhook.ts` | PRESENT (Stripe only) |
| POST `/org/:id/payments/:id/refund` | -- | **MISSING** |
| GET `/org/:id/reports/financial` | `dues/getDuesDashboard.ts` | PARTIAL (dashboard, not full report) |
| GET `/my/payments` | -- | **MISSING** |
| PUT `/org/:id/config/dues` | -- | **MISSING** (test exists) |
| PUT `/org/:id/config/funds` | -- | **MISSING** |
| POST `/org/:id/config/gateway` | -- | **MISSING** |
| GET `/org/:id/payments/:id/receipt` | `dues/downloadReceipt.ts` | PRESENT |
| GET `/pay/:token` | `dues/validatePaymentToken.ts` | PRESENT |

**Endpoint coverage: 3/11 full + 2/11 partial = 5/11 (45.5%)**. Core payment operations (manual, refund, config) all missing handlers.

---

## 5. Workflow-to-File Traceability

| Workflow | Files | Status |
|----------|-------|--------|
| WF-038: Pay Dues Online | `checkoutPaymentToken.ts`, `validatePaymentToken.ts`, `stripeWebhook.ts`, `jobs/processStripePayment.ts` | PARTIAL (token-based, Stripe only) |
| WF-039: Fund Allocation | `utils/fund-math.test.ts`, `repos/dues-payments.repo.ts` (createFundAllocations) | PRESENT (repo + test) |
| WF-040: Dues Config | `dues-config.test.ts` (orphan) | **MISSING HANDLER** |
| WF-041: Refund Processing | -- | **MISSING** |
| WF-042: Dunning/Reminders | `jobs/reminderProcessor.ts`, `dunning.schema.ts`, `dunning.repo.ts` | PRESENT |
| WF-043: Financial Dashboard | `getDuesDashboard.ts` | PRESENT |
| WF-044: Manual Payment | `bulkRecordPayments.test.ts` (orphan) | **MISSING HANDLER** |
| WF-045: Receipt Generation | `downloadReceipt.ts`, `repos/dues-payments.repo.ts` (getNextReceiptSequence) | PRESENT |

**Workflow coverage: 4/8 implemented, 1 partial, 3 missing.**

---

## 6. Business Rule Traceability

| Rule | Files | Status |
|------|-------|--------|
| BR-04: Per-org/category config | `dues-payments.schema.ts` (duesOrgConfigs, duesCategoryOverrides) | SCHEMA ONLY -- no config handler |
| BR-05: Fund split sums to 100% | `utils/fund-math.test.ts`, `dues-payments.repo.ts` | PRESENT |
| BR-06: Manual payment recording | -- | **MISSING** |
| BR-07: Payment extends expiry | `utils/expiry-extension.test.ts` | TEST ONLY |
| BR-08: Refund reverses expiry | -- | **MISSING** |
| BR-30: Org gateway isolation | Architecture (billing/ vs dues/) | BY DESIGN |
| BR-32: 7-year retention, no hard delete | No hard-delete in repos | COMPLIANT |
| M6-R1: Currency-aware rounding | `utils/fund-math.test.ts` | TEST PRESENT |
| M6-R2: State machine transitions | `dues-payments.schema.ts` (enum), `dues-payment-status-history.schema.ts` | SCHEMA ONLY |
| M6-R4: Duplicate payment warning | -- | **MISSING** |
| M6-R5: Reminder defaults 60/30/7 | `jobs/reminderProcessor.ts` | PRESENT |
| M6-R6: Receipt ORG_CODE-YEAR-SEQ | `dues-payments.repo.ts` (getNextReceiptSequence) | PRESENT |
| M6-R8: Idempotent webhooks | `stripeWebhook.ts`, `jobs/webhookRetryProcessor.ts` | PRESENT |
| M6-R12: Gateway adapter pattern | -- | **MISSING** (no adapter interface) |

---

## 7. Findings

### 7a. Summary

| Severity | Count |
|----------|-------|
| P0 (Blocker) | 1 |
| P1 (Critical) | 7 |
| P2 (Warning) | 8 |
| P3 (Info) | 3 |
| **Total** | **19** |

### 7b. Findings Detail

#### P0 -- Must Fix Before Merge

| ID | Check | Finding | File | Spec Source |
|----|-------|---------|------|-------------|
| EF-M06-a1e7c3b2 | naming | `sendPaymentLink` has no role check -- any authenticated user can generate payment links for any member. Spec requires treasurer/president/admin with 2FA. | `dues/sendPaymentLink.ts` | S6: "Record payment: super, admin, president (2FA), treasurer (2FA)" |

#### P1 -- Must Fix Before Release

| ID | Check | Finding | File | Spec Source |
|----|-------|---------|------|-------------|
| EF-M06-b4d2f1a9 | error-taxonomy | No handler for manual payment recording. Repo has `createPayment()`, `createFundAllocations()`, `findRecentPaymentForPerson()` ready. Missing: role+2FA, duplicate warning, fund split orchestration, PaymentRecorded event. | `dues/` (missing) | S10 POST /org/:id/payments/manual, WF-044 |
| EF-M06-c8e5a7d3 | error-taxonomy | No handler for refund processing. Repo has `updatePaymentStatus()`. Missing: role check, status transition, fund reversal, expiry reversal, PaymentRefunded event. | `dues/` (missing) | S10 POST /org/:id/payments/:id/refund, WF-041 |
| EF-M06-d7f3b9e1 | error-taxonomy | No financial report handler. Repo has 4 report methods (`reportCollectionSummary`, `reportFundBreakdown`, `reportDuesStatus`, `reportAging`). None wired to endpoint. | `dues/` (missing) | S10 GET /org/:id/reports/financial, WF-043 |
| EF-M06-f9d1b3c5 | error-taxonomy | No member payment history handler. Repo `listPayments()` supports person filter but no self-service endpoint. | `dues/` (missing) | S10 GET /my/payments |
| EF-M06-a3e7d2b8 | error-taxonomy | No dues config handlers. Repo has `upsertConfig()`, `replaceFunds()`, `replaceCategoryOverrides()`. Test file exists but no handler. | `dues/` (missing) | S10 PUT /org/:id/config/dues, WF-040 |
| EF-M06-b6f4c8a1 | error-taxonomy | No reminder schedule handlers. Repo has `getReminderSchedules()` and `replaceReminderSchedules()`. | `dues/` (missing) | S10 implied, WF-042 |
| EF-M06-a4b5c6d7 | error-taxonomy | No gateway adapter interface. Only Stripe implemented. Adding PayMongo requires core logic changes, violating M6-R12. | `dues/` (missing) | S20.10, M6-R12 |

#### P2 -- Should Fix

| ID | Check | Finding | File | Spec Source |
|----|-------|---------|------|-------------|
| EF-M06-c2a5e9d7 | domain-terms | `getDuesDashboard` checks session but position enforcement depends on middleware wiring at runtime. | `dues/getDuesDashboard.ts` | S6 |
| EF-M06-d4b8f1c3 | data-shape | `checkoutPaymentToken` uses `(gatewayConfig as any).connected` and `(gatewayConfig as any).publicKey`. Schema has `encryptedSecretKey`, not `publicKey`. Two type-safety violations. | `dues/checkoutPaymentToken.ts:49,67` | S7 DuesGatewayConfig |
| EF-M06-e1c9a5b7 | import-boundaries | `getDuesDashboard.ts` imports from `association:member/repos/`. `dues/repos/dues.repo.ts` imports from `association:member/repos/`. Three cross-module boundary violations. | Multiple | S20 AI-1 |
| EF-M06-f3d7b2a4 | domain-terms | `validatePaymentToken` does not check Life member status before returning payment details. Life Members must not see pay button. | `dues/validatePaymentToken.ts` | S5 Life member exemption |
| EF-M06-a8c4e6d2 | domain-terms | Domain events registry defines only `dues.payment.recorded`. Missing 3 events: `dues.payment.refunded`, `dues.invoice.generated`, `dunning.escalation`. | `core/domain-events.registry.ts` | S10b Published Events |
| EF-M06-b5e9c1f7 | domain-terms | Missing consumed event handler: `membership.status.changed` -> suppress reminders for Suspended/Removed/Life. | `core/domain-event-consumers.ts` | S10b Consumed Events |
| EF-M06-c7a3d5b1 | import-boundaries | `billing/handleStripeWebhook.ts` does not bridge to dues module. No dues payment record created on `payment_intent.succeeded` for dues payments. | `billing/handleStripeWebhook.ts` | S4 WF-038, S20 AI-5 |
| EF-M06-d9f2a4c6 | data-shape | `billing/markInvoiceUncollectible.ts` has 3 TODO comments: missing payment intent cleanup, context field, paymentCaptureMethod. | `billing/markInvoiceUncollectible.ts` | Billing schema |

#### P3 -- Informational

| ID | Check | Finding | File | Spec Source |
|----|-------|---------|------|-------------|
| EF-M06-e6b8d3f5 | naming | `sendPaymentLink` hardcodes `currency = 'PHP'` fallback. Should read from DuesOrgConfig.currency. | `dues/sendPaymentLink.ts:41` | S7 DuesOrgConfig |
| EF-M06-f4a2c7e9 | data-shape | 2 test files without matching handler: `bulkRecordPayments.test.ts`, `dues-config.test.ts`. TDD RED without GREEN. | `dues/` | S19 Vertical Slice |
| EF-M06-b0c1d2e3 | import-boundaries | DuesPaymentStatusHistory schema in `association:member/repos/` instead of `dues/repos/`. Violates aggregate boundary (DuesPayment owns its history). | `association:member/repos/dues-payment-status-history.schema.ts` | S7b Aggregate Boundaries |

---

## 8. Per-File 5-Check Matrix

### Dues Source Files

| File | Error Tax | Domain Terms | Data Shape | Naming | Imports | Verdict |
|------|-----------|-------------|------------|--------|---------|---------|
| `checkoutPaymentToken.ts` | PASS | PASS | **FAIL** (unsafe casts) | PASS | PASS | 1 finding |
| `sendPaymentLink.ts` | PASS | PASS | PASS | **WARN** (PHP hardcode) | PASS | 2 findings |
| `validatePaymentToken.ts` | PASS | **FAIL** (no Life member check) | PASS | PASS | PASS | 1 finding |
| `getDuesDashboard.ts` | PASS | **WARN** (role enforcement) | PASS | PASS | **FAIL** (cross-module) | 2 findings |
| `downloadReceipt.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `stripeWebhook.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `repos/dues-payments.schema.ts` | N/A | PASS | PASS | PASS | PASS | Clean |
| `repos/dues-payments.repo.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `repos/dues.schema.ts` | N/A | PASS | PASS | PASS | PASS | Legacy |
| `repos/payment-token.schema.ts` | N/A | PASS | PASS | PASS | PASS | Clean |
| `repos/payment-token.repo.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `utils/payment-token.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/index.ts` | PASS | PASS | N/A | PASS | PASS | Clean |
| `jobs/autoInvoiceGenerator.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/processStripePayment.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/reminderProcessor.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/webhookRetryProcessor.ts` | PASS | PASS | PASS | PASS | PASS | Clean |

### Billing Source Files

| File | Error Tax | Domain Terms | Data Shape | Naming | Imports | Verdict |
|------|-----------|-------------|------------|--------|---------|---------|
| All 16 billing handlers | PASS | PASS | PASS (except markInvoiceUncollectible) | PASS | PASS | 1 finding total |
| `handleStripeWebhook.ts` | PASS | PASS | PASS | PASS | **WARN** (no dues bridge) | 1 finding |
| `repos/billing.schema.ts` | N/A | PASS | PASS | PASS | PASS | Clean |
| `repos/billing.repo.ts` | PASS | PASS | PASS | PASS | PASS | Clean |

---

## 9. Structural Health

| Metric | Dues | Billing | Combined |
|--------|------|---------|----------|
| Source files | 17 | 18 | 35 |
| Test files | 16 | 22 | 38 |
| Test-to-source ratio | 0.94 | 1.22 | 1.09 |
| Files with findings | 5 | 2 | 7 |
| Clean files | 12 | 16 | 28 |
| Orphaned tests (no source) | 2 | 1 | 3 |
| Missing handlers (spec-required) | 7 | 0 | 7 |

**Endpoint coverage: 3/11 full + 2/11 partial (45.5%)**
**Entity coverage: 9/9 (100%, 1 mislocated)**
**Workflow coverage: 4/8 implemented + 1 partial (56.3%)**
**Business rule coverage: 7/14 present (50%)**

---

## 10. Prioritized Fix Queue

| Priority | Finding ID | Fix | Effort |
|----------|-----------|-----|--------|
| P0 | EF-M06-a1e7c3b2 | Add `requirePosition(['treasurer', 'president'])` + 2FA to `sendPaymentLink` | S |
| P1 | EF-M06-b4d2f1a9 | Create `recordManualPayment.ts` handler | M |
| P1 | EF-M06-c8e5a7d3 | Create `refundPayment.ts` handler | M |
| P1 | EF-M06-d7f3b9e1 | Create `getFinancialReport.ts` handler | M |
| P1 | EF-M06-f9d1b3c5 | Create `getMyPayments.ts` handler | S |
| P1 | EF-M06-a3e7d2b8 | Create dues config handlers (3 endpoints) | L |
| P1 | EF-M06-b6f4c8a1 | Create reminder schedule GET/PUT handlers | S |
| P1 | EF-M06-a4b5c6d7 | Create gateway adapter interface + Stripe impl | M |
| P2 | 8 findings | Role checks, type safety, cross-module imports, domain events, webhook bridge, Life member guard, TODOs | M |
| P3 | 3 findings | PHP hardcode, orphan tests, mislocated schema | S |

**Effort:** S = < 1 day, M = 1-3 days, L = 3-5 days

---

*End of report. 19 findings across ~80 files in 3 directories (dues/, billing/, association:member/repos/).*


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
