# Module Enforcement Audit: M09 Training

**Module:** m09-training
**Date:** 2026-05-28
**Auditor:** Claude Opus 4.6 (oli-enforce-module)
**Spec Sources:** MODULE_SPEC.md, handler source code, schema, app.ts route wiring
**Previous Audit:** 2026-05-27 (score 3.0/10)

---

## Executive Summary

**Overall Score: 5.0 / 10** (improved from 3.0 -- domain events now emitted, state machine formalized)

M09 Training has 14 handler files in `training/` and ~20 parallel handlers in `association:operations/`. Since last audit, domain events are now emitted (3/5 published events present) and a formal `VALID_TRANSITIONS` state machine map was added. However, the module has a **critical dual-handler architecture problem**: 8 of 14 training/ handler files are dead code (not wired to any route), with the TypeSpec-generated `association:operations/` handlers serving actual traffic. URL fragmentation across 3 patterns, missing event consumers, and trainingType data loss remain significant issues.

**Uncapped avg: 5.2/10** | **Capped: 5.0/10** (P0 on dead code)

---

## Dimension Scores

| Dim | Name | Score | Cap | P0 | P1 | P2 | P3 |
|-----|------|-------|-----|-----|-----|-----|-----|
| D1 | Public API Completeness | 4.0 | P0->4.0 | 1 | 0 | 0 | 0 |
| D2 | Workflow Implementation | 5.0 | -- | 0 | 1 | 2 | 0 |
| D3 | Domain Term / Data Model | 5.0 | -- | 0 | 0 | 1 | 0 |
| D4 | State Machine Enforcement | 7.5 | -- | 0 | 0 | 0 | 2 |
| D5 | Event Publishing / Consuming | 4.0 | -- | 0 | 0 | 5 | 0 |
| D6 | Auth/Permission Enforcement | 5.5 | -- | 0 | 0 | 2 | 0 |

---

## Findings

### P0 -- Blockers

#### EM-M09-z6a7b8c9: 8/14 training/ handler files are dead code

- **Dimension:** D1 Public API
- **Location:** `services/api-ts/src/handlers/training/`
- **Expected:** All handler files wired to routes.
- **Actual:** Only `completeTraining.ts` (app.ts:458) and `publishTraining.ts` (app.ts:459) are wired as hand-wired routes. The remaining 8 handlers (`createTraining`, `updateTraining`, `cancelTraining`, `enroll`, `listTrainings`, `listMyTrainings`, `listEnrollments`, `markComplete`) are NOT imported in app.ts and NOT referenced by generated routes. The 4 accredited provider handlers are imported but their routes were MIGRATED to generated routes (comment at app.ts:452-454).
- **Evidence:** `grep -n` of app.ts shows only 2 route registrations at lines 458-459. TypeSpec-generated `association:operations/` handlers serve the actual routes at `/association/training*`.
- **Impact:** Massive maintenance confusion. Changes to `training/createTraining.ts` have zero effect on the running system. Developers may incorrectly modify dead code.
- **Fix:** Either (a) wire the training/ handlers to routes matching the spec URLs, or (b) delete the dead handler files and consolidate on association:operations/.

---

### P1 -- Warnings

#### EM-M09-n4o5p6q7: Certificate generation not connected to training module

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC WF-061, BR-20
- **Location:** `training/markComplete.ts`
- **Expected:** After attendance confirmation + credit award, certificate should be generated (WF-061). `CertificateGenerated` event should be emitted.
- **Actual:** markComplete creates credit entry and triggers `credit.issue` job but never generates a certificate and never emits `CertificateGenerated`. Certificate module exists at `handlers/certificates/` but is not called from any training handler.
- **Fix:** After credit creation in markComplete, trigger certificate generation or emit `CertificateGenerated` event for async processing.

---

### P2 -- Improvement

#### EM-M09-y5z6a7b8: URL fragmentation across 3 patterns

- **Dimension:** D1 API
- **Spec Ref:** MODULE_SPEC Section 10
- **Expected:** Spec declares `/org/:id/trainings/*` pattern.
- **Actual:** Three patterns in production:
  1. Hand-wired: `/organizations/:organizationId/training/:id/complete` (app.ts:458)
  2. Hand-wired: `/org/:organizationId/trainings/:id/publish` (app.ts:459)
  3. TypeSpec: `/association/training*` and `/association/training-lifecycle/*`
- **Impact:** Frontend confusion. Spec URLs match none of the implementations.
- **Fix:** Standardize on TypeSpec `/association/training*` pattern and update spec.

#### EM-M09-x4y5z6a7: trainingType validated but never persisted

