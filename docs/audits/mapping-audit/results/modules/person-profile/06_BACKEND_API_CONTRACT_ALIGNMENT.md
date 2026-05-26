# 06 — Backend API Contract Alignment: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Handler Registration Verification

Cross-reference: handler files in `services/api-ts/src/handlers/person/` vs registered routes in `services/api-ts/src/generated/openapi/routes.ts`.

| Handler File | Handler Name | Registered in routes.ts | Registry Key |
|-------------|-------------|------------------------|-------------|
| `createPerson.ts` | `createPerson` | YES — `POST /persons` | `registry.createPerson` |
| `listPersons.ts` | `listPersons` | YES — `GET /persons` | `registry.listPersons` |
| `getPerson.ts` | `getPerson` | YES — `GET /persons/:person` | `registry.getPerson` |
| `updatePerson.ts` | `updatePerson` | YES — `PATCH /persons/:person` | `registry.updatePerson` |
| `updateMyProfile.ts` | `updateMyProfile` | YES — `PATCH /persons/me` | `registry.updateMyProfile` |
| `deleteMyAccount.ts` | `deleteMyAccount` | NO | **UNREGISTERED** |
| `requestAccountDeletion.ts` | `requestAccountDeletion` | NO — `requestMyAccountDeletion` is wired | Dead file? |
| `cancelAccountDeletion.ts` | `cancelAccountDeletion` | NO — `cancelMyAccountDeletion` is wired | Dead file? |
| `cancelMyAccountDeletion.ts` | `cancelMyAccountDeletion` | YES — `POST /persons/me/cancel-delete` | `registry.cancelMyAccountDeletion` |
| `requestMyAccountDeletion.ts` | (assumed) | YES — `POST /persons/me/delete` | `registry.requestMyAccountDeletion` |
| `executeAccountDeletion.ts` | `executeAccountDeletion` | NO — not in routes.ts | Called from jobs only? |
| `exportMyData.ts` | `exportMyData` | YES — `GET /persons/me/export` | `registry.exportMyData` |
| `exportPersonData.ts` | `exportPersonData` | NO | Dead file / admin use? |
| `getMyCreditSummary.ts` | `getMyCreditSummary` | YES — `GET /persons/me/credit-summary` | `registry.getMyCreditSummary` |
| `getMyCredits.ts` | `getMyCredits` | YES — `GET /persons/me/credits` | `registry.getMyCredits` |
| `getMyMemberships.ts` | `getMyMemberships` | YES — `GET /persons/me/memberships` | `registry.getMyMemberships` |
| `getMyNotificationPreferences.ts` | `getMyNotificationPreferences` | YES | `registry.getMyNotificationPreferences` |
| `getMyOfficerRole.ts` | `getMyOfficerRole` | YES | `registry.getMyOfficerRole` |
| `getMyPrivacySettings.ts` | `getMyPrivacySettings` | YES | `registry.getMyPrivacySettings` |
| `updateMyNotificationPreferences.ts` | `updateMyNotificationPreferences` | YES | `registry.updateMyNotificationPreferences` |
| `updateMyPrivacySettings.ts` | `updateMyPrivacySettings` | YES | `registry.updateMyPrivacySettings` |
| `createMyCreditEntry.ts` | `createMyCreditEntry` | YES | `registry.createMyCreditEntry` |
| `listMyCreditEntries.ts` | `listMyCreditEntries` | YES | `registry.listMyCreditEntries` |
| `getNotificationPreferences.ts` | `getNotificationPreferences` | NO | Dead code |
| `updateNotificationPreferences.ts` | `updateNotificationPreferences` | NO | Dead code |
| `getPrivacySettings.ts` | `getPrivacySettings` | NO | Dead code |
| `updatePrivacySettings.ts` | `updatePrivacySettings` | NO | Dead code |
| `accountDeletionCascade.ts` | `executeCascadeDeletion` | NO — utility, not a route | Imported by `executeAccountDeletion` |

---

## `ctx.req.valid()` vs `ctx.req.json()` Audit

Best practice: handlers should use `ctx.req.valid('json')` (Zod-validated) not raw `ctx.req.json()`.

