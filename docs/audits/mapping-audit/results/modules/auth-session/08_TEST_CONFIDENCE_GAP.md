# Module 1: Auth/Session — Test Confidence Gap Audit (v2 — gap-filled)

**Scope**: All auth/session test files, per-file assertion quality, module spec BR coverage
**Date**: 2026-05-26 (revised)
**Coverage Target**: 90%+

---

## 1. Test Structure Summary

| Test File | Lines | Tests | Assertions | Quality | What It Tests |
|-----------|-------|-------|-----------|---------|--------------|
| `middleware/auth.test.ts` | 546 | 31 | 56+ | **STRONG** | Auth middleware factory, required/optional auth, RBAC roles, `:owner` syntax, internal service token bypass, token rotation |
| `middleware/custom-routes-auth.test.ts` | 94 | 8 | 8 | **WEAK** | Render-only: verify 401 on custom routes without session. No permission boundaries tested. Only 6 of 24 hand-wired routes covered. |
| `middleware/platform-admin-auth.test.ts` | 82 | 4 | 5 | **WEAK** | ForbiddenError when not admin; next called when admin. Only checks 3 roles (super, support, analyst). |
| `middleware/impersonation-guard.test.ts` | 228 | 11 | 14 | **WEAK** | Mostly `toBe` assertions; limited error path coverage; 1 status code check only. |
| `middleware/org-context.test.ts` | 220 | 9 | 19 | **STRONG** | requireActiveStatus (allow active/grace, deny suspended/lapsed/expired), requireOrgRole (role match/mismatch), requireTenantAccess (org match) |
| `core/auth-events.test.ts` | 237 | 7 | 27 | **STRONG** | Event structure validation, timestamp assertions, specific event fields (personId, ip, email_hash, method) |
| `core/auth-session-hardening.test.ts` | 222 | 18 | 30 | **WEAK** | 15x `toContain` assertions (array membership checks); weak on error path validation |
| `utils/auth.test.ts` | 171 | 12 | 38 | **STRONG** | Permission definitions (patient, provider, admin, user), permission array membership |
| `utils/org-auth.test.ts` | 97 | 12 | 28 | **WEAK** | requireActiveStatus, requireOrgRole, requireTenantAccess — mostly status code + `toBe`; thin error scenarios |
| `utils/officer-check.test.ts` | 101 | 8 | 10 | **WEAK** | requireOfficerTerm (active/inactive), requirePosition (match/mismatch) — minimal error paths |
| `handlers/auth-gate-coverage.test.ts` | 421 | 56 | 61 | **WEAK** | 59x `toBe` assertions (render-only); only 2 status code checks. High count but shallow: tests gate logic, not wiring. |
| E2E (auth flow) | — | 0 | 0 | **NONE** | No E2E tests for any auth journey |
| Frontend component | — | 0 | 0 | **NONE** | No frontend auth component tests |

**Totals**: ~176 backend tests across 11 files. 0 frontend tests.
**Quality breakdown**: 4 STRONG, 6 WEAK, 1 NONE (E2E)

---

## 2. Module Spec Business Rule Coverage (M01 — 15 rules)

| Rule | Description | Test Status | Evidence | Severity |
|------|------------|-------------|---------|----------|
| M1-R1 | OTP: 6 digits, 15 min expiry, max 3 resends, max 5 attempts → invalidate | **NONE** | No OTP exhaustion or expiry test | P1 |
| M1-R2 | Claim token: 7-day expiry, officer can regenerate | **NONE** | No token age validation test | P1 |
| M1-R3 | Password: min 8 chars, 1 upper, 1 number; reject top-10k common | **NONE** | No password validation test | P1 |
| M1-R4 | Account lockout: 5 consecutive failures → 15 min lock | **NONE** | auth-session-hardening mentions lockout but no failure-count test | P1 |
| M1-R5 | Magic link: single-use, 15 min expiry | **NONE** | No link reuse or expiry test | P2 |
| M1-R6 | Wizard progress: persist per-org, resume from last step | **NONE** | No state resumption test | P2 |
| M1-R7 | MFA backup codes: 10 single-use, exhaustion → require support | **NONE** | No exhaustion test | P1 |
| M1-R8 | All auth events: immutable audit trail | **PARTIAL** | `auth-events.test.ts` tests structure, NOT immutability | P2 |
| M1-R9 | Logo: SVG/PNG/JPEG/WebP, max sizes, sanitize SVG | **NONE** | No file validation test | P2 |
| M1-R10 | CSV import: skip invalid rows, don't block valid | **NONE** | No row-level validation test | P2 |
| M1-R11 | Import: already-linked member → skip (count separately) | **NONE** | No duplicate detection test | P2 |
| BR-22 | Member matching: email ↔ license conflict → flag for resolution | **NONE** | No conflict detection test | P1 |
| BR-23 | License format: per-association regex, normalize | **NONE** | No regex validation test | P2 |
| BR-25 | OTP pattern: 6-digit, 10-min expiry | **PARTIAL** | Mentioned but no dedicated test | P2 |
| BR-26 | Session: concurrent allowed, 24-hour expiry, device-linked | **NONE** | No expiry enforcement test | P1 |

