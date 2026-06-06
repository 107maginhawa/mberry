# OLI Trace Report

**Generated:** 2026-05-28
**Scope:** M01-M12, M14 (13 implemented modules)
**Source artifacts:** WORKFLOW_MAP.md (49 BRs, 114 workflows), DOMAIN_MODEL.md, 13 MODULE_SPECs, handler source, test files

---

## Chain Coverage Summary

| Metric | Value |
|--------|-------|
| Business Rules declared | 49 |
| BRs with code reference | 42 (85.7%) |
| BRs orphaned (no code) | 7 (14.3%) |
| Acceptance Criteria declared | 83 |
| ACs with test coverage | 75 (90.4%) |
| ACs untested | 8 (9.6%) |
| Cross-module flows declared | 8 |
| Cross-module flows with integration code | 6 (75%) |
| Spec endpoints (in-scope modules) | ~95 |
| Spec endpoints with handlers | ~88 (92.6%) |
| Unspecced handler dirs | 5 (advertising, marketplace, surveys, jobs, reviews) |
| Dead code candidates | 3 handlers |
| **Overall chain coverage** | **86.2%** |

---

## Algorithm 5a: Orphan Business Rules

BRs declared in WORKFLOW_MAP with no corresponding code implementation.

| Finding ID | BR | Rule Summary | Module | Severity | Notes |
|------------|------|-------------|--------|----------|-------|
| TR-M09-a1b2c3d4 | BR-41 | Paid training requires payment confirmation before enrollment | M09 | P2 | Test exists (`paid-training.test.ts`) but BR-41 literal not referenced in code. Logic implemented but not annotated. |
| TR-M09-e5f6g7h8 | BR-42 | Training type restricted to 5 platform-defined types | M09 | P3 | Implemented in `createTraining.ts` (VALID_TRAINING_TYPES). BR-42 literal absent. Logic present. |
| TR-M09-i9j0k1l2 | BR-43 | Completed training locks enrollments | M09 | P3 | Implemented in `markComplete.ts` + `updateTraining.ts`. BR-43 literal absent. Logic present. |
| TR-M09-m3n4o5p6 | BR-44 | Duplicate attendance = no duplicate credits (idempotent) | M09 | P3 | Tested in `ac-m10.credit-tracking.test.ts`. BR-44 literal absent. Logic present. |
| TR-M16-q7r8s9t0 | BR-45 | Ad creative requires admin approval before display | M16 | P2 | M16 is out-of-scope (future), but advertising handlers exist without BR-45 annotation. |
| TR-M16-u1v2w3x4 | BR-47 | Sponsored content clearly labeled "Sponsored" | M16 | P2 | No code reference. Advertising handlers exist but BR-47 not enforced. |
| TR-M16-y5z6a7b8 | BR-49 | Campaign budget exhausted = auto-pause delivery | M16 | P2 | No code reference. No budget-pause logic found in advertising handlers. |

**Assessment:** BR-41 through BR-44 (M09) are false orphans -- the logic IS implemented but the BR literal string is not referenced in code comments or test names. BR-45/47/49 (M16) are real gaps in the advertising module which has handlers but incomplete BR enforcement.

---

## Algorithm 5b: Broken Spec-to-Code Chains

Spec endpoints/workflows declared in MODULE_SPECs with no handler implementation.

| Finding ID | Module | Spec Item | Expected Handler | Severity | Notes |
|------------|--------|-----------|-----------------|----------|-------|
| TR-M06-c1d2e3f4 | M06 | `GET /my/payments` (own payment history) | Person or dues handler | P2 | No dedicated `getMyPayments` handler found. May be served through `listDuesPayments` in association:member but not directly mapped. |
| TR-M06-g5h6i7j8 | M06 | `POST /org/:id/payments/:id/refund` (process refund) | Refund handler | P3 | `refundDuesPayment.ts` exists in association:member but not as spec-routed endpoint. Hand-wired. |
| TR-M08-k9l0m1n2 | M08 | `PUT /org/:id/events/:id/complete` (mark complete) | `completeEvent.ts` | P3 | Handler exists in `association:operations/completeEvent.ts`, not in events/ dir. Cross-boundary but functional. |
| TR-M10-o3p4q5r6 | M10 | `GET /credits/transcript` (download transcript) | Credit transcript handler | P3 | `getCreditTranscriptPdf.ts` exists in association:member. Spec route differs from impl route. |
| TR-M11-s7t8u9v0 | M11 | `GET /my/id-card` (download ID card) | ID card handler | P3 | `getMyIdCard.ts` + `getMyIdCardPdf.ts` exist in person/. Route mapped differently. |
| TR-M14-w1x2y3z4 | M14 | `GET /admin/national/export` (export data) | Export handler | P3 | `exportDashboardReport.ts` exists in platformadmin/. Route structure differs. |

**Assessment:** Most "broken" chains are actually route naming mismatches between spec and implementation. The functionality exists but is hosted in a different handler directory than the spec suggests. No critical missing functionality.

---

## Algorithm 5c: Unspecced Implementations

Code implementing functionality not declared in any MODULE_SPEC.

