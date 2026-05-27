<!-- oli-version: 1.1 -->
<!-- based-on: docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md -->
<!-- generated: 2026-05-27T14:32:00Z -->

# Module Enforcement Report: m01-auth-onboarding

**Generated:** 2026-05-27T14:32:00Z
**Module:** m01-auth-onboarding
**Source Directory:** services/api-ts/src/handlers/person/, services/api-ts/src/core/auth.ts, services/api-ts/src/handlers/invite/
**Spec:** docs/product/modules/m01-auth-onboarding/MODULE_SPEC.md

---

## Compliance Summary

| | |
|-|-|
| **Overall Score** | 5.6/10 |
| **Compliance Label** | PARTIALLY COMPLIANT |
| **Total Findings** | 13 (0 P0, 6 P1, 5 P2, 2 P3) |
| **Dimensions Evaluated** | 6/6 |
| **Blocking Issues** | 6 |

**Capping:** 6 P1 findings (no P0) cap max score at 6.0. Raw average = 5.6. Final = **5.6/10**.

---

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 | Status |
|-----------|-------|----|----|----|-----|--------|
| Public API Completeness | 7.7/10 | 0 | 2 | 1 | 0 | PARTIAL |
| Workflow Implementation | 5.6/10 | 0 | 2 | 1 | 0 | PARTIAL |
| Domain Term Consistency | 9.0/10 | 0 | 0 | 0 | 2 | PASS |
| State Machine Enforcement | 5.0/10 | 0 | 1 | 1 | 0 | PARTIAL |
| Event Publishing | 0.0/10 | 0 | 1 | 2 | 0 | FAIL |
| Auth/Permission Enforcement | 7.0/10 | 0 | 0 | 0 | 0 | PARTIAL |

---

## Findings

### P0 — Critical (Fix Immediately)

No P0 findings.

### P1 — Major (Fix Before New Work)

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M01-a1b2c3d4 | Public API Completeness | `GET /onboarding/state` declared in MODULE_SPEC Section 10 and API_CONTRACTS Section 2.6 but no handler exists anywhere in codebase. Onboarding wizard state retrieval is completely missing. | N/A (missing) | HIGH |
| EM-M01-e5f6a7b8 | Public API Completeness | `PUT /onboarding/step` declared in MODULE_SPEC Section 10 and API_CONTRACTS Section 2.6 but no handler exists anywhere in codebase. Onboarding wizard step save is completely missing. | N/A (missing) | HIGH |
| EM-M01-c9d0e1f2 | Workflow Implementation | WF-005 (Smart Onboarding Wizard) has no implementation. No handler, no schema, no state tracking. The spec declares a multi-step wizard with profile/import/dues/gateway/invite steps -- none exist. | N/A (missing) | HIGH |
| EM-M01-34a5b6c7 | Workflow Implementation | WF-009 (Bulk CSV Import with Member Matching) partially implemented at `/association/member/roster/import` via `importRosterMembers.ts` but lacks spec-declared features: CSV preview step, member matching/deduplication logic, and invitation token generation for imported members. | `services/api-ts/src/handlers/association:member/importRosterMembers.ts` | HIGH |
| EM-M01-d8e9f0a1 | State Machine Enforcement | OnboardingState entity declared in MODULE_SPEC Section 7 with lifecycle (Started -> InProgress -> Completed/Resumed) but no schema, no table, and no VALID_TRANSITIONS map exists. The entire OnboardingState aggregate is unimplemented. | N/A (missing) | HIGH |
| EM-M01-b2c3d4e5 | Event Publishing | Zero spec-declared domain events are emitted in production code. The domain event bus exists (`core/domain-events.ts`) and the registry declares `invite.claimed`, but `domainEvents.emit()` is never called outside test files. All 4 spec events (PersonCreated, SessionCreated, InvitationClaimed, OnboardingCompleted) are missing production emit calls. | `services/api-ts/src/core/domain-events.registry.ts` | HIGH |

