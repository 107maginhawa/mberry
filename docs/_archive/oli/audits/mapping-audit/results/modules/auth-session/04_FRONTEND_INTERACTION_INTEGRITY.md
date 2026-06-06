# Module 1: Auth/Session — Frontend Interaction Integrity Audit

**Scope**: Auth UI components, session management, auth guards
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Interaction Registry

| ID | Route/Page | Component | Action Label | Element Type | Role | Handler | Backend/API | Status | Existing Test |
|----|-----------|-----------|-------------|-------------|------|---------|------------|--------|--------------|
| AUTH-INT-01 | `/auth/sign-in` | `AuthUIProviderTanstack` (Better-Auth UI) | Sign In | Form submit button | Unauthenticated | Better-Auth client SDK | `POST /api/auth/sign-in/email` | Likely working — Better-Auth managed | NONE |
| AUTH-INT-02 | `/auth/sign-up` | `AuthUIProviderTanstack` | Create Account | Form submit button | Unauthenticated | Better-Auth client SDK | `POST /api/auth/sign-up/email` | Likely working — Better-Auth managed | NONE |
| AUTH-INT-03 | `/auth/forgot-password` | `AuthUIProviderTanstack` | Reset Password | Form submit button | Unauthenticated | Better-Auth client SDK | `POST /api/auth/forget-password` | Likely working — Better-Auth managed | NONE |
| AUTH-INT-04 | `/auth/sign-in` | `AuthUIProviderTanstack` | Magic Link | Link/button | Unauthenticated | Better-Auth client SDK | `POST /api/auth/magic-link/send` | [NEEDS MANUAL CONFIRMATION] — plugin enabled but UI availability unclear | NONE |
| AUTH-INT-05 | `/auth/sign-in` | `AuthUIProviderTanstack` | Passkey Login | Button | Unauthenticated | Better-Auth client SDK | WebAuthn API | [NEEDS MANUAL CONFIRMATION] — passkey plugin enabled | NONE |
| AUTH-INT-06 | `_authenticated` layout | `MemberHeader` | Sign Out | Button/link | Authenticated | `authClient.signOut()` via `onSessionChange` | `POST /api/auth/sign-out` | Likely working — Better-Auth managed | NONE |
| AUTH-INT-07 | `_authenticated` layout | `OrgIconRail` | Switch Organization | Icon click | Authenticated member | Client-side state change | No API call — route-based org context | Working | NONE |
| AUTH-INT-08 | `_authenticated` layout | `MemberSidebar` | Officer Portal Link | Nav link | Officer only | Navigation | Route to `/org/:slug/officer/*` | Working — conditionally shown via `isOfficerForActiveOrg` | NONE |
| AUTH-INT-09 | Any protected page | `requireAuth()` guard | Auto-redirect | Programmatic | Unauthenticated | `throw redirect()` in `beforeLoad` | No API — client-side redirect | Working — `requireAuth()` checks `context.auth.user` | NONE |
| AUTH-INT-10 | Root | `AuthUIProviderTanstack` | Session Change Handler | Event handler | All | `onSessionChange` callback | Invalidates `['session']` + person queries | Working | NONE |

---

## 2. Broken Interaction Report

| ID | Issue | File | Route/Page | Role | Evidence | Severity | Recommended Test |
|----|-------|------|-----------|------|---------|----------|-----------------|
| AUTH-BINT-01 | No visible "Sign Out" button found in member header — may be in AuthUI provider or hidden in menu | `_authenticated.tsx`, `member-header.tsx` | All authenticated pages | All | `onSessionChange` handler exists but sign-out trigger location unclear | P2 — [NEEDS MANUAL CONFIRMATION] | E2E: verify sign-out button visible and functional |
| AUTH-BINT-02 | No 2FA enrollment UI surfaced to privileged officers | Frontend auth flow | Officer pages | President/Treasurer/Secretary | Backend requires 2FA for privileged positions but no frontend prompt to enable 2FA | P2 | E2E: privileged officer without 2FA → verify prompt/guidance shown |
| AUTH-BINT-03 | Session expiry not handled gracefully — no auto-redirect or toast on 401 | API response handling | All authenticated pages | All | No global 401 interceptor found in API client configuration | P1 | Integration: simulate 401 response → verify redirect to sign-in |
| AUTH-BINT-04 | `credentials` prop passed to `AuthUIProviderTanstack` — password-based auth enabled, but unclear if email-only or also username | `__root.tsx` | Auth pages | Unauthenticated | `<AuthUIProviderTanstack ... credentials>` — need to verify what auth methods are shown | P3 — [NEEDS MANUAL CONFIRMATION] | Manual visual check |

---

## 3. Missing Test Matrix

| Interaction | Risk | Recommended Test Type | Suggested Assertion |
|------------|------|----------------------|---------------------|
| Sign-in form submission | Users cannot log in | E2E | Submit valid credentials → verify redirected to dashboard, session cookie set |
| Sign-in with invalid credentials | No error feedback | E2E | Submit wrong password → verify error message displayed, no redirect |
| Sign-up form submission | Users cannot register | E2E | Submit registration → verify account created, email verification sent |
| Password reset flow | Users locked out of accounts | E2E | Request reset → verify email sent, link works, password changed |
| Sign-out action | Users cannot log out | E2E | Click sign out → verify session cleared, redirected to sign-in |
| Session expiry handling | Silent failures, broken UX | Integration | API returns 401 → verify global handler redirects to sign-in |
| Auth redirect with return URL | Users lose context after login | E2E | Visit protected page unauthenticated → login → verify returned to original page |
| Org switcher interaction | Wrong org context | E2E | Click different org icon → verify routes and data update to new org |
| Officer portal link visibility | Non-officers see officer features | E2E | Non-officer member → verify officer link not visible in sidebar |

---

## Summary

- **Total interactions identified**: 10
- **Working**: 4 (likely working via Better-Auth)
- **Needs manual confirmation**: 3
- **Broken/risky**: 3
- **P0 findings**: 0
- **P1 findings**: 1 (AUTH-BINT-03 — no 401 handler)
- **P2 findings**: 2
- **P3 findings**: 1
- **Test coverage**: NONE — zero E2E or component tests for auth interactions
