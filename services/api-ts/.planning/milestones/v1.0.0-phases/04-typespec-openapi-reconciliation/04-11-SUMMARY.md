---
phase: 04-typespec-openapi-reconciliation
plan: 11
subsystem: specs/api
tags: [typespec, openapi, sdk, gap-closure, announcements, platform-admin, public-endpoints]
dependency_graph:
  requires: [04-10]
  provides: [complete-openapi-coverage, sdk-hooks-for-all-endpoints]
  affects: [specs/api, packages/sdk-ts, services/api-ts/generated]
tech_stack:
  added: []
  patterns: [typespec-namespace-per-feature, operationId-routing, route-prefix-in-main]
key_files:
  created:
    - specs/api/src/association/operations/announcements.tsp
    - specs/api/src/modules/platform-admin-custom.tsp
    - services/api-ts/src/handlers/platformadmin/getAdminRole.ts
    - services/api-ts/src/handlers/notifs/markAllNotificationsRead.ts
    - services/api-ts/src/handlers/association:member/getCreditCompliance.ts
    - services/api-ts/src/handlers/person/getMyMemberships.ts
    - services/api-ts/src/handlers/person/getMyCreditSummary.ts
    - services/api-ts/src/handlers/person/exportMyData.ts
    - services/api-ts/src/handlers/person/cancelMyAccountDeletion.ts
    - services/api-ts/src/handlers/person/requestMyAccountDeletion.ts
    - services/api-ts/src/handlers/person/createMyCreditEntry.ts
    - services/api-ts/src/handlers/person/listMyCreditEntries.ts
    - services/api-ts/src/handlers/person/getMyOfficerRole.ts
    - services/api-ts/src/handlers/person/getMyPrivacySettings.ts
    - services/api-ts/src/handlers/person/updateMyPrivacySettings.ts
    - services/api-ts/src/handlers/person/getMyNotificationPreferences.ts
    - services/api-ts/src/handlers/person/updateMyNotificationPreferences.ts
    - services/api-ts/src/handlers/person/updateMyProfile.ts
  modified:
    - specs/api/src/main.tsp
    - specs/api/src/modules/person-custom.tsp
    - specs/api/src/association/member/credits.tsp
    - services/api-ts/src/generated/openapi/registry.ts
    - services/api-ts/src/generated/openapi/routes.ts
    - services/api-ts/src/generated/openapi/validators.ts
    - packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts
    - packages/sdk-ts/src/generated/sdk.gen.ts
    - packages/sdk-ts/src/generated/types.gen.ts
decisions:
  - "Renamed CreditEntry to MyCreditEntry in person-custom.tsp to avoid duplicate-symbol conflict with certification.tsp"
  - "Added explicit @route prefixes in main.tsp for CreditCompliance and OfficerTerms interfaces (fixes duplicate-operation routing bug)"
  - "Registry imports for announcement handlers redirected to communications/ (existing impls) not generated communication/ stubs"
  - "markAllNotificationsRead handler implemented inline (delegates to NotificationRepository.markAllAsRead)"
  - "getAdminRole handler implemented to read platformAdmin from context (mirrors inline app.ts handler)"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-06"
  tasks_completed: 2
  files_created: 18
  files_modified: 9
---

# Phase 04 Plan 11: Announcements, Admin & Public TypeSpec + Full Pipeline Rebuild Summary

TypeSpec for 7 announcements routes + getAdminRole + getOrganizationBySlug authored; full OpenAPI → routes → SDK pipeline rebuilt with complete endpoint coverage.

## What Was Done

### Task 1: TypeSpec Authoring
- Created `specs/api/src/association/operations/announcements.tsp` — 7 `@operationId` operations under `Association.Operations.Announcements` namespace:
  - `listAnnouncements`, `getAnnouncement` (member access)
  - `createAnnouncement`, `publishAnnouncement`, `archiveAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` (officer access)
- Created `specs/api/src/modules/platform-admin-custom.tsp` — 2 operations:
  - `getOrganizationBySlug` (public, no auth) under `/public/org/{slug}`
  - `getAdminRole` (platform_admin) under `/admin/me/role`
- Updated `specs/api/src/main.tsp` — imports + interface registrations for both new files

### Task 2: Pipeline Rebuild
- `cd specs/api && bun run build` — succeeds (no errors, 438 pre-existing warnings)
- `cd services/api-ts && bun run generate` — succeeds; produces routes, validators, registry, and handler stubs
- `cd packages/sdk-ts && bun run generate` — succeeds; SDK hooks generated for all new endpoints

## Verification