**Business rule test coverage: 0/15 fully tested, 2/15 partially tested**

---

## 3. Workflow E2E Coverage (M01 — 9 workflows)

| Workflow | Description | Test Status | Severity |
|----------|-----------|-------------|----------|
| WF-001 | Self-Registration (email → OTP → account) | **NONE** | P1 |
| WF-002 | Account Claim (invite link → OTP → linked) | **NONE** | P1 |
| WF-003 | Login (email/password → session) | **PARTIAL** — `auth.test.ts` tests basic auth, no lockout | P1 |
| WF-004 | Forgot Password (email → OTP → reset) | **NONE** | P1 |
| WF-005 | Smart Onboarding Wizard (5-step officer setup) | **NONE** | P2 |
| WF-006 | Magic Link Login (email → link → session) | **NONE** | P2 |
| WF-007 | Account Claim — Imported Member | **NONE** | P1 |
| WF-008 | Invite Member (officer → invitation → email) | **NONE** | P1 |
| WF-009 | Bulk CSV Import (upload → preview → confirm) | **NONE** | P1 |

**Workflow test coverage: 0/9 fully tested, 1/9 partially tested**

---

## 4. Behavior-to-Test Matrix (Updated)

| Behavior | Existing Test | Quality (Revised) | Missing Coverage | Severity |
|----------|--------------|-------------------|-----------------|----------|
| Session validation | `auth.test.ts` | **STRONG** | — | — |
| Role-based access (OR logic) | `auth.test.ts` | **STRONG** | — | — |
| Internal token bypass | `auth.test.ts` | **STRONG** | Token audit logging | P2 |
| Officer term verification | `officer-check.test.ts` | **WEAK** — minimal error paths | 2FA enforcement, position scope | P1 |
| Platform admin check | `platform-admin-auth.test.ts` | **WEAK** — only 4 tests | Error scenarios | P2 |
| Impersonation guards | `impersonation-guard.test.ts` | **WEAK** — mostly toBe | Error path coverage | P2 |
| Org context resolution | `org-context.test.ts` | **STRONG** | Cross-org isolation | P2 |
| Account lockout | `auth-session-hardening.test.ts` | **WEAK** — toContain only | Failure count, lockout persistence, unlock timer | P1 |
| Route protection (generated) | `auth-gate-coverage.test.ts` | **WEAK** — 59x toBe, shallow | Wiring integration tests | P1 |
| Route protection (hand-wired) | `custom-routes-auth.test.ts` | **WEAK** — 8 tests, 6 routes | 18 more hand-wired routes | P1 |
| Cross-org data isolation | NONE | **NONE** | Org A member cannot see org B data | P1 |
| 2FA enforcement for privileged positions | NONE | **NONE** | President/treasurer/secretary 2FA check | P1 |

---

## 5. Weak Test Report (Updated)

