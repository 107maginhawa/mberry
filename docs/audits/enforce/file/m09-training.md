# File Enforcement Audit: M09 — Training

> **Generated**: 2026-05-27
> **Spec Sources**: `docs/product/modules/m09-training/MODULE_SPEC.md` v2.0, `API_CONTRACTS.md`, `ERROR_TAXONOMY.md`
> **Scope**: `services/api-ts/src/handlers/training/` (all files) + training-related files in `services/api-ts/src/handlers/association:operations/`

---

## File Inventory

### `training/` handler directory (10 handlers, 2 repos, 18 tests)

| File | Role | Lines | Spec Coverage |
|------|------|-------|---------------|
| `createTraining.ts` | Handler: POST create training | 43 | API_CONTRACTS 2.1 POST |
| `updateTraining.ts` | Handler: PUT update training | ~80 | API_CONTRACTS 2.1 PUT |
| `cancelTraining.ts` | Handler: PUT cancel training | 34 | API_CONTRACTS 2.1 PUT cancel |
| `markComplete.ts` | Handler: PUT complete + attendance + auto-credit | ~150 | API_CONTRACTS 2.1 PUT complete, 2.3 POST attendance |
| `enroll.ts` | Handler: POST enroll member | 55 | API_CONTRACTS 2.2 POST enroll |
| `listTrainings.ts` | Handler: GET list trainings | 15 | API_CONTRACTS 2.1 GET list |
| `listMyTrainings.ts` | Handler: GET my training history | 11 | API_CONTRACTS 2.4 GET |
| `listEnrollments.ts` | Handler: GET enrollment list | 29 | API_CONTRACTS 2.2 implied |
| `listAccreditedProviders.ts` | Handler: GET providers | ~30 | API_CONTRACTS 2.6 GET |
| `createAccreditedProvider.ts` | Handler: POST provider | ~35 | API_CONTRACTS 2.6 POST |
| `deleteAccreditedProvider.ts` | Handler: DELETE provider | 28 | API_CONTRACTS 2.6 DELETE |
| `repos/training.repo.ts` | Repository: training + enrollment CRUD | ~150 | Consumes ao schema |
| `repos/accredited-provider.schema.ts` | Schema: accredited_provider table | 24 | MODULE_SPEC 7: AccreditedProvider |
| `repos/accredited-provider.repo.ts` | Repository: provider CRUD | ~106 | MODULE_SPEC 7: AccreditedProvider |
| **Tests (18 files):** | | | |
| `createTraining.test.ts` | Unit: create handler | ~170 | BR-15, SO-8 |
| `cancelTraining.test.ts` | Unit: cancel handler | ~80 | BR-20 |
| `enroll.test.ts` | Unit: enroll handler | ~120 | BR-02 |
| `markComplete.test.ts` | Unit: markComplete handler | ~450 | BR-13, BR-20, AC-M10-002 |
| `listEnrollments.test.ts` | Unit: listEnrollments handler | ~90 | Officer check |
| `listMyTrainings.test.ts` | Unit: listMyTrainings handler | ~60 | -- |
| `listTrainings.test.ts` | Unit: listTrainings handler | ~70 | -- |
| `listAccreditedProviders.test.ts` | Unit: listAccreditedProviders | ~80 | Officer check |
| `createAccreditedProvider.test.ts` | Unit: createAccreditedProvider | ~70 | Officer check |
| `deleteAccreditedProvider.test.ts` | Unit: deleteAccreditedProvider | ~70 | Officer check |
| `auth-enforcement.test.ts` | Auth: officer check on 5 handlers | ~180 | P0-AUTH |
| `ac-m09.training.test.ts` | AC: domain logic (AC-M09-002/004/005/006) | ~250 | Acceptance criteria |
| `ac-m10.credit-tracking.test.ts` | AC: credit domain logic (AC-M10-003/004/005) | ~240 | Cross-module ACs |
| `br-14.cross-org-credits.test.ts` | BR: cross-org credit aggregation | ~130 | BR-14 |
| `br-15.training-event-distinction.test.ts` | BR: training vs event | ~110 | BR-15 |
| `flow-02.training-credit-award.test.ts` | Flow: completion -> credit award | ~200 | FLOW-02 |
| `flow-020.attendance-credit.test.ts` | Flow: attendance -> auto credit | ~250 | AC-M09-001, AC-M10-002 |
| `paid-training.test.ts` | Feature: paid training enrollment | ~200 | M9-R2, BR-02 |

