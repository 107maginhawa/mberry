# Module 2: Dues/Finances — Frontend Interaction Integrity Audit

**Scope**: Member dues page, officer finance pages, payment flows
**Date**: 2026-05-26

---

## 1. Interaction Registry

| ID | Route/Page | Component | Action | Element Type | Role | Backend/API | Status | Existing Test |
|----|-----------|-----------|--------|-------------|------|------------|--------|--------------|
| DUES-INT-01 | `/org/$orgSlug/dues` | `ProofUploadForm` | Upload payment proof | File upload form | Member | POST proof upload API | Likely working | NONE (E2E) |
| DUES-INT-02 | `/org/$orgSlug/dues` | `DuesStatusCard` | View dues status | Display card | Member | GET dues status | Working | NONE |
| DUES-INT-03 | `/org/$orgSlug/dues` | `ArrearsBreakdown` | View arrears detail | Expandable section | Member | Data from dues query | Working | NONE |
| DUES-INT-04 | `/org/$orgSlug/dues` | `PaymentScheduleTimeline` | View payment timeline | Timeline display | Member | Data from dues query | Working | NONE |
| DUES-INT-05 | `/org/$orgSlug/dues` | Export CSV button | Export payment history | Button | Member | Client-side `buildPaymentCsv` + `downloadCsv` | Working | NONE |
| DUES-INT-06 | `/my/payments` | `PaymentHistoryTable` | View all payments | Table | Member | GET dues-payments | Working | NONE |
| DUES-INT-07 | `/officer/finances/` | Dashboard metrics | View collection metrics | Metric cards | Officer | GET dues-financial-dashboard | Working | NONE |
| DUES-INT-08 | `/officer/finances/` | `CollectionsAreaChart` | View monthly trends | Chart | Officer | GET dues-metrics (hand-wired) | Working | NONE |
| DUES-INT-09 | `/officer/finances/` | `RecentActivityFeed` | View recent activity | Feed list | Officer | Data from dashboard | Working | NONE |
| DUES-INT-10 | `/officer/finances/dues` | `DuesConfigForm` | Configure dues rates | Form | Officer | PATCH cpd-config | Likely working — [LIKELY BUG] backend lacks officer guard | NONE |
| DUES-INT-11 | `/officer/finances/assessments` | `SpecialAssessmentsList` | CRUD assessments | List + actions | Officer | Special assessment API | Likely working — [LIKELY BUG] backend lacks officer guard | NONE |
| DUES-INT-12 | `/officer/finances/invoices` | Invoice list | View/manage invoices | Table | Officer | GET invoices | Working | NONE |
| DUES-INT-13 | `/officer/finances/invoices/$id` | Invoice detail | View/void/refund invoice | Detail + actions | Officer | GET/POST invoice actions | Working | NONE |
| DUES-INT-14 | `/officer/payments` | Payment list | View payments | Table | Officer | GET payments | Working | NONE |
| DUES-INT-15 | Payment link email | Checkout flow | Pay via one-tap link | External link → form | Unauthenticated | GET validate + POST checkout | Working | `checkoutPaymentToken.test.ts` |

---

## 2. Broken Interaction Report

| ID | Issue | File | Route | Role | Evidence | Severity | Recommended Test |
|----|-------|------|-------|------|---------|----------|-----------------|
| DUES-BINT-01 | `DuesConfigForm` submits to backend that lacks officer guard — any member could potentially submit | `officer/finances/dues.tsx` | `/officer/finances/dues` | Officer (intended) / Any member (actual backend) | PATCH cpd-config has `authMiddleware()` only | P1 | API: non-officer PATCH → expect 403 |
| DUES-BINT-02 | `SpecialAssessmentsList` actions hit backend without officer guard | `officer/finances/assessments.tsx` | `/officer/finances/assessments` | Officer (intended) / Any member (actual backend) | 6 special-assessment routes lack officer check | P0 | API: non-officer CRUD → expect 403 |
| DUES-BINT-03 | Member dues page payment actions — unclear if "Pay Online" button exists or only proof upload | `org/$orgSlug/dues.tsx` | `/org/$orgSlug/dues` | Member | Page has `ProofUploadForm` and status cards but online payment button not clearly visible | P2 — [NEEDS MANUAL CONFIRMATION] | E2E: verify pay button exists for pending invoices |

---

## 3. Missing Test Matrix

| Interaction | Risk | Recommended Test Type | Suggested Assertion |
|------------|------|----------------------|---------------------|
| Member views dues status | Member can't see their dues | E2E | Navigate to dues → verify status card, outstanding amount displayed |
| Member uploads proof | Proof doesn't reach backend | E2E | Upload file → verify success toast, proof attached to payment |
| Officer views finance dashboard | Dashboard shows stale/wrong data | E2E | Navigate to finances → verify metrics load, chart renders |
| Officer configures dues | Unauthorized config change | API integration | Non-officer PATCH → 403; officer PATCH → 200 |
| Officer manages assessments | Unauthorized assessment creation | API integration | Non-officer POST → 403; officer POST → 201 |
| Payment link checkout | Payment fails silently | E2E | Click payment link → validate → checkout → verify payment recorded |
| Export CSV | Export produces corrupt data | Component | Click export → verify CSV contains correct columns/rows |

---

## Summary

- **15 interactions identified**
- **P0 findings**: 1 (DUES-BINT-02 — assessment actions unguarded)
- **P1 findings**: 1 (DUES-BINT-01 — dues config unguarded)
- **P2 findings**: 1 (DUES-BINT-03 — unclear pay button)
- **E2E test coverage**: NONE for any finance interaction
