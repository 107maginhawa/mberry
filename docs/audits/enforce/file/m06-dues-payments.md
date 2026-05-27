# File Enforcement: m06-dues-payments

> Generated: 2026-05-27 | Auditor: oli-enforce-file | Module: M06 Dues & Payments
> Directories: `services/api-ts/src/handlers/dues/`, `services/api-ts/src/handlers/billing/`

---

## 1. Spec Artifacts Used

| Artifact | Path | Version |
|----------|------|---------|
| MODULE_SPEC | `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` | v2.0, 2026-05-21 |
| API_CONTRACTS | `docs/product/modules/m06-dues-payments/API_CONTRACTS.md` | v2.0, 2026-05-21 |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | v1.0 |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | v1.0 |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | v1.0 |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | v1.0 |

---

## 2. File Classification

### 2a. Dues Directory (`services/api-ts/src/handlers/dues/`)

| # | File | Role | Lines | Spec Trace | Notes |
|---|------|------|-------|------------|-------|
| 1 | `checkoutPaymentToken.ts` | controller | ~90 | WF-038, M06-S12 | Public endpoint: POST /pay/:token/checkout. Creates Stripe checkout from token. |
| 2 | `sendPaymentLink.ts` | controller | ~65 | WF-038, M06-S12 | Officer sends payment link: POST /org/:orgId/payments/send-link. |
| 3 | `validatePaymentToken.ts` | controller | ~50 | WF-038, M06-S12, API_CONTRACTS GET /pay/:token | Public: validates token, returns payment details. |
| 4 | `getDuesDashboard.ts` | controller | ~55 | WF-043, M06-S10, API_CONTRACTS GET /org/:id/reports/financial | Dashboard stats. Imports from association:member repo (cross-module). |
| 5 | `repos/dues.repo.ts` | repository | ~280 | M06-S1 through M06-S10 | Full dues repository: config CRUD, payment CRUD, fund allocation, report aggregations, reminder schedules. **Deprecated header** but actively used. |
| 6 | `repos/payment-token.repo.ts` | repository | ~60 | M06-S12 | Token persistence: create, find by hash, mark used. |
| 7 | `repos/payment-token.schema.ts` | entity | ~40 | DOMAIN_MODEL (not in spec entities) | pgTable `payment_token`: tokenHash, personId, organizationId, duesAmount, currency, expiresAt, usedAt, createdByOfficer. |
| 8 | `utils/payment-token.ts` | utility | ~45 | M06-S12 | HMAC-SHA256 token generation, hashing, expiry check. Reuses invite token pattern. |
| 9 | `jobs/index.ts` | service | ~35 | WF-042, M06-S8 | Job registration: reminderProcessor (daily cron), webhookRetryProcessor (60s interval). |
| 10 | `jobs/webhookRetryProcessor.ts` | service | ~130 | WF-038, M06-S6, AC-M06-002 | Retries pending_retry webhook entries with exponential backoff. Dead-letters after max retries. |
| 11 | `jobs/reminderProcessor.ts` | service | ~100 | WF-042, M06-S8, M06-S11 | Processes dues reminders: queries overdue members, deduplicates via reminder_log, creates notifications. |
| 12 | `jobs/autoInvoiceGenerator.ts` | service | ~95 | WF-038, M06-S1 | Auto-generates invoices for members approaching billing cycle. |
| 13 | `checkoutPaymentToken.test.ts` | test | -- | -- | Tests for token checkout flow. |
| 14 | `sendPaymentLink.test.ts` | test | -- | -- | Tests for send-link handler. |
| 15 | `validatePaymentToken.test.ts` | test | -- | -- | Tests for token validation. |
| 16 | `getDuesDashboard.test.ts` | test | -- | -- | Tests for dashboard handler. |
| 17 | `dues-config.test.ts` | test | -- | -- | Tests for dues config operations (no matching handler file). |
| 18 | `bulkRecordPayments.test.ts` | test | -- | -- | Tests for bulk payment recording (no matching handler file). |
| 19 | `repos/dues.repo.test.ts` | test | -- | -- | Repository unit tests. |
| 20 | `utils/payment-token.test.ts` | test | -- | -- | Token utility unit tests. |
| 21 | `utils/fund-math.test.ts` | test | -- | -- | Fund allocation math tests (no matching utility file). |
| 22 | `utils/settle-payment.test.ts` | test | -- | -- | Payment settlement tests (no matching utility file). |
| 23 | `utils/expiry-extension.test.ts` | test | -- | -- | Expiry extension tests (no matching utility file). |
| 24 | `jobs/index.test.ts` | test | -- | -- | Job registration tests. |
| 25 | `jobs/autoInvoiceGenerator.test.ts` | test | -- | -- | Auto-invoice tests. |
| 26 | `jobs/reminderProcessor.test.ts` | test | -- | -- | Reminder processor tests. |
| 27 | `jobs/webhookRetryProcessor.test.ts` | test | -- | -- | Webhook retry tests. |