### `association:operations/` training-related files (16 handlers, 2 repos, 4 tests)

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

| ID | Sev | Check | Finding | File:Line | Spec Source | Confidence |
|----|-----|-------|---------|-----------|-------------|------------|
| EF-M09-8638f390 | P1 | (3) Data Shape | `createTraining.ts` accepts `body.status ?? 'draft'`, allowing client to set `published`/`completed` directly. Spec state machine requires all new trainings start as `draft`. Bypasses publish workflow. | `training/createTraining.ts:35` | MODULE_SPEC sec 8 state machine, API_CONTRACTS 2.1 POST | HIGH |
| EF-M09-483a92da | P2 | (2) Domain Terms | `createTraining.ts` has no training type validation. Spec M9-R1 says only 5 platform-defined types (`seminar`, `workshop`, `webinar`, `conference`, `self-paced`). Schema lacks `type` column entirely. | `training/createTraining.ts` (absent) | MODULE_SPEC M9-R1, sec 7 Entity:Training | MEDIUM |
| EF-M09-d054981b | P2 | (3) Data Shape | `createTraining.ts` does not validate `creditAmount >= 0` or `creditBearing + creditAmount` consistency. Spec M09-005 requires non-negative hours; M09-009 requires creditBearing flag to match creditAmount. | `training/createTraining.ts:34` | API_CONTRACTS M09-005, M09-009 | MEDIUM |
| EF-M09-ff7c912c | P2 | (1) Errors | `createTraining.ts` does not validate request body with Zod. Uses raw `ctx.req.json()` instead of `ctx.req.valid('json')` from generated validators. No M09-005/M09-006/M09-009 error codes emitted. | `training/createTraining.ts:19` | ERROR_TAXONOMY M09 range, API_CONTRACTS 2.1 | MEDIUM |
| EF-M09-f1f59f17 | P1 | (3) Data Shape | `updateTraining.ts` blocks status changes but allows field updates on `completed`/`cancelled` trainings. Spec M9-R3 says post-completion lock: all modifications blocked after completion. | `training/updateTraining.ts:23-30` | MODULE_SPEC M9-R3, API_CONTRACTS M09-004 | HIGH |
| EF-M09-eb8fc0df | P3 | (4) Naming | `updateTraining.ts` strips 9 body fields (`type`, `scheduleDescription`, `locationType`, etc.) that don't exist in schema. Defensive but indicates schema evolution debt. | `training/updateTraining.ts:35-50` | Schema alignment | LOW |
| EF-M09-ce90545e | P1 | (1) Errors | `cancelTraining.ts` does not emit `TrainingCancelled` domain event. Spec requires `{trainingId, orgId, enrollmentCount}` event. Downstream M07 (notifications) and M06 (refunds) never triggered. | `training/cancelTraining.ts:32` | MODULE_SPEC 10b Published Events, API_CONTRACTS 3 | HIGH |
| EF-M09-130fb4e3 | P1 | (3) Data Shape | `cancelTraining.ts` does not cascade cancellation to existing enrollments. Enrolled members remain with `enrolled` status on a `cancelled` training. Orphaned enrollments. | `training/cancelTraining.ts:32` | MODULE_SPEC sec 8 Training Status side effects | HIGH |
| EF-M09-6b384ec6 | P2 | (2) Domain Terms | `cancelTraining.ts` does not trigger refund cascade (M9-R5). Spec: "IF training cancelled THEN refund all enrolled members via M06." No M06 integration. | `training/cancelTraining.ts:32` | MODULE_SPEC M9-R5 | MEDIUM |
| EF-M09-e9628339 | P2 | (3) Data Shape | `enroll.ts` sets waitlisted members to `status: 'cancelled'` (line 48). No `waitlisted` enum value exists. Over-capacity members silently get `cancelled`, losing enrollment intent. | `training/enroll.ts:48` | MODULE_SPEC sec 8 Enrollment Status | HIGH |
| EF-M09-f284b4e5 | P2 | (3) Data Shape | `enroll.ts` does not restrict enrollment to `published` trainings only. It blocks `completed` and `cancelled` but allows enrollment in `draft` trainings. Spec state machine: enrollment only from `published`. | `training/enroll.ts:17-25` | MODULE_SPEC sec 8, API_CONTRACTS 2.2 | MEDIUM |
| EF-M09-1142ef7e | P2 | (3) Data Shape | `enroll.ts` has no duplicate enrollment guard. Same person can enroll multiple times. Spec M09-003 error code: "Already enrolled in this training." | `training/enroll.ts:45-52` | API_CONTRACTS M09-003 | MEDIUM |
| EF-M09-1379e22a | P3 | (2) Domain Terms | `enroll.ts` does not emit any enrollment domain event. No `MemberEnrolled` event for downstream notification by M07. | `training/enroll.ts:54` | MODULE_SPEC 10b (implied) | LOW |
| EF-M09-7d516b1f | P1 | (3) Data Shape | `markComplete.ts` response body does not match spec. Spec requires `{enrollmentId, enrollmentStatus, creditEntryId, creditValue, certificateAvailable}`. Code returns raw enrollment update without credit/certificate fields. | `training/markComplete.ts:58` | API_CONTRACTS 2.3 POST attendance response | HIGH |
| EF-M09-0f9ebcc8 | P1 | (2) Domain Terms | `markComplete.ts` does not generate a certificate record. Spec side effect: "Certificate record created; CertificateGenerated event emitted." BR-20 requires HMAC-signed QR certificate. | `training/markComplete.ts:60-145` | MODULE_SPEC BR-20, API_CONTRACTS 2.3 side effects | HIGH |
| EF-M09-6ebad122 | P2 | (1) Errors | `markComplete.ts` does not emit `CreditAwarded` domain event. Uses `credit.issue` pg-boss job instead. Spec event: `CreditAwarded {personId, trainingId, creditValue, creditEntryId}` -> M10. | `training/markComplete.ts:120-140` | MODULE_SPEC 10b Published Events | MEDIUM |
| EF-M09-3fa9f646 | P2 | (1) Errors | `markComplete.ts` swallows credit creation errors in try/catch. If credit repo fails, enrollment is completed but no credit awarded. Silent data loss for BR-13 critical path. | `training/markComplete.ts:143-145` | MODULE_SPEC BR-13 auto-credit | MEDIUM |
| EF-M09-35a3fa7a | P3 | (3) Data Shape | `listTrainings.ts` passes `status` and `search` filters but not `from`/`to` date filters. Spec declares date range params on GET list endpoint. | `training/listTrainings.ts:8-14` | API_CONTRACTS 2.1 GET query params | LOW |
| EF-M09-eb08be5a | P2 | (4) Naming | `deleteAccreditedProvider.ts` and `createAccreditedProvider.ts` use `requirePosition()` auth pattern. Other training handlers use `OfficerTermRepository.findActiveByPersonAndOrg()`. Inconsistent auth approach within same module. | `training/deleteAccreditedProvider.ts:14` vs `training/createTraining.ts:13-17` | Consistency | MEDIUM |
| EF-M09-e7f7f690 | P3 | (5) Import Boundary | `training/repos/training.repo.ts` imports schema from `../../association:operations/repos/training.schema`. Cross-handler-directory import. Spec AI instruction 1 says schema is in `association:operations/repos/training.schema.ts`. Acceptable by design but tightly couples two handler dirs. | `training/repos/training.repo.ts:3-10` | MODULE_SPEC sec 20 AI Instructions | LOW |
| EF-M09-7a1738ee | P3 | (5) Import Boundary | `training/` directory has no `training.schema.ts` file. Schema lives only in `association:operations/repos/training.schema.ts`. Spec says this is by design (AI instruction 1) but means training handler depends on a different module for its data shape. | `training/repos/` (absent) | MODULE_SPEC sec 20, AI Instructions 1 | LOW |
| EF-M09-4e7b3504 | P2 | (3) Data Shape | No `publishTraining.ts` handler exists in `training/` directory. Spec requires `PUT /org/:id/trainings/:id/publish`. Only exists in `association:operations/publishTraining.ts`. Training dir has no publish workflow. | `training/publishTraining.ts` (missing) | API_CONTRACTS 2.1 PUT publish | MEDIUM |
| EF-M09-38e78d3b | P2 | (3) Data Shape | No `recordAttendance.ts` handler exists in `training/` directory. Spec requires `POST /org/:id/trainings/:id/attendance`. `markComplete.ts` partially covers this but conflates completion with attendance. | `training/recordAttendance.ts` (missing) | API_CONTRACTS 2.3 POST attendance | MEDIUM |
| EF-M09-e2226ba7 | P1 | (1) Errors | **No domain events are emitted anywhere** in the training handler directory. Spec declares 5 published events: `TrainingPublished`, `TrainingCompleted`, `TrainingCancelled`, `CreditAwarded`, `CertificateGenerated`. Zero are implemented. | `training/*.ts` (all) | MODULE_SPEC 10b Published Events | HIGH |
| EF-M09-86679351 | P3 | (4) Naming | `auth-enforcement.test.ts` header comment says "Training module (M8)" but this is M09. Incorrect module ID in test documentation. | `training/auth-enforcement.test.ts:2` | Naming convention | LOW |
| EF-M09-b99c8053 | P2 | (3) Data Shape | `ao/enrollInCustomTraining.ts` does not check active membership before enrollment. Spec BR-02: "Only active members can enroll in training." The `training/enroll.ts` handler does check, but the ao variant does not. | `association:operations/enrollInCustomTraining.ts:30-48` | MODULE_SPEC BR-02 | MEDIUM |
| EF-M09-851ca7ea | P2 | (3) Data Shape | `ao/createTrainingEnrollment.ts` does not check for duplicate enrollment (same person + same training). Could create multiple enrollment records. | `association:operations/createTrainingEnrollment.ts:40-52` | API_CONTRACTS M09-003 | MEDIUM |
| EF-M09-db63aae8 | P3 | (4) Naming | `ao/cancelCustomTraining.ts` cancels the **enrollment** (not the training itself). Name suggests training cancellation but body cancels enrollment. Confusing naming. | `association:operations/cancelCustomTraining.ts:49` | Naming | LOW |
| EF-M09-231abb33 | P2 | (2) Domain Terms | `ao/completeCustomTraining.ts` marks enrollment completed but does NOT trigger auto-credit award (BR-13). Only `ao/completeTrainingEnrollment.ts` has the credit logic. Two complete handlers with different behavior. | `association:operations/completeCustomTraining.ts:49-52` | MODULE_SPEC BR-13 | MEDIUM |
| EF-M09-8ff44abf | -- | -- | **POSITIVE**: `ao/completeTrainingEnrollment.ts` correctly implements AC-M09-001 (auto-credit) and AC-M10-002 (duplicate guard via `findByTrainingAndPerson`). Good spec alignment. | `association:operations/completeTrainingEnrollment.ts:59-80` | AC-M09-001, AC-M10-002 | HIGH |
| EF-M09-9fed4c2b | P2 | (3) Data Shape | `ao/repos/training.schema.ts` defines `training_status` as `['draft', 'published', 'cancelled', 'completed']`. Spec also lists `active` as a possible status in AC-M09 tests. Schema lacks `active`. | `association:operations/repos/training.schema.ts:23-28` | MODULE_SPEC sec 8 state machine | MEDIUM |
| EF-M09-9d412294 | P3 | (3) Data Shape | `ao/createCourse.ts` does not validate `creditAmount` range. Courses are behind a feature flag. Low severity but should validate when feature launches. | `association:operations/createCourse.ts:39` | MODULE_SPEC sec 18 Feature Flags | LOW |
| EF-M09-369c0c86 | P2 | (1) Errors | `ao/createQuizAttempt.ts` has no quiz attempt limit enforcement. Spec error M09-007: "Quiz attempt limit exceeded." Handler allows unlimited retakes. | `association:operations/createQuizAttempt.ts:40-54` | API_CONTRACTS M09-007 | MEDIUM |
| EF-M09-b088a647 | -- | -- | **POSITIVE**: `listMyTrainings.ts` correctly returns person-scoped training history. Matches API_CONTRACTS 2.4 `GET /my/training`. Simple and correct. | `training/listMyTrainings.ts` | API_CONTRACTS 2.4 | HIGH |
| EF-M09-20ac8cb1 | -- | -- | **POSITIVE**: `listEnrollments.ts` correctly enforces officer-only access via `OfficerTermRepository` and includes attendance stats. | `training/listEnrollments.ts` | API_CONTRACTS 2.2 | HIGH |
| EF-M09-0e4a4a13 | -- | -- | **POSITIVE**: Accredited provider CRUD (4 files) is complete with proper auth. Matches API_CONTRACTS 2.6 for all 4 endpoints. | `training/*AccreditedProvider*.ts` | API_CONTRACTS 2.6 | HIGH |

