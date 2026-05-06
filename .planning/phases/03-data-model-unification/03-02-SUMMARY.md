---
phase: 03-data-model-unification
plan: 02
subsystem: backend-data-model
tags: [schema, tenantId, enum, consolidation, drizzle]
dependency_graph:
  requires: [03-01]
  provides: [canonical-schema-only, no-tenantid-runtime, camelcase-enums]
  affects: [dues, certificates, communications, elections, events, training, membership]
tech_stack:
  added: []
  patterns: [drizzle-pgEnum-camelCase, schema-consolidation]
key_files:
  created:
    - services/api-ts/src/handlers/certificates/repos/certificates.schema.ts
    - services/api-ts/src/handlers/communications/repos/communications.schema.ts
    - services/api-ts/src/handlers/dues/repos/dues.schema.ts
    - services/api-ts/src/handlers/elections/repos/elections.schema.ts
    - services/api-ts/src/generated/migrations/0015_enum_standardization.sql
  modified:
    - services/api-ts/src/middleware/org-context.ts
    - services/api-ts/src/middleware/org-context.test.ts
    - services/api-ts/src/app.ts
    - services/api-ts/src/handlers/dues/repos/dues.repo.ts
    - services/api-ts/src/handlers/dues/disconnectGateway.ts
    - services/api-ts/src/handlers/dues/upsertGatewayConfig.ts
    - services/api-ts/src/handlers/dues/refundPayment.ts
    - services/api-ts/src/handlers/dues/jobs/reminderProcessor.ts
    - services/api-ts/src/handlers/certificates/repos/certificates.repo.ts
    - services/api-ts/src/handlers/communications/repos/communications.repo.ts
    - services/api-ts/src/handlers/elections/repos/elections.repo.ts
    - services/api-ts/src/handlers/elections/castVote.ts
    - services/api-ts/src/handlers/elections/getElection.ts
    - services/api-ts/src/handlers/person/exportPersonData.ts
    - services/api-ts/src/handlers/association:operations/repos/events.schema.ts
    - services/api-ts/src/seed.ts
    - services/api-ts/src/seed-modules.ts
    - services/api-ts/src/seed-rich.ts
decisions:
  - memberships.orgId corrected to memberships.organizationId throughout middleware and app.ts
  - *.types.ts files renamed to *.schema.ts (not deleted) where they are the only schema definition
  - training.types.ts, events.types.ts, membership.types.ts deleted (repos already imported from canonical association:* schema)
  - Pre-existing typecheck errors (763) were out of scope; count reduced to 733 after fixes
  - billing.schema.ts, booking.schema.ts, comms.schema.ts enum values not changed (out of plan scope)
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-06"
  tasks_completed: 3
  files_changed: 22
---

# Phase 03 Plan 02: Handler Consolidation and Enum Standardization Summary

Remove duplicate schema definitions, fix tenantId → organizationId in middleware, and standardize enum values to camelCase across all old handler modules.

## What Was Built

**Task 1: Fix tenantId in middleware and runtime code**
- `org-context.ts`: Changed `memberships.orgId` → `memberships.organizationId` in Drizzle query and select (3 occurrences)
- `app.ts`: Fixed credit-entries endpoint to use `memberships.organizationId`
- `org-context.test.ts`: Updated mock row key from `orgId` to `organizationId`
- Result: zero tenantId references in middleware or types; all 5 middleware tests pass

**Task 2: Eliminate *.types.ts duplicate schema files**
- **Deleted** (repos already imported from canonical association:* schemas):
  - `training/repos/training.types.ts`
  - `events/repos/events.types.ts`
  - `membership/repos/membership.types.ts`
- **Renamed to *.schema.ts** (these are sole schema definitions for their tables):
  - `dues/repos/dues.types.ts` → `dues.schema.ts`
  - `certificates/repos/certificates.types.ts` → `certificates.schema.ts`
  - `communications/repos/communications.types.ts` → `communications.schema.ts`
  - `elections/repos/elections.types.ts` → `elections.schema.ts`
