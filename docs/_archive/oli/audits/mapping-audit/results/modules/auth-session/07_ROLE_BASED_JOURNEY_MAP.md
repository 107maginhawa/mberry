# Module 1: Auth/Session — Role-Based Journey Map Audit

**Scope**: Auth journeys across all roles
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Journey Registry

| Journey | Role | Start Route | End State | Routes | UI Actions | APIs | Existing Tests | Criticality |
|---------|------|------------|-----------|--------|-----------|------|---------------|-------------|
| J-AUTH-01: Email Sign-In | Unauthenticated | `/auth/sign-in` | Authenticated, on dashboard | `/auth/sign-in` → `/_authenticated/dashboard` | Enter email + password, click Sign In | `POST /api/auth/sign-in/email` | `auth-session-hardening.test.ts` (backend STRONG) | Critical/core |
| J-AUTH-02: Email Sign-Up | Unauthenticated | `/auth/sign-up` | Authenticated, on dashboard (pending email verification) | `/auth/sign-up` → `/auth/verify-email` → `/_authenticated/dashboard` | Enter name + email + password, click Create Account | `POST /api/auth/sign-up/email` | `auth-events.test.ts` (backend STRONG) | Critical/core |
| J-AUTH-03: Password Reset | Unauthenticated | `/auth/forgot-password` | Password changed, can sign in | `/auth/forgot-password` → email → `/auth/reset-password` → `/auth/sign-in` | Enter email, click Reset, check email, set new password | `POST /api/auth/forget-password`, `POST /api/auth/reset-password` | NONE | Critical/core |
| J-AUTH-04: Magic Link Login | Unauthenticated | `/auth/sign-in` (magic link tab) | Authenticated, on dashboard | `/auth/sign-in` → email → click link → `/_authenticated/dashboard` | Enter email, click Send Link, check email, click link | `POST /api/auth/magic-link/send` | NONE | Important |
| J-AUTH-05: Sign Out | Authenticated | Any authenticated page | Unauthenticated, on sign-in | Any → `/auth/sign-in` | Click Sign Out | `POST /api/auth/sign-out` | NONE (E2E) | Critical/core |
| J-AUTH-06: 2FA Enrollment | Authenticated (officer) | Settings/security page | 2FA enabled | `/my/settings/security` [INFERRED] → scan QR → enter code | Navigate to settings, enable 2FA, scan QR, enter TOTP code | `POST /api/auth/two-factor/enable` | NONE | Important (required for privileged officers) |
| J-AUTH-07: 2FA Login | Authenticated (partial) | `/auth/sign-in` → 2FA prompt | Fully authenticated | `/auth/sign-in` → 2FA prompt → `/_authenticated/dashboard` | Sign in → enter TOTP code | `POST /api/auth/sign-in/email`, `POST /api/auth/two-factor/verify-totp` | NONE | Important |
| J-AUTH-08: Session Expiry Recovery | Authenticated (session expired) | Any page | Re-authenticated or sign-in | Any → 401 → `/auth/sign-in?redirect=...` → re-auth → original page | Automatic redirect on 401 | `GET /api/auth/get-session` → 401 | NONE | Critical/core |
| J-AUTH-09: Org Context Switch | Authenticated member | Any org-scoped page | Correct org context loaded | `/org/slug-a/*` → click org icon → `/org/slug-b/*` | Click org icon in OrgIconRail | No API — client-side route change, `orgContextMiddleware` resolves on next API call | NONE (E2E) | Important |
| J-AUTH-10: Protected Page Access (Unauthenticated) | Unauthenticated | Any `/_authenticated/*` URL | Redirected to sign-in with return URL | `/org/my-org/dashboard` → `/auth/sign-in?redirect=...` | None — automatic redirect | None — client-side guard | NONE | Critical/core |
| J-AUTH-11: Passkey Registration | Authenticated | Settings/security page | Passkey registered | `/my/settings/security` [INFERRED] → register passkey | Navigate to settings, click Add Passkey, authenticate with device | `POST /api/auth/passkey/register` | NONE | Secondary |
| J-AUTH-12: Passkey Login | Unauthenticated | `/auth/sign-in` | Authenticated | `/auth/sign-in` → passkey prompt → `/_authenticated/dashboard` | Click "Use Passkey", authenticate with device | `POST /api/auth/passkey/authenticate` | NONE | Secondary |
| J-AUTH-13: Admin Impersonation | Platform admin | `/admin/*` → impersonate user | Viewing as target user (read-only) | Admin app → set impersonation → memberry app (read-only) | Click Impersonate, view as user | Impersonation cookie set | `impersonation-guard.test.ts` (STRONG) | Admin/config only |
| J-AUTH-14: Account Lockout Recovery | Unauthenticated (locked) | `/auth/sign-in` | Unlocked, signed in | `/auth/sign-in` → locked → wait for timeout or contact admin | Multiple failed attempts → lockout message | `POST /api/auth/sign-in/email` → lockout response | `auth-session-hardening.test.ts` (backend STRONG) | Important |