### 2b. Billing Directory (`services/api-ts/src/handlers/billing/`)

| # | File | Role | Lines | Spec Trace | Notes |
|---|------|------|-------|------------|-------|
| 28 | `createInvoice.ts` | controller | ~120 | API_CONTRACTS POST /invoices | Creates invoice with line items, tax placeholder. TypeSpec-aligned. |
| 29 | `updateInvoice.ts` | controller | ~110 | -- | Updates draft invoices only. Role-gated (merchant/admin). |
| 30 | `deleteInvoice.ts` | controller | ~60 | -- | Soft-deletes draft invoices. Merchant/admin only. |
| 31 | `finalizeInvoice.ts` | controller | ~90 | -- | Transitions invoice draft -> open. Creates Stripe PaymentIntent. |
| 32 | `getInvoice.ts` | controller | ~70 | -- | Reads single invoice. Customer/merchant/admin access. |
| 33 | `listInvoices.ts` | controller | ~90 | -- | Paginated invoice list with status/customer/merchant filters. |
| 34 | `payInvoice.ts` | controller | ~80 | -- | Records payment against invoice. Creates Stripe checkout session. |
| 35 | `captureInvoicePayment.ts` | controller | ~110 | -- | Captures authorized PaymentIntent. Updates invoice to paid. |
| 36 | `refundInvoicePayment.ts` | controller | ~100 | -- | Creates Stripe refund. Updates invoice status. |
| 37 | `markInvoiceUncollectible.ts` | controller | ~90 | -- | Marks invoice uncollectible. Has TODO for cleanup tasks. |
| 38 | `voidInvoice.ts` | controller | ~100 | -- | Voids invoice + cancels PaymentIntent. Conflict checks. |
| 39 | `createMerchantAccount.ts` | controller | ~80 | -- | Creates Stripe Connect account + onboarding link. |
| 40 | `onboardMerchantAccount.ts` | controller | ~110 | -- | Generates new onboarding link / checks onboarding status. |
| 41 | `getMerchantAccount.ts` | controller | ~90 | -- | Returns merchant account with balance from Stripe. |
| 42 | `getMerchantDashboard.ts` | controller | ~95 | -- | Merchant analytics: revenue, invoice counts, recent activity. |
| 43 | `handleStripeWebhook.ts` | controller | ~200 | WF-038 (bridge) | Processes Stripe events: payment_intent.succeeded/failed, account.updated, etc. |
| 44 | `repos/billing.schema.ts` | entity | ~200 | DOMAIN_MODEL Financial context | pgTable definitions: invoices, invoice_line_items, merchant_accounts. Enums: invoice_status, payment_status. |
| 45 | `repos/billing.repo.ts` | repository | ~250 | -- | InvoiceRepository + MerchantAccountRepository classes. CRUD, filtering, status updates. |
| 46 | `captureInvoicePayment.test.ts` | test | -- | -- | -- |
| 47 | `createInvoice.test.ts` | test | -- | -- | -- |
| 48 | `createMerchantAccount.test.ts` | test | -- | -- | -- |
| 49 | `deleteInvoice.test.ts` | test | -- | -- | -- |
| 50 | `finalizeInvoice.test.ts` | test | -- | -- | -- |
| 51 | `getInvoice.test.ts` | test | -- | -- | -- |
| 52 | `getMerchantAccount.test.ts` | test | -- | -- | -- |
| 53 | `getMerchantDashboard.test.ts` | test | -- | -- | -- |
| 54 | `handleStripeWebhook.test.ts` | test | -- | -- | -- |
| 55 | `listInvoices.test.ts` | test | -- | -- | -- |
| 56 | `markInvoiceUncollectible.test.ts` | test | -- | -- | -- |
| 57 | `onboardMerchantAccount.test.ts` | test | -- | -- | -- |
| 58 | `payInvoice.test.ts` | test | -- | -- | -- |
| 59 | `refundInvoicePayment.test.ts` | test | -- | -- | -- |
| 60 | `updateInvoice.test.ts` | test | -- | -- | -- |
| 61 | `voidInvoice.test.ts` | test | -- | -- | -- |
| 62 | `lifecycle.test.ts` | test | -- | -- | Full invoice lifecycle integration test. |
| 63 | `accessControl.test.ts` | test | -- | -- | Role-based access control tests across all billing endpoints. |
| 64 | `repos/billing.repo.test.ts` | test | -- | -- | -- |
| 65 | `repos/billing-config.repo.test.ts` | test | -- | -- | Config repo tests (no matching source file). |
| 66 | `ac-m16.advertising.test.ts` | test | -- | -- | Cross-module: M16 advertising billing tests. |
| 67 | `ac-m17.marketplace.test.ts` | test | -- | -- | Cross-module: M17 marketplace billing tests. |
| 68 | `br-38.marketplace-disclosure.test.ts` | test | -- | -- | BR-38 marketplace disclosure compliance test. |

