---
phase: 22-prc-cpd-compliance
plan: "02"
subsystem: training
tags: [accredited-providers, prc, crud, officer-rbac]
dependency_graph:
  requires: [22-01]
  provides: [accredited-provider-crud]
  affects: [training]
tech_stack:
  added: []
  patterns: [handler-repo-pattern, requirePosition-rbac, org-scoped-queries]
key_files:
  created:
    - services/api-ts/src/handlers/training/repos/accredited-provider.repo.ts
    - services/api-ts/src/handlers/training/listAccreditedProviders.ts
    - services/api-ts/src/handlers/training/createAccreditedProvider.ts
    - services/api-ts/src/handlers/training/updateAccreditedProvider.ts
    - services/api-ts/src/handlers/training/deleteAccreditedProvider.ts
    - services/api-ts/src/handlers/training/accredited-providers.test.ts
  modified:
    - services/api-ts/src/app.ts
decisions:
  - "requirePosition (SOCIETY_OFFICER, PRESIDENT) used for all provider endpoints — same pattern as getCreditCompliance.ts"
  - "listWithExpiry method on repo computes expiringSoon flag inline — avoids DB-level date arithmetic, simpler and correct for 30-day window"
  - "Routes registered hand-wired (no TypeSpec) per plan spec; no /api prefix per CLAUDE.md"
metrics:
  duration: "8 minutes"
  completed: "2026-05-13"
  tasks_completed: 1
  files_created: 6
  files_modified: 1
---

# Phase 22 Plan 02: Accredited Provider CRUD Summary

Full CRUD for PRC-accredited training providers: org-scoped repository, 4 handlers with officer RBAC, route registration, and 17 unit tests covering auth, status filter, expiry flag, and org isolation.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Provider repository + CRUD handlers + route registration | bf03c3c | 6 created, 1 modified |

## What Was Built

- **AccreditedProviderRepository** — `listWithExpiry(orgId, statusFilter?)` queries org-scoped providers and computes `expiringSoon: boolean` (true if expiryDate is non-null, in the future, and <= 30 days away). Also `getByOrg`, `createOne`, `update`, `delete`.
- **4 handler files** — All follow `getCreditCompliance.ts` pattern: 401 guard on missing user, `ctx.set('organizationId', orgId)`, `requirePosition([SOCIETY_OFFICER, PRESIDENT])`, then business logic.
- **app.ts routes** — 4 routes registered under `/accredited-providers/:organizationId[/:providerId]` with `authMiddleware()` per CLAUDE.md (no `/api` prefix).
- **17 unit tests** — Cover 401 auth guard, 403 non-officer denial, CRUD happy paths, status filter passthrough, expiringSoon flag values, org isolation via `getByOrg`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — handlers are fully wired to real repository methods.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model documents (T-22-02 through T-22-05). All mitigations applied:
- T-22-02: `requirePosition` at handler entry
- T-22-03: `getByOrg` / `listWithExpiry(orgId)` scopes all queries
- T-22-04: Drizzle parameterized queries; pgEnum constrains status
- T-22-05: `authMiddleware()` on all 4 routes

## Deferred Items

Pre-existing typecheck errors in `src/generated/openapi/registry.ts`, `src/handlers/system/`, and `src/handlers/membership/repos/membership.repo.ts` — not caused by this plan. Logged for separate resolution.

## Self-Check: PASSED

- services/api-ts/src/handlers/training/repos/accredited-provider.repo.ts — FOUND
- services/api-ts/src/handlers/training/listAccreditedProviders.ts — FOUND
- services/api-ts/src/handlers/training/createAccreditedProvider.ts — FOUND
- services/api-ts/src/handlers/training/updateAccreditedProvider.ts — FOUND
- services/api-ts/src/handlers/training/deleteAccreditedProvider.ts — FOUND
- services/api-ts/src/handlers/training/accredited-providers.test.ts — FOUND
- Commit bf03c3c — FOUND
