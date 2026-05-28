# File Enforcement Audit: M09 — Training

> **Generated**: 2026-05-28 (re-audit)
> **Previous**: 2026-05-27
> **Spec Sources**: `docs/product/modules/m09-training/MODULE_SPEC.md` v2.0, `API_CONTRACTS.md`, `ERROR_TAXONOMY.md`
> **Scope**: `services/api-ts/src/handlers/training/` (all files) + training-related files in `services/api-ts/src/handlers/association:operations/`

---

## File Inventory

### `training/` handler directory (12 handlers, 2 repos, 19 tests)

| File | Role | Lines | Spec Coverage |
|------|------|-------|---------------|
| `createTraining.ts` | Handler: POST create training | 55 | API 2.1 POST, M9-R1, M9-R6 |
| `updateTraining.ts` | Handler: PUT update training | 88 | API 2.1 PUT, AC-M09-005 |
| `cancelTraining.ts` | Handler: PUT cancel training | 43 | API 2.1 PUT cancel, domain event |
| `completeTraining.ts` | Handler: PUT complete training (status) | 63 | API 2.1 PUT complete, state machine |
| `publishTraining.ts` | Handler: PUT publish training | 49 | API 2.1 PUT publish, state machine |
| `markComplete.ts` | Handler: POST attendance + auto-credit | 166 | API 2.3 POST attendance, BR-13 |
| `enroll.ts` | Handler: POST enroll member | 57 | API 2.2 POST enroll, BR-02, M9-R2 |
| `listTrainings.ts` | Handler: GET list trainings | ~15 | API 2.1 GET list |
| `listMyTrainings.ts` | Handler: GET my training history | ~11 | API 2.4 GET |
| `listEnrollments.ts` | Handler: GET enrollment list | ~29 | API 2.2 implied |
| `listAccreditedProviders.ts` | Handler: GET providers | ~30 | API 2.6 GET |
| `createAccreditedProvider.ts` | Handler: POST provider | ~35 | API 2.6 POST |
| `updateAccreditedProvider.ts` | Handler: PATCH provider | ~35 | API 2.6 PATCH |
| `deleteAccreditedProvider.ts` | Handler: DELETE provider | ~28 | API 2.6 DELETE |
| `repos/training.repo.ts` | Repository: training + enrollment CRUD | ~150 | Consumes ao schema |
| `repos/accredited-provider.schema.ts` | Schema: accredited_provider table | 24 | MODULE_SPEC 7: AccreditedProvider |
| `repos/accredited-provider.repo.ts` | Repository: provider CRUD | ~106 | MODULE_SPEC 7: AccreditedProvider |
| **Tests (19 files):** | | | |
| `createTraining.test.ts` | Unit: create handler | ~170 | BR-15, SO-8, M9-R1 |
| `cancelTraining.test.ts` | Unit: cancel handler | ~80 | Status checks |
| `completeTraining.test.ts` | Unit: complete handler | ~60 | State machine |
| `enroll.test.ts` | Unit: enroll handler | ~120 | BR-02, capacity |
| `markComplete.test.ts` | Unit: markComplete handler | ~450 | BR-13, BR-20, AC-M10-002 |
| `listEnrollments.test.ts` | Unit: listEnrollments handler | ~90 | Officer check |
| `listMyTrainings.test.ts` | Unit: listMyTrainings handler | ~60 | -- |
| `listTrainings.test.ts` | Unit: listTrainings handler | ~70 | -- |
| `listAccreditedProviders.test.ts` | Unit: listAccreditedProviders | ~80 | Officer check |
| `createAccreditedProvider.test.ts` | Unit: createAccreditedProvider | ~70 | Officer check |
| `updateAccreditedProvider.test.ts` | Unit: updateAccreditedProvider | ~70 | Officer check |
| `deleteAccreditedProvider.test.ts` | Unit: deleteAccreditedProvider | ~70 | Officer check |
| `auth-enforcement.test.ts` | Auth: officer check on 5 handlers | ~180 | P0-AUTH |
| `ac-m09.training.test.ts` | AC: domain logic (AC-M09-002/004/005/006) | ~250 | Acceptance criteria |
| `ac-m10.credit-tracking.test.ts` | AC: credit domain logic (AC-M10-003/004/005) | ~240 | Cross-module ACs |
| `br-14.cross-org-credits.test.ts` | BR: cross-org credit aggregation | ~130 | BR-14 |
| `br-15.training-event-distinction.test.ts` | BR: training vs event | ~110 | BR-15 |
| `flow-02.training-credit-award.test.ts` | Flow: completion -> credit award | ~200 | FLOW-02 |
| `flow-020.attendance-credit.test.ts` | Flow: attendance -> auto credit | ~250 | AC-M09-001, AC-M10-002 |
| `paid-training.test.ts` | Feature: paid training enrollment | ~200 | M9-R2, BR-02 |
| `post-completion-lock.test.ts` | Feature: AC-M09-005 lock | ~100 | AC-M09-005 |
| `accredited-providers.test.ts` | Provider CRUD | ~100 | API 2.6 |

