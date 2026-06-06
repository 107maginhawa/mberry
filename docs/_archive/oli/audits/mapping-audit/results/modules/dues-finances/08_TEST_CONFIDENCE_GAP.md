# Module 2: Dues/Finances — Test Confidence Gap Audit (v2 — gap-filled)

**Scope**: All dues + billing test files, frontend components, module spec BRs
**Date**: 2026-05-26 (revised)
**Coverage Target**: 90%+

---

## 1. Test Structure Summary

| Test Type | Location | Count | Notes |
|-----------|----------|-------|-------|
| Unit (dues handlers) | `handlers/dues/*.test.ts` | 14 files | getDuesDashboard, sendPaymentLink, checkoutPaymentToken, validatePaymentToken, config, bulk payments |
| Unit (dues utils) | `handlers/dues/utils/*.test.ts` | 4 files | expiry-extension, fund-math, payment-token, settle-payment |
| Unit (dues jobs) | `handlers/dues/jobs/*.test.ts` | 3 files | autoInvoiceGenerator, reminderProcessor, webhookRetryProcessor |
| Unit (dues repos) | `handlers/dues/repos/*.test.ts` | 1 file | dues.repo |
| Unit (billing handlers) | `handlers/billing/*.test.ts` | 18 files | Full CRUD lifecycle, webhook, merchant operations |
| Unit (billing repos) | `handlers/billing/repos/*.test.ts` | 2 files | billing.repo, billing-config.repo |
| Unit (billing access control) | `handlers/billing/accessControl.test.ts` | 1 file | Role-based access checks |
| Integration (billing lifecycle) | `handlers/billing/lifecycle.test.ts` | 1 file | Full invoice lifecycle |
| Business rules | `handlers/billing/br-38.*.test.ts` | 1 file | Marketplace disclosure |
| Frontend component tests | `features/dues/components/*.test.tsx` | ~7 files | [NEEDS QUALITY CLASSIFICATION] |
| E2E (finance flows) | — | 0 | **No E2E tests** |

**Total backend test files**: ~45
**Total frontend component test files**: ~7
**Total E2E tests**: 0

---

## 2. Frontend Component Analysis (Gap-Filled)

### Form Field → Backend Validation Comparison

**DuesConfigForm:**
| Frontend Field | Zod Rule | Backend Validator | Match? |
|---------------|----------|------------------|--------|
| `defaultAmount` | `z.number().positive()` | [NEEDS MANUAL CONFIRMATION] — hand-wired endpoint | Unknown |
| `gracePeriodDays` | `z.number().int().min(0).max(90)` | [NEEDS MANUAL CONFIRMATION] | Unknown |
| `billingFrequency` | Enum (annual/semi-annual/quarterly) | [NEEDS MANUAL CONFIRMATION] | Unknown |
| `dueDateMonth` | Number 1-12 | [NEEDS MANUAL CONFIRMATION] | Unknown |
| `dueDateDay` | Number 1-31 | [NEEDS MANUAL CONFIRMATION] | Unknown |
| Reminder schedule | Dynamic array with channelPush, channelEmail, daysOffset | [NEEDS MANUAL CONFIRMATION] | Unknown |

**Note**: DuesConfig endpoint is hand-wired (`PATCH /association/member/cpd-config/:orgId`) — no TypeSpec-generated validators. Cannot confirm backend validation alignment without reading handler.

**ProofUploadForm:**
| Frontend Field | Zod Rule | Backend Validator | Match? |
|---------------|----------|------------------|--------|
| `paymentMethod` | `z.string().min(1)` — enum: online/cash/check/bankTransfer/gcash/other | Generated validator | [NEEDS MANUAL CONFIRMATION] |
| `referenceNumber` | `z.string().optional()` | Generated validator | [NEEDS MANUAL CONFIRMATION] |
| File upload | Separate state (not Zod) — proofStorageKey, proofFileName, proofMimeType | Via storage service | Working |

**SpecialAssessmentsList (CRUD Dialog):**
| Frontend Field | Validation | Backend Validator | Match? |
|---------------|-----------|------------------|--------|
| `name` | Required (JS check, no Zod) | **NONE** — hand-wired route, no TypeSpec | **MISMATCH** — no backend validation |
| `description` | Optional | **NONE** | **MISMATCH** |
| `amount` | Required (JS check) | **NONE** | **MISMATCH** — P0 risk |
| `currency` | ISO 4217 select | **NONE** | **MISMATCH** |
| `dueDate` | Required ISO date | **NONE** | **MISMATCH** |
| `appliesTo` | Enum: all/selected | **NONE** | **MISMATCH** |

**CRITICAL**: Special assessment endpoints have NO backend request validation — no Zod, no TypeSpec. Combined with no officer auth guard, any authenticated user can POST arbitrary data.

---

## 3. Module Spec Business Rule Coverage (M06 — 7 key BRs)

| Rule | Description | Test Status | Severity |
|------|------------|-------------|----------|
| BR-04 | Dues amount per org (org-specific config) | `dues-config.test.ts` | [NEEDS QUALITY CLASSIFICATION] |
| BR-05 | Fund allocation (must total 100%) | `fund-math.test.ts` (STRONG) | — |
| BR-06 | Payment recording (offline capture) | Backend tests exist | — |
| BR-07 | Dues expiry extension (auto on payment) | `expiry-extension.test.ts` | [NEEDS QUALITY CLASSIFICATION] |
| BR-08 | Refund reversal (reverses extension, recomputes status) | `settle-payment.test.ts` | [NEEDS QUALITY CLASSIFICATION] |
| BR-30 | Payment gateway isolation | Not directly tested | P2 |
| BR-32 | Financial record retention (7 years) | No test | P3 |