**Totals:** 68 files (27 dues + 41 billing). 24 source files, 44 test files.

---

## 3. Findings

### 3a. Summary

| Severity | Count |
|----------|-------|
| P0 (Blocker) | 1 |
| P1 (Critical) | 7 |
| P2 (Warning) | 8 |
| P3 (Info) | 3 |
| **Total** | **19** |

### 3b. Findings Table

| ID | Sev | Check | Finding | File | Spec Source |
|----|-----|-------|---------|------|-------------|
| EF-M06-a1e7c3b2 | P0 | naming | `sendPaymentLink` has no role check -- any authenticated user can generate payment links for any member. Spec requires treasurer/president/admin with 2FA. Route in app.ts uses `authMiddleware()` + `orgContextMiddleware()` but no position restriction. | `dues/sendPaymentLink.ts` | MODULE_SPEC S6: "Record payment: super, admin, president (2FA), treasurer (2FA)" |
| EF-M06-b4d2f1a9 | P1 | error-taxonomy | No handler file for manual payment recording (`POST /org/:id/payments/manual`). Repo has `createPayment()`, `createFundAllocations()`, `findRecentPaymentForPerson()` (duplicate check) ready. Missing: role+2FA validation, duplicate warning, fund split orchestration, PaymentRecorded event emission. | `dues/` (missing) | API_CONTRACTS S2.1, MODULE_SPEC WF-044, M06-S3 |
| EF-M06-c8e5a7d3 | P1 | error-taxonomy | No handler for refund processing (`POST /org/:id/payments/:id/refund`). Repo has `updatePaymentStatus()` and `createFundAllocations(isReversal=true)`. Missing: role check, status transition validation, fund reversal chain, membership expiry reversal, PaymentRefunded event. | `dues/` (missing) | API_CONTRACTS S2.1, MODULE_SPEC WF-041, M06-S9 |
| EF-M06-d7f3b9e1 | P1 | error-taxonomy | No financial report handler (`GET /org/:id/reports/financial`). Repo has 4 report methods: `reportCollectionSummary`, `reportFundBreakdown`, `reportDuesStatus`, `reportAging`. None are wired to an endpoint. | `dues/` (missing) | API_CONTRACTS S2.2, MODULE_SPEC WF-043, M06-S10 |
| EF-M06-e2c4a6f8 | P1 | error-taxonomy | No receipt PDF handler (`GET /org/:id/payments/:id/receipt`). `getNextReceiptSequence()` generates sequential receipt numbers. No handler generates or serves the PDF. | `dues/` (missing) | API_CONTRACTS S2.1, MODULE_SPEC WF-045, M06-S7 |
| EF-M06-f9d1b3c5 | P1 | error-taxonomy | No member payment history handler (`GET /my/payments`). Repo `listPayments()` supports person filter but no handler wires it for self-service. | `dues/` (missing) | API_CONTRACTS S2.1, MODULE_SPEC S9 |
| EF-M06-a3e7d2b8 | P1 | error-taxonomy | No dues configuration handlers (`PUT /org/:id/config/dues`, `PUT /org/:id/config/funds`). Repo has `upsertConfig()`, `replaceFunds()`, `replaceCategoryOverrides()` ready. Test file `dues-config.test.ts` exists but no source handler. | `dues/` (missing) | API_CONTRACTS S2.3, M06-S1, M06-S2 |
| EF-M06-b6f4c8a1 | P1 | error-taxonomy | No reminder schedule handlers (`GET/PUT /org/:id/config/reminder-schedule`). Repo has `getReminderSchedules()` and `replaceReminderSchedules()`. | `dues/` (missing) | API_CONTRACTS S2.4, M06-S8 |
| EF-M06-c2a5e9d7 | P2 | domain-terms | `getDuesDashboard` checks session but not officer position. Dashboard restricted to super/admin/president(2FA)/treasurer(2FA) per spec. Currently uses `requirePosition` from `@/utils/officer-check` but actual enforcement depends on runtime middleware wiring. | `dues/getDuesDashboard.ts` | MODULE_SPEC S6: "Dashboard: super, admin, president (2FA), treasurer (2FA)" |
| EF-M06-d4b8f1c3 | P2 | data-shape | `checkoutPaymentToken` uses unsafe `(gatewayConfig as any).connected` and `(gatewayConfig as any).publicKey`. Schema `duesGatewayConfigs` has `encryptedSecretKey` not `publicKey`. The `publicKey` is passed as Stripe `connectedAccountId` (expects `acct_xxx` format). Two type-safety violations. | `dues/checkoutPaymentToken.ts:49,67` | MODULE_SPEC S7: DuesGatewayConfig entity |
| EF-M06-e1c9a5b7 | P2 | import-boundaries | `getDuesDashboard.ts` imports from `association:member/repos/dues-payments.repo` (cross-handler directory import). `dues/repos/dues.repo.ts` imports from `association:member/repos/membership.schema` and `association:member/repos/dues.schema`. Three cross-module boundary violations. | `dues/getDuesDashboard.ts`, `dues/repos/dues.repo.ts` | MODULE_SPEC S20 AI-1: "Two handler directories exist" (acknowledged but should be migrated) |
| EF-M06-f3d7b2a4 | P2 | domain-terms | `validatePaymentToken` does not check Life member status before returning payment details. Spec explicitly states: "Life Members must not see a pay button or receive reminders." Token validation is the last guard before checkout. | `dues/validatePaymentToken.ts` | MODULE_SPEC S5: Life member dues exemption |
| EF-M06-a8c4e6d2 | P2 | domain-terms | Domain events registry defines only `dues.payment.recorded`. Missing 3 spec-required events: `dues.payment.refunded`, `dues.invoice.generated`, `dunning.escalation`. | `core/domain-events.registry.ts` | MODULE_SPEC S10b Published Events, API_CONTRACTS S3 |
| EF-M06-b5e9c1f7 | P2 | domain-terms | Domain event consumers handle `dues.payment.recorded` -> membership expiry update. Missing consumed event: `membership.status.changed` -> block/unblock dues for suspended members. | `core/domain-event-consumers.ts` | MODULE_SPEC S10b Consumed Events |
| EF-M06-c7a3d5b1 | P2 | import-boundaries | `billing/handleStripeWebhook.ts` processes Stripe payment events but does not bridge to dues module. When `payment_intent.succeeded` fires for a dues payment, no dues payment record is created, no fund allocation happens, no `dues.payment.recorded` event emits. The two-level payment architecture (BR-30) keeps them separate but the webhook-to-dues bridge is unimplemented. | `billing/handleStripeWebhook.ts` | MODULE_SPEC S4 WF-038 steps 4-5, S20 AI-5 |
| EF-M06-d9f2a4c6 | P2 | data-shape | `billing/markInvoiceUncollectible.ts` has 3 TODO comments: missing payment intent cleanup, missing `context` field mapping, missing `paymentCaptureMethod` in schema. Response object assembled with hardcoded placeholder values. | `billing/markInvoiceUncollectible.ts` | Billing schema: invoices table |
| EF-M06-e6b8d3f5 | P3 | naming | `sendPaymentLink` hardcodes `currency = 'PHP'` as fallback. Should read from `DuesOrgConfig.currency` first. Config is fetched but default could mask missing config for non-PHP orgs. | `dues/sendPaymentLink.ts:41` | MODULE_SPEC S7: DuesOrgConfig entity |
| EF-M06-f4a2c7e9 | P3 | data-shape | 6 test files exist without matching source files: `bulkRecordPayments.test.ts`, `dues-config.test.ts`, `utils/fund-math.test.ts`, `utils/settle-payment.test.ts`, `utils/expiry-extension.test.ts`, `billing/repos/billing-config.repo.test.ts`. Tests were written TDD-first but implementation files are missing. | `dues/` and `billing/repos/` (orphaned tests) | MODULE_SPEC S19 Vertical Slice Plan |
| EF-M06-a7d5f9b3 | P3 | naming | `dues/repos/dues.repo.ts` has `@deprecated` JSDoc but is still actively imported by `getDuesDashboard.ts`. Should complete migration to canonical repo or remove deprecation marker. | `dues/repos/dues.repo.ts` | Code hygiene |

