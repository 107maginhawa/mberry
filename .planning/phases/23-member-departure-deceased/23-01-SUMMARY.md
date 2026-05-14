---
phase: 23-member-departure-deceased
plan: "01"
subsystem: association:member
tags: [schema, typespec, codegen, membership, lifecycle]
dependency_graph:
  requires: []
  provides: [MembershipStatus.resigned, MembershipStatus.deceased, MembershipStatus.expelled, dateOfDeath, resignMembership, deceaseMembership]
  affects: [services/api-ts/src/generated/openapi, specs/api/dist]
tech_stack:
  added: []
  patterns: [typespec-enum-extension, drizzle-pgEnum-extension, additive-migration]
key_files:
  created:
    - services/api-ts/src/handlers/association:member/resignMembership.ts
    - services/api-ts/src/handlers/association:member/deceaseMembership.ts
    - services/api-ts/src/generated/migrations/0035_glossy_titanium_man.sql
  modified:
    - specs/api/src/association/member/membership.tsp
    - services/api-ts/src/handlers/association:member/repos/membership.schema.ts
    - services/api-ts/src/generated/openapi/registry.ts
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/validators.ts
decisions:
  - dateOfDeath placed on memberships table (not person) for org-scoping — aligns with RESEARCH.md recommendation
  - terminationReason optional on resign (unlike terminate which requires it)
  - Migration uses additive ALTER TYPE ADD VALUE (no DROP+RECREATE — data safe)
metrics:
  duration: "~12 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  files_changed: 8
---

# Phase 23 Plan 01: Schema + TypeSpec + Codegen Summary

**One-liner:** Additive enum extension (resigned/deceased/expelled) + dateOfDeath column + TypeSpec resign/decease operations + migration 0035 via ALTER TYPE ADD VALUE.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend TypeSpec enum + 2 new operations | 120ba4c | membership.tsp, generated/openapi/* |
| 2 | Extend Drizzle schema + generate migration | 7a5b300 | membership.schema.ts, migrations/0035_* |

## What Was Built

### Task 1: TypeSpec + Codegen
- Added `resigned`, `deceased`, `expelled` to `MembershipStatus` enum in TypeSpec
- Added `MembershipResignRequest` (optional terminationReason) and `MembershipDeceasedRequest` (required dateOfDeath, optional terminationReason)
- Added `resignMembership` (POST /{membershipId}/resign) and `deceaseMembership` (POST /{membershipId}/deceased) operations in `MembershipManagement` interface
- Both operations require `association:admin` role
- Ran full codegen: TypeSpec build → OpenAPI → routes/validators/registry/stubs
- 2 new handler stubs generated, 361 existing handlers skipped

### Task 2: Drizzle Schema + Migration
- Extended `membershipStatusEnum` from 7 to 10 values (added resigned, deceased, expelled)
- Added `dateOfDeath: date('date_of_death')` (nullable) to `memberships` table after `terminationReason`
- Generated migration 0035 with exact SQL:
  - `ALTER TYPE "public"."membership_status" ADD VALUE 'resigned'`
  - `ALTER TYPE "public"."membership_status" ADD VALUE 'deceased'`
  - `ALTER TYPE "public"."membership_status" ADD VALUE 'expelled'`
  - `ALTER TABLE "membership" ADD COLUMN "date_of_death" date`

## Decisions Made

1. **dateOfDeath on memberships, not person** — Org-scoped; a person could be deceased in one org's records before another knows. Aligns with RESEARCH.md recommendation.
2. **terminationReason optional on resign** — Resignation is voluntary; reason is courtesy, not required. Terminate (disciplinary) requires it.
3. **Additive migration** — Drizzle generated `ALTER TYPE ADD VALUE` (not DROP+RECREATE), preserving all existing data safely.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The two generated handler stubs (`resignMembership.ts`, `deceaseMembership.ts`) are intentional scaffolding — they import `db` from a path that is pre-existing broken (`@/core/database` does not export `db`). This is a pre-existing issue affecting all newly generated stubs in this codebase. Business logic will be wired in Plan 02.

## Threat Flags

None — this plan is schema/spec only. No new runtime network endpoints exposed until Plan 02 implements handlers.

## Self-Check: PASSED

- [x] `specs/api/src/association/member/membership.tsp` — modified, contains resigned/deceased/expelled + 2 new operations
- [x] `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` — modified, contains dateOfDeath
- [x] `services/api-ts/src/generated/migrations/0035_glossy_titanium_man.sql` — exists, correct SQL
- [x] `services/api-ts/src/handlers/association:member/resignMembership.ts` — exists
- [x] `services/api-ts/src/handlers/association:member/deceaseMembership.ts` — exists
- [x] Commit 120ba4c — Task 1 (TypeSpec + codegen)
- [x] Commit 7a5b300 — Task 2 (schema + migration)