- **Dimension:** D3 Data Model
- **Spec Ref:** MODULE_SPEC BR M9-R1, AC-M09-004
- **Location:** `training/createTraining.ts:10-13`, `training/updateTraining.ts:5`
- **Code:** `VALID_TRAINING_TYPES = ['seminar', 'workshop', 'convention', 'onlineCourse', 'skillsTraining']` validated, but no `training_type` column in `training` schema table.
- **Impact:** Training type validated on create/update but discarded. Round-trip data loss -- cannot filter or display training type after creation.
- **Fix:** Add `trainingType` pgEnum column to training table.

#### EM-M09-w3x4y5z6: Officer handlers lack admin/super role fallback

- **Dimension:** D6 Auth
- **Spec Ref:** MODULE_SPEC Section 6 Permissions
- **Location:** All officer-restricted handlers (`createTraining`, `updateTraining`, `cancelTraining`, `completeTraining`, `publishTraining`, `markComplete`)
- **Expected:** Spec says president(2FA), officer, admin, super all have access.
- **Actual:** All use `OfficerTermRepository.findActiveByPersonAndOrg()` which only checks officer positions. Admin and super roles are not checked.
- **Fix:** Add admin/super role fallback check.

#### EM-M09-v2w3x4y5: listTrainings has no auth check

- **Dimension:** D6 Auth
- **Location:** `training/listTrainings.ts`
- **Expected:** Auth required; draft trainings restricted to officers.
- **Actual:** No `authMiddleware()`, no session check. Returns all trainings including drafts.
- **Note:** This handler is dead code (not wired), but if wired would be a security issue.

#### EM-M09-q7r8s9t0: TrainingPublished event payload mismatches spec

- **Dimension:** D5 Events
- **Spec Ref:** MODULE_SPEC 10b Published Events
- **Location:** `training/publishTraining.ts`
- **Expected:** Payload: `{trainingId, orgId, trainingType, creditValue}`
- **Actual:** Payload: `{trainingId, organizationId, publishedBy}` -- missing `trainingType` and `creditValue`, extra `publishedBy`.

#### EM-M09-r8s9t0u1: TrainingCancelled event payload mismatches spec

- **Dimension:** D5 Events
- **Location:** `training/cancelTraining.ts`
- **Expected:** Payload: `{trainingId, orgId, enrollmentCount}`
- **Actual:** Payload: `{trainingId, organizationId, cancelledBy}` -- missing `enrollmentCount`.

#### EM-M09-s9t0u1v2: CertificateGenerated event never emitted

- **Dimension:** D5 Events
- **Spec Ref:** MODULE_SPEC 10b
- **Location:** No file
- **Expected:** Emitted when certificate created after training completion.
- **Actual:** Not emitted anywhere in training module.

#### EM-M09-t0u1v2w3: PaymentRecorded consumer not implemented

- **Dimension:** D5 Events
- **Spec Ref:** MODULE_SPEC 10b Consumed Events
- **Expected:** PaymentRecorded from M06 -> confirm paid enrollment (status -> enrolled).
- **Actual:** No listener. Paid training enrollment is permanently blocked by `PAYMENT_REQUIRED` error with no callback path.

#### EM-M09-u1v2w3x4: RefundCompleted consumer not implemented

- **Dimension:** D5 Events
- **Expected:** RefundCompleted from M06 -> cancel enrollment.
- **Actual:** No listener.

#### EM-M09-k1l2m3n4: publishTraining lacks completeness validation

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC WF: Create & Publish, Error "400 incomplete"
- **Location:** `training/publishTraining.ts`
- **Expected:** Validate required fields (title, dates, etc.) before publishing. Return 400 if incomplete.
- **Actual:** Only checks state machine transition (draft -> published). No field completeness validation.

#### EM-M09-m3n4o5p6: Over-capacity enrollment creates cancelled record instead of 409

- **Dimension:** D2 Workflow
- **Spec Ref:** MODULE_SPEC WF Browse & Enroll
- **Location:** `training/enroll.ts:39-40`
- **Code:** `status: isWaitlisted ? 'cancelled' : 'enrolled'`
- **Expected:** Spec says return 409 error when training is full. "No waitlist for training."
- **Actual:** Creates enrollment record with `cancelled` status instead of rejecting.
- **Note:** Dead code (handler not wired), but incorrect logic.

---

### P3 -- Nits

#### EM-M09-d4e5f6g7: completeTraining wired as POST, spec says PUT

- **Dimension:** D4 API
- **Location:** `app.ts:458`
- **Code:** `app.post('/organizations/:organizationId/training/:id/complete', ...)`
- **Expected:** Spec says `PUT /org/:id/trainings/:id/complete`.
- **Actual:** Registered as POST with different URL pattern.

#### EM-M09-o5p6q7r8: No enrollment state machine enforcement function