| Test File | Tests | Weak Pattern | Why Weak | Recommended Improvement | Severity |
|-----------|-------|-------------|---------|------------------------|----------|
| `custom-routes-auth.test.ts` | 8 | Render-only 401 checks | No permission boundaries; covers 6/24 routes | Expand to all 24 routes + role-based denial | P1 |
| `auth-gate-coverage.test.ts` | 56 | 59x `toBe` assertions | High count but shallow — tests gate functions, not route wiring | Add integration tests verifying gates wired to routes | P1 |
| `auth-session-hardening.test.ts` | 18 | 15x `toContain` | Array membership checks, weak error validation | Add specific lockout counter + timer assertions | P1 |
| `impersonation-guard.test.ts` | 11 | Mostly `toBe` | Limited error paths, 1 status code check | Add write-block error response assertions | P2 |
| `officer-check.test.ts` | 8 | Minimal assertions | 10 total assertions for 8 tests; no 2FA, no position scope | Add 2FA enforcement + position-specific denial tests | P1 |
| `org-auth.test.ts` | 12 | Status code + `toBe` | Thin error scenarios, no cross-org tests | Add org isolation + edge cases | P2 |
| `platform-admin-auth.test.ts` | 4 | Only 5 assertions | Only 3 roles tested; no edge cases | Add non-admin denial, missing user, etc. | P2 |

---

## 6. Missing Test Report (Updated)

### P0 — Critical Path

| Item | Risk | Test Type |
|------|------|-----------|
| E2E: Sign-in flow (WF-003) | Core auth broken | E2E |
| E2E: Sign-up flow (WF-001) | Registration broken | E2E |

### P1 — Major Gaps

| Item | Risk | Test Type |
|------|------|-----------|
| Account lockout enforcement (M1-R4) | Brute force unblocked | API integration |
| OTP exhaustion (M1-R1) | Unlimited OTP attempts | API integration |
| Claim token expiry (M1-R2) | Stale tokens usable | API integration |
| Password validation (M1-R3) | Weak passwords accepted | API integration |
| MFA backup code exhaustion (M1-R7) | Codes reusable | API integration |
| Session 24-hour expiry (BR-26) | Sessions never expire | API integration |
| Cross-org data isolation | Org data leaks | API integration |
| 2FA enforcement for privileged officers | Privileged ops without MFA | API integration |
| Member matching on import (BR-22) | Conflicts undetected | API integration |
| Auth redirect E2E (WF-003 flow) | Users bypass auth | E2E |
| Password reset E2E (WF-004) | Users locked out | E2E |
| Invite member flow (WF-008) | Invites broken | E2E |
| CSV import (WF-009) | Import broken | E2E |
| 18 untested hand-wired routes | Auth bypass on pre-migration routes | API integration |
| Route gate wiring verification | Gates defined but not wired | Integration |

### P2 — Important

| Item | Risk | Test Type |
|------|------|-----------|
| Magic link single-use (M1-R5) | Link reuse | API integration |
| Wizard progress resumption (M1-R6) | Progress lost | API integration |
| Logo validation (M1-R9) | Bad files accepted | API integration |
| Audit trail immutability (M1-R8) | Events modifiable | API integration |
| Org switch E2E | Wrong org data | E2E |
| Sign-out E2E | Can't log out | E2E |

---

## 7. Confidence Score (Revised)

| Layer | Score / 10 | Main Gap |
|-------|-----------|----------|
| Coverage Integrity | 5/10 | 176 tests but 6/11 files are WEAK. 14/15 BRs untested. 0/9 workflows tested E2E. |
| Behavior Traceability | 4/10 | Module spec defines 15 BRs, 9 workflows — nearly all lack test coverage. Only auth middleware (auth.test.ts) is well-traced. |
| Test Quality | 5/10 | Only 4/11 test files are STRONG. 6 files are WEAK (shallow assertions, render-only, toBe-heavy). |
| Release Gate Readiness | 2/10 | No E2E. Weak backend tests for critical paths (lockout, OTP, password validation). Cannot ship auth module. |

**Overall Module Confidence: 4.0/10** (revised down from 6.75)

---

## Summary (Revised)

- **176 backend tests** — but only 4/11 files are STRONG; 6 are WEAK (shallow assertions)
- **0 frontend/E2E tests**
- **0/15 business rules fully tested** from module spec
- **0/9 workflows tested end-to-end**
- **6 WEAK test files** need assertion hardening (auth-gate-coverage, session-hardening, officer-check, custom-routes, impersonation, org-auth)
- **P0 missing**: 2 (login E2E, signup E2E)
- **P1 missing**: 15 (BRs, workflows, route coverage, cross-org isolation, 2FA)
- **P2 missing**: 6 (magic link, wizard, logo, audit trail, org switch, sign-out)
- **Recommended first slice**: Harden existing WEAK tests (add real assertions) + add lockout/OTP/password BR tests
