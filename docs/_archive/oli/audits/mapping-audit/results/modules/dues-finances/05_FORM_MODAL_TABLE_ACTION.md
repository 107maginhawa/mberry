# Module 2: Dues/Finances — Form/Modal/Table Action Audit

**Scope**: Dues config forms, payment forms, invoice actions, assessment forms
**Date**: 2026-05-26

---

## 1. Form Registry

| Form | Route/Page | Fields | Submit Handler | API | Role | Validation | Existing Tests | Status |
|------|-----------|--------|---------------|-----|------|-----------|---------------|--------|
| DuesConfigForm | `/officer/finances/dues` | Rates, billing period, grace period, fund allocation % | React form → PATCH API | `PATCH /association/member/cpd-config/:orgId` | Officer (frontend), Any auth (backend) | Frontend Zod [NEEDS MANUAL CONFIRMATION] | NONE (E2E) | [LIKELY BUG] — backend lacks officer guard |
| ProofUploadForm | `/org/$orgSlug/dues` | File upload, invoice selection | React form → POST API | POST proof upload endpoint | Member | File type/size validation | NONE (E2E) | Likely working |
| Special Assessment Create | `/officer/finances/assessments` | Name, amount, description, org | React form → POST API | `POST /association/member/special-assessments` | Officer (frontend), Any auth (backend) | [NEEDS MANUAL CONFIRMATION] | NONE | [LIKELY BUG] — backend lacks officer guard |
| Invoice Create | API-driven | customer, merchant, lineItems, currency, paymentDue | API call | `POST /invoices` | Merchant/authenticated | TypeSpec-generated validators | `createInvoice.test.ts` (STRONG) | Working |
| Payment Token Checkout | `/pay/:token/checkout` | Payment method selection | Form → POST | `POST /pay/:token/checkout` | Unauthenticated | Token validation | `checkoutPaymentToken.test.ts` | Working |

---

## 2. Modal Registry

| Modal | Trigger | Confirm Action | Cancel/Close | Accessibility | Existing Tests | Status |
|-------|---------|---------------|-------------|--------------|---------------|--------|
| Void Invoice | "Void" button on invoice detail | POST void → refreshes list | Close/cancel | [NEEDS MANUAL CONFIRMATION] | `voidInvoice.test.ts` (backend STRONG) | Backend working, frontend untested |
| Refund Invoice | "Refund" button on invoice detail | POST refund with amount | Close/cancel | [NEEDS MANUAL CONFIRMATION] | `refundInvoicePayment.test.ts` (backend STRONG) | Backend working, frontend untested |
| Refund Dues Payment | Refund action in officer view | POST refund → refreshes | Close/cancel | [NEEDS MANUAL CONFIRMATION] | Backend tested | Backend working, frontend untested |
| Delete Assessment | "Delete" in assessment list | DELETE assessment | Close/cancel | [NEEDS MANUAL CONFIRMATION] | NONE | [LIKELY BUG] — backend unguarded |

---

## 3. Table/List Action Registry

| Table/List | Action | Role | Handler/API | State Updates | Existing Tests | Status |
|-----------|--------|------|------------|--------------|---------------|--------|
| Payment History (member) | Export CSV | Member | Client-side `buildPaymentCsv` | Download file | NONE | Working |
| Invoices List (officer) | View detail | Officer | GET invoice by ID | Navigate to detail | NONE (E2E) | Working |
| Invoices List (officer) | Finalize | Officer | POST finalize | Update status | `finalizeInvoice.test.ts` (STRONG) | Backend working |
| Invoices List (officer) | Void | Officer | POST void | Update status | `voidInvoice.test.ts` (STRONG) | Backend working |
| Assessments List | Create/Edit/Delete/Apply | Officer (frontend) | CRUD endpoints | Refresh list | NONE | [LIKELY BUG] — backend unguarded |
| Recent Activity Feed | View entry | Officer | Read-only | None | NONE | Working |

---

## 4. Gap Report

| ID | Issue | Component | Role | Backend/API Link | Severity | Recommended Test |
|----|-------|-----------|------|-----------------|----------|-----------------|
| DUES-FMT-01 | DuesConfigForm frontend validation not compared against backend schema | `DuesConfigForm` | Officer | PATCH cpd-config | P2 | Compare form Zod schema vs backend validator fields |
| DUES-FMT-02 | Invoice void/refund modals — confirmation, escape key, focus trap not verified | Invoice detail page | Officer | POST void/refund | P2 — [NEEDS MANUAL CONFIRMATION] | Component test: modal accessibility |
| DUES-FMT-03 | Special assessment form — no loading/error/success states verified | Assessment form | Officer | POST special-assessments | P2 | E2E: submit → verify loading → success state |
| DUES-FMT-04 | ProofUploadForm — no file type/size error handling verified | `ProofUploadForm` | Member | POST proof upload | P2 — [NEEDS MANUAL CONFIRMATION] | Component test: upload invalid file → error |
| DUES-FMT-05 | Fund allocation form — must total 100%, UI enforcement unclear | DuesConfigForm | Officer | PATCH cpd-config | P1 | Component test: allocation != 100% → validation error |
| DUES-FMT-06 | **Special assessment create/edit dialog has NO Zod schema** — uses JS checks (`if (!name)`) while backend has NO validation either. Double validation gap. | SpecialAssessmentsList dialog | Officer | POST special-assessments | **P0** | API: POST with empty/invalid body → verify rejection |
| DUES-FMT-07 | DuesConfigForm Zod validates `defaultAmount` (positive) and `gracePeriodDays` (0-90 int) but backend endpoint is hand-wired — **field alignment unverified** | DuesConfigForm | Officer | PATCH cpd-config | P1 | Integration: compare form fields vs backend accepted fields |
| DUES-FMT-08 | ProofUploadForm file validation is separate from Zod schema — stored in component state, not form validation | ProofUploadForm | Member | POST proof | P2 | Component: upload invalid file type → verify error |

---

## Summary

- **5 forms**, **4 modals**, **6 table actions**
- **P0**: 1 (DUES-FMT-06 — special assessment dialog + backend both lack validation)
- **P1**: 2 (fund allocation 100% constraint, DuesConfigForm field alignment)
- **P2**: 5 (validation alignment, modal accessibility, loading states, file validation, proof upload)
