<!-- oli-version: 1.2 -->
<!-- generated: 2026-05-28T00:00:00Z -->

# Enforce File Report -- m01-auth-onboarding

**Module:** m01-auth-onboarding
**Audited:** 2026-05-28
**Source directory:** services/api-ts/src/handlers/person/
**Frontend routes:** apps/memberry/src/routes/ (auth-related)
**Spec version:** MODULE_SPEC v2.0 (2026-05-21)

## Summary

| Metric | Value |
|--------|-------|
| Total files checked | 44 |
| Handler files | 22 |
| Test files | 10 |
| Repo/schema files | 5 |
| Job files | 2 |
| Util files | 1 |
| Frontend route files | 4 |
| P0 findings | 1 |
| P1 findings | 9 |
| P2 findings | 12 |
| P3 findings | 4 |
| Review Required (LOW confidence) | 2 |
| Module traceability score | 42% |

**Score rationale:** 9 of 9 spec API endpoints unimplemented or delegated. Core CRUD (createPerson, getPerson, updatePerson, listPersons) exists but those are TypeSpec-driven Person CRUD, not the auth-specific endpoints the spec declares. Auth is fully delegated to Better-Auth with no custom handlers for OTP, lockout, magic link, or officer onboarding wizard. The 42% reflects partial frontend coverage and existing person CRUD.

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
| `getMyNotificationPreferences.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateMyNotificationPreferences.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyPrivacySettings.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `updateMyPrivacySettings.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyOfficerRole.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `getMyIdCard.ts` | controller | MODULE_SPEC |
| `getMyIdCardPdf.ts` | controller | MODULE_SPEC |
| `updateMyProfile.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `exportMyData.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `requestMyAccountDeletion.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `cancelMyAccountDeletion.ts` | controller | MODULE_SPEC, API_CONTRACTS |
| `executeAccountDeletion.ts` | controller | MODULE_SPEC |
| `accountDeletionCascade.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `repos/person.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/privacy-settings.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/notification-preferences.schema.ts` | entity | DOMAIN_MODEL, MODULE_SPEC |
| `repos/person.repo.ts` | repository | MODULE_SPEC, DOMAIN_MODEL |
| `repos/person.repo.test.ts` | test | MODULE_SPEC |
| `jobs/deletionProcessor.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `jobs/deletionProcessor.test.ts` | test | MODULE_SPEC |
| `jobs/index.ts` | service | MODULE_SPEC, WORKFLOW_MAP |
| `jobs/index.test.ts` | test | MODULE_SPEC |
| `utils/id-card-data.ts` | utility | MODULE_SPEC |
| `ac-m01.auth-onboarding.test.ts` | test | MODULE_SPEC |
| `ac-m02.member-profile.test.ts` | test | MODULE_SPEC |
| `createPerson.test.ts` | test | MODULE_SPEC |
| `getPerson.test.ts` | test | MODULE_SPEC |
| `getMyMemberships.test.ts` | test | MODULE_SPEC |
| `getMyNotificationPreferences.test.ts` | test | MODULE_SPEC |
| `getMyOfficerRole.test.ts` | test | MODULE_SPEC |
| `getMyPrivacySettings.test.ts` | test | MODULE_SPEC |
| `cancelMyAccountDeletion.test.ts` | test | MODULE_SPEC |
| `routes/auth/$authView.tsx` | frontend | MODULE_SPEC S9 |
| `routes/onboarding.tsx` | frontend | MODULE_SPEC S9, WF-006 |
| `routes/invite/$token.tsx` | frontend | MODULE_SPEC WF-002/WF-008 |
| `routes/verify-email.tsx` | frontend | MODULE_SPEC S9 |

## Findings

| ID | File | Line | Severity | Check | Confidence | Spec Source | Description |
|----|------|------|----------|-------|------------|-------------|-------------|
| EF-M01-a1b2c3d4 | N/A | -- | P0 | Security | HIGH | S5 M1-R4, S15 | **Missing account lockout.** Spec requires locking account after 5 consecutive failed logins for 15 minutes with audit logging. No handler implements this. No `failedLoginAttempts` counter in person schema. Better-Auth default config does not enforce lockout. Attacker can brute-force credentials. |
| EF-M01-b2c3d4e5 | N/A | -- | P1 | Spec Traceability | HIGH | S10 row 1, WF-001 | **Unimplemented: POST /register.** Spec declares self-registration with license validation, OTP, duplicate-license check (M1-R3, BR-23). No handler exists. Better-Auth `sign-up` used instead but lacks license number, specialization, PRC ID fields. |
| EF-M01-c3d4e5f6 | N/A | -- | P1 | Spec Traceability | HIGH | S10 row 2, M1-R1, BR-25 | **Unimplemented: POST /verify-otp.** Spec declares 6-digit OTP, 15-min expiry, max 5 attempts. No handler exists. Better-Auth uses email-link verification instead. |
| EF-M01-d4e5f6a7 | N/A | -- | P1 | Spec Traceability | MEDIUM | S10 row 4, M1-R5 | **Unimplemented: POST /magic-link.** Spec declares magic link send with 429 rate limiting and single-use 15-min expiry. No handler exists. Better-Auth may provide internally but no rate-limit enforcement found. |
| EF-M01-e5f6a7b8 | N/A | -- | P1 | Spec Traceability | HIGH | S10 rows 8-9, WF-005, S7 | **Unimplemented: GET /onboarding/state and PUT /onboarding/step.** Spec declares 5-step officer org setup wizard (profile, import, dues, gateway, invite). No handler files, no `OnboardingState` entity/schema. Frontend `/onboarding.tsx` is a 2-step member profile wizard, not the officer wizard. |
| EF-M01-f6a7b8c9 | N/A | -- | P1 | Spec Traceability | MEDIUM | S10 rows 6-7, WF-004 | **Unimplemented: POST /forgot-password and POST /reset-password.** Spec declares OTP-based password reset. Better-Auth provides email-link reset via UI component but without OTP flow and custom rate limiting. |
| EF-M01-a7b8c9d0 | N/A | -- | P1 | Spec Traceability | HIGH | S5 M1-R1, BR-25 | **Unimplemented: OTP subsystem.** No OTP generation, storage, validation, or expiry logic exists anywhere in person handlers. All 3 spec endpoints requiring OTP (register, verify-otp, reset-password) are unimplemented. |
| EF-M01-b8c9d0e1 | N/A | -- | P1 | Spec Traceability | HIGH | S7 Entity: OnboardingState | **Missing entity: OnboardingState.** Spec declares `orgId, personId, currentStep, stepsCompleted, stepData, createdAt, updatedAt`. No schema file exists. |
| EF-M01-c9d0e1f2 | N/A | -- | P1 | Spec Traceability | HIGH | S5 M1-R8 | **Incomplete audit logging for auth flows.** Spec requires immutable audit trail for login, registration, password reset, MFA enrollment. `auditAction` is used in deletion/privacy/profile handlers but NOT in any auth flow (no auth handlers exist). |
| EF-M01-d0e1f2a3 | N/A | -- | P1 | Spec Traceability | LOW | S7 Entity: InvitationToken | **Missing entity in person/repos: InvitationToken.** Spec declares `token, personId, organizationId, expiresAt, claimedAt`. Frontend `/invite/$token.tsx` uses `@/features/invite/lib/token-validation`. Schema may exist in invite handler module -- needs cross-module verification. |
| EF-M01-e1f2a3b4 | `getMyIdCard.ts` | 1 | P2 | Import Pattern | MEDIUM | Convention | **Uses raw `Context` from Hono** instead of `ValidatedContext` with generated validators. Path param `orgId` extracted manually via `ctx.req.param()` without validation. |
| EF-M01-f2a3b4c5 | `getMyIdCardPdf.ts` | 1 | P2 | Import Pattern | MEDIUM | Convention | **Same as above:** raw `Context`, no validator import, manual param extraction. |
| EF-M01-a3b4c5d6 | `getMyCredits.ts` | 1 | P2 | Import Pattern | MEDIUM | Convention | **Uses raw `Context` from Hono.** No generated validator import. Single-line compressed SQL reduces auditability. |
| EF-M01-b4c5d6e7 | `getMyMemberships.ts` | 1 | P2 | Import Pattern | LOW | Convention | **Uses `BaseContext`** instead of `ValidatedContext`. No generated validator type imported. |
| EF-M01-c5d6e7f8 | `exportMyData.ts` | 30 | P2 | Data Shape | HIGH | TypeSpec MyDataExport | **Response shape mismatch.** TypeSpec declares `{exportedAt, categories, profile, memberships, payments, credits, notifications}`. Handler returns `{exportedAt, personId, person, memberships, creditEntries}` -- missing `categories`, `payments`, `notifications` fields; `profile` renamed to `person`. |
| EF-M01-d6e7f8a9 | `getMyMemberships.ts` | 4-5 | P2 | Import Boundaries | HIGH | MODULE_MAP | Imports `memberships` from `association:member` and `organizations` from `platformadmin`. Cross-module read -- tolerated under shared-directory exemption. |
| EF-M01-e7f8a9b0 | `createMyCreditEntry.ts` | 5-6 | P2 | Import Boundaries | LOW | MODULE_MAP | Imports `CreditEntryRepository` from `association:member`. Credit tracking is M10 -- handler may belong to M10 scope. |
| EF-M01-f8a9b0c1 | `getMyCreditSummary.ts` | 4-7 | P2 | Import Boundaries | LOW | MODULE_MAP | Widest cross-module import surface: 3 imports from `association:member`, 1 from `platformadmin`. |
| EF-M01-a9b0c1d2 | `getMyOfficerRole.ts` | 5 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `OfficerTermRepository` from `association:member/repos/governance.repo`. Governance data belongs to M04/M12. |
| EF-M01-b0c1d2e3 | `updateMyPrivacySettings.ts` | 7 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `memberships` schema from `association:member` for org membership verification. |
| EF-M01-c1d2e3f4 | `getMyCredits.ts` | 5 | P2 | Import Boundaries | MEDIUM | MODULE_MAP | Imports `creditEntries` and `orgCpdConfig` schemas from `association:member`. |
| EF-M01-d2e3f4a5 | `routes/onboarding.tsx` | -- | P2 | Spec Traceability | HIGH | S9, WF-005 vs WF-006 | **Onboarding scope mismatch.** Frontend implements 2-step member profile wizard (personal info + address = WF-006 member onboarding). Spec WF-005 requires 5-step officer wizard (org profile, import, dues, gateway, invite). Different workflows -- officer wizard entirely missing. |
| EF-M01-e3f4a5b6 | `repos/person.schema.ts` | -- | P3 | Domain Terms | MEDIUM | MODULE_SPEC S7, DOMAIN_MODEL | Spec Person entity declares `passwordHash`, `mfaEnabled`, `emailVerifiedAt`. Schema omits these -- handled by Better-Auth `user` table. Correct architectural split but spec-to-code gap exists. |
| EF-M01-f4a5b6c7 | `routes/verify-email.tsx` | -- | P3 | Spec Traceability | MEDIUM | S9 OTP Verification | **Email-link vs OTP.** Spec S9 declares "/verify" screen with "6-digit code input, countdown timer, resend button." Implementation uses email-link verification ("click the link in your email"). |
| EF-M01-a5b6c7d8 | `routes/auth/$authView.tsx` | -- | P3 | Spec Traceability | LOW | S9 Registration | **Registration route.** Spec declares `/register` with license/specialization fields. Implementation uses Better-Auth `/auth/sign-up` which is generic email+password. Professional fields collected later in `/onboarding`. |
| EF-M01-b6c7d8e9 | `repos/person.schema.ts` | -- | P3 | Naming | HIGH | Convention | Drizzle table variable `persons` (plural) for DB table `person` (singular). Standard Drizzle convention -- no real violation. |

## Review Required (LOW Confidence)

| ID | File | Description |
|----|------|-------------|
| EF-M01-e7f8a9b0 | `createMyCreditEntry.ts` | Cross-module import direction unclear. Is this M01 or M10 handler? Credit handlers in person/ may belong to M10 scope. Needs architectural clarity. |
| EF-M01-f8a9b0c1 | `getMyCreditSummary.ts` | Imports from 3 handler directories (association:member, platformadmin, person repos). Most coupled file. Confirm intentional shared-directory aggregation. |

## Unimplemented Spec Items

| Spec Item | Section | Status | Notes |
|-----------|---------|--------|-------|
| `POST /register` | S10, WF-001 | **MISSING** | Self-registration with license validation, OTP |
| `POST /verify-otp` | S10, WF-001 | **MISSING** | 6-digit OTP verification |
| `POST /magic-link` | S10, WF-006 | **MISSING** | Magic link send with rate limit |
| `POST /accept-invite` | S10, WF-002 | **PARTIAL** | Frontend `/invite/$token.tsx` exists; no dedicated handler in person/ |
| `POST /forgot-password` | S10, WF-004 | **DELEGATED** | Better-Auth provides via UI component |
| `POST /reset-password` | S10, WF-004 | **DELEGATED** | Better-Auth provides via UI component |
| `GET /onboarding/state` | S10, WF-005 | **MISSING** | Officer wizard state -- no handler, no schema |
| `PUT /onboarding/step` | S10, WF-005 | **MISSING** | Officer wizard step save -- no handler, no schema |
| `OnboardingState` entity | S7 | **MISSING** | No schema exists |
| `InvitationToken` entity | S7 | **MISSING from person/** | May exist in invite handler module |
| Account lockout (M1-R4) | S5 | **MISSING** | No failed-login counter, no 15-min lockout |
| OTP rules (M1-R1, BR-25) | S5 | **MISSING** | No OTP generation/validation logic |
| Password strength (M1-R3) | S5 | **DELEGATED** | Better-Auth may enforce; no custom validation found |
| Claim token expiry (M1-R2) | S5 | **PARTIAL** | Frontend shows expiry error; no backend enforcement in person/ |
| Auth audit logging (M1-R8) | S5 | **PARTIAL** | auditAction used in CRUD; not in auth flows (none exist) |
| Screen: Registration (/register) | S9 | **REPLACED** | Better-Auth `/auth/sign-up` -- no professional fields |
| Screen: OTP Verification (/verify) | S9 | **REPLACED** | Email-link instead of 6-digit code |
| Screen: Onboarding Wizard (officer) | S9, WF-005 | **MISSING** | Only member profile wizard exists |

## Orphan Files (in code, not in M01 spec)

Files in person/ that implement functionality outside M01 Auth & Onboarding scope:

| File | Implements | Likely Module |
|------|-----------|---------------|
| `getMyCredits.ts` | CPD credit dashboard data | M10 Credits |
| `getMyCreditSummary.ts` | Aggregated credit totals | M10 Credits |
| `createMyCreditEntry.ts` | Manual CPD credit entry | M10 Credits |
| `getMyMemberships.ts` | List user memberships | M05 Membership |
| `getMyOfficerRole.ts` | Officer role lookup | M04/M12 Governance |
| `getMyIdCard.ts` | Digital ID card JSON | M02 Member Profile |
| `getMyIdCardPdf.ts` | Digital ID card PDF | M02 Member Profile |
| `getMyNotificationPreferences.ts` | Notification prefs | M02 Member Profile |
| `updateMyNotificationPreferences.ts` | Update notification prefs | M02 Member Profile |
| `getMyPrivacySettings.ts` | Privacy visibility | M02 Member Profile |
| `updateMyPrivacySettings.ts` | Privacy visibility update | M02 Member Profile |
| `listPersons.ts` | Admin person list | Platform Admin |
| `accountDeletionCascade.ts` | Cross-module deletion cascade | M02 / DPA |
| `executeAccountDeletion.ts` | PII anonymization | M02 / DPA |
| `requestMyAccountDeletion.ts` | Deletion request | M02 / DPA |
| `cancelMyAccountDeletion.ts` | Cancel deletion | M02 / DPA |
| `exportMyData.ts` | DPA data export | M02 / DPA |
| `updateMyProfile.ts` | Self-profile update | M02 Member Profile |

**Note:** These are not defects. The person/ directory is a shared handler directory hosting M01 + M02 + M10 + M05 handlers. Each should be traced to its own module spec.

## Detailed Check Results

### Check 1: Error Taxonomy

**PASS (20/22 controllers):** All implemented controllers use typed errors from `@/core/errors` (`UnauthorizedError`, `ValidationError`, `ConflictError`, `ForbiddenError`, `NotFoundError`, `BusinessLogicError`). Zero instances of `throw new Error()`.

**Known issues from prior audit (v1.1):** `updateNotificationPreferences.ts` and `updatePrivacySettings.ts` duplicate handlers were flagged with P1 for using `ctx.json({ error: 'Unauthorized' }, 401)` instead of typed errors. These files were not found in current file listing -- may have been removed. The `updateMy*` variants with proper error handling remain.

### Check 2: Domain Term Usage

**PASS:** No forbidden synonyms. All files use spec-aligned terms: "Person" (not "User" for entity), "Member" (association context), "Officer" (not "Admin" for org roles), "Organization" (not "Company"/"Team"). The `User` type from `@/types/auth` is Better-Auth auth user, distinct from Person domain entity.

### Check 3: Data Shape Conformance

**PASS (18/22 controllers):** Handler signatures match generated validators. `createPerson` uses `ValidatedContext<CreatePersonBody>`, `updatePerson` uses `ValidatedContext<UpdatePersonBody>`, `listPersons` uses `ValidatedContext<never, ListPersonsQuery>`.

**FAIL (4 files):** `getMyIdCard.ts`, `getMyIdCardPdf.ts`, `getMyCredits.ts` use raw `Context`; `getMyMemberships.ts` uses `BaseContext`. These bypass generated validator type safety.

### Check 4: Naming Conventions

**PASS:** All handler files follow camelCase. CRUD naming consistent: `create*`, `get*`, `update*`, `list*`, `execute*`. The `getMy*` prefix pattern correctly distinguishes self-service from admin endpoints.

### Check 5: Import Boundaries

**PARTIAL PASS:** 7 handler files import from `association:member` (M04/M05). Tolerated because:
1. person/ directory is explicitly shared between M01 and M02 per MODULE_MAP
2. "getMy*" handlers aggregate authenticated user's own data cross-module
3. All cross-module access is read-only via repository or schema imports

## Risk Assessment

**Architectural gap:** The M01 spec describes a comprehensive custom auth system (OTP, lockout, magic link, officer wizard). Implementation delegates authentication entirely to Better-Auth. This is a valid architectural decision but creates a 42% traceability score.

**Recommendation priority:**
1. **P0 -- Account lockout (M1-R4):** Implement via Better-Auth plugin or custom middleware. Brute-force risk.
2. **P1 -- Update MODULE_SPEC:** Document Better-Auth delegation pattern. Mark which spec items are covered by Better-Auth vs. require custom handlers. Resolve spec-vs-reality gap.
3. **P1 -- Officer onboarding wizard (WF-005):** No backend or frontend implementation exists. Decide: build it or defer to backlog with spec annotation.
4. **P2 -- exportMyData response shape:** Align with TypeSpec `MyDataExport` model or update the TypeSpec model.

## Spec Artifacts Used

| Artifact | Path | Status |
|---------|------|--------|
| MODULE_SPEC | `docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md` | Found, v2.0 |
| TypeSpec (person) | `specs/api/src/modules/person-custom.tsp` | Found |
| TypeSpec (person base) | `specs/api/src/modules/person.tsp` (inferred) | Found |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | Found, v1.0 |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | Found, v1.0 |
