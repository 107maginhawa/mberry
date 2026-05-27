# Module Enforcement Audit: M09 Training

**Module:** m09-training
**Date:** 2026-05-27
**Auditor:** Claude Opus 4.6 (oli-enforce-module)
**Spec Sources:** MODULE_SPEC.md, API_CONTRACTS.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

---

## Executive Summary

**Overall Score: 3.0 / 10** (P0 cap active from D5 Events)

M09 Training has substantial handler coverage split across two directories (`training/` with 10 handlers and `association:operations/` with 20 training-related handlers). Core CRUD, enrollment, publish, and credit-award flows exist. However, **zero domain events are emitted** (5 required by spec), no consumed events are handled (PaymentRecorded, RefundCompleted), no formal VALID_TRANSITIONS map enforces the training status state machine, `createTraining` in `training/` accepts arbitrary status bypassing draft-only creation, and certificate generation is not triggered from the attendance handler.

**Uncapped avg: 5.67/10** | **Capped: 3.0/10** (P0 on D5)

---

## Dimension Scores

| Dim | Name | Score | Cap | P0 | P1 | P2 | P3 |
|-----|------|-------|-----|-----|-----|-----|-----|
| D1 | Public API Completeness | 6.5 | -- | 0 | 1 | 1 | 1 |
| D2 | Workflow Implementation | 5.5 | -- | 0 | 0 | 3 | 0 |
| D3 | Domain Term Consistency | 7.0 | -- | 0 | 1 | 1 | 0 |
| D4 | State Machine Enforcement | 4.0 | P1->6.0 | 0 | 3 | 0 | 0 |
| D5 | Event Publishing | 3.0 | **P0->3.0** | 2 | 0 | 0 | 0 |
| D6 | Auth/Permission Enforcement | 8.0 | -- | 0 | 0 | 0 | 1 |

---

## Findings

### P0 -- Blockers

#### EM-M09-7a3d1e02: Zero domain events emitted

- **Dimension:** D5 Events
- **Spec Ref:** MODULE_SPEC 10b, API_CONTRACTS 3
- **Location:** All handlers in `training/` and `association:operations/`
- **Expected:** 5 domain events: TrainingPublished (on publish), TrainingCompleted (on complete), TrainingCancelled (on cancel), CreditAwarded (on attendance), CertificateGenerated (on attendance)
- **Actual:** grep for all 5 event names across both handler directories returns zero matches. No `emit`, `publish`, `eventBus`, or domain event infrastructure referenced in any training handler.
- **Impact:** M07 (notifications), M10 (credit aggregation), M06 (refunds on cancel) never learn about training state changes. Breaks cross-module contracts.
- **Fix:** Add domain event emission in publishTraining, cancelTraining, markComplete/completeCustomTraining, and checkInCustomTraining handlers.

#### EM-M09-c4e82f19: No consumed events (PaymentRecorded, RefundCompleted)

- **Dimension:** D5 Events
- **Spec Ref:** MODULE_SPEC 10b Consumed Events
- **Location:** `services/api-ts/src/core/domain-event-consumers.ts`
- **Expected:** PaymentRecorded -> confirm paid enrollment. RefundCompleted -> cancel enrollment.
- **Actual:** grep for PaymentRecorded/RefundCompleted in training handlers and domain-event-consumers returns zero matches.
- **Impact:** Paid training enrollment flow (M9-R2) blocks enrollment with "use the payment gateway" error but has no callback to confirm enrollment after payment succeeds. Enrollment is permanently blocked for paid trainings.
- **Fix:** Add event consumers for PaymentRecorded and RefundCompleted that update enrollment status.

### P1 -- Warnings

#### EM-M09-9b1f3a44: createTraining accepts arbitrary status

- **Dimension:** D4 State Machine
- **Spec Ref:** MODULE_SPEC 8 (Training Status), API_CONTRACTS 2.1 POST
- **Location:** `services/api-ts/src/handlers/training/createTraining.ts:35`
- **Code:** `status: body.status ?? 'draft'`
- **Expected:** New trainings must always start as `draft`. Only dedicated endpoints (publish, cancel, complete) should change status.
- **Actual:** Client can pass `status: 'published'` or `status: 'completed'` on creation, bypassing the entire state machine.
- **Impact:** Circumvents all publish/cancel/complete business rules and guards.
- **Note:** The `association:operations/createTraining.ts` correctly hardcodes `status: 'draft'`.
- **Fix:** Change to `status: 'draft'` (remove `body.status`).

#### EM-M09-a2e7c801: No formal VALID_TRANSITIONS map for training_status

- **Dimension:** D4 State Machine
- **Spec Ref:** MODULE_SPEC 8
- **Location:** `training/cancelTraining.ts`, `association:operations/publishTraining.ts`
- **Expected:** A `VALID_TRANSITIONS` map: `{ draft: ['published'], published: ['completed', 'cancelled'], completed: [], cancelled: [] }`
- **Actual:** Individual handlers check `if (status !== 'draft')` or `if (status === 'cancelled')` ad hoc. A `validTransitions` map exists in `association:operations/training-lifecycle.test.ts:72` but only in test code, not production.
- **Impact:** Transition logic scattered across handlers, easy to introduce invalid transitions.
- **Fix:** Extract shared `VALID_TRANSITIONS` into `training/utils/status-transitions.ts`.

