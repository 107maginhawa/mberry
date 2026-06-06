# Module 2: Dues/Finances — Backend API Contract Alignment Audit

**Scope**: Dues + billing handlers, TypeSpec alignment, frontend/backend drift
**Date**: 2026-05-26

---

## 1. API Catalogue

| Method | Path | Handler | Auth | Roles | Request Schema | Tests | TypeSpec |
|--------|------|---------|------|-------|---------------|-------|---------|
| GET | `/association/member/dues-financial-dashboard/:orgId` | Generated | GA+OC | Officer [INFERRED] | Path: orgId | Yes | Yes |
| GET | `/association/member/dues-invoices` | Generated | GA+OC | Member (scoped) | Query: orgId, limit | Yes | Yes |
| GET | `/association/member/dues-payments` | Generated | GA+OC | Member (scoped) | Query: orgId, limit | Yes | Yes |
| POST | `/association/member/dues-payments/:id/refund` | `refundDuesPayment.ts` | GA+OC+`requirePosition` | Treasurer/President | Body: amount, reason | Yes | Yes |
| PATCH | `/association/member/cpd-config/:orgId` | `updateCpdConfig` | GA only | **None enforced** [LIKELY BUG] | Body: config fields | `dues-config.test.ts` | **Hand-wired** |
| POST | `/org/:orgId/payments/send-link` | `sendPaymentLink.ts` | GA+OC | **None enforced** [LIKELY BUG] | Body: personId, amount?, invoiceId? | `sendPaymentLink.test.ts` | **Hand-wired** |
| GET | `/pay/:token/validate` | `validatePaymentToken.ts` | Public | None | Path: token | Yes | **Hand-wired** |
| POST | `/pay/:token/checkout` | `checkoutPaymentToken.ts` | Public | None | Path: token, Body: payment data | Yes | **Hand-wired** |
| POST/GET/PUT/DELETE | `/association/member/special-assessments/*` | Hand-wired (6 routes) | GA only | **None enforced** [LIKELY BUG] | Various | NONE | **Hand-wired** |
| POST | `/invoices` | `createInvoice.ts` | GA (generated) | Authenticated | TypeSpec-validated body | Yes (STRONG) | Yes |
| GET | `/invoices/:id` | `getInvoice.ts` | GA | Merchant/Customer/Admin | Path: id | Yes | Yes |
| GET | `/invoices` | `listInvoices.ts` | GA | Scoped by user | Query: filters, pagination | Yes | Yes |
| POST | `/invoices/:id/pay` | `payInvoice.ts` | GA | Customer only | Path: id | Yes (STRONG) | Yes |
| POST | `/invoices/:id/refund` | `refundInvoicePayment.ts` | GA | Merchant/Admin | Body: amount, reason | Yes (STRONG) | Yes |
| POST | `/invoices/:id/void` | `voidInvoice.ts` | GA | Merchant/Admin | Path: id | Yes (STRONG) | Yes |
| POST | `/invoices/:id/capture` | `captureInvoicePayment.ts` | GA | Merchant/Admin | Path: id | Yes | Yes |
| POST | `/invoices/:id/finalize` | `finalizeInvoice.ts` | GA | Merchant/Admin | Path: id | Yes | Yes |
| PATCH | `/invoices/:id` | `updateInvoice.ts` | GA | Merchant | Body: update fields | Yes | Yes |
| DELETE | `/invoices/:id` | `deleteInvoice.ts` | GA | Merchant/Admin | Path: id | Yes | Yes |
| POST | `/billing/stripe-webhook` | `handleStripeWebhook.ts` | Stripe sig | N/A | Raw body + signature | Yes (STRONG) | Yes |
| POST | `/billing/merchant-accounts` | `createMerchantAccount.ts` | GA | Self only | Body: personId | Yes | Yes |
| GET | `/merchant-accounts/:id` | `getMerchantAccount.ts` | GA | Owner/Admin | Path: id | Yes | Yes |
| POST | `/merchant-accounts/:id/dashboard` | `getMerchantDashboard.ts` | GA | Owner only | Path: id | Yes | Yes |
| POST | `/merchant-accounts/:id/onboard` | `onboardMerchantAccount.ts` | GA | Owner only | Path: id | Yes | Yes |

---

## 2. Frontend/Backend Drift Report

| ID | Issue | Frontend File | Backend File/API | Evidence | Severity |
|----|-------|-------------|-----------------|---------|----------|
| DUES-DRIFT-01 | Officer finances index uses hand-wired endpoint `dues-metrics/:orgId` — not in TypeSpec, no SDK hook | `officer/finances/index.tsx` — `api.get('/api/association/member/dues-metrics/${orgId}')` | Hand-wired in app.ts | Direct `api.get()` instead of SDK hook | P2 |
| DUES-DRIFT-02 | Member dues page uses hand-wired endpoints for membership + dues-config — direct API calls, not SDK | `org/$orgSlug/dues.tsx` — `api.get('/api/persons/me/memberships')`, `api.get('/api/association/member/dues-configs')` | Various endpoints | Bypasses typed SDK | P2 |
| DUES-DRIFT-03 | 6 special assessment endpoints are hand-wired with no TypeSpec definition — no generated types/validators | `officer/finances/assessments.tsx` | `app.ts` lines 311-316 | No request validation beyond `authMiddleware()` | P1 |
| DUES-DRIFT-04 | Billing invoice handlers check `invoice.merchant === user.id` — if person model changes, auth breaks | All billing handlers | `billing.repo.ts` | Tightly coupled to person.id = user.id assumption | P3 |

---

## 3. API Test Gap Matrix

| API | Existing Tests | Missing Tests | Priority |
|-----|---------------|--------------|----------|
| Special assessment CRUD (6 routes) | NONE | All: create, list, update, delete, apply, collection + auth denial | P0 |
| PATCH cpd-config | `dues-config.test.ts` | Non-officer access denial test | P1 |
| POST send-link | `sendPaymentLink.test.ts` | Non-officer access denial test | P1 |
| POST refundDuesPayment | `refundDuesPayment.test.ts` [NEEDS MANUAL CONFIRMATION] | Non-treasurer/president denial | P1 |
| All billing handlers | 23 test files (STRONG) | — | — |
| Payment token flow | 2 test files (STRONG) | — | — |
| Dues jobs | 3 test files | — | — |

---

## Summary

- **24+ API endpoints** in module scope
- **TypeSpec coverage**: ~60% (billing fully covered, dues partially, special assessments + payment token hand-wired)
- **Test coverage**: STRONG for billing (23 files), moderate for dues (14 files), NONE for special assessments
- **P0**: 1 (special assessment routes untested + unguarded)
- **P1**: 2 (DUES-DRIFT-03, auth denial tests missing)
- **P2**: 2 (hand-wired endpoint drift)