- Updated all imports in repos, handlers, seed files
- Fixed seed.ts, seed-rich.ts, seed-modules.ts: removed `tenantId`/`orgId` field references, replaced with `organizationId` matching canonical schemas
- Typecheck error count reduced from 763 (baseline) to 733 after cleanup

**Task 3: Standardize enum values to camelCase (D-10)**
- `dues.schema.ts`: `bank_transfer` → `bankTransfer`, `partially_refunded` → `partiallyRefunded`
- `communications.schema.ts`: `scheduled_failed` → `scheduledFailed`
- `elections.schema.ts`: `nominations_open` → `nominationsOpen`, `voting_open` → `votingOpen`, `awaiting_confirmation` → `awaitingConfirmation`, `in_person` → `inPerson`
- `events.schema.ts`: `general_assembly` → `generalAssembly`, `induction_ceremony` → `inductionCeremony`, `medical_mission` → `medicalMission`, `board_meeting` → `boardMeeting`, `committee_meeting` → `committeeMeeting`
- Updated handler code: `castVote.ts` (votingOpen), `getElection.ts` (awaitingConfirmation), `refundPayment.ts` (partiallyRefunded), `seed-rich.ts` (bankTransfer)
- Created migration `0015_enum_standardization.sql` with ALTER TYPE RENAME VALUE statements

## Commits

- `d3a26c0` — fix(03-02): align org-context middleware to use organizationId from membership schema
- `5c70b3c` — feat(03-02): eliminate *.types.ts duplicates — consolidate to canonical schema files
- `9814bea` — feat(03-02): standardize enum values to camelCase (D-10)

## Verification

- Zero `tenantId` in `src/middleware/` and `src/types/`
- Zero `ctx.get('tenantId')` or `ctx.var.tenantId` in any handler
- Zero `*.types.ts` files with `pgTable` definitions in old handler directories
- All 5 `org-context.test.ts` tests pass
- `app.ts` still registers all 7 route groups (`/dues`, `/membership`, `/communications`, `/certificates`, `/events`, `/training`, `/elections`)
- Migration file created for enum renames

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed memberships.orgId → memberships.organizationId in org-context middleware**
- Found during: Task 1 (attempting to verify current state)
- Issue: org-context.ts queried `memberships.orgId` but canonical membership.schema.ts only has `organizationId`. The middleware would have failed at runtime for any real auth request.
- Fix: Updated query select, where clause, and response object construction to use `organizationId`; updated app.ts credit-entries endpoint similarly; updated test mock row key
- Files modified: org-context.ts, org-context.test.ts, app.ts
- Commit: d3a26c0

**2. [Rule 1 - Bug] Fixed tenantId field references in seed files**
- Found during: Task 2 (running typecheck after schema consolidation)
- Issue: seed.ts, seed-rich.ts, seed-modules.ts used `tenantId` and `orgId` as insert fields against canonical schemas that only have `organizationId`. These would fail at runtime.
- Fix: Replaced all tenantId/orgId insert fields with organizationId; removed `tenantId` variable in seed-modules.ts; removed sortOrder from membershipTier inserts (field not in canonical schema)
- Files modified: seed.ts, seed-rich.ts, seed-modules.ts
- Commit: 5c70b3c

## Known Stubs

None — all handler modules route to real schema definitions. Seed files may not succeed at runtime if DB migrations haven't been applied, but this is expected (seeds require prior migration).

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes introduced. The org-context fix (T-03-04) improves security by ensuring membership lookup uses the correct column.

## Self-Check: PASSED

- Migration file: FOUND at services/api-ts/src/generated/migrations/0015_enum_standardization.sql
- Commit d3a26c0: FOUND (org-context fix)
- Commit 5c70b3c: FOUND (schema consolidation)
- Commit 9814bea: FOUND (enum standardization)
- Zero tenantId in middleware: CONFIRMED
- Zero *.types.ts with pgTable in old handler repos: CONFIRMED
- Middleware tests: 5/5 pass