### `association:operations/` training-related files (16 handlers, 2 repos, 6 tests)

| File | Role | Spec Coverage |
|------|------|---------------|
| `createTraining.ts` | Handler: POST create (generated route) | OpenAPI |
| `getTraining.ts` | Handler: GET single training | OpenAPI |
| `updateTraining.ts` | Handler: PUT update | OpenAPI |
| `deleteTraining.ts` | Handler: DELETE training | OpenAPI |
| `publishTraining.ts` | Handler: POST publish | OpenAPI |
| `searchTrainings.ts` | Handler: GET search | OpenAPI |
| `cancelCustomTraining.ts` | Handler: POST cancel enrollment | OpenAPI lifecycle |
| `completeCustomTraining.ts` | Handler: POST complete enrollment | OpenAPI lifecycle |
| `checkInCustomTraining.ts` | Handler: POST check-in | OpenAPI lifecycle |
| `enrollInCustomTraining.ts` | Handler: POST enroll | OpenAPI lifecycle |
| `createTrainingEnrollment.ts` | Handler: POST enrollment | OpenAPI |
| `completeTrainingEnrollment.ts` | Handler: POST complete enrollment + auto-credit | OpenAPI + BR-13 |
| `listCustomTrainingEnrollments.ts` | Handler: GET enrollments | OpenAPI |
| `listMyCustomTrainings.ts` | Handler: GET my trainings | OpenAPI |
| `searchTrainingEnrollments.ts` | Handler: GET search enrollments | OpenAPI |
| `updateTrainingEnrollment.ts` | Handler: PUT enrollment | OpenAPI |
| `deleteTrainingEnrollment.ts` | Handler: DELETE enrollment | OpenAPI |
| `getTrainingEnrollment.ts` | Handler: GET enrollment | OpenAPI |
| `createOrgAccreditedProvider.ts` | Handler: POST org provider | OpenAPI |
| `createCourse.ts` | Handler: POST course | OpenAPI (behind flag) |
| `createCourseEnrollment.ts` | Handler: POST course enrollment | OpenAPI |
| `createQuizAttempt.ts` | Handler: POST quiz attempt | OpenAPI |
| `repos/training.schema.ts` | Schema: training + enrollment + course + quiz | MODULE_SPEC 7 |
| `repos/training.repo.ts` | Repository: all training entities | MODULE_SPEC 7 |
| `getTraining.test.ts` | Test: getTraining handler | -- |
| `training.test.ts` | Test: training CRUD | -- |
| `training-enrollment.test.ts` | Test: enrollment CRUD | -- |
| `training-lifecycle.test.ts` | Test: lifecycle flows | -- |
| `courses.test.ts` | Test: course handlers | -- |
| `course-enrollment.test.ts` | Test: course enrollment | -- |

---

## Findings

