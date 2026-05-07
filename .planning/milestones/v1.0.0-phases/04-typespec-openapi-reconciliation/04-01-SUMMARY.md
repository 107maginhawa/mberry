---
phase: 04-typespec-openapi-reconciliation
plan: "01"
subsystem: specs/api
tags: [typespec, openapi, elections, certificates, governance]
dependency_graph:
  requires: []
  provides: [elections-openapi-paths, certificates-openapi-paths, election-status-db-aligned]
  affects: [specs/api/dist/openapi/openapi.json, services/api-ts generated types]
tech_stack:
  added: []
  patterns: [typespec-module-authoring, interface-registration-in-main-tsp]
key_files:
  created:
    - specs/api/src/association/member/certificates.tsp
  modified:
    - specs/api/src/association/member/governance.tsp
    - specs/api/src/main.tsp
decisions:
  - "DB schema values are canonical for ElectionStatus enum (nominationsOpen, awaitingConfirmation, published vs old nominationOpen/nominationClosed/votingClosed/certified)"
  - "Certificates TypeSpec scoped to 2 read-only ops matching hand-wired handler (listMyCertificates, getCertificate)"
metrics:
  duration: 5m
  completed_date: "2026-05-06"
  tasks_completed: 2
  files_modified: 3
---

# Phase 04 Plan 01: TypeSpec OpenAPI Reconciliation — Elections + Certificates Summary

Register elections governance interfaces in main.tsp, reconcile ElectionStatus enum to match DB, and author certificates.tsp TypeSpec module covering the two modules with zero prior OpenAPI coverage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Reconcile ElectionStatus enum in governance.tsp | ee65592 | governance.tsp |
| 2 | Author certificates.tsp and register elections+certificates in main.tsp | e4b262c | certificates.tsp, main.tsp |

## Verification Results

- `bun run build` exits 0 (307 pre-existing warnings, zero errors)
- `grep -c "election" openapi.json` = 67
- `grep -c "certificate" openapi.json` = 32
- `grep "nominationsOpen" governance.tsp` matches (DB-aligned enum)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All Certificate and Election endpoints use `@useAuth(bearerAuth)` + `@extension("x-security-required-roles", ...)` per threat model T-04-01 and T-04-02.

## Self-Check: PASSED

- `specs/api/src/association/member/certificates.tsp` exists
- `specs/api/src/main.tsp` contains `AssocElectionManagement`, `AssocCandidateManagement`, `AssocBallotManagement`, `AssocCertificateManagement`
- Commits ee65592 and e4b262c confirmed in git log