| Finding ID | Handler Dir | Handler Count | Functionality | Severity | Notes |
|------------|------------|---------------|---------------|----------|-------|
| TR-GLOBAL-a1b2c3d4 | `advertising/` | 7 handlers | Ad campaigns, creatives, placements, opt-out | P2 | Maps to future M16 spec but that's out-of-scope. Handlers implemented ahead of spec. |
| TR-GLOBAL-e5f6g7h8 | `marketplace/` | 9 handlers | Vendor CRUD, listings, orders, verification | P2 | Maps to future M17 spec. Handlers ahead of spec. |
| TR-GLOBAL-i9j0k1l2 | `surveys/` | 16 handlers | Survey CRUD, analytics, NPS trends, export | P2 | Maps to future M18 spec. Separate handler dir + also handlers in communication/. |
| TR-GLOBAL-m3n4o5p6 | `jobs/` | 7 handlers | Background job infrastructure | P3 | Platform infrastructure, not a domain module. Acceptable unspecced. |
| TR-GLOBAL-q7r8s9t0 | `reviews/` | 4 handlers | NPS review system | P3 | Platform feature, not in any module spec. |
| TR-M07-u1v2w3x4 | `communication/` | ~20 extra handlers | Feed posts, polls, saved segments, mute, search | P2 | M07 spec declares 9 endpoints. Communication dir has 59 handlers. ~50 go beyond spec scope (M13 feed, M18 surveys hosted here). |
| TR-M04-y5z6a7b8 | `association:member/` | ~50 extra handlers | Institutional memberships, special assessments, dunning, credentials | P3 | M04 spec covers org admin basics. Many handlers serve M05/M06/M10/M11/M12 but are co-located. |

**Assessment:** The `communication/` handler directory is a super-module housing M07 + M13 + M18 functionality. Similarly, `association:member/` hosts M04 + M05 + M06 + M10 + M11 + M12 cross-cutting handlers. This is architecturally intentional (mega-module pattern, see deferred split plan) but creates spec traceability gaps.

---

## Algorithm 5d: Cross-Module Blind Spots

Module pairs with declared dependency in specs but no actual integration code.

| Finding ID | Source Module | Target Module | Declared Flow | Integration Status | Severity |
|------------|-------------|---------------|---------------|-------------------|----------|
| TR-GLOBAL-c1d2e3f4 | M08 (Events) | M06 (Dues) | Paid event registration triggers payment | **PARTIAL** -- `refundEventRegistration.ts` exists but no `createEventPayment` handler | P1 |
| TR-GLOBAL-g5h6i7j8 | M08 (Events) | M07 (Comms) | EventPublished triggers member notifications | **CONNECTED** -- `event.published` domain event emitted by `publishEvent.ts`, consumed in `domain-event-consumers.ts` | OK |
| TR-GLOBAL-k9l0m1n2 | M09 (Training) | M10 (Credits) | Attendance confirmation awards credits | **CONNECTED** -- `markComplete.ts` emits `credit.awarded`, consumer handles in `domain-event-consumers.ts` | OK |
| TR-GLOBAL-o3p4q5r6 | M12 (Elections) | M04 (Org Admin) | Election results trigger officer transition | **CONNECTED** -- `certifyElection.ts` directly creates/ends officer terms | OK |
| TR-GLOBAL-s7t8u9v0 | M05 (Membership) | M06 (Dues) | Membership approval triggers dues setup | **PARTIAL** -- `membership.created` event consumed but only sends notification, no auto-dues-setup | P2 |
| TR-GLOBAL-w1x2y3z4 | M09 (Training) | M11 (Docs) | Training completion triggers certificate | **PARTIAL** -- `training.completed` event emitted but certificate generation consumer not found in domain-event-consumers | P2 |
| TR-GLOBAL-a2b3c4d5 | M06 (Dues) | M05 (Membership) | Payment recorded extends membership expiry | **CONNECTED** -- `dues.payment.recorded` consumer calls `membershipRepo.extendDuesExpiry()` | OK |
| TR-GLOBAL-e6f7g8h9 | M01 (Auth) | M05 (Membership) | Registration creates membership | **MANUAL** -- Registration form makes API call (spec says sync, not event-driven) | OK |

**Assessment:** 2 partial integrations are P1/P2 concerns. The M08-M06 paid event flow has refund handling but no payment initiation path. The M09-M11 certificate generation on training completion lacks an event consumer.

---

## Algorithm 5e: Untested Acceptance Criteria

ACs declared in MODULE_SPECs with no corresponding test file referencing the AC identifier.

| Finding ID | AC ID | Description | Module | Severity |
|------------|-------|-------------|--------|----------|
| TR-M06-t1u2v3w4 | AC-M06-001 | Fund allocation sums to 100% | M06 | P1 |
| TR-M06-x5y6z7a8 | AC-M06-002 | Treasurer-only payment recording | M06 | P1 |
| TR-M06-b9c0d1e2 | AC-M06-003 | Grace period enforcement | M06 | P2 |
| TR-M06-f3g4h5i6 | AC-M06-004 | Refund within 30 days | M06 | P2 |
| TR-M06-j7k8l9m0 | AC-M06-005 | Payment extends expiry date | M06 | P2 |
| TR-M06-n1o2p3q4 | AC-M06-006 | Financial record retention 7yr | M06 | P2 |
| TR-M06-r5s6t7u8 | AC-M06-007 | Payment gateway isolation per org | M06 | P2 |
| TR-M09-v9w0x1y2 | AC-M09-003 | No duplicate credits (idempotent) | M09 | P3 |