### Legend
- **5 Checks**: (1) Error taxonomy alignment, (2) Domain term usage, (3) Data shape conformance, (4) Naming conventions, (5) Import boundary compliance
- **Severity**: P0 = security/data loss, P1 = spec violation blocking correctness, P2 = spec drift with workaround, P3 = cosmetic/minor
- **Status**: OPEN = still present, FIXED = resolved since last audit, PARTIAL = partially addressed

### Resolved Findings (from 2026-05-27 audit)

| ID | Previous Sev | Resolution |
|----|-------------|------------|
| EF-M09-8638f390 | P1 | **FIXED** — `createTraining.ts:46` now hardcodes `status: 'draft'`. Client cannot bypass state machine. |
| EF-M09-f1f59f17 | P1 | **FIXED** — `updateTraining.ts:36-42` blocks all field updates on completed/cancelled trainings (AC-M09-005). |
| EF-M09-ce90545e | P1 | **FIXED** — `cancelTraining.ts:35-39` emits `training.cancelled` domain event. |
| EF-M09-6ebad122 | P2 | **FIXED** — `markComplete.ts:127-133` emits `credit.awarded` domain event with personId, trainingId, creditAmount. |
| EF-M09-4e7b3504 | P2 | **FIXED** — `publishTraining.ts` now exists (49 lines) with state machine validation via `isValidTrainingTransition`. Emits `training.published` event. |
| EF-M09-e2226ba7 | P1 | **PARTIAL** — 4 of 5 spec events now implemented (`training.published`, `training.completed`, `training.cancelled`, `credit.awarded`). Only `CertificateGenerated` remains missing. Downgraded from P1 to P2; see EF-M09-0f9ebcc8. |

