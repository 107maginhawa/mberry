---
phase: 35
plan: "35-01"
subsystem: "specs/api"
tags: [typespec, openapi, migration]
dependency_graph:
  requires: []
  provides: [typespec-definitions-for-10-premigration-routes]
  affects: [specs/api/dist/openapi/openapi.json]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified: []
decisions:
  - "All 10 pre-migration routes already have TypeSpec definitions -- no new code needed"
metrics:
  duration: "2m"
  completed: "2026-05-28T09:34:00Z"
---

# Phase 35 Plan 01: Author TypeSpec Definitions for 10 Remaining Routes -- Summary

All 10 pre-migration routes already had complete TypeSpec definitions before this plan executed. No code changes were required.

## One-liner

No-op: all 10 target routes already have TypeSpec definitions in existing .tsp files

## Verification Results

TypeSpec compilation: exit 0 (823 warnings, 0 errors)
OpenAPI output contains all 3 operation groups (grep count = 3):
- `createSpecialAssessment` -- in `specs/api/src/association/member/special-assessments.tsp`
- `bulkIssueCertificates` -- in `specs/api/src/association/member/certificates.tsp`
- `createSavedSegment` -- in `specs/api/src/association/core/communication.tsp`

## Existing Coverage Detail

### Special Assessments (6 routes) -- already in `association/member/special-assessments.tsp`
- `createSpecialAssessment` -- POST
- `listSpecialAssessments` -- GET /{orgId}
- `updateSpecialAssessment` -- PUT /{id}
- `deleteSpecialAssessment` -- DELETE /{id}
- `applySpecialAssessment` -- POST /{id}/apply
- `getSpecialAssessmentCollection` -- GET /{id}/collection

Wired in main.tsp line 335: `AssocSpecialAssessmentManagement extends Association.Member.SpecialAssessments.SpecialAssessmentManagement`

### Certificates Bulk Issue (1 route) -- already in `association/member/certificates.tsp`
- `bulkIssueCertificates` -- POST /bulk-issue (supports 201 sync + 202 queued responses)

Wired in main.tsp line 395: `CertificateBulkIssuance extends Association.Member.Certificates.CertificateBulkIssuance`

### Saved Segments (3 routes) -- already in `association/core/communication.tsp`
- `createSavedSegment` -- POST
- `listSavedSegments` -- GET
- `deleteSavedSegment` -- DELETE /{id}

Wired in main.tsp line 459: `AssocSavedSegmentManagement extends Association.Core.Communication.SavedSegmentManagement.SavedSegmentManagement`

## Deviations from Plan

### Plan Superseded by Prior Work

All 4 tasks (T1-T4) were already completed in earlier development cycles. The plan was authored with stale information about which routes lacked TypeSpec coverage.

- T1 (special-assessments in dues-custom.tsp): Already in `association/member/special-assessments.tsp` with richer models than the plan specified
- T2 (certificates-custom.tsp): Already in `association/member/certificates.tsp` with 201/202 dual-response support
- T3 (communication-custom.tsp): Already in `association/core/communication.tsp` with typed SegmentFilters model
- T4 (imports in main.tsp): All imports and interface wiring already present

## Tasks

| Task | Status | Notes |
|------|--------|-------|
| T1: Add special-assessments to dues-custom.tsp | ALREADY DONE | Exists in association/member/special-assessments.tsp |
| T2: Create certificates-custom.tsp | ALREADY DONE | Exists in association/member/certificates.tsp |
| T3: Create communication-custom.tsp | ALREADY DONE | Exists in association/core/communication.tsp |
| T4: Add imports to main.tsp | ALREADY DONE | All imports and interfaces wired |

## Known Stubs

None.

## Self-Check: PASSED

- All target operations confirmed in OpenAPI output (grep count = 3)
- TypeSpec compilation succeeds (exit 0)
- No files created or modified (no-op plan)