#### EM-M09-d8f21b73: No enrollment_status VALID_TRANSITIONS enforcement

- **Dimension:** D4 State Machine
- **Spec Ref:** MODULE_SPEC 8 Enrollment Status
- **Location:** `training/enroll.ts`, `association:operations/completeCustomTraining.ts`, `cancelCustomTraining.ts`
- **Expected:** Formal guard: enrolled -> completed/cancelled/noShow. Completed, cancelled, noShow are terminal.
- **Actual:** Handlers check ad hoc but no shared map. The `enroll.ts` handler in `training/` sets waitlisted enrollments to `status: 'cancelled'` which is semantically wrong.
- **Fix:** Create enrollment status transition map. Add `waitlisted` status or separate mechanism.

#### EM-M09-e4a9f256: Training type enum (M9-R1) not enforced at schema level

- **Dimension:** D3 Domain Terms
- **Spec Ref:** MODULE_SPEC BR M9-R1, AC-M09-004
- **Location:** `association:operations/repos/training.schema.ts`
- **Expected:** `training_type` pgEnum with 5 values (Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training) as required column.
- **Actual:** No `training_type` column on training table. Tests in `ac-m09.training.test.ts` validate the 5 types but schema has no such field.
- **Fix:** Add `trainingType` column with pgEnum to training table.

#### EM-M09-f1c34d87: Duplicate handler implementations across directories

- **Dimension:** D1 Public API
- **Spec Ref:** MODULE_SPEC 20 AI Instructions
- **Location:** `training/` vs `association:operations/`
- **Expected:** Single source of truth per handler.
- **Actual:** Two parallel implementations:
  - `training/` dir: hand-wired handlers, org-scoped via URL params, officer check via `OfficerTermRepository`
  - `association:operations/` dir: generated-route handlers, org from context, `requirePosition` auth, audit logging
  - Both registered on different routes for same logical operations.
- **Impact:** Maintenance burden, inconsistent behavior (e.g., training/ lacks audit logging).
- **Fix:** Consolidate to single implementation per operation. Prefer `association:operations/` versions (generated validators, audit logging, `requirePosition`).

### P2 -- Improvement

#### EM-M09-b5d71a92: markComplete does not trigger certificate generation

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC WF-060/WF-061, BR-20, API_CONTRACTS POST .../attendance
- **Location:** `training/markComplete.ts`
- **Expected:** After attendance + credit award, certificate should be generated.
- **Actual:** markComplete creates credit entry and triggers `credit.issue` job but does not generate certificate. Certificate module exists (`handlers/certificates/`) but not called from attendance flow.
- **Fix:** After credit creation, trigger certificate generation or emit CertificateGenerated event.

#### EM-M09-3a7e1c09: checkInCustomTraining is a no-op

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC WF-060
- **Location:** `association:operations/checkInCustomTraining.ts`
- **Expected:** Check-in should update enrollment (e.g., `checkedInAt` timestamp) or trigger attendance confirmation.
- **Actual:** Validates enrollment exists, creates audit log, returns unchanged enrollment. No data modified.
- **Fix:** Add `checkedInAt` field or connect to attendance/completion flow.

#### EM-M09-52c8d1ef: M9-R5 cancel refund not implemented

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC BR M9-R5
- **Location:** `training/cancelTraining.ts`, `association:operations/cancelCustomTraining.ts`
- **Expected:** Training cancellation triggers refund for all enrolled members via M06.
- **Actual:** cancelTraining sets status to cancelled. cancelCustomTraining cancels the enrollment (not the training). Neither triggers refunds.
- **Fix:** On training cancellation, iterate enrollments and trigger refund via M06/TrainingCancelled event.

#### EM-M09-71b2e4d3: M9-R6 network-wide visibility not enforced

- **Dimension:** D3 Domain Terms
- **Spec Ref:** MODULE_SPEC BR M9-R6
- **Location:** `association:operations/repos/training.schema.ts`
- **Expected:** `visibility` field defaulting to network-wide.
- **Actual:** No `visibility` column. All trainings implicitly org-scoped by `organizationId` filter.
- **Fix:** Add `visibility` enum column (network/org/internal) with default `network`.

### P3 -- Nits

#### EM-M09-8e2a3f16: listTrainings exposes draft trainings without auth

- **Dimension:** D6 Auth/Permission
- **Spec Ref:** ROLE_PERMISSION_MATRIX
- **Location:** `training/listTrainings.ts`
- **Expected:** Published trainings publicly visible. Draft/cancelled require auth.
- **Actual:** No auth check, no default status filter. Draft trainings visible to unauthenticated users if no filter param.
- **Fix:** Default status filter to `published` for unauthenticated requests.

#### EM-M09-a1b4c5d7: Course CRUD handlers not implemented

