---
phase: 04-typespec-openapi-reconciliation
verified: 2026-05-06T10:30:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "OpenAPI spec documents every endpoint in the system (base + custom)"
    status: failed
    reason: "Multiple hand-wired routes in app.ts have no TypeSpec definition or OpenAPI documentation. /communications/announcements (7 routes), /persons/me/memberships, /persons/me/credit-summary, /persons/me/export, /persons/me/delete, /persons/me/cancel-delete, /persons/me/credit-entries, /persons/me/officer-role/:orgId, /persons/me/privacy, /persons/me/notification-preferences, /public/org/:slug, /credit-compliance/:orgId, /admin/me/role are all live endpoints not present in openapi.json."
    artifacts:
      - path: "services/api-ts/src/app.ts"
        issue: "13+ hand-wired app.get/app.post/app.route calls serve endpoints not in OpenAPI. Only /communications/* and /admin/* (admin routes via generated TypeSpec) are partially covered. persons/me/* paths have zero coverage."
      - path: "specs/api/dist/openapi/openapi.json"
        issue: "203 paths documented. Announcements (/communications/announcements/*), all /persons/me/* custom paths, /credit-compliance/:orgId, /admin/me/role, /public/org/:slug are absent."
    missing:
      - "TypeSpec definitions for /communications/announcements CRUD (7 endpoints) in specs/api/src/"
      - "TypeSpec definitions for custom /persons/me/* paths (memberships, credit-summary, export, delete, cancel-delete, credit-entries, officer-role, privacy, notification-preferences)"
      - "TypeSpec definition for /credit-compliance/:orgId endpoint"
      - "TypeSpec definition for /admin/me/role endpoint"
      - "TypeSpec definition for /public/org/:slug endpoint"
      - "Rebuild OpenAPI + SDK after adding TypeSpec definitions"

  - truth: "SDK auto-generates React Query hooks for all custom modules (no manual fetch calls)"
    status: partial
    reason: "One dues feature component retains a manual api.get call for a membership endpoint. record-payment-form.tsx line 65 uses api.get for /api/membership/members/:orgId for debounced member search. The SDK has listRosterMembersOptions which could replace this. The decision to keep it was documented but violates the must-have truth."
    artifacts:
      - path: "apps/memberry/src/features/dues/components/record-payment-form.tsx"
        issue: "Line 65: api.get<{ data: any[] }>('/api/membership/members/${orgId}?search=...') — manual fetch for in-scope membership module. listRosterMembersOptions exists in SDK and could replace this."
    missing:
      - "Migrate record-payment-form.tsx member search from api.get to listRosterMembersOptions with search query param"

  - truth: "Generated routes preserve equivalent role-based auth for every decommissioned hand-wired route"
    status: failed
    reason: "CR-04 from code review: All 48 generated handler stubs in services/api-ts/src/handlers/association:member/ and association:operations/ contain 'import { db } from @/core/database' on line 2. @/core/database does NOT export `db` (exports createDatabase, getDatabaseFromContext, DatabaseInstance type, etc.). This is a broken import that will produce TypeScript compilation errors the moment any stub is implemented and references db. The API service tsc was NOT checked — only apps/memberry tsc was verified per 04-07-PLAN.md task instructions. The established pattern is `const db = ctx.get('database') as DatabaseInstance` inside the handler function."
    artifacts:
      - path: "services/api-ts/src/handlers/association:member/listElections.ts"
        issue: "Line 2: import { db } from '@/core/database' — db not exported from this module. Representative of all 48 stubs."
      - path: "services/api-ts/src/handlers/association:member/*.ts"
        issue: "All 37 files in this directory have the broken import"
      - path: "services/api-ts/src/handlers/association:operations/*.ts"
        issue: "All 11 files in this directory have the broken import"
    missing:
      - "Remove `import { db } from '@/core/database'` from all 48 handler stubs"
      - "Run cd services/api-ts && bunx tsc --noEmit to verify API service typecheck passes"
---

# Phase 04: TypeSpec/OpenAPI Reconciliation Verification Report