---

## 2. Broken Journey Report

| ID | Journey | Role | Broken Step | Evidence | Severity | Recommended Fix | Recommended Test Type |
|----|---------|------|------------|---------|----------|----------------|----------------------|
| AUTH-BJ-01 | J-AUTH-08: Session Expiry | All | 401 → redirect | No global 401 interceptor in API client; expired session causes silent API failures, not redirect | P1 | Add axios/fetch interceptor that catches 401 and redirects to `/auth/sign-in?redirect=current` | E2E: expire session → verify redirect |
| AUTH-BJ-02 | J-AUTH-06: 2FA Enrollment | Privileged officers | Navigate to settings | [NEEDS MANUAL CONFIRMATION] — unclear if 2FA enrollment UI exists in settings. Backend enforces 2FA for president/treasurer/secretary. If no UI, officers are blocked. | P1 | Verify settings page has 2FA setup; if not, add it | E2E: officer navigates to settings → verify 2FA section exists |
| AUTH-BJ-03 | J-AUTH-03: Password Reset | Unauthenticated | Full flow | No E2E test coverage; Better-Auth handles it but flow untested end-to-end | P1 | — (library-managed) | E2E: request reset → verify email → set new password → verify can login |
| AUTH-BJ-04 | J-AUTH-14: Account Lockout | Unauthenticated | Lockout message | Backend enforces lockout but frontend may show generic "invalid credentials" instead of lockout-specific message | P2 | Verify lockout error message is user-friendly | E2E: trigger lockout → verify message |
| AUTH-BJ-05 | J-AUTH-05: Sign Out | All | Sign out trigger | Sign-out button location/visibility unclear — may be in a dropdown menu | P2 — [NEEDS MANUAL CONFIRMATION] | Verify sign-out is discoverable | E2E: verify sign-out visible and functional |

---

## 3. Journey Test Matrix

| Journey | Unit Tests Needed | Component Tests Needed | API/Integration Tests Needed | E2E Tests Needed | Priority |
|---------|------------------|----------------------|------------------------------|-----------------|----------|
| J-AUTH-01: Email Sign-In | — | — | Lockout response format | Full login flow | P0 |
| J-AUTH-02: Email Sign-Up | — | — | Duplicate email, weak password | Full registration flow | P0 |
| J-AUTH-03: Password Reset | — | — | Reset token generation, expiry | Full reset flow | P1 |
| J-AUTH-04: Magic Link | — | — | Link generation, expiry | Full magic link flow | P2 |
| J-AUTH-05: Sign Out | — | — | Session invalidation | Sign out + verify session cleared | P1 |
| J-AUTH-06: 2FA Enrollment | — | — | Enable/disable 2FA | Full 2FA setup flow | P1 |
| J-AUTH-07: 2FA Login | — | — | TOTP verification | Login with 2FA | P1 |
| J-AUTH-08: Session Expiry | — | Global 401 handler | — | Expire session → redirect | P1 |
| J-AUTH-09: Org Switch | — | — | — | Switch org → verify data | P2 |
| J-AUTH-10: Protected Page | — | — | — | Unauthenticated → redirect | P1 |
| J-AUTH-11: Passkey Register | — | — | WebAuthn flow | Full passkey setup | P2 |
| J-AUTH-12: Passkey Login | — | — | WebAuthn auth | Login with passkey | P2 |
| J-AUTH-13: Impersonation | — | — | — (STRONG coverage exists) | — | — |
| J-AUTH-14: Lockout Recovery | — | Lockout message display | Lockout timing | Trigger lockout → verify UX | P2 |

---

## Summary

- **Total journeys identified**: 14
- **Critical/core**: 5 (sign-in, sign-up, password reset, sign-out, session expiry, protected page redirect)
- **Important**: 5 (magic link, 2FA enrollment, 2FA login, org switch, lockout recovery)
- **Secondary**: 2 (passkey register, passkey login)
- **Admin**: 1 (impersonation)
- **Broken journeys**: 5
- **P0 findings**: 0
- **P1 findings**: 3 (session expiry handling, 2FA enrollment UI, password reset untested)
- **P2 findings**: 2 (lockout UX, sign-out discoverability)
- **Backend journey coverage**: STRONG for core auth (session hardening, events, gate coverage)
- **E2E journey coverage**: NONE — zero end-to-end auth journey tests