### Open Findings

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M09-a1c3d7f2 | P1 | (2) Domain Terms | `createTraining.ts:7` defines training types as `['seminar', 'workshop', 'convention', 'onlineCourse', 'skillsTraining']`. Spec M9-R1 defines types as `['seminar', 'workshop', 'webinar', 'conference', 'self-paced']`. Three of five types differ: `convention` vs `conference`, `onlineCourse` vs `webinar`, `skillsTraining` vs `self-paced`. Same mismatch in `updateTraining.ts:4`. | `training/createTraining.ts:7`, `training/updateTraining.ts:4` | MODULE_SPEC M9-R1, sec 7 Entity:Training | HIGH |
| EF-M09-d054981b | P2 | (3) Data Shape | `createTraining.ts` does not validate `creditAmount >= 0` or `creditBearing + creditAmount` consistency. Spec requires non-negative credits and creditBearing flag to match creditAmount (creditBearing=false should mean creditAmount=0). | `training/createTraining.ts:43-44` | MODULE_SPEC BR-15, sec 7 Entity:Training | MEDIUM |
| EF-M09-ff7c912c | P2 | (1) Errors | `createTraining.ts` uses raw `ctx.req.json()` instead of `ctx.req.valid('json')` from generated validators. No structured error codes (M09-005/M09-006/M09-009) emitted. | `training/createTraining.ts:21` | ERROR_TAXONOMY M09 range | MEDIUM |
| EF-M09-130fb4e3 | P1 | (3) Data Shape | `cancelTraining.ts` does not cascade cancellation to existing enrollments. Enrolled members remain with `enrolled` status on a `cancelled` training. Orphaned enrollments violate state machine invariant. Domain event emitted but no side effects executed. | `training/cancelTraining.ts:33` | MODULE_SPEC sec 8 Training Status side effects | HIGH |
| EF-M09-6b384ec6 | P2 | (2) Domain Terms | `cancelTraining.ts` does not trigger refund cascade (M9-R5). Spec: "IF training cancelled THEN refund all enrolled members via M06." No M06 integration. Event is emitted but no refund consumer exists. | `training/cancelTraining.ts:33` | MODULE_SPEC M9-R5 | MEDIUM |
| EF-M09-e9628339 | P2 | (3) Data Shape | `enroll.ts:50` sets over-capacity members to `status: 'cancelled'`. No `waitlisted` enum value exists in schema. Over-capacity members silently get `cancelled`, losing enrollment intent. Should either add `waitlisted` status or return a clear rejection. | `training/enroll.ts:50` | MODULE_SPEC sec 8 Enrollment Status | HIGH |
| EF-M09-f284b4e5 | P2 | (3) Data Shape | `enroll.ts` does not restrict enrollment to `published` trainings only. It blocks `completed` and `cancelled` but allows enrollment in `draft` trainings. Spec state machine: enrollment only after publish. | `training/enroll.ts:18-26` | MODULE_SPEC sec 8, API 2.2 | MEDIUM |
| EF-M09-1142ef7e | P2 | (3) Data Shape | `enroll.ts` has no duplicate enrollment guard. Same person can enroll multiple times in the same training. Spec M09-003 error: "Already enrolled in this training." | `training/enroll.ts:47-54` | MODULE_SPEC M9-R7 (implied), API M09-003 | MEDIUM |
| EF-M09-1379e22a | P3 | (2) Domain Terms | `enroll.ts` does not emit any enrollment domain event. No `MemberEnrolled` event for downstream notification by M07. | `training/enroll.ts:56` | MODULE_SPEC 10b (implied) | LOW |
| EF-M09-7d516b1f | P1 | (3) Data Shape | `markComplete.ts:164` response returns raw enrollment update (`{ data: updated }`). Spec requires `{enrollmentId, enrollmentStatus, creditEntryId, creditValue, certificateAvailable}`. Credit and certificate fields missing from response. | `training/markComplete.ts:164` | MODULE_SPEC API 2.3 POST attendance response | HIGH |
| EF-M09-0f9ebcc8 | P1 | (2) Domain Terms | `markComplete.ts` does not generate a certificate record. Spec BR-20: "IF training completed THEN certificate generated with HMAC-signed QR." No certificate logic, no `CertificateGenerated` event, no QR code generation. Last unimplemented domain event. | `training/markComplete.ts:60-165` | MODULE_SPEC BR-20, sec 10b Published Events | HIGH |
| EF-M09-3fa9f646 | P2 | (1) Errors | `markComplete.ts:152-154` swallows credit creation errors in outer try/catch. If credit repo fails, enrollment is marked completed but no credit awarded. Silent data loss on BR-13 critical path. Inner try/catch at line 148 also swallows job trigger errors (acceptable). | `training/markComplete.ts:152-154` | MODULE_SPEC BR-13 auto-credit | MEDIUM |
| EF-M09-4e0d1809 | P3 | (3) Data Shape | `markComplete.ts:45-47` checks `endDate > now` to block early completion. Correct but uses loose comparison (`new Date(training.endDate) > new Date()`) without timezone normalization. Edge case: training ending at midnight UTC vs local time. | `training/markComplete.ts:45-47` | MODULE_SPEC BR-20 | LOW |
| EF-M09-35a3fa7a | P3 | (3) Data Shape | `listTrainings.ts` passes `status` and `search` filters but not `from`/`to` date filters. Spec declares date range params on GET list endpoint. | `training/listTrainings.ts:8-14` | API 2.1 GET query params | LOW |
| EF-M09-eb08be5a | P2 | (4) Naming | `deleteAccreditedProvider.ts` and `createAccreditedProvider.ts` use `requirePosition()` auth pattern. Other training handlers use `OfficerTermRepository.findActiveByPersonAndOrg()`. Inconsistent auth approach within same module. | `training/deleteAccreditedProvider.ts:14` vs `training/createTraining.ts:14-18` | Consistency | MEDIUM |
| EF-M09-eb8fc0df | P3 | (4) Naming | `updateTraining.ts:53-70` strips 9 body fields (`type`, `scheduleDescription`, `locationType`, etc.) that don't exist in schema. Defensive but indicates schema evolution debt and field aliasing complexity. | `training/updateTraining.ts:53-70` | Schema alignment | LOW |
| EF-M09-e7f7f690 | P3 | (5) Import Boundary | `training/repos/training.repo.ts` imports schema from `../../association:operations/repos/training.schema`. Cross-handler-directory import. Spec AI instruction 1 says this is by design but tightly couples two handler dirs. | `training/repos/training.repo.ts:3-10` | MODULE_SPEC sec 20 AI Instructions | LOW |
| EF-M09-7a1738ee | P3 | (5) Import Boundary | `training/` directory has no `training.schema.ts` file. Schema lives only in `association:operations/repos/training.schema.ts`. By design per spec but means training handler depends on a different module for its data shape. | `training/repos/` (absent) | MODULE_SPEC sec 20, AI Instructions 1 | LOW |
| EF-M09-38e78d3b | P2 | (3) Data Shape | No dedicated `recordAttendance.ts` handler exists. Spec requires `POST /org/:id/trainings/:id/attendance`. `markComplete.ts` conflates attendance confirmation with enrollment completion. Spec separates them conceptually. | `training/recordAttendance.ts` (missing) | MODULE_SPEC API 2.3 POST attendance | MEDIUM |
| EF-M09-86679351 | P3 | (4) Naming | `auth-enforcement.test.ts` header comment says "Training module (M8)" but this is M09. Incorrect module ID in test documentation. | `training/auth-enforcement.test.ts:2` | Naming convention | LOW |
| EF-M09-b99c8053 | P2 | (3) Data Shape | `ao/enrollInCustomTraining.ts` does not check active membership before enrollment. Spec BR-02: "Only active members can enroll in training." The `training/enroll.ts` handler does check, but the ao variant does not. | `association:operations/enrollInCustomTraining.ts` | MODULE_SPEC BR-02 | MEDIUM |
| EF-M09-851ca7ea | P2 | (3) Data Shape | `ao/createTrainingEnrollment.ts` does not check for duplicate enrollment (same person + same training). Could create multiple enrollment records. | `association:operations/createTrainingEnrollment.ts` | API M09-003 | MEDIUM |
| EF-M09-db63aae8 | P3 | (4) Naming | `ao/cancelCustomTraining.ts` cancels the **enrollment** (not the training itself). Name suggests training cancellation but body cancels enrollment. Confusing naming. | `association:operations/cancelCustomTraining.ts` | Naming | LOW |
| EF-M09-231abb33 | P2 | (2) Domain Terms | `ao/completeCustomTraining.ts` marks enrollment completed but does NOT trigger auto-credit award (BR-13). Only `ao/completeTrainingEnrollment.ts` has the credit logic. Two complete handlers with different behavior. | `association:operations/completeCustomTraining.ts` | MODULE_SPEC BR-13 | MEDIUM |
| EF-M09-9fed4c2b | P2 | (3) Data Shape | `ao/repos/training.schema.ts` defines `training_status` as `['draft', 'published', 'cancelled', 'completed']`. Some AC-M09 tests reference `active` status. Schema lacks `active`. Minor — `active` is not in spec state machine either. | `association:operations/repos/training.schema.ts` | MODULE_SPEC sec 8 | MEDIUM |
| EF-M09-9d412294 | P3 | (3) Data Shape | `ao/createCourse.ts` does not validate `creditAmount` range. Courses are behind a feature flag. Low severity but should validate when feature launches. | `association:operations/createCourse.ts` | MODULE_SPEC sec 18 Feature Flags | LOW |
| EF-M09-369c0c86 | P2 | (1) Errors | `ao/createQuizAttempt.ts` has no quiz attempt limit enforcement. Spec error M09-007: "Quiz attempt limit exceeded." Handler allows unlimited retakes. | `association:operations/createQuizAttempt.ts` | API M09-007 | MEDIUM |