---

## 4. Per-File 5-Check Details

### Check Legend
1. **Error taxonomy** -- Does the file use the correct error classes from `@/core/errors` and match spec error codes?
2. **Domain terms** -- Do variable/function names match MODULE_SPEC S2 domain glossary?
3. **Data shape** -- Do types/schemas match MODULE_SPEC S7 entities and API_CONTRACTS request/response shapes?
4. **Naming** -- Do file names, function names, route paths follow project conventions?
5. **Import boundaries** -- Does the file only import from allowed modules (own handler dir, core/, generated/, shared utils)?

### Dues Source Files

| File | Error Tax | Domain Terms | Data Shape | Naming | Imports | Verdict |
|------|-----------|-------------|------------|--------|---------|---------|
| `checkoutPaymentToken.ts` | PASS (no spec errors needed for public endpoint) | PASS | **FAIL** (unsafe `as any` casts, wrong Stripe field) | PASS | PASS (imports own repos + utils) | 1 finding |
| `sendPaymentLink.ts` | PASS | PASS | PASS | **WARN** (PHP hardcode) | PASS | 2 findings |
| `validatePaymentToken.ts` | PASS | **FAIL** (no Life member check) | PASS | PASS | PASS | 1 finding |
| `getDuesDashboard.ts` | PASS | **WARN** (role check depends on middleware) | PASS | PASS | **FAIL** (cross-module import) | 2 findings |
| `repos/dues.repo.ts` | PASS | PASS | PASS | **WARN** (deprecated but used) | **FAIL** (imports association:member schemas) | 2 findings |
| `repos/payment-token.repo.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `repos/payment-token.schema.ts` | N/A | PASS | PASS | PASS | PASS (imports person + platformadmin schemas -- acceptable FK refs) | Clean |
| `utils/payment-token.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/index.ts` | PASS | PASS | N/A | PASS | PASS | Clean |
| `jobs/webhookRetryProcessor.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/reminderProcessor.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `jobs/autoInvoiceGenerator.ts` | PASS | PASS | PASS | PASS | PASS | Clean |