- **Dimension:** D4 State Machine
- **Expected:** Formal `isValidEnrollmentTransition()` like the training status machine.
- **Actual:** Ad-hoc checks (completedAt guard in markComplete, status checks in enroll).

#### EM-M09-p6q7r8s9: No accredited provider status transition enforcement

- **Dimension:** D4 State Machine
- **Expected:** Guard active -> suspended -> expired transitions.
- **Actual:** CRUD allows arbitrary status changes.

---

## Endpoint Coverage Matrix

| Spec Endpoint | Handler(s) | Wired Route | Status |
|---|---|---|---|
| POST /org/:id/trainings | training/createTraining (dead) + assoc:ops/createTraining | `/association/training` (TypeSpec) | IMPL via assoc:ops |
| PUT /org/:id/trainings/:id | training/updateTraining (dead) + assoc:ops/updateTraining | TypeSpec (if exists) | PARTIAL |
| PUT .../publish | training/publishTraining | `/org/:orgId/trainings/:id/publish` (hand-wired) | IMPL |
| PUT .../cancel | training/cancelTraining (dead) + assoc:ops/cancelCustomTraining | `/association/training-lifecycle/:id/cancel` (TypeSpec) | IMPL via assoc:ops |
| PUT .../complete | training/completeTraining | `/organizations/:orgId/training/:id/complete` (hand-wired, POST) | IMPL |
| POST .../enroll | training/enroll (dead) + assoc:ops/enrollInCustomTraining | `/association/training-lifecycle/:id/enroll` (TypeSpec) | IMPL via assoc:ops |
| POST .../attendance | training/markComplete (dead) + assoc:ops/checkInCustomTraining | `/association/training-lifecycle/:id/check-in` (TypeSpec) | PARTIAL (checkIn is no-op) |
| GET /org/:id/trainings | training/listTrainings (dead) + assoc:ops/searchTrainings | `/association/training` (TypeSpec) | IMPL via assoc:ops |
| GET /my/training | training/listMyTrainings (dead) + assoc:ops/listMyCustomTrainings | `/association/training-lifecycle/my` (TypeSpec) | IMPL via assoc:ops |
| GET /my/certificates/:id/pdf | certificates/ module | certificates/ (TypeSpec) | CROSS_MODULE |
| GET /verify/certificate/:number | certificates/ module | certificates/ (TypeSpec) | CROSS_MODULE |

**Coverage: 9/11 spec endpoints implemented** (2 via certificates cross-module)

---

## Business Rule Traceability

| Rule | Enforced | Location | Notes |
|------|----------|----------|-------|
| BR-13 (auto credit on attendance) | YES | training/markComplete.ts:60-125 | CreditEntryRepository.createOne() with cycle computation |
| BR-15 (training != event) | TEST-ONLY | br-15.training-event-distinction.test.ts | No runtime enforcement |
| BR-17 (officer confirms attendance) | YES | markComplete.ts OfficerTermRepository check | |
| BR-20 (certificate gen) | NO | -- | Not triggered from attendance flow |
| M9-R1 (5 platform types) | PARTIAL | createTraining.ts validation | Validated but not persisted (no column) |
| M9-R2 (paid enrollment) | PARTIAL | enroll.ts PAYMENT_REQUIRED | Blocks but no PaymentRecorded callback |
| M9-R3 (lock on complete) | YES | enroll.ts status check | |
| M9-R4 (HMAC cert QR) | CROSS_MODULE | certificates/ module | Exists but not wired from M09 |
| M9-R5 (cancel refund) | NO | -- | No refund triggered on cancel |
| M9-R6 (network visibility) | PARTIAL | Schema has `visibility` column defaulting to `network` | In schema but not enforced in queries |
| M9-R7 (idempotent credits) | YES | markComplete.ts completedAt guard | Enrollment-level check, not DB unique constraint |

---

## State Machine Audit

### Training Status -- PASS
```
VALID_TRANSITIONS (completeTraining.ts:14-19):
  draft     -> [published, cancelled]
  published -> [completed, cancelled]
  completed -> []  (terminal)
  cancelled -> []  (terminal)
```
Matches spec exactly. Used by both publishTraining and completeTraining. cancelTraining does its own ad-hoc checks but arrives at same result.

### Enrollment Status -- PARTIAL
Schema enum: `enrolled | completed | cancelled | noShow`. No formal transition map. markComplete enforces `completedAt` guard. enroll.ts abuses `cancelled` for over-capacity.

### Accredited Provider Status -- SCHEMA ONLY
Schema enum: `active | suspended | expired`. No transition enforcement in handlers.

### Course Status -- SCHEMA ONLY
Schema enum: `draft | published | archived`. No course handlers implemented.

---

## Domain Events Audit

### Published Events