**Phase Goal:** All 6 custom modules have TypeSpec definitions and auto-generated SDK hooks
**Verified:** 2026-05-06T10:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | TypeSpec definitions exist for dues, membership, events, training, elections, and certificates | VERIFIED | All 6 .tsp files exist with substantive content: dues.tsp (1061 lines), membership.tsp (1164 lines), certificates.tsp (78 lines), governance.tsp with elections (1159 lines), events.tsp (805 lines), training.tsp (1003 lines). ElectionStatus enum reconciled to DB values (nominationsOpen, awaitingConfirmation, published). |
| 2 | `cd specs/api && bun run build` produces OpenAPI including all custom module endpoints | VERIFIED | openapi.json exists (2MB, last built May 6 16:27). 203 total paths. Elections: 5 paths, certificates: 2, dues: 15, membership: 7+, events: 22 (as /association/event-lifecycle/*), training: 18 (as /association/training-lifecycle/*). All 6 modules produce OpenAPI paths. |
| 3 | SDK auto-generates React Query hooks for all custom modules (no manual fetch calls) | PARTIAL | SDK hooks verified: listElectionsOptions, listMyCertificatesOptions, listDuesPaymentsOptions, listRosterMembersOptions, listMyCustomEventsOptions, listMyCustomTrainingsOptions all exist in react-query.gen.ts. One manual api.get call remains in record-payment-form.tsx (dues component, line 65) for membership member search. Plan 05 SUMMARY documents this as explicit decision "no SDK hook covers debounced search without useQuery" but listRosterMembersOptions exists and could be used. |
| 4 | OpenAPI spec documents every endpoint in the system (base + custom) | FAILED | 13+ hand-wired routes in app.ts serve live endpoints with zero OpenAPI coverage. /communications/announcements (7 routes), /persons/me/* (9 custom routes), /credit-compliance/:orgId, /admin/me/role, /public/org/:slug are not in openapi.json. Communications was explicitly scoped out in 04-04-SUMMARY ("Keep communications route hand-wired — announcements module not in Phase 4 TypeSpec scope") but this directly violates SC-4. |

**Score:** 2/4 truths verified (SC-1 and SC-2 pass; SC-3 partial; SC-4 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `specs/api/src/association/member/certificates.tsp` | TypeSpec for certificates | VERIFIED | Exists, 78 lines, contains CertificateManagement interface, listMyCertificates + getCertificate operations |
| `specs/api/src/association/member/dues.tsp` | TypeSpec for dues | VERIFIED | Exists, 1061 lines, contains DuesPaymentManagement, DuesGatewayManagement, DuesReportingService |
| `specs/api/src/association/member/membership.tsp` | TypeSpec for membership | VERIFIED | Exists, 1164 lines, contains MemberRosterManagement, MemberCategoryManagement |
| `specs/api/src/association/member/governance.tsp` | Reconciled ElectionStatus enum | VERIFIED | ElectionStatus matches DB: draft, nominationsOpen, votingOpen, awaitingConfirmation, published, cancelled |
| `specs/api/src/association/operations/events.tsp` | TypeSpec for events | VERIFIED | Exists, 805 lines, contains EventLifecycleService (29 matches) |
| `specs/api/src/association/operations/training.tsp` | TypeSpec for training | VERIFIED | Exists, 1003 lines, contains TrainingLifecycleService (35 matches) |
| `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` | Generated SDK hooks for all modules | VERIFIED | Contains listMyCertificatesOptions, listElectionsOptions, listDuesPaymentsOptions, listRosterMembersOptions, listMyCustomEventsOptions, listMyCustomTrainingsOptions and hundreds of other hooks |
| `services/api-ts/src/app.ts` | Hand-wired routes removed for 6 modules | VERIFIED | Only /communications route remains hand-wired. 6 module route blocks (dues, membership, elections, certificates, events, training) decommissioned. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `specs/api/src/association/member/certificates.tsp` | `specs/api/src/main.tsp` | import + interface extends | VERIFIED | main.tsp imports certificates.tsp and registers AssocCertificateManagement |
| `specs/api/src/association/member/governance.tsp` | `specs/api/src/main.tsp` | interface extends for elections | VERIFIED | AssocElectionManagement, AssocCandidateManagement, AssocBallotManagement all registered |
| `specs/api/dist/openapi/openapi.json` | `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` | bun run generate | VERIFIED | SDK hooks generated from OpenAPI; all module hooks present |
| `services/api-ts/src/handlers/association:member/*.ts` | `@/core/database` | import { db } | FAILED | 48 stubs import `db` which is not exported from @/core/database. Will fail API service typecheck when implemented. |

### Data-Flow Trace (Level 4)

Not applicable — Phase 04 focuses on TypeSpec/SDK generation, not handler implementation. Handler stubs intentionally throw "Not implemented" and are scheduled for Phase 05.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| OpenAPI includes elections paths | `grep -c "association/member/elections" openapi.json` | 5 | PASS |
| OpenAPI includes certificates paths | `grep -c "association/member/certificates" openapi.json` | 2 | PASS |
| OpenAPI includes dues paths | `grep -c "association/member/dues" openapi.json` | 15 | PASS |
| SDK has listMyCertificatesOptions | grep in react-query.gen.ts | 17 matches | PASS |
| ElectionStatus enum has nominationsOpen | grep in governance.tsp | 3 matches (nominationsOpen, awaitingConfirmation, published) | PASS |
| 6 hand-wired routes decommissioned from app.ts | grep "app.route(" app.ts | Only /communications remains | PASS |
| Communications endpoints in OpenAPI | python3 check | 0 paths | FAIL |
| record-payment-form has no manual api.get | grep api.get | Line 65 has manual fetch | FAIL |
| 48 handler stubs have broken db import | grep import | 48 files affected | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPEC-01 | 04-02-PLAN | TypeSpec definitions exist for dues module | SATISFIED | dues.tsp exists, 1061 lines, DuesPaymentManagement + DuesGatewayManagement + DuesReportingService interfaces |
| SPEC-02 | 04-02-PLAN | TypeSpec definitions exist for membership module | SATISFIED | membership.tsp exists, 1164 lines, MemberRosterManagement + MemberCategoryManagement + OrganizationProfileManagement |
| SPEC-03 | 04-03-PLAN | TypeSpec definitions exist for events module | SATISFIED | events.tsp exists, 805 lines, EventLifecycleService with full CRUD + lifecycle operations |
| SPEC-04 | 04-03-PLAN | TypeSpec definitions exist for training module | SATISFIED | training.tsp exists, 1003 lines, TrainingLifecycleService with enroll/complete/checkin operations |
| SPEC-05 | 04-01-PLAN | TypeSpec definitions exist for elections module | SATISFIED | governance.tsp has ElectionManagement, CandidateManagement, BallotManagement; enum reconciled to DB values |
| SPEC-06 | 04-01-PLAN | TypeSpec definitions exist for certificates module | SATISFIED | certificates.tsp exists, CertificateManagement interface with listMyCertificates + getCertificate |
| SPEC-07 | 04-04, 04-05, 04-06, 04-07 PLAN | SDK auto-generates React Query hooks for all custom modules | PARTIAL | Hooks generated and exist. 25+ feature component files migrated to SDK hooks. One manual api.get remains in record-payment-form.tsx for membership search. |
| SPEC-08 | 04-04-PLAN | OpenAPI spec documents all endpoints (base + custom) | BLOCKED | 13+ hand-wired routes are NOT in OpenAPI. Communications announcements (7 routes), persons/me/* custom paths, credit-compliance, admin/me/role all undocumented. This requirement explicitly maps to Phase 4 in REQUIREMENTS.md traceability table. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `services/api-ts/src/handlers/association:member/*.ts` (37 files) | 2 | `import { db } from '@/core/database'` — db not exported | BLOCKER | API service typecheck will fail when any stub is implemented. `db` must be obtained via `ctx.get('database')` per all existing handler patterns. |
| `services/api-ts/src/handlers/association:operations/*.ts` (11 files) | 2 | Same broken import | BLOCKER | Same impact. |
| `apps/memberry/src/features/dues/components/record-payment-form.tsx` | 65 | `api.get(...)` for /membership/members — in-scope module, manual fetch not migrated | WARNING | Violates SC-3 "no manual fetch calls" and plan 05 must-have truth. listRosterMembersOptions exists in SDK. |
| `apps/memberry/src/features/elections/components/election-form.tsx` | 37, 331 | Client-generated random IDs sent as position references | BLOCKER (CR-01) | Data integrity bug: elections created with non-existent position IDs will break at nomination/voting time. Found in code review but not fixed. |
| `specs/api/src/association/member/certificates.tsp` | 65-76 | getCertificate has no ownership enforcement | BLOCKER (CR-02) | Any authenticated member can read any other member's certificate by UUID. Security gap. |
| `services/api-ts/src/app.ts` | 246 | Unvalidated date input `new Date(body.activityDate)` + no org membership check | BLOCKER (CR-03) | Runtime crash on invalid date + cross-org credit assignment vulnerability. |

**Note:** CR-01, CR-02, CR-03 were found by the code review (commit 67eabd9) but not fixed before this verification. They are pre-existing in the committed code.

### Human Verification Required

None — all checks were programmable.

### Gaps Summary

**3 gaps blocking full goal achievement:**

**Gap 1 (BLOCKER — SC-4/SPEC-08):** OpenAPI spec does not document all endpoints. 13+ live routes in app.ts have no TypeSpec definition. The communications/announcements module (7 routes) was explicitly scoped out of Phase 4 despite SPEC-08 requiring all endpoints. Additionally, 9 custom `/persons/me/*` paths, `/credit-compliance/:orgId`, `/admin/me/role`, and `/public/org/:slug` are hand-wired without any OpenAPI spec. The REQUIREMENTS.md traceability table assigns SPEC-08 to Phase 4 as Pending.

**Gap 2 (WARNING — SC-3/SPEC-07):** One manual api.get call remains in `record-payment-form.tsx` (dues feature component, line 65) for membership member search. The SDK hook `listRosterMembersOptions` exists and could replace this. The plan's must-have truth explicitly states "No dues or membership feature component uses manual api.get/api.post" — this truth is violated. The SUMMARY documented it as an explicit deviation but the codebase evidence shows it remains.

**Gap 3 (BLOCKER — API service typecheck):** All 48 generated handler stubs in `services/api-ts/src/handlers/association:member/` and `association:operations/` contain `import { db } from '@/core/database'` on line 2. `@/core/database` does not export `db` (exports `createDatabase`, `getDatabaseFromContext`, `DatabaseInstance`). The frontend typecheck (`cd apps/memberry && bunx tsc`) was verified but the API service typecheck (`cd services/api-ts && bunx tsc`) was never run per the plan's task instructions. This broken import will fail API service compilation. The established pattern is `const db = ctx.get('database') as DatabaseInstance` inside handler bodies.

**SC-4 note:** The code review (04-REVIEW.md) already identified 4 critical bugs (CR-01 through CR-04) that were not fixed before the phase was declared complete. CR-04 maps directly to Gap 3. The code review commit (67eabd9) is the HEAD commit — no remediation was applied.

---

_Verified: 2026-05-06T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