### Positive Findings

| ID | Finding | File | Spec Source | Confidence |
|----|---------|------|-------------|------------|
| EF-M09-8ff44abf | `ao/completeTrainingEnrollment.ts` correctly implements AC-M09-001 (auto-credit) and AC-M10-002 (duplicate guard via `findByTrainingAndPerson`). Good spec alignment. | `association:operations/completeTrainingEnrollment.ts` | AC-M09-001, AC-M10-002 | HIGH |
| EF-M09-b088a647 | `listMyTrainings.ts` correctly returns person-scoped training history. Simple and correct. | `training/listMyTrainings.ts` | API 2.4 | HIGH |
| EF-M09-20ac8cb1 | `listEnrollments.ts` correctly enforces officer-only access via `OfficerTermRepository` and includes attendance stats. | `training/listEnrollments.ts` | API 2.2 | HIGH |
| EF-M09-0e4a4a13 | Accredited provider CRUD (4 files) is complete with proper auth. Matches API 2.6 for all 4 endpoints. | `training/*AccreditedProvider*.ts` | API 2.6 | HIGH |
| EF-M09-c4b91e20 | `completeTraining.ts` uses proper state machine via `isValidTrainingTransition()`. Emits `training.completed` event. Clean separation from `markComplete.ts` (enrollment-level). | `training/completeTraining.ts` | MODULE_SPEC sec 8 | HIGH |
| EF-M09-d8e2f531 | `publishTraining.ts` uses same state machine, emits `training.published` event. Only draft -> published allowed. | `training/publishTraining.ts` | MODULE_SPEC sec 8 | HIGH |
| EF-M09-e4f19a72 | `markComplete.ts` implements BR-13 auto-credit with cycle config lookup (BR-11), duplicate guard (AC-M10-002), and domain event emission. Most complex handler, mostly correct. | `training/markComplete.ts` | BR-13, BR-11, AC-M10-002 | HIGH |

