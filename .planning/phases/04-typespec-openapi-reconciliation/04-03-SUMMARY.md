---
phase: 04
plan: 03
subsystem: specs/api
tags: [typespec, openapi, events, training, lifecycle-operations]
dependency_graph:
  requires: [04-02]
  provides: [SPEC-03, SPEC-04]
  affects: [specs/api/dist/openapi/openapi.json, packages/sdk-ts]
tech_stack:
  added: []
  patterns: [TypeSpec lifecycle service interface, member-scoped operations, officer-scoped operations]
key_files:
  created: []
  modified:
    - specs/api/src/association/operations/events.tsp
    - specs/api/src/association/operations/training.tsp
    - specs/api/src/main.tsp
decisions:
  - "Added EventLifecycleService as a new interface (not merged into EventManagement) to avoid duplicating cancelEvent which already exists in EventManagement"
  - "Used organizationId as @query parameter (not @path) to match hand-wired route convention established in Phase 3"
  - "checkInCustomEvent reuses CheckInCreateRequest body model from existing CheckInManagement"
  - "completeCustomTraining reuses TrainingEnrollmentCompleteRequest body model from TrainingEnrollmentManagement"
metrics:
  duration: 8m
  completed: "2026-05-06"
  tasks: 2
  files: 3
---

# Phase 04 Plan 03: Events and Training Lifecycle TypeSpec Operations Summary

TypeSpec lifecycle service interfaces for all hand-wired events and training custom routes, producing OpenAPI coverage for member-facing and officer-facing operations not in the existing CRUD interfaces.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add events custom operation interfaces to events.tsp | 6488409 | events.tsp, main.tsp |
| 2 | Add training custom operation interfaces to training.tsp | dc45c4b | training.tsp, main.tsp |

## What Was Built

### Task 1: EventLifecycleService (events.tsp)

Added `interface EventLifecycleService` with 5 operations covering hand-wired routes not in EventManagement:

| Operation | Method | Route | Roles |
|-----------|--------|-------|-------|
| `listMyCustomEvents` | GET | /my | association:member |
| `registerForCustomEvent` | POST | /{eventId}/register | association:member |
| `checkInCustomEvent` | POST | /{eventId}/check-in | association:admin, association:staff |
| `listCustomEventAttendance` | GET | /{eventId}/attendance | association:admin, association:staff |
| `listCustomEventRegistrations` | GET | /{eventId}/registrations | association:admin, association:staff |

Registered as `AssocEventLifecycleService` at `/association/event-lifecycle` in main.tsp.

Note: `cancelEvent` and `createEvent`/`updateEvent` were already covered by EventManagement — not duplicated.

### Task 2: TrainingLifecycleService (training.tsp)

Added `interface TrainingLifecycleService` with 6 operations covering hand-wired routes not in TrainingManagement:

| Operation | Method | Route | Roles |
|-----------|--------|-------|-------|
| `listMyCustomTrainings` | GET | /my | association:member |
| `enrollInCustomTraining` | POST | /{trainingId}/enroll | association:member |
| `cancelCustomTraining` | POST | /{trainingId}/cancel | association:admin, association:staff |
| `completeCustomTraining` | POST | /{trainingId}/complete | association:admin, association:staff |
| `checkInCustomTraining` | POST | /{trainingId}/check-in | association:admin, association:staff |
| `listCustomTrainingEnrollments` | GET | /{trainingId}/enrollments | association:admin, association:staff |

Registered as `AssocTrainingLifecycleService` at `/association/training-lifecycle` in main.tsp.

Note: `createTraining`, `updateTraining` already covered by TrainingManagement — not duplicated.

## Deviations from Plan

None — plan executed exactly as written. All operations used `organizationId` (not `orgId`) per Phase 3 unification. Build succeeded with 0 errors.

## Verification

- `cd specs/api && bun run build` exits 0
- `grep -c "event-lifecycle\|training-lifecycle" specs/api/dist/openapi/openapi.json` returns 11
- All acceptance criteria met for both tasks

## Known Stubs

None.

## Threat Flags

None — no new network endpoints beyond what the plan specified. Role constraints match threat model dispositions T-04-06 and T-04-07.

## Self-Check: PASSED

- specs/api/src/association/operations/events.tsp — FOUND (contains EventLifecycleService)
- specs/api/src/association/operations/training.tsp — FOUND (contains TrainingLifecycleService)
- specs/api/src/main.tsp — FOUND (contains AssocEventLifecycleService + AssocTrainingLifecycleService)
- Commit 6488409 — FOUND
- Commit dc45c4b — FOUND