---

## 4. Behavior-to-Test Matrix (Updated)

| Behavior | Existing Test | Quality | Missing | Severity |
|----------|--------------|---------|---------|----------|
| Invoice CRUD lifecycle | `lifecycle.test.ts` + 18 handler tests | STRONG | — | — |
| Stripe webhook processing | `handleStripeWebhook.test.ts` | STRONG (12+ tests) | — | — |
| Payment token flow | `validatePaymentToken.test.ts`, `checkoutPaymentToken.test.ts` | STRONG | — | — |
| Fund allocation math | `fund-math.test.ts` | STRONG | — | — |
| Billing access control | `accessControl.test.ts` | STRONG | — | — |
| **Special assessment CRUD** | **NONE** | **NONE** | All: create, list, update, delete, apply + auth + validation | **P0** |
| **Special assessment request validation** | **NONE** | **NONE** | No backend Zod/TypeSpec validators exist | **P0** |
| Dues config officer guard | Tested for logic, NOT for auth denial | PARTIAL | Non-officer denial test | P1 |
| sendPaymentLink officer guard | Tested for logic, NOT for auth denial | PARTIAL | Non-officer denial test | P1 |
| DuesConfigForm → backend field alignment | No comparison test | NONE | Field-by-field comparison | P2 |
| Member proof upload flow | Backend tests | PARTIAL | E2E: upload → success | P1 |
| Officer finance dashboard load | Backend tests | PARTIAL | E2E: dashboard renders with data | P1 |
| One-tap payment E2E | Backend STRONG | — | E2E: email link → checkout | P2 |
| Fund allocation 100% constraint (frontend) | No frontend test | NONE | Component: allocation != 100% → error | P1 |
| No refund UI exists | N/A | N/A | [NEEDS PRODUCT DECISION] — refund is backend-only, no officer UI | P2 |

---

## 5. Weak Test Report

| Area | Pattern | Why Weak | Severity |
|------|---------|---------|----------|
| Special assessments | **NO TESTS + NO VALIDATION** | 6 API routes, 0 tests, 0 backend validators | P0 |
| Hand-wired dues routes | Auth-only, no officer guard tests | Routes assume frontend restricts access | P1 |
| Frontend component tests (~7 files) | [NEEDS QUALITY CLASSIFICATION] — not individually read | May be render-only or STRONG | P2 |

---

## 6. Missing Test Report

### P0 — Critical

| Item | Risk | Test Type |
|------|------|-----------|
| Special assessment CRUD (6 routes) — tests | Any user CRUD financial obligations | API integration |
| Special assessment request validation | Arbitrary data accepted | API integration |
| Special assessment auth denial | Non-officer access | API integration |

### P1 — Major

| Item | Risk | Test Type |
|------|------|-----------|
| Dues config non-officer denial | Unauthorized config | API integration |
| sendPaymentLink non-officer denial | Unauthorized payment links | API integration |
| Member proof upload E2E | Upload broken | E2E |
| Officer finance dashboard E2E | Dashboard broken | E2E |
| Fund allocation 100% frontend constraint | Invalid allocation | Component |
| Member dues page E2E | Can't see dues | E2E |

### P2 — Important

| Item | Risk | Test Type |
|------|------|-----------|
| DuesConfigForm field alignment | Drift between form and backend | Integration |
| One-tap payment E2E | Payment link broken | E2E |
| Payment gateway isolation (BR-30) | Gateway leaks | API integration |
| Refund UI existence | Officers can't refund from UI | [NEEDS PRODUCT DECISION] |

---

## 7. Confidence Score (Revised)

| Layer | Score / 10 | Main Gap |
|-------|-----------|----------|
| Coverage Integrity | 6/10 | Billing excellent (23 files). Dues good (14 files). Special assessments: ZERO tests + ZERO validation. |
| Behavior Traceability | 6/10 | Billing BRs well-traced. Dues BRs partially traced. Special assessment BRs untraced. M06 spec 7 BRs — 3 tested, 4 unknown/untested. |
| Test Quality | 8/10 | Backend billing tests uniformly STRONG. Dues tests good. Frontend test quality TBD. |
| Release Gate Readiness | 2/10 | P0: 6 unguarded + unvalidated financial routes with zero tests. No E2E. Cannot ship. |

**Overall Module Confidence: 5.5/10** (revised down from 6.5)

---

## Summary (Revised)

- **~45 backend test files** + **~7 frontend test files** — billing quality STRONG, dues good
- **0 E2E tests**
- **P0 CRITICAL**: Special assessment routes have NO auth guard, NO request validation, NO tests — triple gap
- **54 frontend component files** in features/dues/ — 9 audited, 45 additional
- **Form validation comparison**: DuesConfigForm has Zod, backend is hand-wired (alignment unknown). SpecialAssessmentsList has JS checks, backend has NOTHING.
- **Module spec M06**: 7 BRs, ~3 tested, ~4 unknown
- **No refund UI found** — [NEEDS PRODUCT DECISION]
- **Recommended first slice**: Add officer guard + Zod validators + test suite for special assessment routes
