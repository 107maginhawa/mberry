---
phase: 35
plan: "35-02"
subsystem: "api-ts routing"
tags: [typespec-migration, route-cleanup, hand-wired-removal]
dependency_graph:
  requires: ["35-01"]
  provides: ["all-pre-migration-routes-migrated"]
  affects: ["services/api-ts/src/app.ts"]
tech_stack:
  patterns: [generated-openapi-routes, registry-based-handler-mapping]
key_files:
  modified:
    - services/api-ts/src/app.ts
decisions:
  - "Kept assocIdParam/uuidIdParam/orgIdParam/orgIdShortParam validators — still used by non-migrated routes"
  - "T1 (build+generate) confirmed no-op — generated files already contained all 14 operations"
  - "T7 (handler signatures) confirmed no-op — typecheck passes with existing signatures via re-export stubs"
metrics:
  duration: "337s"
  completed: "2026-05-28T09:42:45Z"
  tasks_completed: 8
  tasks_total: 8
---

# Phase 35 Plan 02: Build, Generate, Remove Hand-Wired, Update Handlers Summary

Removed 14 hand-wired route registrations from app.ts and their associated Zod validators, completing the pre-migration backlog. All routes now served via generated OpenAPI routing with registry-based handler mapping.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| T1 | Run TypeSpec build and code generation | (no-op) | Generated files already contained all 14 operations from Plan 35-01 |
| T2 | Remove hand-wired platformadmin routes | 284dd464 | Removed getNationalDashboard, listAllCommittees, getCommittee route registrations + imports |
| T3 | Remove hand-wired dues send-link route | 17915e9a | Removed /org/:organizationId/payments/send-link registration + import |
| T4 | Remove hand-wired special-assessments routes | 0ea469c7 | Removed 6 route registrations, saCreateBody, saUpdateBody validators, 6 imports |
| T5 | Remove hand-wired certificates bulk-issue route | f8776fca | Removed /certificates/bulk-issue registration, bulkIssueBody validator, import |
| T6 | Remove hand-wired communications segments routes | f38e4fc9 | Removed 3 /communications/segments registrations, segmentBody validator, import |
| T7 | Update handler signatures | (no-op) | Handlers already compatible via re-export stubs; typecheck passes |
| T8 | Update PRE-MIGRATION comment block | 536114c8 | Updated to "ALL PRE-MIGRATION ROUTES MIGRATED" with Cycle 8 + Phase 35 history |

## Deviations from Plan

### Adjusted Tasks

**1. [Rule 3 - Blocking] T1 build+generate was a no-op**
- **Reason:** Plan 35-01 already ran the TypeSpec build; generated files were up to date
- **Action:** Verified all 14 operations present in routes.ts and registry.ts, skipped rebuild

**2. [Rule 3 - Blocking] T7 handler signature updates were a no-op**
- **Reason:** Generated registry uses re-export stubs (e.g., `association:member/bulkIssueCertificates.ts` re-exports from `certificates/bulkIssueCertificates.ts`). Handler signatures already compatible with generated validator types.
- **Action:** Verified typecheck passes, no signature changes needed

## Verification Results

- `bun run typecheck` exits 0 (all 5 workspaces pass)
- All 14 hand-wired route registrations removed from app.ts
- All associated Zod validators removed (saCreateBody, saUpdateBody, bulkIssueBody, segmentBody)
- Shared validators retained (assocIdParam, uuidIdParam, orgIdParam, orgIdShortParam)
- Comment block updated to reflect "ALL PRE-MIGRATION ROUTES MIGRATED"
- Net change: -60 lines from app.ts (14 route registrations + 4 validator blocks + 10 import lines)

## Routes Migrated (14 total)

1. `GET /admin/national-dashboard/:associationId` -> getNationalDashboard
2. `GET /admin/committees` -> listAllCommittees
3. `GET /admin/committees/:id` -> getCommittee
4. `POST /org/:organizationId/payments/send-link` -> sendPaymentLink
5. `POST /association/member/special-assessments` -> createSpecialAssessment
6. `GET /association/member/special-assessments/:orgId` -> listSpecialAssessments
7. `PUT /association/member/special-assessments/:id` -> updateSpecialAssessment
8. `DELETE /association/member/special-assessments/:id` -> deleteSpecialAssessment
9. `POST /association/member/special-assessments/:id/apply` -> applySpecialAssessment
10. `GET /association/member/special-assessments/:id/collection` -> getSpecialAssessmentCollection
11. `POST /certificates/bulk-issue` -> bulkIssueCertificates
12. `POST /communications/segments` -> createSavedSegment
13. `GET /communications/segments` -> listSavedSegments
14. `DELETE /communications/segments/:id` -> deleteSavedSegment

## Self-Check: PASSED

- [x] services/api-ts/src/app.ts modified (confirmed)
- [x] Commit 284dd464 exists
- [x] Commit 17915e9a exists
- [x] Commit 0ea469c7 exists
- [x] Commit f8776fca exists
- [x] Commit f38e4fc9 exists
- [x] Commit 536114c8 exists
