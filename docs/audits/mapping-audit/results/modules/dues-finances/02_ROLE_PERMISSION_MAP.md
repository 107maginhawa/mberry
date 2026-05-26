# Module 2: Dues/Finances — Role Permission Map Audit

**Scope**: handlers/dues/, handlers/billing/, association:member dues handlers, officer/finances routes, special-assessments
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Role Inventory (Module-Scoped)

| Role | Backend Usage | Frontend Usage | Notes |
|------|-------------|---------------|-------|
| Member | Can view own dues/invoices, make payments, upload proof | `/org/$orgSlug/dues`, `/my/payments` | Scoped to own data |
| Officer (any) | Can view finances dashboard, all payments | `/org/$orgSlug/officer/finances/*` | `requireOrgOfficer` guard in frontend |
| Treasurer | Can refund dues payments, manage dues config | Backend: `requirePosition(ctx, [TREASURER, PRESIDENT])` | Position-specific guard |
| President | Can refund dues payments | Backend: `requirePosition(ctx, [TREASURER, PRESIDENT])` | Same as treasurer for refunds |
| Merchant (invoice creator) | Can create/manage invoices, void, refund | Billing handlers: `invoice.merchant === user.id` | Person-based, not role-based |
| Customer (invoice recipient) | Can view/pay own invoices | Billing handlers: `invoice.customer === user.id` | Person-based |
| Admin | Full billing access | `userRoles.includes('admin')` in billing handlers | Bypasses ownership checks |
| Unauthenticated | Can validate/checkout payment tokens | `/pay/:token/validate`, `/pay/:token/checkout` | Public one-tap payment flow |

---

## 2. Permission Access Matrix

| Role | Action | Route/API | Frontend Enforcement | Backend Enforcement | Status | Severity |
|------|--------|-----------|---------------------|--------------------|---------|----|
| Member | View own dues status | `GET /association/member/dues-*` | `/org/$orgSlug/dues` page | `authMiddleware()` + org context scopes to user | Working | — |
| Member | Upload payment proof | `POST /association/member/dues-payments/*/proof` | `ProofUploadForm` component | Auth + org context | Working | — |
| Member | Pay invoice | `POST /invoices/{id}/pay` | Member dues page | `payInvoice` checks `invoice.customer === user.id` | Working | — |
| Member | View payment history | `GET /association/member/dues-payments` | `/my/payments` | Auth + session-scoped | Working | — |
| Officer | View finances dashboard | `GET /association/member/dues-financial-dashboard` | `/officer/finances/` | `authMiddleware()` + org context | Working | — |
| Officer | View dues metrics | `GET /association/member/dues-metrics/:orgId` | `/officer/finances/` (hand-wired) | `authMiddleware()` | Working — [NEEDS MANUAL CONFIRMATION] no officer check on metrics endpoint | P2 |
| Treasurer/President | Refund dues payment | `POST /association/member/dues-payments/{id}/refund` | Officer finance pages | `requirePosition(ctx, [TREASURER, PRESIDENT])` | Working — STRONG guard | — |
| Officer | Send payment link | `POST /org/:orgId/payments/send-link` | Officer payments page | `authMiddleware()` + `orgContextMiddleware()`, handler checks user auth | Working | — |
| Officer | Configure dues | `PATCH /association/member/cpd-config/:orgId` | `/officer/finances/dues` → `DuesConfigForm` | Officer layout guard | Backend: `authMiddleware()` only — [LIKELY BUG] no officer check | P1 |
| **Any authenticated** | **CRUD special assessments** | `POST/GET/PUT/DELETE /association/member/special-assessments/*` | `/officer/finances/assessments` (officer pages) | **`authMiddleware()` ONLY — no officer guard, no org context check** | **[LIKELY BUG] — any member can create/edit/delete assessments** | **P0** |
| **Any authenticated** | **Apply special assessment** | `POST /association/member/special-assessments/:id/apply` | Officer page only | **`authMiddleware()` ONLY** | **[LIKELY BUG] — any member can apply assessments to org** | **P0** |
| Merchant | Create invoice | `POST /invoices` | N/A (API-driven) | `authMiddleware()` via generated routes, no role check in handler | Working — person-based | — |
| Merchant | Void invoice | `POST /invoices/{id}/void` | N/A | `merchant === user.id` OR admin | Working | — |
| Merchant | Refund invoice | `POST /invoices/{id}/refund` | N/A | `invoice.merchant === user.id` OR admin | Working | — |
| Unauthenticated | Validate payment token | `GET /pay/:token/validate` | Email link | No auth — public endpoint | Working — by design | — |
| Unauthenticated | Checkout payment | `POST /pay/:token/checkout` | Email link → checkout page | No auth — public endpoint | Working — by design | — |
| Any | Stripe webhook | `POST /billing/stripe-webhook` | N/A | Stripe signature verification (no user auth) | Working — correct pattern | — |

