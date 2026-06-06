# Module 2: Dues/Finances — Route Navigation Audit

**Scope**: Dues, billing, finance routes (frontend + backend)
**Date**: 2026-05-26

---

## 1. Route Registry

### Frontend Routes

| Route | Type | Component/Page | Auth Required | Roles | Source File |
|-------|------|---------------|--------------|-------|------------|
| `/org/$orgSlug/dues` | Member page | `MemberDuesPage` | Yes (requireAuth) | Member | `_authenticated/org/$orgSlug/dues.tsx` |
| `/my/payments` | Member page | `MyPaymentsPage` | Yes | Member | `_authenticated/my/payments.tsx` |
| `/org/$orgSlug/officer/finances/` | Officer index | `FinancesOverviewPage` | Yes (requireOrgOfficer) | Officer | `officer/finances/index.tsx` |
| `/org/$orgSlug/officer/finances/dues` | Officer page | `DuesSchedulePage` | Yes (requireOrgOfficer) | Officer | `officer/finances/dues.tsx` |
| `/org/$orgSlug/officer/finances/invoices` | Officer page | Invoices list | Yes (requireOrgOfficer) | Officer | `officer/finances/invoices.tsx` |
| `/org/$orgSlug/officer/finances/invoices/$invoiceId` | Officer page | Invoice detail | Yes (requireOrgOfficer) | Officer | `officer/finances/invoices/$invoiceId.tsx` |
| `/org/$orgSlug/officer/finances/assessments` | Officer page | `FinancesAssessmentsPage` | Yes (requireOrgOfficer) | Officer | `officer/finances/assessments.tsx` |
| `/org/$orgSlug/officer/finances/funds` | Officer page | Fund allocations | Yes (requireOrgOfficer) | Officer | `officer/finances/funds.tsx` |
| `/org/$orgSlug/officer/finances/members` | Officer page | Member finance list | Yes (requireOrgOfficer) | Officer | `officer/finances/members.tsx` |
| `/org/$orgSlug/officer/finances/members/$memberId` | Officer page | Member detail | Yes (requireOrgOfficer) | Officer | `officer/finances/members/$memberId.tsx` |
| `/org/$orgSlug/officer/payments` | Layout | Outlet wrapper | Yes (requireOrgOfficer) | Officer | `officer/payments.tsx` |
| `/org/$orgSlug/officer/payments/$paymentId` | Officer page | Payment detail | Yes (requireOrgOfficer) | Officer | `officer/payments/$paymentId.tsx` |
| `/org/$orgSlug/officer/settings/dues` | Officer page | Dues settings | Yes (requireOrgOfficer) | Officer | `officer/settings/dues.tsx` |
| `/org/$orgSlug/officer/reports/financial` | Officer page | Financial report | Yes (requireOrgOfficer) | Officer | `officer/reports/financial.tsx` |
| `/org/$orgSlug/officer/dues/treasurer` | Redirect | → `/officer/finances` | Yes | Officer | Redirect only |
| `/org/$orgSlug/officer/dues/assessments` | Redirect | → `/officer/finances/assessments` | Yes | Officer | Redirect only |
| `/org/$orgSlug/officer/dues/member.$memberId` | Officer page | Member dues detail | Yes (requireOrgOfficer) | Officer | `officer/dues/member.$memberId.tsx` |

### Backend API Routes

| Method | Path | Auth | Handler | Type |
|--------|------|------|---------|------|
| GET | `/association/member/dues-financial-dashboard/:orgId` | Auth + org context | Generated (TypeSpec) | Generated |
| GET | `/association/member/dues-invoices` | Auth + org context | Generated | Generated |
| GET | `/association/member/dues-payments` | Auth + org context | Generated | Generated |
| POST | `/association/member/dues-payments/:id/refund` | Auth + org context + `requirePosition` | `refundDuesPayment.ts` | Generated |
| PATCH | `/association/member/cpd-config/:orgId` | Auth only | `updateCpdConfig` | Hand-wired |
| GET | `/association/member/dues-configs` | Auth + org context | Generated | Generated |
| POST | `/org/:orgId/payments/send-link` | Auth + org context | `sendPaymentLink` | Hand-wired |
| GET | `/pay/:token/validate` | Public | `validatePaymentToken` | Hand-wired |
| POST | `/pay/:token/checkout` | Public | `checkoutPaymentToken` | Hand-wired |
| POST/GET/PUT/DELETE | `/association/member/special-assessments/*` | Auth only (NO officer) | Hand-wired | Hand-wired |
| POST | `/invoices` | Auth (generated) | `createInvoice` | Generated |
| GET | `/invoices/:id` | Auth (generated) | `getInvoice` | Generated |
| POST | `/invoices/:id/pay` | Auth | `payInvoice` | Generated |
| POST | `/invoices/:id/refund` | Auth | `refundInvoicePayment` | Generated |
| POST | `/invoices/:id/void` | Auth | `voidInvoice` | Generated |
| POST | `/billing/stripe-webhook` | Stripe signature | `handleStripeWebhook` | Generated |
| POST | `/billing/merchant-accounts` | Auth | `createMerchantAccount` | Generated |

---

## 2. Broken Navigation Report

| ID | Issue | Source | Target | Severity | Recommended Test |
|----|-------|--------|--------|----------|-----------------|
| DUES-NAV-01 | Old `/officer/dues/treasurer` redirects to `/officer/finances` — may confuse bookmarked URLs | Redirect route | `/officer/finances` | P3 | Smoke test: verify redirect works |
| DUES-NAV-02 | Old `/officer/dues/assessments` redirects to `/officer/finances/assessments` — same | Redirect route | `/officer/finances/assessments` | P3 | Smoke test |

---

## 3. Route Test Gap Matrix

| Route | Existing Tests | Missing Tests | Priority |
|-------|---------------|--------------|----------|
| `/org/$orgSlug/dues` (member) | NONE (E2E) | Member views dues, sees invoices, uploads proof | P1 |
| `/my/payments` | NONE (E2E) | Member views payment history | P2 |
| `/officer/finances/` | NONE (E2E) | Officer views dashboard, metrics load | P1 |
| `/officer/finances/assessments` | NONE (E2E) | Officer CRUD assessments | P1 |
| `/pay/:token/*` | `validatePaymentToken.test.ts`, `checkoutPaymentToken.test.ts` (STRONG) | E2E: member clicks payment link → checkout | P2 |
| Billing API routes | 23 test files (STRONG) | — | — |
| Dues API routes | 14 test files (STRONG) | — | — |

---

## Summary

- **17 frontend routes** (2 member, 13 officer, 2 redirects)
- **18+ backend routes** (mix of generated and hand-wired)
- **Frontend auth**: All officer routes protected by `requireOrgOfficer` layout guard
- **Backend auth**: Mixed — generated routes have auth, hand-wired routes partially guarded
- **P0**: 0 (navigation-specific; P0 permission issues covered in 02)
- **P3**: 2 (redirect artifacts)