---

## Summary by Severity

| Severity | Count | Key Themes |
|----------|-------|------------|
| **P0** | 0 | -- |
| **P1** | 7 | Domain events missing (all 5), status bypass in create, enrollment cascade, response shape mismatch, certificate generation absent |
| **P2** | 16 | Missing validations (type, creditAmount, duplicate enrollment), incomplete state checks, inconsistent auth patterns, no refund cascade, quiz limit unenforced |
| **P3** | 9 | Schema debt, naming issues, cosmetic import boundaries, missing date filters |
| **Positive** | 4 | Auto-credit in ao/completeTrainingEnrollment, listMyTrainings, listEnrollments, accredited provider CRUD |

## Check Coverage Matrix

| Check | Files Checked | Findings |
|-------|--------------|----------|
| (1) Error Taxonomy | All 10 handlers + 16 ao handlers | 5 findings — no M09-xxx error codes emitted, domain events absent, credit error swallowed |
| (2) Domain Terms | All handlers + schema + repo | 4 findings — no training type, no certificate, no refund, no credit event |
| (3) Data Shape | All handlers + schema | 14 findings — status bypass, post-completion lock, waitlist, duplicate enrollment, response shape |
| (4) Naming | All files | 4 findings — inconsistent auth, confusing handler names, wrong module ID in test |
| (5) Import Boundaries | All handlers + repos | 2 findings — cross-module schema import (by design), no local schema |

