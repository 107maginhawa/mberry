<!-- oli-version: 1.1 -->
<!-- generated: 2026-05-27T00:00:00Z -->

# Enforce File Report — m01-auth-onboarding

**Module:** m01-auth-onboarding
**Audited:** 2026-05-27
**Source directory:** services/api-ts/src/handlers/person/

## Summary
| Metric | Value |
|--------|-------|
| Total files | 43 |
| Files classified | 43 |
| P0 findings | 0 |
| P1 findings | 4 |
| P2 findings | 8 |
| P3 findings | 3 |
| Review Required (LOW confidence) | 2 |
| Module traceability score | 78% |

## File Classification
| File | Type | Specs Loaded |
|------|------|-------------|
| `createPerson.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getPerson.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updatePerson.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `listPersons.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyMemberships.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyCredits.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyCreditSummary.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `createMyCreditEntry.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `listMyCreditEntries.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyNotificationPreferences.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateMyNotificationPreferences.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateNotificationPreferences.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyPrivacySettings.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateMyPrivacySettings.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updatePrivacySettings.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyOfficerRole.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateMyProfile.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `exportMyData.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `requestMyAccountDeletion.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `cancelMyAccountDeletion.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `executeAccountDeletion.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `accountDeletionCascade.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `repos/person.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/privacy-settings.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/notification-preferences.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/person.repo.ts` | repository | MODULE_SPEC, DOMAIN_MODEL |
| `jobs/deletionProcessor.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `jobs/index.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `ac-m01.auth-onboarding.test.ts` | test | MODULE_SPEC |
| `ac-m02.member-profile.test.ts` | test | MODULE_SPEC |
| `createPerson.test.ts` | test | MODULE_SPEC |
| `getPerson.test.ts` | test | MODULE_SPEC |
| `updatePerson.test.ts` | test | MODULE_SPEC |
| `getMyMemberships.test.ts` | test | MODULE_SPEC |
| `getMyCredits.test.ts` | test | MODULE_SPEC |
| `getMyCreditSummary.test.ts` | test | MODULE_SPEC |
| `createMyCreditEntry.test.ts` | test | MODULE_SPEC |
| `requestMyAccountDeletion.test.ts` | test | MODULE_SPEC |
| `cancelMyAccountDeletion.test.ts` | test | MODULE_SPEC |
| `accountDeletionCascade.test.ts` | test | MODULE_SPEC |
| `executeAccountDeletion.test.ts` | test | MODULE_SPEC |
| `exportMyData.test.ts` | test | MODULE_SPEC |
| `repos/person.repo.test.ts` | test | MODULE_SPEC |
| `jobs/deletionProcessor.test.ts` | test | MODULE_SPEC |
| `jobs/index.test.ts` | test | MODULE_SPEC |

## Findings

| ID | File | Line | Severity | Check | Confidence | Spec Source | Description |
|----|------|------|----------|-------|------------|-------------|-------------|
| EF-M01-a1b2c3d4 | `updateNotificationPreferences.ts` | 20 | P1 | Error Taxonomy | HIGH | ERROR_TAXONOMY | Controller uses `ctx.json({ error: 'Unauthorized' }, 401)` instead of `throw new UnauthorizedError()`. Bypasses global error middleware, producing non-standard error envelope (bare `{ error }` vs. ERROR_TAXONOMY shape with `code`, `message`, `details`). |
| EF-M01-b2c3d4e5 | `updatePrivacySettings.ts` | 19 | P1 | Error Taxonomy | HIGH | ERROR_TAXONOMY | Same pattern: `ctx.json({ error: 'Unauthorized' }, 401)` instead of typed error. Non-standard error shape for clients. |
| EF-M01-k1l2m3n4 | `updateNotificationPreferences.ts` | -- | P1 | Data Shape | HIGH | MODULE_SPEC | Duplicate handler: both `updateNotificationPreferences.ts` and `updateMyNotificationPreferences.ts` serve PATCH `/persons/me/notification-preferences`. Code divergence risk — one shadows the other at route registration. The `updateMy*` variant uses typed errors; this one uses raw `ctx.json`. |
| EF-M01-l2m3n4o5 | `updatePrivacySettings.ts` | -- | P1 | Data Shape | HIGH | MODULE_SPEC | Duplicate handler: both `updatePrivacySettings.ts` and `updateMyPrivacySettings.ts` serve PATCH `/persons/me/privacy`. Same divergence risk as notification preferences pair. |
| EF-M01-c3d4e5f6 | `getMyMemberships.ts` | 4-5 | P2 | Import Boundaries | HIGH | MODULE_MAP | Imports `memberships` from `association:member` and `organizations` from `platformadmin`. M01 allowlist is M02, M03, M13, M15, M17. association:member maps to M04/M05. Tolerated under shared-directory exemption (person/ shared M01/M02). |
| EF-M01-d4e5f6g7 | `createMyCreditEntry.ts` | 5-6 | P2 | Import Boundaries | LOW | MODULE_MAP | Imports `CreditEntryRepository` from `association:member` and `getCycleForDate` utility. Credit tracking is M10 — reverse dependency direction. |
| EF-M01-e5f6g7h8 | `exportMyData.ts` | 5-6 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `MembershipRepository` and `CreditEntryRepository` from `association:member`. Cross-module data aggregation for GDPR export. |
| EF-M01-f6g7h8i9 | `getMyCreditSummary.ts` | 4-7 | P2 | Import Boundaries | LOW | MODULE_MAP | Imports from `association:member` (3 imports) and `platformadmin` (1 import). Widest cross-module import surface in the module. |
| EF-M01-g7h8i9j0 | `getMyCredits.ts` | 5 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `creditEntries` and `orgCpdConfig` schemas from `association:member`. |
| EF-M01-h8i9j0k1 | `listMyCreditEntries.ts` | 4 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `CreditEntryRepository` from `association:member`. |
| EF-M01-i9j0k1l2 | `updateMyPrivacySettings.ts` | 7 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `memberships` schema from `association:member` for org membership verification. |
| EF-M01-j0k1l2m3 | `getMyOfficerRole.ts` | 5 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `OfficerTermRepository` from `association:member/repos/governance.repo`. Governance data belongs to M04/M12. |
| EF-M01-m3n4o5p6 | `repos/person.schema.ts` | -- | P3 | Domain Terms | HIGH | DOMAIN_MODEL | Variable `persons` (plural) for Drizzle table reference while DB table is `person` (singular). Standard Drizzle convention — no real violation. |
| EF-M01-n4o5p6q7 | `accountDeletionCascade.ts` | -- | P3 | Naming | MEDIUM | MODULE_SPEC | File uses camelCase — consistent with module convention. No violation. |
| EF-M01-o5p6q7r8 | `repos/person.schema.ts` | -- | P3 | Domain Terms | MEDIUM | MODULE_SPEC, DOMAIN_MODEL | MODULE_SPEC entity declares `passwordHash`, `mfaEnabled`, `emailVerifiedAt` on Person. Schema omits these — handled by Better-Auth's `user` table. Correct architectural split, but spec-to-code gap exists. |

## Review Required (LOW Confidence)

| ID | File | Description |
|----|------|-------------|
| EF-M01-d4e5f6g7 | `createMyCreditEntry.ts` | Cross-module import direction unclear. Is this M01 or M10 handler? Credit handlers in person/ may belong to M10 scope, not M01. Needs architectural clarity. |
| EF-M01-f6g7h8i9 | `getMyCreditSummary.ts` | Imports from 3 handler directories (association:member, platformadmin, person repos). Most coupled file. Confirm this is intentional shared-directory aggregation. |

## Detailed Check Results

### Check 1: Error Taxonomy

**PASS (20/22 controllers):** All implemented controllers use typed errors from `@/core/errors` (`UnauthorizedError`, `ValidationError`, `ConflictError`, `ForbiddenError`, `NotFoundError`, `BusinessLogicError`). Zero instances of `throw new Error()` found across the entire module.

**FAIL (2 controllers):** `updateNotificationPreferences.ts` and `updatePrivacySettings.ts` use `ctx.json({ error: 'Unauthorized' }, 401)` for auth checks instead of `throw new UnauthorizedError()`. This bypasses the global error middleware and produces a non-standard error envelope.

### Check 2: Domain Term Usage

**PASS:** No forbidden synonyms detected. All files use spec-aligned terms: "Person" (not "User" for the entity), "Member" (for association context), "Officer" (not "Admin" for org roles), "Organization" (not "Company"/"Team"), "Association" (not "Tenant"). The `User` type import from `@/types/auth` is the Better-Auth auth user, distinct from the Person domain entity — correct usage.

### Check 3: Data Shape Conformance

**PASS (20/22 controllers):** Handler signatures match generated validators where applicable. `createPerson` uses `ValidatedContext<CreatePersonBody>`, `updatePerson` uses `ValidatedContext<never, never, UpdatePersonBody>`, `listPersons` uses `ValidatedContext<never, ListPersonsQuery>`.

**FAIL (2 files):** Duplicate handler pairs (`updateNotificationPreferences`/`updateMyNotificationPreferences` and `updatePrivacySettings`/`updateMyPrivacySettings`) create ambiguity about which is authoritative.

### Check 4: Naming Conventions

**PASS:** All handler files follow camelCase naming. CRUD naming consistent: `create*`, `get*`, `update*`, `list*`, `execute*`. The `getMy*` prefix pattern correctly distinguishes self-service from admin endpoints.

### Check 5: Import Boundaries

**PARTIAL PASS:** 8 handler files import from `association:member` (M04/M05). MODULE_MAP shows M01 allows M02, M03, M13, M15, M17 — not M04/M05. Tolerated because:
1. person/ directory is explicitly shared between M01 and M02 per MODULE_MAP
2. "getMy*" handlers aggregate the authenticated user's own data across modules
3. All cross-module access is read-only via repository or schema imports

## Spec Artifacts Used
| Artifact | Path | Status |
|---------|------|--------|
| MODULE_SPEC | `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` | Found, v2.0 |
| API_CONTRACTS | `docs/product/modules/m01-auth-onboarding/API_CONTRACTS.md` | Found |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | Found, v1.0 |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | Found, v1.0 |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | Found |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | Found |
| ERROR_TAXONOMY | `docs/product/ERROR_TAXONOMY.md` | Found |