| Check | Result |
|-------|--------|
| `grep "persons/me/memberships" openapi.json` | FOUND |
| `grep "credit-compliance" openapi.json` | FOUND |
| `grep "announcements" openapi.json` | FOUND |
| `grep "admin/me/role" openapi.json` | FOUND |
| `grep "public/org" openapi.json` | FOUND |
| `grep "notifs/read-all" openapi.json` | FOUND |
| `grep "getMyMembershipsOptions" react-query.gen.ts` | FOUND |
| `grep "listAnnouncementsOptions" react-query.gen.ts` | FOUND |
| `grep "getAdminRoleOptions" react-query.gen.ts` | FOUND |
| announcements.tsp `@operationId` count | 7 |
| platform-admin-custom.tsp `@operationId` count | 2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate symbol `CreditEntry` from plan 04-10**
- **Found during:** Task 1 (TypeSpec build failure)
- **Issue:** `person-custom.tsp` and `certification.tsp` both defined `model CreditEntry` at global scope, causing TypeSpec compiler to fail with `duplicate-symbol`
- **Fix:** Renamed `CreditEntry` → `MyCreditEntry` in person-custom.tsp; updated the two interface method return types
- **Files modified:** `specs/api/src/modules/person-custom.tsp`
- **Commit:** c02f1f6

**2. [Rule 1 - Bug] Duplicate operation routing for CreditCompliance and OfficerTerms**
- **Found during:** Task 1 (TypeSpec build)
- **Issue:** `getCreditCompliance` and `listOfficerTerms` both resolved to `get /{orgId}` because the `@route` decorators on the nested interfaces in `credits.tsp` were not being propagated when extended without a prefix in `main.tsp`
- **Fix:** Added `@route("/credit-compliance")` and `@route("/officer-terms")` to the interface extensions in `main.tsp`; removed redundant `@route` + `@tag` from the interface definitions in `credits.tsp`
- **Files modified:** `specs/api/src/main.tsp`, `specs/api/src/association/member/credits.tsp`
- **Commit:** c02f1f6

**3. [Rule 1 - Bug] Generated registry pointed announcement handlers to wrong directory**
- **Found during:** Task 2 (post-generation inspection)
- **Issue:** Code generator scaffolded new announcement stubs under `handlers/communication/` (singular) but the real implementations live in `handlers/communications/` (plural). The registry imported from the wrong path.
- **Fix:** Updated registry imports for 7 announcement operations to `communications/` (existing); deleted the duplicate stubs from `communication/`
- **Files modified:** `services/api-ts/src/generated/openapi/registry.ts`
- **Commit:** c7c67e0

**4. [Rule 2 - Missing implementation] markAllNotificationsRead stub needed real logic**
- **Found during:** Task 2
- **Issue:** Generated stub threw `Error('Not implemented')`. The `notifs-custom.tsp` endpoint needs actual business logic.
- **Fix:** Implemented the handler to delegate to `NotificationRepository.markAllAsRead(userId)`, returning `{ success: true }`
- **Files modified:** `services/api-ts/src/handlers/notifs/markAllNotificationsRead.ts`
- **Commit:** c7c67e0

**5. [Rule 2 - Missing implementation] getAdminRole stub needed real logic**
- **Found during:** Task 2
- **Issue:** Generated stub threw `Error('Not implemented')`. The inline handler in app.ts reads `ctx.get('platformAdmin')`.
- **Fix:** Implemented handler to read `platformAdmin` from context and return `{ role, email, name }`
- **Files modified:** `services/api-ts/src/handlers/platformadmin/getAdminRole.ts`
- **Commit:** c7c67e0

## Known Stubs

The following person/me endpoint handlers are stubs awaiting business logic implementation (generated from 04-10 TypeSpec additions):
- `services/api-ts/src/handlers/person/getMyMemberships.ts`
- `services/api-ts/src/handlers/person/getMyCreditSummary.ts`
- `services/api-ts/src/handlers/person/exportMyData.ts`
- `services/api-ts/src/handlers/person/cancelMyAccountDeletion.ts`
- `services/api-ts/src/handlers/person/requestMyAccountDeletion.ts`
- `services/api-ts/src/handlers/person/createMyCreditEntry.ts`
- `services/api-ts/src/handlers/person/listMyCreditEntries.ts`
- `services/api-ts/src/handlers/person/getMyOfficerRole.ts`
- `services/api-ts/src/handlers/person/getMyPrivacySettings.ts`
- `services/api-ts/src/handlers/person/updateMyPrivacySettings.ts`
- `services/api-ts/src/handlers/person/getMyNotificationPreferences.ts`
- `services/api-ts/src/handlers/person/updateMyNotificationPreferences.ts`
- `services/api-ts/src/handlers/person/updateMyProfile.ts`
- `services/api-ts/src/handlers/association:member/getCreditCompliance.ts`

These stubs are intentional — the OpenAPI spec and SDK hooks are now correct. Business logic implementation belongs to a future phase (app/feature work).

## Threat Flags

None — no new trust boundaries introduced beyond what the threat model documented. `getOrganizationBySlug` intentionally public (T-04-gc-06 accepted).

## Self-Check: PASSED

- `specs/api/src/association/operations/announcements.tsp` — FOUND
- `specs/api/src/modules/platform-admin-custom.tsp` — FOUND
- `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` — FOUND (contains listAnnouncementsOptions)
- Commits c02f1f6, c7c67e0 — VERIFIED via git log
