# Module 2: Dues/Finances — Role-Based Journey Map Audit

**Scope**: Member payment journeys, officer finance management, billing flows
**Date**: 2026-05-26

---

## 1. Journey Registry

| Journey | Role | Start Route | End State | APIs | Existing Tests | Criticality |
|---------|------|------------|-----------|------|---------------|-------------|
| J-DUES-01: Member views dues status | Member | `/org/$orgSlug/dues` | Sees outstanding balance, invoices, payment history | GET dues-invoices, GET dues-payments, GET persons/me/memberships | Backend: STRONG | Critical/core |
| J-DUES-02: Member uploads proof of payment | Member | `/org/$orgSlug/dues` → `ProofUploadForm` | Proof attached, status changes to pending | POST proof upload | Backend tests exist | Critical/core |
| J-DUES-03: Member pays via one-tap link | Unauthenticated | Email → `/pay/:token/validate` → `/pay/:token/checkout` | Payment recorded, invoice updated | GET validate, POST checkout | `validatePaymentToken.test.ts`, `checkoutPaymentToken.test.ts` (STRONG) | Critical/core |
| J-DUES-04: Officer views finance dashboard | Officer | `/officer/finances/` | Dashboard with collection metrics, charts, activity | GET dues-financial-dashboard, GET dues-metrics | Backend tests exist | Critical/core |
| J-DUES-05: Officer configures dues | Officer | `/officer/finances/dues` | Dues config saved | PATCH cpd-config | `dues-config.test.ts` | Important |
| J-DUES-06: Treasurer refunds a dues payment | Treasurer/President | Officer finance pages → refund action | Payment refunded, membership expiry adjusted | POST refundDuesPayment | Backend test exists | Critical/core |
| J-DUES-07: Officer creates special assessment | Officer | `/officer/finances/assessments` → create form | Assessment created for org | POST special-assessments | NONE | Important |
| J-DUES-08: Officer applies assessment to members | Officer | `/officer/finances/assessments` → apply | Assessment charges applied | POST special-assessments/:id/apply | NONE | Important |
| J-DUES-09: Officer sends payment link | Officer | Officer payments page → send link | Member receives email with payment link | POST /org/:orgId/payments/send-link | `sendPaymentLink.test.ts` | Important |
| J-DUES-10: Merchant creates invoice | Merchant | API-driven | Invoice created | POST /invoices | `createInvoice.test.ts` (STRONG) | Critical/core |
| J-DUES-11: Customer pays invoice (Stripe) | Customer | Checkout URL | Payment captured/authorized | POST /invoices/:id/pay → Stripe | `payInvoice.test.ts` (STRONG) | Critical/core |
| J-DUES-12: Merchant refunds invoice | Merchant | API-driven | Refund processed via Stripe | POST /invoices/:id/refund | `refundInvoicePayment.test.ts` (STRONG) | Important |
| J-DUES-13: Stripe webhook processes payment | System | Stripe → POST /billing/stripe-webhook | Invoice status updated | handleStripeWebhook | STRONG (12+ tests) | Critical/core |
| J-DUES-14: Merchant onboards to Stripe | Merchant | API → Stripe Connect onboarding | Merchant account active | POST merchant-accounts, onboard | `createMerchantAccount.test.ts` | Important |
| J-DUES-15: Member exports payment CSV | Member | `/org/$orgSlug/dues` → Export button | CSV downloaded | Client-side only | NONE | Secondary |

---

## 2. Broken Journey Report

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Test |
|----|---------|------|------------|---------|----------|-----------------|
| DUES-BJ-01 | J-DUES-07 + J-DUES-08: Officer assessment CRUD | Officer | Backend authorization | 6 special-assessment routes lack officer guard — any authenticated user can CRUD | P0 | API: non-officer POST/PUT/DELETE → expect 403 |
| DUES-BJ-02 | J-DUES-05: Officer configures dues | Officer | Backend authorization | PATCH cpd-config lacks officer guard | P1 | API: non-officer PATCH → expect 403 |
| DUES-BJ-03 | J-DUES-09: Officer sends payment link | Officer | Backend authorization | sendPaymentLink checks user + orgId but no `requireOfficerTerm/Position` | P1 | API: non-officer POST → expect 403 |
| DUES-BJ-04 | J-DUES-03: One-tap payment | Unauthenticated | Token expiry UX | If token expired, user sees generic error — no "request new link" guidance | P2 | E2E: expired token → verify friendly message |

---

## 3. Journey Test Matrix

| Journey | Backend Tests | E2E Tests Needed | Priority |
|---------|-------------|-----------------|----------|
| J-DUES-01: View dues status | STRONG | Member loads dues page → data displays correctly | P1 |
| J-DUES-02: Upload proof | Tests exist | Upload → success toast → status change | P1 |
| J-DUES-03: One-tap payment | STRONG | Click email link → validate → checkout → success | P1 |
| J-DUES-04: Finance dashboard | Tests exist | Officer loads dashboard → metrics correct | P1 |
| J-DUES-05: Configure dues | Partial | Officer updates config → saved, non-officer blocked | P1 |
| J-DUES-06: Refund payment | Tests exist | Treasurer refunds → amount reversed, non-treasurer blocked | P1 |
| J-DUES-07+08: Assessment CRUD | NONE | Officer CRUD + apply → non-officer blocked | P0 |
| J-DUES-11: Pay invoice (Stripe) | STRONG | Customer gets checkout URL → payment succeeds | P2 |
| J-DUES-13: Webhook | STRONG | — (difficult to E2E test) | — |

---

## Summary

- **15 journeys identified**: 7 critical, 5 important, 1 secondary
- **P0 broken journeys**: 1 (assessment CRUD unguarded)
- **P1 broken journeys**: 2 (dues config, send payment link)
- **P2 broken journeys**: 1 (token expiry UX)
- **Backend journey test coverage**: STRONG for billing (Stripe lifecycle well-tested), moderate for dues
- **E2E journey test coverage**: NONE
