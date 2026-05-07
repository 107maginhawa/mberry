---
phase: 04-typespec-openapi-reconciliation
plan: 10
subsystem: specs/api
tags: [typespec, openapi, gap-closure, person, credits, notifs]
dependency_graph:
  requires: []
  provides: [TypeSpec definitions for /persons/me/*, /credit-compliance/:orgId, /officer-terms/:orgId, /notifs/read-all]
  affects: [specs/api/src/main.tsp, OpenAPI rebuild in plan 04-11]
tech_stack:
  added: []
  patterns: [TypeSpec namespace per module, bearerAuth + x-security-required-roles, inline response models]
key_files:
  created:
    - specs/api/src/modules/person-custom.tsp
    - specs/api/src/association/member/credits.tsp
    - specs/api/src/modules/notifs-custom.tsp
  modified:
    - specs/api/src/main.tsp
decisions:
  - "person-custom.tsp defines PersonCustomModule namespace with @route('/persons/me') — separate from PersonModule to avoid namespace conflicts with existing /persons routes"
  - "credits.tsp placed under association/member/ as Association.Member.Credits namespace — mirrors governance.tsp pattern"
  - "officer-terms route kept in credits.tsp (not governance.tsp) since it is a custom app.ts route, not the existing /association/member/officer-terms CRUD route"
  - "ComplianceStatus enum uses snake_case values (compliant, at_risk, non_compliant) matching actual SQL output in app.ts"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-06"
  tasks_completed: 3
  files_changed: 4
---

# Phase 04 Plan 10: TypeSpec for Custom Endpoints — Person/Me, Credits, Notifs

## One-liner

TypeSpec definitions for 16 hand-wired routes: 13 /persons/me/* operations, getCreditCompliance, listOfficerTerms, and markAllNotificationsRead — closing Gap 1 (SPEC-08 part 1).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Author TypeSpec for /persons/me custom endpoints | f379bd1 | specs/api/src/modules/person-custom.tsp |
| 2 | Author TypeSpec for credits, officer-terms, notifs/read-all | 7829bd5 | specs/api/src/association/member/credits.tsp, specs/api/src/modules/notifs-custom.tsp |
| 3 | Register new TypeSpec files in main.tsp | 0e03de9 | specs/api/src/main.tsp |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Additional Notes

- Plan task list shows 12 operations for person-custom; 13 were authored because `updateMyProfile` (PATCH /persons/me) was explicitly listed in the plan interfaces section and the task action description. This is correct — not a deviation.
- `listOfficerTerms` placed in `credits.tsp` rather than `governance.tsp` because the custom app.ts route `/officer-terms/:orgId` is a standalone non-CRUD path separate from the existing TypeSpec-covered `/association/member/officer-terms` CRUD interface in governance.tsp.

## Decisions Made

1. `PersonCustomModule` uses its own namespace rather than extending `PersonModule` — avoids collision with the @route("/persons") base route already defined in person.tsp.
2. `Association.Member.Credits` namespace hosts both `CreditComplianceManagement` and `OfficerTermsManagement` — grouped by function (officer-facing credit/governance views) not by file origin.
3. `NotifsCustomModule` is a thin namespace wrapping a single operation — matches the pattern used for other custom modules in this phase.

## Threat Flags

None — all new operations annotate `@useAuth(bearerAuth)` with appropriate roles per threat model T-04-gc-03 and T-04-gc-04. No new network surface beyond what exists in app.ts.

## Known Stubs

None — this plan authors TypeSpec definitions only. No runtime code was modified.

## Self-Check: PASSED

- specs/api/src/modules/person-custom.tsp: EXISTS (13 operationIds)
- specs/api/src/association/member/credits.tsp: EXISTS (2 operationIds)
- specs/api/src/modules/notifs-custom.tsp: EXISTS (1 operationId)
- specs/api/src/main.tsp: imports all 3 new files, registers 4 new interfaces
- Commits: f379bd1, 7829bd5, 0e03de9
