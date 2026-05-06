---
phase: 04-typespec-openapi-reconciliation
verified: 2026-05-06T12:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "SPEC-07: record-payment-form.tsx manual api.get migrated to listRosterMembersOptions. All 6 custom module feature directories now have zero manual api calls."
    - "CR-04 (partial): Original 48 handler stubs in association:member/ and association:operations/ had broken import removed (commit 63aeee6)."
    - "SPEC-08 (partial): Announcements (5 paths), credit-compliance, admin/me/role, public/org now documented in OpenAPI. TypeSpec files created and pipeline rebuilt."
  gaps_remaining:
    - "SPEC-08: /persons/me/* paths documented at wrong routes in OpenAPI — /memberships, /credit-summary, etc. instead of /persons/me/memberships, /persons/me/credit-summary. Missing @route prefix in main.tsp PersonCustomManagement interface extension."
    - "CR-04 (new): 14 newly generated handler stubs in services/api-ts/src/handlers/person/ and association:member/ (from plan 04-11 code generation) contain the same broken import { db } from '@/core/database'. Plan 04-08 fixed original 48; plan 04-11 introduced 14 new ones."
  regressions:
    - "Plan 04-11 code generation re-introduced the broken db import in 14 new handler stubs. Gap was closed for original stubs then immediately re-opened."
gaps:
  - truth: "OpenAPI spec documents every endpoint in the system (base + custom)"
    status: partial
    reason: "Person-custom TypeSpec routes generate at wrong URL paths. PersonCustomManagement in main.tsp extends PersonCustomModule.PersonCustomManagement without adding @route('/persons/me') prefix. Result: OpenAPI documents /memberships, /credit-summary, /credit-entries, /export, /privacy, /notification-preferences, /officer-role/{orgId}, /delete, /cancel-delete — NOT /persons/me/memberships etc. The live app.ts hand-wired routes are at /persons/me/* and the SDK hooks use /persons/me/* paths. OpenAPI mismatches actual API surface."
    artifacts:
      - path: "specs/api/src/main.tsp"
        issue: "Line ~144: 'interface PersonCustomManagement extends PersonCustomModule.PersonCustomManagement {}' — missing @route('/persons/me') decorator. Compare with PersonManagement which has @route('/persons')."
      - path: "specs/api/dist/openapi/openapi.json"
        issue: "9 /persons/me/* routes documented at wrong paths: /memberships, /credit-summary, /credit-entries, /export, /privacy, /notification-preferences, /officer-role/{orgId}, /delete, /cancel-delete — none have /persons/me prefix."
    missing:
      - "Add @route('/persons/me') decorator to PersonCustomManagement interface extension in main.tsp"
      - "Rebuild: cd specs/api && bun run build"
      - "Regenerate routes + SDK: cd services/api-ts && bun run generate && cd packages/sdk-ts && bun run generate"
      - "Verify openapi.json contains /persons/me/memberships, /persons/me/credit-summary etc."

  - truth: "Generated routes preserve equivalent role-based auth for every decommissioned hand-wired route"
    status: partial
    reason: "Plan 04-11 code generation created 14 new handler stubs that reintroduce the broken 'import { db } from @/core/database' on line 2. @/core/database does not export db. These are the person/ and association:member/getCreditCompliance stubs generated after the TypeSpec rebuild. Plan 04-08 fixed the original 48 stubs but the pipeline rebuild in 04-11 generated 14 new ones with the same bad import."
    artifacts:
      - path: "services/api-ts/src/handlers/person/getMyMemberships.ts"
        issue: "Line 2: import { db } from '@/core/database' — db not exported. Representative of all 14 new stubs."
      - path: "services/api-ts/src/handlers/person/*.ts"
        issue: "13 files: getMyMemberships, getMyCreditSummary, exportMyData, cancelMyAccountDeletion, requestMyAccountDeletion, createMyCreditEntry, listMyCreditEntries, getMyOfficerRole, getMyPrivacySettings, updateMyPrivacySettings, getMyNotificationPreferences, updateMyNotificationPreferences, updateMyProfile"
      - path: "services/api-ts/src/handlers/association:member/getCreditCompliance.ts"
        issue: "1 file: getCreditCompliance also has the broken import"
    missing:
      - "Remove 'import { db } from @/core/database' from all 14 new handler stubs"
      - "Run cd services/api-ts && bunx tsc --noEmit to verify API service typecheck passes"
---

# Phase 04: TypeSpec/OpenAPI Reconciliation — Re-Verification Report