## Critical Path Gaps

1. **Zero domain events emitted** — All 5 spec-declared events (`TrainingPublished`, `TrainingCompleted`, `TrainingCancelled`, `CreditAwarded`, `CertificateGenerated`) are unimplemented. This blocks M07 notifications, M06 refunds, and M10 credit aggregation.
2. **No certificate generation** — BR-20 requires HMAC-signed QR certificate on completion. No certificate logic exists anywhere in the training handlers.
3. **Status bypass in createTraining** — Client can create trainings with any status, bypassing the draft -> published -> completed state machine.
4. **No enrollment cascade on cancellation** — When a training is cancelled, enrolled members are not notified or refunded. Their enrollments remain active.
5. **Two parallel handler sets** — `training/` and `association:operations/` both implement training CRUD with different patterns (raw json vs validated context), different auth mechanisms, and different feature completeness. The ao set has auto-credit; the training set has membership checks. Neither is complete.

## Consumed Events Gap

| Spec Event | Source | Handler | Status |
|------------|--------|---------|--------|
| `PaymentRecorded` | M06 | Confirm paid enrollment | **NOT IMPLEMENTED** — no event consumer found |
| `RefundCompleted` | M06 | Update enrollment | **NOT IMPLEMENTED** — no event consumer found |

---

## Test Coverage Assessment

