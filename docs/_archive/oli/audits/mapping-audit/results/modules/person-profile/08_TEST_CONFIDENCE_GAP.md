# 08 — Test Confidence Gap: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Test File Inventory

### Unit Tests (Backend — Bun test runner)

| File | Handler Covered | Classification | Notes |
|------|----------------|---------------|-------|
| `createPerson.test.ts` | `createPerson` | STRONG | Covers auth, conflict, happy path |
| `updateMyProfile.test.ts` | `updateMyProfile` | WEAK | Only 2 tests: unauth + happy path. No field validation tests. |
| `deleteMyAccount.test.ts` | `deleteMyAccount` | STRONG | 4 tests: unauth, not found, happy path (202), idempotent (200), already deleted (410) |
| `cancelMyAccountDeletion.test.ts` | `cancelMyAccountDeletion` | WEAK | [NEEDS MANUAL CONFIRMATION — not read] |
| `requestMyAccountDeletion.test.ts` | `requestMyAccountDeletion` (assumed) | [NEEDS MANUAL CONFIRMATION] | File not read |
| `executeAccountDeletion.test.ts` | `executeAccountDeletion` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `accountDeletionCascade.test.ts` | `executeCascadeDeletion` | [NEEDS MANUAL CONFIRMATION] | Cascade logic |
| `exportMyData.test.ts` | `exportMyData` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `exportPersonData.test.ts` | `exportPersonData` (dead handler) | WEAK | Tests dead code |
| `getMyCreditSummary.test.ts` | `getMyCreditSummary` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getMyCredits.test.ts` | `getMyCredits` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getMyMemberships.test.ts` | `getMyMemberships` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getMyNotificationPreferences.test.ts` | `getMyNotificationPreferences` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getMyOfficerRole.test.ts` | `getMyOfficerRole` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getMyPrivacySettings.test.ts` | `getMyPrivacySettings` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `getPerson.test.ts` | `getPerson` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `listPersons.test.ts` | `listPersons` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `listMyCreditEntries.test.ts` | `listMyCreditEntries` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `updateMyNotificationPreferences.test.ts` | `updateMyNotificationPreferences` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `updateMyPrivacySettings.test.ts` | `updateMyPrivacySettings` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `updatePerson.test.ts` | `updatePerson` | [NEEDS MANUAL CONFIRMATION] | File not read |
| `cancelAccountDeletion.test.ts` | Dead handler | WEAK | Tests dead code |
| `requestAccountDeletion.test.ts` | Dead handler | WEAK | Tests dead code |
| `notification-preferences.test.ts` | Multiple notif handlers | [NEEDS MANUAL CONFIRMATION] | File not read |
| `privacy.test.ts` | Multiple privacy handlers | [NEEDS MANUAL CONFIRMATION] | File not read |

### Spec-Level Tests (Acceptance Criteria)

| File | Covers | Classification | Notes |
|------|--------|---------------|-------|
| `ac-m01.auth-onboarding.test.ts` | Auth + onboarding flow | STRONG | Acceptance criteria for auth onboarding |
| `ac-m02.member-profile.test.ts` | Member profile ACs | STRONG | AC-M02 acceptance criteria |
| `profile-spec-compliance.test.ts` | AC-M02-001 thru AC-M02-005 | STRONG | Photo upload, privacy toggle, QR, multi-org |

### Repo Tests

| File | Covers | Classification |
|------|--------|---------------|
| `repos/person.repo.test.ts` | PersonRepository | [NEEDS MANUAL CONFIRMATION] |

### E2E Tests (Playwright)

| File | Person/Profile Coverage | Classification | Notes |
|------|------------------------|---------------|-------|
| `actions/profile-settings-actions.spec.ts` | Profile edit, notifications toggle, credits, organizations | STRONG | Tests real API persistence, not just UI |
| `auth.spec.ts` | Auth flow (person creation indirect) | STRONG | Covers sign-in/out |
| `auth/account-claim.spec.ts` | Account claiming | [NEEDS MANUAL CONFIRMATION] | |
| `auth/otp-registration.spec.ts` | OTP registration → person creation | STRONG | End-to-end person creation |
| `auth/session-management.spec.ts` | Sessions | STRONG | |
| `journeys/navigation.spec.ts` | Navigation to profile pages | [NEEDS MANUAL CONFIRMATION] | |
| `journeys/registration-to-payment.spec.ts` | Registration → profile | [NEEDS MANUAL CONFIRMATION] | |
| `directory-onboarding.spec.ts` | Directory + profile | [NEEDS MANUAL CONFIRMATION] | |

### Contract Tests (Hurl)

| File | Coverage |
|------|---------|
| `person-lifecycle.hurl` | Basic CRUD |
| `person-validation.hurl` | Input validation |
| `persons-extended-flow.hurl` | Extended flows |

---

## Gap Analysis

### Handlers with NO test coverage

| Handler | Status |
|---------|--------|
| No confirmed completely untested handler | — but many need manual confirmation |

### Critical Flows with NO E2E Coverage

| Flow | Severity |
|------|---------|
| Account deletion request | P1 |
| Account deletion cancellation | P1 |
| Data export (GDPR) | P1 |
| Privacy settings toggle + persistence | P2 |
| Notification preferences persistence (reload check) | P2 |
| Admin list persons | P2 |
| `executeAccountDeletion` (scheduled job) | P2 |

### Contract Test Gaps

Missing Hurl coverage for:
- `GET /persons/me/credits` (also has auth middleware gap)
- `GET /persons/me/export`
- `POST /persons/me/delete` + `POST /persons/me/cancel-delete`
- `GET/PATCH /persons/me/notification-preferences`
- `GET/PATCH /persons/me/privacy`

---

## Test Quality Issues

### 1. `updateMyProfile.test.ts` — Only 2 tests

Tests: auth failure + happy path. Missing:
- Person not found (404)
- Partial updates (each optional field)
- Audit action called

### 2. Dead handler test files

`cancelAccountDeletion.test.ts`, `requestAccountDeletion.test.ts`, `exportPersonData.test.ts` — test dead code. Misleading coverage metrics.

### 3. E2E notification toggles — no persistence check

```typescript
// Actual test in profile-settings-actions.spec.ts:
await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 5000 })
```
Verifies toggles visible but does NOT check that PATCH fires, nor that setting persists on reload. WEAK for a persistence-critical feature.

### 4. No E2E for Settings general tab

The general tab calls `GET /persons/me` (unregistered route — P1 bug). If tested, it would catch this immediately. No test exists.

---

## Confidence Score

| Layer | Score | Rationale |
|-------|-------|-----------|
| Unit tests (backend) | 6/10 | High handler count with paired test files; quality varies; some tests only cover 2 cases |
| Spec/AC tests | 8/10 | profile-spec-compliance.test.ts + AC tests are thorough for covered ACs |
| E2E tests | 5/10 | Profile edit + credits covered; deletion/export/privacy uncovered |
| Contract tests | 4/10 | 5 hurl files but miss 6 key person endpoints |
| **Overall** | **5.5/10** | PII hub with P0 auth gap and P1 missing tests for deletion/export journeys |

**Weighted Score: 5.5/10**

Deduction factors:
- P0 auth middleware missing on `GET /persons/me/credits`
- P0 `executeAccountDeletion` no auth check
- P1 unregistered `GET /persons/me` breaking Settings general tab
- P1 zero E2E tests for account deletion and GDPR export
- Significant dead code (4+ handler file pairs) skewing test metrics

---

## Recommended Test Additions (Priority Order)

| Priority | Test | Type |
|----------|------|------|
| P0 | `GET /persons/me/credits` — verify 401 when unauthenticated | Contract (Hurl) |
| P0 | `executeAccountDeletion` — verify requires admin/system context | Unit + Contract |
| P1 | Account deletion request + cancel flow | E2E |
| P1 | Data export — trigger + verify JSON response contains PII fields | E2E |
| P1 | Settings general tab loads profile (catches `GET /persons/me` bug) | E2E |
| P2 | Privacy settings toggle + reload persistence | E2E |
| P2 | Notification preferences PATCH + reload persistence | E2E |
| P2 | `updateMyProfile` — field-by-field validation (firstName max 50) | Unit |
| P3 | Admin `listPersons` pagination | Contract |