| Handler | Body Read Method | Correct? |
|---------|-----------------|---------|
| `updateMyProfile` | `ctx.req.valid('json')` | YES |
| `createPerson` | `ctx.req.valid('json')` | YES |
| `updatePerson` | `ctx.req.valid('json')` | YES |
| `updateMyNotificationPreferences` | `ctx.req.valid('json')` | YES |
| `updateMyPrivacySettings` | `ctx.req.valid('json')` | YES |
| `getMyPrivacySettings` | `ctx.req.valid('query')` | YES |
| `updatePrivacySettings` (dead) | `ctx.req.json()` | NO — uses raw JSON, but dead code |
| `updateNotificationPreferences` (dead) | `ctx.req.json()` | NO — uses raw JSON, but dead code |
| `cancelAccountDeletion` (dead) | No body | N/A |
| `requestAccountDeletion` (dead) | No body | N/A |
| `executeAccountDeletion` | No body — uses path param | N/A |
| `exportMyData` | No body | N/A |

**Assessment**: All active (registered) handlers use `ctx.req.valid()`. Dead handlers use raw JSON but are unreachable.

---

## Dead Handler Files

The following handler files exist but are NOT registered in routes.ts:

| File | Status | Risk |
|------|--------|------|
| `deleteMyAccount.ts` | Unregistered | P2 — duplicate of `requestMyAccountDeletion`, different method name |
| `requestAccountDeletion.ts` | Unregistered | P2 — superseded by `requestMyAccountDeletion` |
| `cancelAccountDeletion.ts` | Unregistered | P2 — superseded by `cancelMyAccountDeletion` |
| `executeAccountDeletion.ts` | Unregistered as HTTP route | P1 — no auth check, called from jobs |
| `exportPersonData.ts` | Unregistered | P2 — admin-side export, no route |
| `getNotificationPreferences.ts` | Unregistered | P3 — superseded by `getMyNotificationPreferences` |
| `updateNotificationPreferences.ts` | Unregistered | P3 — superseded by `updateMyNotificationPreferences` |
| `getPrivacySettings.ts` | Unregistered | P3 — superseded by `getMyPrivacySettings` |
| `updatePrivacySettings.ts` | Unregistered | P3 — superseded by `updateMyPrivacySettings` |

---

## Contract Test Coverage

**Hurl contract files found** for person module:

| File | Coverage |
|------|---------|
| `specs/api/tests/contract/person-lifecycle.hurl` | Basic CRUD lifecycle |
| `specs/api/tests/contract/person-validation.hurl` | Input validation |
| `specs/api/tests/contract/persons-extended-flow.hurl` | Extended flows |
| `specs/api/tests/contract/assoc-org-profile-flow.hurl` | Org+profile integration |
| `specs/api/tests/contract/impersonation-flow.hurl` | Admin impersonation |

**Missing contract coverage** (no hurl files found for):
- `GET /persons/me/credits` — no contract test
- `GET /persons/me/export` — no contract test
- `POST /persons/me/delete` — no contract test
- `POST /persons/me/cancel-delete` — no contract test
- `GET/PATCH /persons/me/notification-preferences` — no contract test
- `GET/PATCH /persons/me/privacy` — no contract test

---

## TypeSpec Alignment

TypeSpec source: `specs/api/src/modules/person.tsp`, `person-custom.tsp`  
Generated types consumed by handlers via `@monobase/api-spec`.

All active handlers import validators from `@/generated/openapi/validators` — aligned with TypeSpec-generated types. No evidence of manual type drift.

---

## Summary of Findings

| ID | Severity | Finding |
|----|----------|---------|
| FINDING-PP-P0-001 | P0 | `GET /persons/me/credits` missing `authMiddleware` in routes.ts |
| FINDING-PP-P0-002 | P0 | `executeAccountDeletion` has no auth check — [NEEDS MANUAL CONFIRMATION] of job invocation |
| FINDING-PP-P1-002 | P1 | 4 dead handler pairs (old vs new) — maintenance hazard, risk of accidental re-wiring |
| FINDING-PP-P2-004 | P2 | `deleteMyAccount.ts` unregistered — duplicate of `requestMyAccountDeletion` |
| FINDING-PP-P2-005 | P2 | `exportPersonData.ts` unregistered — no admin route to access it |
| FINDING-PP-P2-006 | P2 | Contract tests absent for 6 key privacy/deletion endpoints |