---

## 3. Permission Gap Report

| ID | Gap | Role | Route/API/Component | Evidence | Risk | Severity | Recommended Test Type |
|----|-----|------|--------------------|---------|----- |----------|-----------------------|
| DUES-GAP-01 | Special assessment routes (6) have NO officer guard — any authenticated user can CRUD | Any member | `app.ts` lines 311-316: `authMiddleware()` only, no `officerAuthMiddleware()` or `requirePosition()` | Only `authMiddleware()` applied; handler files not checked for internal guard | **Financial integrity — members can create/apply assessments to org** | **P0** | API integration: non-officer sends POST /special-assessments → expect 403 |
| DUES-GAP-02 | Dues config endpoint lacks officer guard | Any member | `app.ts`: `app.patch('/association/member/cpd-config/:organizationId', authMiddleware(), updateCpdConfig)` | No `officerAuthMiddleware()` or `requirePosition()` | Members could modify dues rates/config | P1 | API integration: non-officer PATCHes cpd-config → expect 403 |
| DUES-GAP-03 | Dues metrics endpoint lacks officer guard | Any member | `app.ts`: manual query endpoint for metrics | No position/officer check visible | Members could access org-wide financial metrics | P2 | API integration: member GETs dues-metrics → check if scoped |
| DUES-GAP-04 | `sendPaymentLink` handler checks `user` and `orgId` but does not verify officer role | Any member with org context | `dues/sendPaymentLink.ts` — checks `user` and `orgId` exist, but no `requirePosition()` or `requireOfficerTerm()` | Any member in the org could generate payment links | P1 | API integration: non-officer calls send-link → expect 403 |
| DUES-GAP-05 | Billing handlers use person-based auth (merchant/customer) — no org-scoping | Any authenticated person | All billing handlers | Invoices are person-to-person, not org-scoped. Correct for billing but means org officers cannot manage member invoices. | P3 — [NEEDS PRODUCT DECISION] should officers manage billing? | — |

---

## 4. Test Coverage Recommendations

| Permission Rule | Existing Test | Missing Test | Recommended Test Type |
|----------------|--------------|-------------|----------------------|
| Special assessment officer-only CRUD | NONE | Non-officer cannot create/update/delete/apply assessments | API integration | 
| Dues config officer-only update | NONE | Non-officer cannot patch CPD config | API integration |
| `requirePosition` for refund | `refundDuesPayment.test.ts` [NEEDS MANUAL CONFIRMATION] | Verify non-treasurer/president gets 403 | API integration |
| `sendPaymentLink` officer check | `sendPaymentLink.test.ts` | Verify non-officer gets 403 | API integration |
| Billing merchant ownership | `accessControl.test.ts` (STRONG) | — | — |
| Payment token public access | `validatePaymentToken.test.ts`, `checkoutPaymentToken.test.ts` | — | — |
| Stripe webhook signature | `handleStripeWebhook.test.ts` (STRONG) | — | — |

---

## Summary

- **P0 findings**: 2 (DUES-GAP-01 — special assessments unguarded, 6 routes)
- **P1 findings**: 2 (DUES-GAP-02 dues config, DUES-GAP-04 sendPaymentLink)
- **P2 findings**: 1 (DUES-GAP-03 metrics endpoint)
- **P3 findings**: 1 (DUES-GAP-05 billing org-scoping decision)
- **Critical risk**: Special assessment endpoints allow any authenticated user to create financial obligations for an organization