- **Dimension:** D1 Public API
- **Spec Ref:** API_CONTRACTS 2.7
- **Location:** Generated routes reference `createCourse`/`listCourses` but no handler files exist.
- **Fix:** Implement course CRUD handlers. Feature-flag: `training_courses`.

---

## Endpoint Coverage Matrix

| Spec Endpoint | Handler | Dir | Registered | Status |
|--------------|---------|-----|------------|--------|
| GET /org/:id/trainings | listTrainings + searchTrainings | training/ + assoc:ops | both | IMPL (dup) |
| POST /org/:id/trainings | createTraining | training/ + assoc:ops | both | IMPL (dup) |
| PUT /org/:id/trainings/:id | updateTraining | training/ + assoc:ops | both | IMPL (dup) |
| PUT .../publish | publishTraining | assoc:ops | generated | IMPL |
| PUT .../cancel | cancelTraining | training/ | hand-wired | IMPL |
| PUT .../complete | markComplete | training/ | hand-wired | PARTIAL |
| POST .../enroll | enroll + enrollInCustomTraining | training/ + assoc:ops | both | IMPL (dup) |
| POST .../attendance | markComplete (via) | training/ | hand-wired | PARTIAL |
| GET /my/training | listMyTrainings + listMyCustomTrainings | training/ + assoc:ops | both | IMPL (dup) |
| GET /my/certificates/:id/pdf | generateCertificatePdf | certificates/ | registered | IMPL (xmod) |
| GET /verify/certificate/:number | verifyCertificatePublic | certificates/ | registered | IMPL (xmod) |
| GET .../providers | listAccreditedProviders | training/ | hand-wired | IMPL |
| POST .../providers | createAccreditedProvider | training/ | hand-wired | IMPL |
| PUT .../providers/:id | updateAccreditedProvider | training/ | hand-wired | IMPL |
| DELETE .../providers/:id | deleteAccreditedProvider | training/ | hand-wired | IMPL |
| GET /org/:id/courses | -- | -- | stub | MISSING |
| POST /org/:id/courses | -- | -- | stub | MISSING |

**Coverage: 13/16 spec endpoints** (2 in certificates xmod, 2 courses missing)

---

## Business Rule Traceability

| Rule | Enforced | Location | Notes |
|------|----------|----------|-------|
| BR-13 (auto credit) | YES | training/markComplete.ts:60-125 | CreditEntryRepository.createOne() |
| BR-15 (training!=event) | TEST-ONLY | br-15.training-event-distinction.test.ts | No runtime handler enforcement |
| BR-17 (officer attendance) | YES | markComplete.ts:23-29, checkInCustomTraining.ts:22 | Officer check enforced |
| BR-20 (certificate) | NO | -- | Not triggered from attendance flow |
| M9-R1 (5 types) | NO | -- | No training_type column in schema |
| M9-R2 (paid enrollment) | PARTIAL | enroll.ts:28-33 | Blocks but no payment callback |
| M9-R3 (lock on complete) | YES | enroll.ts:18-19 | status check |
| M9-R4 (HMAC cert) | PARTIAL | certificates/ module | Exists but not wired from M09 |
| M9-R5 (cancel refund) | NO | -- | No refund triggered |
| M9-R6 (visibility) | NO | -- | No visibility column |
| M9-R7 (idempotent credits) | YES | markComplete.ts:67-68 | findByTrainingAndPerson guard |

---

## File Inventory

### training/ (15 non-test files)
`cancelTraining.ts`, `createTraining.ts`, `updateTraining.ts`, `markComplete.ts`, `enroll.ts`, `listEnrollments.ts`, `listTrainings.ts`, `listMyTrainings.ts`, `createAccreditedProvider.ts`, `updateAccreditedProvider.ts`, `deleteAccreditedProvider.ts`, `listAccreditedProviders.ts`, `repos/training.repo.ts`, `repos/accredited-provider.repo.ts`, `repos/accredited-provider.schema.ts`

### association:operations/ (20 training files)
`createTraining.ts`, `updateTraining.ts`, `deleteTraining.ts`, `publishTraining.ts`, `searchTrainings.ts`, `getTraining.ts`, `createTrainingEnrollment.ts`, `updateTrainingEnrollment.ts`, `deleteTrainingEnrollment.ts`, `getTrainingEnrollment.ts`, `searchTrainingEnrollments.ts`, `completeTrainingEnrollment.ts`, `cancelCustomTraining.ts`, `checkInCustomTraining.ts`, `completeCustomTraining.ts`, `enrollInCustomTraining.ts`, `listCustomTrainingEnrollments.ts`, `listMyCustomTrainings.ts`, `repos/training.schema.ts`, `repos/training.repo.ts`

### certificates/ (cross-module, 10 files)
`generateCertificatePdf.ts`, `verifyCertificatePublic.ts`, `batchGenerateCertificates.ts`, `bulkIssueCertificates.ts`, `getCertificate.ts`, `listCertificates.ts`, `repos/certificates.schema.ts`, `repos/certificates.repo.ts`, `utils/certificate-template.ts`, `utils/certificate-numbering.ts`