| Test File | Handlers Covered | Spec Traceability |
|-----------|-----------------|-------------------|
| `createTraining.test.ts` | createTraining | BR-15, SO-8 PRC fields |
| `cancelTraining.test.ts` | cancelTraining | Status checks only |
| `enroll.test.ts` | enroll | Capacity, membership |
| `markComplete.test.ts` | markComplete | BR-13, BR-20, duplicate credit |
| `auth-enforcement.test.ts` | 5 handlers | Officer check only |
| `ac-m09.training.test.ts` | Pure domain logic | AC-M09-002/004/005/006 |
| `ac-m10.credit-tracking.test.ts` | Pure domain logic | AC-M10-003/004/005 |
| `br-14.cross-org-credits.test.ts` | Pure domain logic | BR-14 |
| `br-15.training-event-distinction.test.ts` | Pure domain logic | BR-15 |
| `flow-02.training-credit-award.test.ts` | markComplete | FLOW-02 credit path |
| `flow-020.attendance-credit.test.ts` | markComplete | AC-M09-001, AC-M10-002 |
| `paid-training.test.ts` | enroll | M9-R2, BR-02 |
| `listEnrollments.test.ts` | listEnrollments | Officer check, empty state |
| `listMyTrainings.test.ts` | listMyTrainings | Basic happy path |
| `listTrainings.test.ts` | listTrainings | Filters, empty state |
| `listAccreditedProviders.test.ts` | listAccreditedProviders | Officer check, filters |
| `createAccreditedProvider.test.ts` | createAccreditedProvider | Officer check |
| `deleteAccreditedProvider.test.ts` | deleteAccreditedProvider | Officer check, not found |

**Test gaps**: No tests for `updateTraining` happy path, no tests for domain event emission (none exist to test), no tests for certificate generation, no integration tests crossing training/ <-> ao/ boundary.