### Billing Source Files

| File | Error Tax | Domain Terms | Data Shape | Naming | Imports | Verdict |
|------|-----------|-------------|------------|--------|---------|---------|
| `createInvoice.ts` | PASS | PASS | PASS | PASS | PASS (imports person repo -- acceptable FK lookup) | Clean |
| `updateInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `deleteInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `finalizeInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `getInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `listInvoices.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `payInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `captureInvoicePayment.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `refundInvoicePayment.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `markInvoiceUncollectible.ts` | PASS | PASS | **WARN** (3 TODO placeholders) | PASS | PASS | 1 finding |
| `voidInvoice.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `createMerchantAccount.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `onboardMerchantAccount.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `getMerchantAccount.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `getMerchantDashboard.ts` | PASS | PASS | PASS | PASS | PASS | Clean |
| `handleStripeWebhook.ts` | PASS | PASS | PASS | PASS | **WARN** (no bridge to dues) | 1 finding |
| `repos/billing.schema.ts` | N/A | PASS | PASS | PASS | PASS | Clean |
| `repos/billing.repo.ts` | PASS | PASS | PASS | PASS | PASS | Clean |

---

## 5. Review Required

### P0 -- Must Fix Before Merge

| ID | Action Required |
|----|----------------|
| EF-M06-a1e7c3b2 | Add `requirePosition(['treasurer', 'president'])` + 2FA middleware to `sendPaymentLink`. Currently any authenticated org member can generate payment links. |

### P1 -- Must Fix Before Release

| ID | Action Required |
|----|----------------|
| EF-M06-b4d2f1a9 | Implement `recordManualPayment.ts` handler wiring repo methods + role/2FA + duplicate check + fund split + event emission. |
| EF-M06-c8e5a7d3 | Implement `refundPayment.ts` handler with status transition, fund reversal, expiry reversal, event emission. |
| EF-M06-d7f3b9e1 | Implement `getFinancialReport.ts` handler exposing the 4 repo report methods. |
| EF-M06-e2c4a6f8 | Implement `generatePaymentReceipt.ts` handler for PDF receipt generation + serving. |
| EF-M06-f9d1b3c5 | Implement `getMyPayments.ts` handler for member self-service payment history. |
| EF-M06-a3e7d2b8 | Implement dues config handlers (upsertDuesConfig, updateFunds). Test stubs already exist. |
| EF-M06-b6f4c8a1 | Implement reminder schedule GET/PUT handlers. |