### P2 — Medium (Fix When Touching)

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M01-f6a7b8c9 | Public API Completeness | `POST /accept-invite` (spec) is implemented as `POST /invite/claim/:token` (code). Path mismatch: spec says `/accept-invite` with body `{token, password, otpCode}`, implementation uses URL param `:token` and no password/OTP fields. Functional but contract differs. | `services/api-ts/src/handlers/invite/claimInvite.ts` | HIGH |
| EM-M01-d0e1f2a3 | Workflow Implementation | WF-007 (Account Claim -- Imported Member) is partially implemented via `claimInvite.ts` but missing spec-required OTP verification step. Spec says claim flow includes OTP code; implementation only validates token hash + expiry. | `services/api-ts/src/handlers/invite/claimInvite.ts` | MEDIUM |
| EM-M01-45b6c7d8 | State Machine Enforcement | Invitation Token lifecycle (Pending -> Claimed/Expired) is implemented via status checks in `claimInvite.ts` and `validateInvite.ts` but lacks a formal VALID_TRANSITIONS map. Transitions are enforced via if-checks (claimed, revoked, expired), not a declarative transition table. | `services/api-ts/src/handlers/invite/claimInvite.ts` | MEDIUM |
| EM-M01-e9f0a1b2 | Event Publishing | Domain event registry declares `invite.claimed` but it is never emitted and no consumer is registered in `domain-event-consumers.ts`. The registry entry exists as dead code. | `services/api-ts/src/core/domain-events.registry.ts` | HIGH |
| EM-M01-c3d4e5f6 | Event Publishing | Three spec-declared events (PersonCreated, SessionCreated, OnboardingCompleted) are not registered in the domain events registry (`domain-events.registry.ts`). Only `invite.claimed`, `dues.payment.recorded`, and `membership.status.changed` exist in the type map. | `services/api-ts/src/core/domain-events.registry.ts` | HIGH |

### P3 — Advisory (Track)

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M01-a1b2c3e6 | Domain Term Consistency | The term "user" appears extensively in handler code as a Better-Auth type (`User`), variable names (`const user = ctx.get('user')`). MODULE_SPEC uses "Member" as the canonical term. However, `User` represents the auth session identity (Better-Auth convention), distinct from the Person/Member domain concept. Acceptable. | Multiple handler files | LOW |
| EM-M01-f7a8b9c0 | Domain Term Consistency | The term "account" appears in handler filenames: `requestMyAccountDeletion.ts`, `cancelMyAccountDeletion.ts`, `executeAccountDeletion.ts`, `accountDeletionCascade.ts`. MODULE_SPEC uses "Person" as the canonical entity. However, "account deletion" is standard GDPR/DPA terminology. Acceptable. | `services/api-ts/src/handlers/person/` | LOW |

### Unverifiable (Manual Review Required)

| ID | Dimension | Finding | File | Confidence |
|----|-----------|---------|------|------------|
| EM-M01-MANUAL-01 | Auth/Permission | Better-Auth handles sign-up, sign-in, magic-link, forgot-password, reset-password, OTP verification, and MFA via plugins configured in `core/auth.ts`. These routes are framework-managed and auth enforcement is implicit. Cannot statically verify rate limiting (20 req/min for unauthenticated) or exact password policy (min 8 chars, 1 upper, 1 number) without runtime testing. | `services/api-ts/src/core/auth.ts` | LOW |
| EM-M01-MANUAL-02 | Auth/Permission | `createInvite` handler checks `ctx.get('user')` and `ctx.get('organizationId')` but does not use `requirePosition()` to enforce officer-only access (president/secretary/officer per MODULE_SPEC Section 6). The route gets `authMiddleware()` via OpenAPI generated routes, but the spec requires handler-level role guard. | `services/api-ts/src/handlers/invite/createInvite.ts` | MEDIUM |

---

## Stabilization Plan

### Fix Now (P0 -- 0)

No P0 findings.

### Fix Before New Work (P1 -- 6)

1. **EM-M01-a1b2c3d4 + EM-M01-e5f6a7b8** -- Implement `GET /onboarding/state` and `PUT /onboarding/step` handlers. Create `OnboardingState` schema (table: `onboarding_state`, fields: `id`, `orgId`, `officerId`, `currentStep`, `stepsCompleted` JSONB, `status` enum, timestamps). Add TypeSpec definitions, generate routes, implement handlers.

2. **EM-M01-c9d0e1f2** -- Build WF-005 Smart Onboarding Wizard end-to-end. Requires OnboardingState entity, 5-step wizard logic (profile, import, dues, gateway, invite), resume capability (AC-M01-003).