**Phase Goal:** All 6 custom modules have TypeSpec definitions and auto-generated SDK hooks
**Verified:** 2026-05-06T12:00:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 04-08 through 04-11)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TypeSpec definitions exist for dues, membership, events, training, elections, and certificates | VERIFIED | All 6 .tsp files exist and are substantive. Status unchanged from initial verification. |
| 2 | `cd specs/api && bun run build` produces OpenAPI including all custom module endpoints | VERIFIED | openapi.json has 223 paths (up from 203). Announcements (5 paths), credit-compliance (1), admin/me/role (1), public/org (1) now present. |
| 3 | SDK auto-generates React Query hooks for all custom modules (no manual fetch calls) | VERIFIED | record-payment-form.tsx migrated (plan 04-09). All 6 custom module feature dirs (dues, membership, events, training, elections, certificates) have zero manual api.get/post/patch/put/delete calls. Remaining manual calls in admin/, communications/, dashboard/, invite/, notifications/ are out of scope for the 6 custom modules. |
| 4 | OpenAPI spec documents every endpoint in the system (base + custom) | FAILED | 9 /persons/me/* endpoints documented at wrong paths. PersonCustomManagement in main.tsp is missing @route('/persons/me'), causing TypeSpec to emit /memberships, /credit-summary etc. at root — not /persons/me/memberships. Live app.ts routes are at /persons/me/*. Path mismatch means clients following the spec would target wrong URLs. |

**Score:** 3/4 truths verified

### Gaps Closed vs Remaining

| Gap | Was | Now | Evidence |
|-----|-----|-----|---------|
| SPEC-07: record-payment-form manual api.get | OPEN | CLOSED | commit 805e0e5; 0 manual calls in 6 module dirs |
| SPEC-08: Announcements not in OpenAPI | OPEN | CLOSED | /communications/announcements/* (5 paths) in openapi.json |
| SPEC-08: credit-compliance not in OpenAPI | OPEN | CLOSED | /credit-compliance/{orgId} in openapi.json |
| SPEC-08: admin/me/role not in OpenAPI | OPEN | CLOSED | /admin/me/role in openapi.json |
| SPEC-08: public/org not in OpenAPI | OPEN | CLOSED | /public/org/{slug} in openapi.json |
| SPEC-08: /persons/me/* not in OpenAPI | OPEN | STILL OPEN | 9 paths documented at wrong URLs (missing /persons/me prefix) |
| CR-04: 48 broken db imports (original) | OPEN | CLOSED | commit 63aeee6; 0 matches in original 48 files |
| CR-04: 14 broken db imports (regression) | — | NEW GAP | Plan 04-11 code generation re-introduced in 14 new stubs |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `specs/api/src/association/operations/announcements.tsp` | TypeSpec for announcements | VERIFIED | Created in plan 04-11; 7 operationIds |
| `specs/api/src/modules/platform-admin-custom.tsp` | TypeSpec for admin/me/role + public/org | VERIFIED | Created in plan 04-11; 2 operationIds |
| `specs/api/src/modules/person-custom.tsp` | TypeSpec for /persons/me/* | STUB | Exists with correct @route('/persons/me') on inner interface but main.tsp extension missing @route — generates wrong paths |
| `specs/api/dist/openapi/openapi.json` | All endpoints documented | PARTIAL | 223 paths; /persons/me/* absent (wrong paths generated) |
| `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` | Hooks for all custom modules | VERIFIED | All 6 module hooks present; new hooks for announcements, admin, person-custom |
| `services/api-ts/src/handlers/person/*.ts` (13 files) | Clean stubs | STUB | All 13 have `import { db } from '@/core/database'` — broken import |
| `services/api-ts/src/handlers/association:member/getCreditCompliance.ts` | Clean stub | STUB | Same broken import |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `specs/api/src/modules/person-custom.tsp` | `specs/api/dist/openapi/openapi.json` | bun run build | FAILED | @route('/persons/me') not propagated; paths generated at root level |
| `specs/api/src/association/operations/announcements.tsp` | `specs/api/dist/openapi/openapi.json` | bun run build | VERIFIED | 5 announcement paths in openapi.json |
| `specs/api/src/modules/platform-admin-custom.tsp` | `specs/api/dist/openapi/openapi.json` | bun run build | VERIFIED | /admin/me/role and /public/org/{slug} in openapi.json |
| `services/api-ts/src/handlers/person/*.ts` | `@/core/database` | import { db } | FAILED | db not exported; 14 stubs with broken import |
| All 6 custom module feature dirs | SDK hooks | zero manual fetch | VERIFIED | grep returns 0 matches in dues, membership, events, training, elections, certificates features |

### Data-Flow Trace (Level 4)

Not applicable — Phase 04 focuses on TypeSpec/SDK generation. Handler stubs intentionally throw "Not implemented" and are scheduled for Phase 05.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| OpenAPI has announcements paths | python3 grep 'communications/announcements' | 5 paths | PASS |
| OpenAPI has credit-compliance | python3 grep 'credit-compliance' | 1 path | PASS |
| OpenAPI has admin/me/role | python3 grep 'admin/me/role' | 1 path | PASS |
| OpenAPI has public/org | python3 grep 'public/org' | 1 path | PASS |
| OpenAPI has /persons/me/memberships | python3 grep 'persons/me' | 0 paths | FAIL |
| OpenAPI has stray /memberships at root | python3 exact path check | /memberships found | FAIL (wrong path) |
| Zero manual api.get in 6 module dirs | grep in dues/membership/events/training/elections/certificates | 0 matches | PASS |
| record-payment-form.tsx clean | grep api.get | 0 matches | PASS |
| Broken db import in original 48 stubs | grep -rl import | 0 files | PASS |
| Broken db import in new 14 stubs | grep -rl import | 14 files | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPEC-01 | 04-02-PLAN | TypeSpec for dues | SATISFIED | dues.tsp, 1061 lines |
| SPEC-02 | 04-02-PLAN | TypeSpec for membership | SATISFIED | membership.tsp, 1164 lines |
| SPEC-03 | 04-03-PLAN | TypeSpec for events | SATISFIED | events.tsp, 805 lines |
| SPEC-04 | 04-03-PLAN | TypeSpec for training | SATISFIED | training.tsp, 1003 lines |
| SPEC-05 | 04-01-PLAN | TypeSpec for elections | SATISFIED | governance.tsp, enum reconciled |
| SPEC-06 | 04-01-PLAN | TypeSpec for certificates | SATISFIED | certificates.tsp, CertificateManagement |
| SPEC-07 | 04-05–07-PLAN | SDK hooks, no manual fetch in 6 modules | SATISFIED | 0 manual calls in all 6 custom module feature dirs |
| SPEC-08 | 04-11-PLAN | OpenAPI documents all endpoints | BLOCKED | /persons/me/* routes at wrong paths; 9 live endpoints undocumented at correct paths |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `services/api-ts/src/handlers/person/*.ts` (13 files) | 2 | `import { db } from '@/core/database'` — db not exported | BLOCKER | API service typecheck fails when any stub is implemented. Regression from plan 04-11 pipeline rebuild. |
| `services/api-ts/src/handlers/association:member/getCreditCompliance.ts` | 2 | Same broken import | BLOCKER | Same impact. |
| `specs/api/src/main.tsp` | ~144 | Missing `@route('/persons/me')` on PersonCustomManagement | BLOCKER | 9 endpoints documented at wrong URL paths; SDK and OpenAPI clients would target /memberships not /persons/me/memberships |
| `services/api-ts/src/app.ts` | 341–349 | app.route('/communications', communications) AND generateOpenAPIRoutes both register /communications/* — duplicate routes | WARNING | Hono matches hand-wired first; generated announcement routes are shadowed; may cause auth middleware gaps |

### Human Verification Required

None — all checks were programmable.

### Gaps Summary

**2 gaps remaining (1 original, 1 regression):**

**Gap 1 (BLOCKER — SPEC-08):** The `/persons/me/*` routing bug. `person-custom.tsp` correctly defines routes under `@route("/persons/me")` on the interface, but `main.tsp` extends it as `interface PersonCustomManagement extends PersonCustomModule.PersonCustomManagement {}` without an `@route("/persons/me")` decorator. TypeSpec generates 9 endpoints at root paths (`/memberships`, `/credit-summary`, etc.) instead of the correct `/persons/me/memberships`, `/persons/me/credit-summary` etc. Fix is one line: add `@route("/persons/me")` to the interface extension in main.tsp, rebuild OpenAPI, regenerate SDK.

**Gap 2 (BLOCKER — CR-04 regression):** Plan 04-11 code generation (`bun run generate`) created 14 new handler stubs for person-custom and getCreditCompliance endpoints. These new stubs contain `import { db } from '@/core/database'` on line 2 — the same broken import fixed in plan 04-08 for the original 48 stubs. The code generator template itself produces this bad import. The 14 affected files are: `services/api-ts/src/handlers/person/{getMyMemberships, getMyCreditSummary, exportMyData, cancelMyAccountDeletion, requestMyAccountDeletion, createMyCreditEntry, listMyCreditEntries, getMyOfficerRole, getMyPrivacySettings, updateMyPrivacySettings, getMyNotificationPreferences, updateMyNotificationPreferences, updateMyProfile}.ts` and `services/api-ts/src/handlers/association:member/getCreditCompliance.ts`.

**Root cause of both gaps:** The plan 04-11 pipeline rebuild was not sufficiently validated — the routing mismatch for /persons/me/* wasn't caught because the SUMMARY checks used `grep "persons/me/memberships" openapi.json` which would return 0 but was interpreted as success. The new broken db imports weren't caught because plan 04-08's grep validation was not re-run after the pipeline rebuild.

---

_Verified: 2026-05-06T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