| Event | Handler | Emitted | Payload Correct |
|---|---|---|---|
| training.published | publishTraining.ts | YES | NO -- missing trainingType, creditValue |
| training.completed | completeTraining.ts + markComplete.ts | YES (dual) | OK |
| training.cancelled | cancelTraining.ts | YES | NO -- missing enrollmentCount |
| credit.awarded | markComplete.ts | YES | OK |
| CertificateGenerated | -- | NO | N/A |

### Consumed Events

| Event | Handler | Implemented |
|---|---|---|
| PaymentRecorded (M06) | -- | NO |
| RefundCompleted (M06) | -- | NO |

---

## File Inventory

### training/ (14 non-test handler files + 4 repo files)

**Wired (2):** `completeTraining.ts`, `publishTraining.ts`
**Dead code (8):** `createTraining.ts`, `updateTraining.ts`, `cancelTraining.ts`, `enroll.ts`, `listTrainings.ts`, `listMyTrainings.ts`, `listEnrollments.ts`, `markComplete.ts`
**Migrated to TypeSpec (4):** `createAccreditedProvider.ts`, `updateAccreditedProvider.ts`, `deleteAccreditedProvider.ts`, `listAccreditedProviders.ts`
**Repos (4):** `repos/training.repo.ts`, `repos/training.repo.test.ts`, `repos/accredited-provider.schema.ts`, `repos/accredited-provider.repo.ts`

### Test files (14)
`ac-m09.training.test.ts`, `ac-m10.credit-tracking.test.ts`, `accredited-providers.test.ts`, `auth-enforcement.test.ts`, `br-14.cross-org-credits.test.ts`, `br-15.training-event-distinction.test.ts`, `cancelTraining.test.ts`, `completeTraining.test.ts`, `createAccreditedProvider.test.ts`, `createTraining.test.ts`, `deleteAccreditedProvider.test.ts`, `enroll.test.ts`, `flow-02.training-credit-award.test.ts`, `flow-020.attendance-credit.test.ts`, `listAccreditedProviders.test.ts`

---

## Findings Summary

| ID | Sev | Cat | Description |
|---|---|---|---|
| EM-M09-z6a7b8c9 | P0 | ARCH | 8/14 training/ handler files are dead code (unwired) |
| EM-M09-n4o5p6q7 | P1 | WORKFLOW | Certificate generation not connected to training module |
| EM-M09-y5z6a7b8 | P2 | API | URL fragmentation: 3 different patterns for same resource |
| EM-M09-x4y5z6a7 | P2 | DATA | trainingType validated but never persisted (no column) |
| EM-M09-w3x4y5z6 | P2 | AUTH | Officer handlers lack admin/super role fallback |
| EM-M09-v2w3x4y5 | P2 | AUTH | listTrainings has no auth check (dead code) |
| EM-M09-q7r8s9t0 | P2 | EVENT | TrainingPublished event payload mismatches spec |
| EM-M09-r8s9t0u1 | P2 | EVENT | TrainingCancelled event payload mismatches spec |
| EM-M09-s9t0u1v2 | P2 | EVENT | CertificateGenerated event never emitted |
| EM-M09-t0u1v2w3 | P2 | EVENT | PaymentRecorded consumer not implemented |
| EM-M09-u1v2w3x4 | P2 | EVENT | RefundCompleted consumer not implemented |
| EM-M09-k1l2m3n4 | P2 | WORKFLOW | publishTraining lacks completeness validation |
| EM-M09-m3n4o5p6 | P2 | WORKFLOW | Over-capacity creates cancelled enrollment instead of 409 |
| EM-M09-d4e5f6g7 | P3 | API | completeTraining wired as POST, spec says PUT |
| EM-M09-o5p6q7r8 | P3 | QUALITY | No enrollment state machine enforcement function |
| EM-M09-p6q7r8s9 | P3 | QUALITY | No accredited provider status transition enforcement |

**P0:** 1 | **P1:** 1 | **P2:** 11 | **P3:** 3 | **Total:** 16

---

## Delta from Previous Audit (2026-05-27)

| Change | Detail |
|---|---|
| Score | 3.0 -> 5.0 (+2.0) |
| Domain events | 0/5 -> 3/5 emitted (training.published, training.completed, training.cancelled, credit.awarded) |
| State machine | Ad-hoc -> Formal VALID_TRANSITIONS map in completeTraining.ts |
| createTraining status bypass | P1 FIXED -- now hardcodes `status: 'draft'` |
| Visibility column | Previously missing, now present in schema with `network` default |
| Dead code finding | NEW P0 -- deeper analysis revealed 8 unwired handlers |
| Findings count | 15 -> 16 (added dead code P0, resolved 2 prior findings) |


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