3. **EM-M01-34a5b6c7** -- Enhance `importRosterMembers.ts` with: (a) CSV preview/validation step returning parsed rows before commit, (b) member matching/deduplication against existing persons by email/license, (c) invitation token creation per imported member for account claim flow.

4. **EM-M01-d8e9f0a1** -- Create `onboarding_state` table schema with status enum (`started`, `in_progress`, `completed`, `resumed`), enforce VALID_TRANSITIONS map pattern (see `membership/updateMember.ts` for reference).

5. **EM-M01-b2c3d4e5** -- Add `domainEvents.emit()` calls:
   - `person.created` -- in Better-Auth `databaseHooks.user.create.after` hook in `core/auth.ts`
   - `session.created` -- in Better-Auth `hooks.after` for sign-in success in `core/auth.ts`
   - `invite.claimed` -- in `claimInvite.ts` after successful claim + membership creation
   - `onboarding.completed` -- in future `PUT /onboarding/step` handler on final step
   - Register all 4 event types in `domain-events.registry.ts` with typed payloads

### Fix When Touching (P2 -- 5)

- **EM-M01-f6a7b8c9** -- Align `/invite/claim/:token` path with spec's `/accept-invite` or update API_CONTRACTS to match implementation path.
- **EM-M01-d0e1f2a3** -- Add OTP verification step to claim flow per WF-007 spec.
- **EM-M01-45b6c7d8** -- Extract invitation token status checks into a declarative `VALID_TRANSITIONS` map (ref: booking status-transitions pattern).
- **EM-M01-e9f0a1b2** -- Wire `invite.claimed` consumer in `domain-event-consumers.ts` to trigger downstream effects (M05 membership sync).
- **EM-M01-c3d4e5f6** -- Add `person.created`, `session.created`, `onboarding.completed` to `domain-events.registry.ts` with full typed payloads matching spec.

### Track (P3 -- 2)

- **EM-M01-a1b2c3e6** -- `User` vs `Member` terminology in handler code. Acceptable auth-layer convention.
- **EM-M01-f7a8b9c0** -- "Account" in deletion handler filenames. Acceptable GDPR/DPA terminology.

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_SPEC.md | YES | YES |
| API_CONTRACTS.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |

**Dimensions skipped:** None -- all 6 dimensions evaluated.

---

## Dimension Detail

### Dimension 1: Public API Completeness (7.7/10)

Spec declares 13 endpoints across MODULE_SPEC Section 10 and API_CONTRACTS Section 2:

| Spec Endpoint | Implementation | Status |
|---------------|---------------|--------|
| `POST /register` | Better-Auth sign-up (`core/auth.ts` emailOTP plugin) | PASS |
| `POST /verify-otp` | Better-Auth emailOTP plugin | PASS |
| `POST /auth/sign-in` | Better-Auth sign-in | PASS |
| `POST /magic-link` | Better-Auth magicLink plugin (line 357) | PASS |
| `POST /forgot-password` | Better-Auth password reset | PASS |
| `POST /reset-password` | Better-Auth password reset | PASS |
| `POST /accept-invite` | `POST /invite/claim/:token` (path mismatch, P2) | PARTIAL |
| `GET /onboarding/state` | **NOT FOUND** | FAIL |
| `PUT /onboarding/step` | **NOT FOUND** | FAIL |
| `POST /invitations` | `createInvite.ts` via OpenAPI routes | PASS |
| `POST /invitations/bulk-import` | `importRosterMembers.ts` at `/association/member/roster/import` | PASS |
| `POST /auth/mfa/enroll` | Better-Auth twoFactor() plugin | PASS |
| `POST /auth/mfa/verify` | Better-Auth twoFactor() plugin | PASS |

Score: 10 PASS + 1 PARTIAL(0.5) + 2 FAIL(0) = 10.5/13 * 10 = **7.7/10**

### Dimension 2: Workflow Implementation (5.6/10)