---

## Summary by Severity

| Severity | Count | Key Themes |
|----------|-------|------------|
| **P0** | 0 | -- |
| **P1** | 4 | Enrollment cascade on cancel, certificate generation absent, response shape mismatch, training type mismatch vs spec |
| **P2** | 14 | Missing validations (creditAmount, duplicate enrollment, draft enrollment), inconsistent auth, refund cascade, ao handler gaps, quiz limit unenforced |
| **P3** | 9 | Schema debt, naming issues, import boundaries, date filters, timezone edge |
| **Positive** | 7 | State machine, auto-credit, domain events (4/5), list handlers, provider CRUD |
| **Resolved** | 6 | Status bypass fixed, post-completion lock fixed, domain events partially fixed, publishTraining added |

## Check Coverage Matrix

| Check | Files Checked | Findings |
|-------|--------------|----------|
| (1) Error Taxonomy | All 12 handlers + 16 ao handlers | 3 findings — no structured error codes, credit error swallowed, quiz limit unenforced |
| (2) Domain Terms | All handlers + schema + repo | 3 findings — type enum mismatch, no certificate, no refund cascade |
| (3) Data Shape | All handlers + schema | 12 findings — enrollment cascade, waitlist, duplicate enrollment, response shape, draft enrollment, ao gaps |
| (4) Naming | All files | 4 findings — inconsistent auth, confusing handler names, wrong module ID, schema debt |
| (5) Import Boundaries | All handlers + repos | 2 findings — cross-module schema import (by design), no local schema |

## Critical Path Gaps

1. **No certificate generation** — BR-20 requires HMAC-signed QR certificate on attendance completion. No certificate logic exists anywhere in the training handlers. `CertificateGenerated` is the only unimplemented domain event.
2. **Training type enum mismatch** — Handler validates `['seminar', 'workshop', 'convention', 'onlineCourse', 'skillsTraining']` but spec declares `['seminar', 'workshop', 'webinar', 'conference', 'self-paced']`. Three types diverge.
3. **No enrollment cascade on cancellation** — When a training is cancelled, enrolled members' enrollments are not updated. `training.cancelled` event is emitted but no handler processes it.
4. **Two parallel handler sets** — `training/` and `association:operations/` both implement training CRUD with different patterns (raw json vs validated context), different auth mechanisms, and different feature completeness. The ao set has full OpenAPI coverage; the training set has membership checks and better BR enforcement. Neither is complete alone.
5. **Response shape mismatch on markComplete** — Returns raw enrollment update instead of the spec-required shape with credit and certificate fields.