### P2 -- Should Fix

8 findings covering: position enforcement, type safety, cross-module imports, domain event gaps, webhook bridge, Life member guard, TODO placeholders.

### P3 -- Informational

3 findings: PHP currency hardcode, orphaned test files, deprecated-but-used repo.

---

## 6. Structural Health

| Metric | Dues | Billing | Combined |
|--------|------|---------|----------|
| Source files | 12 | 18 | 30 |
| Test files | 15 | 23 | 38 |
| Test-to-source ratio | 1.25 | 1.28 | 1.27 |
| Files with findings | 5 | 2 | 7 |
| Clean files | 7 | 16 | 23 |
| Orphaned tests (no source) | 5 | 1 | 6 |
| Missing handlers (spec-required) | 7 | 0 | 7 |

### API Contract Coverage

| Spec Endpoint | Handler Exists | Status |
|---------------|---------------|--------|
| POST `/org/:id/payments/manual` | NO | **MISSING** |
| POST `/org/:id/payments/checkout` | `checkoutPaymentToken.ts` (via token) | Partial (token-based only) |
| POST `/webhooks/:provider` | `handleStripeWebhook.ts` (billing) | Platform-level only, no dues bridge |
| POST `/org/:id/payments/:id/refund` | NO | **MISSING** |
| GET `/org/:id/payments/:id/receipt` | NO | **MISSING** |
| GET `/my/payments` | NO | **MISSING** |
| GET `/pay/:token` | `validatePaymentToken.ts` | Implemented |
| GET `/org/:id/reports/financial` | NO | **MISSING** |
| PUT `/org/:id/config/dues` | NO | **MISSING** |
| PUT `/org/:id/config/funds` | NO | **MISSING** |
| POST `/org/:id/config/gateway` | NO | **MISSING** |
| GET `/org/:id/config/reminder-schedule` | NO | **MISSING** |
| PUT `/org/:id/config/reminder-schedule` | NO | **MISSING** |

**Endpoint coverage: 2/13 (15.4%)**. Token-based payment flow is the only fully wired path. Core payment operations (manual record, refund, config, reports, receipts) are all repo-ready but lack handler orchestration.

---

## 7. Cross-Module Dependencies

| From | To | Type | Files | Issue |
|------|----|------|-------|-------|
| `dues/getDuesDashboard.ts` | `association:member/repos/dues-payments.repo` | Repository import | 1 | Cross-handler boundary violation |
| `dues/repos/dues.repo.ts` | `association:member/repos/membership.schema` | Schema table import | 1 | Cross-handler boundary violation |
| `dues/repos/dues.repo.ts` | `association:member/repos/dues.schema` | Schema table import | 1 | Cross-handler boundary violation (legacy) |
| `dues/checkoutPaymentToken.ts` | `association:member/repos/dues-payments.repo` | Repository import | 1 | Cross-handler boundary violation |
| `billing/handleStripeWebhook.ts` | (none to dues) | Missing bridge | 1 | No integration between billing webhooks and dues payment recording |

**Note:** Per MODULE_SPEC S20 AI-1, two handler directories are acknowledged. The `association:member` mega-module contains legacy dues schemas. Migration to `dues/repos/` is tracked but not yet complete.

---

## 8. Business Rule Traceability

| BR | Description | Handler Coverage | Status |
|----|-------------|-----------------|--------|
| BR-04 | Dues amount per org | `dues.repo.ts` has config CRUD | Repo only, no handler |
| BR-05 | Fund allocation sums to 100% | `dues.repo.ts` validates | Repo only, no handler |
| BR-06 | Payment recording by treasurer | No handler | **MISSING** |
| BR-07 | Dues expiry extension on payment | `domain-event-consumers.ts` | Event consumer exists |
| BR-08 | Refund within 30 days, not allocated | No handler | **MISSING** |
| BR-30 | Two-level gateway separation | Architecture maintained (billing/ vs dues/) | By design |
| BR-32 | 7-year financial retention | No hard-delete in repos | Compliant |

---

*End of report. 19 findings across 68 files in 2 directories.*