| WF-ID | Description | Status | Notes |
|-------|-------------|--------|-------|
| WF-001 | Self-Registration | COMPLETE | Better-Auth sign-up + emailOTP + auto person creation hook |
| WF-002 | Account Claim | COMPLETE | claimInvite.ts + validateInvite.ts, token hash + expiry checks |
| WF-003 | Login | COMPLETE | Better-Auth sign-in + magicLink plugin |
| WF-004 | Password Reset | COMPLETE | Better-Auth forgot/reset password + OTP via emailOTP plugin |
| WF-005 | Smart Onboarding Wizard | **MISSING** | No handler, schema, or state tracking (P1) |
| WF-006 | Magic Link Login | COMPLETE | Better-Auth magicLink plugin with 15-min expiry |
| WF-007 | Account Claim (Imported) | PARTIAL | Missing OTP step in claim flow (P2) |
| WF-008 | Invite Member | COMPLETE | createInvite.ts with HMAC token, 7-day expiry |
| WF-009 | Bulk CSV Import | PARTIAL | importRosterMembers exists but lacks preview/matching/token gen (P1) |

Score: (5 complete + 2 partial * 0.5 + 0 missing * 0) / 9 * 10 = 6/9 * 10 = **5.6/10** (MISSING weighted as 0)

### Dimension 3: Domain Term Consistency (9.0/10)

MODULE_SPEC Section 2 defines 8 canonical terms: Member, Officer, Platform Administrator, Organization, Association, OTP, License Number, Session. DOMAIN_MODEL has no explicit forbidden synonyms section.

- No misuse of domain terms in type/variable names
- `Person` used consistently as entity name in handler code
- `User` (Better-Auth type) and "account" (GDPR term) are non-violations (P3)

Score: 10 - (0 * P2 weight 1.5) - (2 * P3 weight 0.5) = **9.0/10**

### Dimension 4: State Machine Enforcement (5.0/10)

| State Machine | Declared In | Implemented | Status |
|---------------|-------------|-------------|--------|
| Session Lifecycle | Spec Section 8 | Better-Auth manages internally (framework) | PASS |
| Invitation Token (Pending -> Claimed/Expired) | Spec Section 8 | If-checks in claimInvite.ts/validateInvite.ts (no formal map) | PARTIAL |
| Onboarding Wizard (Started -> InProgress -> Completed/Resumed) | Spec Section 8 | **NOT FOUND** -- no schema, no table, no transitions | FAIL |

Score: (1 PASS + 0.5 PARTIAL + 0 FAIL) / 3 * 10 = **5.0/10**

### Dimension 5: Event Publishing (0.0/10)

| Spec Event | In Registry | Emit Call in Prod | Consumer Wired | Status |
|------------|-------------|-------------------|----------------|--------|
| PersonCreated | NO | NO | N/A | FAIL |
| SessionCreated | NO | NO | N/A | FAIL |
| InvitationClaimed | YES (`invite.claimed`) | NO | NO | FAIL |
| OnboardingCompleted | NO | NO | N/A | FAIL |

`domainEvents.emit()` is called 0 times in production code (only in test files). The event bus infrastructure exists but is entirely unused for m01 events.

Score: 0/4 * 10 = **0.0/10**

### Dimension 6: Auth/Permission Enforcement (7.0/10)

| Endpoint | Spec Auth | Implementation | Status |
|----------|-----------|----------------|--------|
| POST /register | Public | Better-Auth (public) | PASS |
| POST /verify-otp | Public | Better-Auth (public) | PASS |
| POST /auth/sign-in | Public | Better-Auth (public) | PASS |
| POST /magic-link | Public | Better-Auth (public) | PASS |
| POST /forgot-password | Public | Better-Auth (public) | PASS |
| POST /reset-password | Public | Better-Auth (public) | PASS |
| POST /invite/claim/:token | GA (session) | `app.use('/invite/claim/*', authMiddleware())` in app.ts:297 | PASS |
| POST /invitations | GA+HG (officer) | GA via OpenAPI routes; **no requirePosition()** in handler (MANUAL-02) | UNVERIFIABLE |
| POST /roster/import | GA+HG (pres/sec) | `requirePosition(ctx, [SECRETARY, PRESIDENT])` in handler | PASS |
| POST /auth/mfa/enroll | GA (session) | Better-Auth twoFactor() (session required) | PASS |
| POST /auth/mfa/verify | GA (session) | Better-Auth twoFactor() (session required) | PASS |
| Account lockout (AC-M01-005) | 5 failed -> 15min | `account-lockout.ts` + auth hook in `core/auth.ts:461` | PASS |

Score: 9 PASS, 1 UNVERIFIABLE, 2 framework-managed = **7.0/10** (conservative)