## Consumed Events Gap

| Spec Event | Source | Handler | Status |
|------------|--------|---------|--------|
| `PaymentRecorded` | M06 | Confirm paid enrollment | **NOT IMPLEMENTED** — no event consumer found |
| `RefundCompleted` | M06 | Update enrollment | **NOT IMPLEMENTED** — no event consumer found |

---

## Test Coverage Assessment

| Test File | Handlers Covered | Spec Traceability |
|-----------|-----------------|-------------------|
| `createTraining.test.ts` | createTraining | BR-15, SO-8, M9-R1 PRC fields |
| `cancelTraining.test.ts` | cancelTraining | Status checks only |
| `completeTraining.test.ts` | completeTraining | State machine validation |
| `enroll.test.ts` | enroll | Capacity, membership, M9-R2 |
| `markComplete.test.ts` | markComplete | BR-13, BR-20, AC-M10-002 |
| `auth-enforcement.test.ts` | 5 handlers | Officer check only |
| `ac-m09.training.test.ts` | Pure domain logic | AC-M09-002/004/005/006 |
| `ac-m10.credit-tracking.test.ts` | Pure domain logic | AC-M10-003/004/005 |
| `br-14.cross-org-credits.test.ts` | Pure domain logic | BR-14 |
| `br-15.training-event-distinction.test.ts` | Pure domain logic | BR-15 |
| `flow-02.training-credit-award.test.ts` | markComplete | FLOW-02 credit path |
| `flow-020.attendance-credit.test.ts` | markComplete | AC-M09-001, AC-M10-002 |
| `paid-training.test.ts` | enroll | M9-R2, BR-02 |
| `post-completion-lock.test.ts` | updateTraining | AC-M09-005 |
| `accredited-providers.test.ts` | Provider CRUD | API 2.6 |
| `listEnrollments.test.ts` | listEnrollments | Officer check, empty state |
| `listMyTrainings.test.ts` | listMyTrainings | Basic happy path |
| `listTrainings.test.ts` | listTrainings | Filters, empty state |
| `listAccreditedProviders.test.ts` | listAccreditedProviders | Officer check, filters |
| `createAccreditedProvider.test.ts` | createAccreditedProvider | Officer check |
| `updateAccreditedProvider.test.ts` | updateAccreditedProvider | Officer check |
| `deleteAccreditedProvider.test.ts` | deleteAccreditedProvider | Officer check, not found |

**Test gaps**:
- No tests for `updateTraining` happy path field updates
- No tests for domain event emission verification (events fire but no test asserts they were emitted)
- No tests for certificate generation (feature not implemented)
- No integration tests crossing `training/` <-> `ao/` handler boundary
- No tests for `publishTraining` happy path (only lifecycle tests in ao)
- No tests for enrollment cascade on training cancellation (feature not implemented)

## Delta from Previous Audit

| Metric | 2026-05-27 | 2026-05-28 | Change |
|--------|-----------|-----------|--------|
| P0 findings | 0 | 0 | -- |
| P1 findings | 7 | 4 | -3 (status bypass, post-completion lock, 3 domain events fixed) |
| P2 findings | 16 | 14 | -2 (publishTraining added, CreditAwarded event added) |
| P3 findings | 9 | 9 | -- |
| Positive findings | 4 | 7 | +3 (completeTraining, publishTraining, markComplete credit logic) |
| Domain events implemented | 0/5 | 4/5 | +4 |
| Handler count (training/) | 10 | 12 | +2 (completeTraining, publishTraining) |
| Test file count | 18 | 19+ | +1 (post-completion-lock) |