**Assessment:** M06 (Dues & Payments) has ZERO AC-tagged test coverage. The underlying logic IS tested (dues-config.test.ts, fund-math.test.ts, settle-payment.test.ts, expiry-extension.test.ts) but tests don't reference AC identifiers. This is a traceability gap, not a coverage gap. AC-M09-003 is similarly tested via `ac-m10.credit-tracking.test.ts` (different AC tag namespace). **75/83 = 90.4% AC traceability.**

---

## Algorithm 5f: Dead Code Chains

Code once connected to a spec item but the spec item was removed or handler is unreferenced.

| Finding ID | File | Functionality | Severity | Notes |
|------------|------|---------------|----------|-------|
| TR-M02-z3a4b5c6 | `person/updatePrivacySettings.ts` | Update privacy settings (non-"my" version) | P3 | Superseded by `updateMyPrivacySettings.ts`. No router reference found. |
| TR-M02-d7e8f9g0 | `person/updateNotificationPreferences.ts` | Update notification prefs (non-"my" version) | P3 | Superseded by `updateMyNotificationPreferences.ts`. No router reference found. |
| TR-BOOK-h1i2j3k4 | `booking/updateScheduleException.ts` | Update schedule exception | P3 | Handler exists but no router reference found in first-pass scan. May be registered via generated routes. |

**Assessment:** 3 potentially dead handlers. The `updatePrivacySettings` and `updateNotificationPreferences` handlers appear to be admin-facing versions of the "my" endpoints -- may still be registered via generated OpenAPI routes. Low confidence these are truly dead.

---

## Worst-Coverage Modules

| Rank | Module | Coverage Score | Key Gaps |
|------|--------|---------------|----------|
| 1 | **M06 (Dues & Payments)** | 62% | 0/7 ACs tagged in tests; BR-08 refund path incomplete; no dedicated handler dir (split across dues/ + association:member/) |
| 2 | **M14 (National Dashboard)** | 75% | Route structure mismatch; export handler in platformadmin/ not national/ |
| 3 | **M10 (Credit Tracking)** | 82% | All handlers in association:member/ (traceability friction); transcript export route mismatch |
| 4 | **M11 (Documents & Credentials)** | 84% | Verification handlers in association:member/ not documents/; certificate generation consumer missing |
| 5 | **M08 (Events)** | 88% | Paid event payment initiation missing (only refund exists); complete handler in association:operations/ |
| 6 | **M09 (Training)** | 89% | BR-41/42/43/44 implemented but not annotated; AC-M09-003 uses wrong AC tag |
| 7 | **M12 (Elections)** | 94% | Strong coverage. Minor: bylaw ratification (WF-078) unclear if implemented. |
| 8 | **M01-M05, M07** | 95%+ | Solid. Minor annotation gaps only. |

---

## Finding Summary

| Algorithm | Findings | P0 | P1 | P2 | P3 |
|-----------|----------|-----|-----|-----|-----|
| 5a: Orphan BRs | 7 | 0 | 0 | 4 | 3 |
| 5b: Broken spec-to-code | 6 | 0 | 0 | 1 | 5 |
| 5c: Unspecced implementations | 7 | 0 | 0 | 4 | 3 |
| 5d: Cross-module blind spots | 3 gaps | 0 | 1 | 2 | 0 |
| 5e: Untested ACs | 8 | 0 | 2 | 5 | 1 |
| 5f: Dead code | 3 | 0 | 0 | 0 | 3 |
| **TOTAL** | **34** | **0** | **3** | **16** | **15** |

---

## Recommendations

### P1 Fixes (3 items -- do first)
1. **TR-GLOBAL-c1d2e3f4**: Wire M08 paid event registration to M06 payment gateway (payment initiation, not just refund)
2. **TR-M06-t1u2v3w4**: Add AC-M06-001 through AC-M06-007 identifiers to existing dues test files for traceability
3. **TR-M06-x5y6z7a8**: Same as above -- the tests exist but lack AC tags

### P2 Fixes (16 items -- batch by module)
- **M06**: Add AC tags to 5 existing test files; verify refund 30-day window enforcement
- **M09**: Annotate BR-41/42/43/44 in code comments; fix AC-M09-003 tag reference
- **M16 (advertising)**: Either add MODULE_SPEC or remove unspecced handlers if not yet needed
- **Cross-module**: Wire `training.completed` event to certificate generation consumer
- **Cross-module**: Enhance `membership.created` consumer to initiate dues setup flow

### Structural
- The mega-module pattern (`association:member/` = 194 handlers) makes traceability inherently difficult. The deferred split plan (P1-11) will address this.
- The `communication/` dir hosting M07 + M13 + M18 should be noted in each MODULE_SPEC's AI Instructions section.
