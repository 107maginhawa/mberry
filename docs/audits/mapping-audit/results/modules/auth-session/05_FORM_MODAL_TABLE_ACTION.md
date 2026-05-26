# Module 1: Auth/Session — Form/Modal/Table Action Audit

**Scope**: Auth forms (sign-in, sign-up, forgot-password, 2FA), modals, table actions
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Form Registry

| Form | Route/Page | Fields | Submit Handler | API | Role | Validation | Existing Tests | Status |
|------|-----------|--------|---------------|-----|------|-----------|---------------|--------|
| Sign In (email) | `/auth/sign-in` | email, password | Better-Auth `AuthUIProviderTanstack` | `POST /api/auth/sign-in/email` | Unauthenticated | Better-Auth client-side + server-side validation | NONE | Likely working — managed by Better-Auth UI |
| Sign Up (email) | `/auth/sign-up` | name, email, password | Better-Auth `AuthUIProviderTanstack` | `POST /api/auth/sign-up/email` | Unauthenticated | Better-Auth validation; server: email uniqueness, password strength | NONE | Likely working — managed by Better-Auth UI |
| Forgot Password | `/auth/forgot-password` | email | Better-Auth `AuthUIProviderTanstack` | `POST /api/auth/forget-password` | Unauthenticated | Email format validation | NONE | Likely working |
| Magic Link | `/auth/sign-in` (tab/option) | email | Better-Auth `AuthUIProviderTanstack` | `POST /api/auth/magic-link/send` | Unauthenticated | Email format | NONE | [NEEDS MANUAL CONFIRMATION] — plugin enabled |
| Email OTP | `/auth/sign-in` (tab/option) | email, then OTP code | Better-Auth `AuthUIProviderTanstack` | `POST /api/auth/email-otp/send-verification-otp` | Unauthenticated | OTP format | NONE | [NEEDS MANUAL CONFIRMATION] — plugin enabled |
| 2FA Setup | Settings (expected) | TOTP code | Better-Auth | `POST /api/auth/two-factor/enable` | Authenticated | TOTP code validation | NONE | [NEEDS MANUAL CONFIRMATION] — unclear if UI exists |
| 2FA Verify | Login flow | TOTP code | Better-Auth | `POST /api/auth/two-factor/verify-totp` | Authenticated (partial — pre-2FA) | TOTP code format | NONE | [NEEDS MANUAL CONFIRMATION] |

**Note**: Auth forms are managed by Better-Auth UI (`AuthUIProviderTanstack`), not custom-built. Frontend validation is provided by the library. Backend validation is handled by Better-Auth core.

---

## 2. Modal Registry

NOT APPLICABLE — Auth/Session module has no custom modals. Better-Auth UI may render dialogs internally (e.g., 2FA setup) but these are library-managed.

---

## 3. Table/List Action Registry

NOT APPLICABLE — Auth/Session module has no table/list views. Platform admin session management (if any) would be under Module 5 (Admin/Platform).

---

## 4. Form/Modal/Table Gap Report

| ID | Issue | File | Component | Role | Backend/API Link | Severity | Recommended Test |
|----|-------|------|-----------|------|-----------------|----------|-----------------|
| AUTH-FORM-01 | All auth forms are Better-Auth UI managed — no custom Zod validation visible on frontend | `__root.tsx` | `AuthUIProviderTanstack` | All | Better-Auth endpoints | P3 — low risk since library handles validation, but no way to verify alignment without manual testing | Manual + E2E |
| AUTH-FORM-02 | Account lockout (MAX_FAILED_ATTEMPTS) has no frontend indicator — user gets generic error after lockout | `core/auth.ts` — `applyLockout()` | Sign-in form | Unauthenticated | `POST /api/auth/sign-in/email` → lockout response | P2 | E2E: trigger lockout → verify user sees "account locked" message, not generic error |
| AUTH-FORM-03 | Password requirements not documented — Better-Auth may enforce strength rules but user gets no upfront guidance | Sign-up form | `AuthUIProviderTanstack` | Unauthenticated | `POST /api/auth/sign-up/email` | P3 | E2E: submit weak password → verify clear error message |
| AUTH-FORM-04 | 2FA enrollment form existence unclear — plugin enabled but no UI path verified | Settings pages | Unknown | Privileged officers (required), all users (optional) | `POST /api/auth/two-factor/enable` | P1 — if 2FA is required for privileged officers but no enrollment UI exists, officers are blocked | E2E: navigate to settings → verify 2FA setup section exists |
| AUTH-FORM-05 | Session limit enforcement (`DEFAULT_SESSION_LIMIT`) — no frontend indication when older session is terminated | `core/session-limit.ts` | N/A | All | Session management | P2 | E2E: login on 2nd device → verify 1st session shows "signed out elsewhere" notification |

---

## Summary

- **Total forms identified**: 7 (all Better-Auth managed)
- **Custom forms**: 0 (all library-provided)
- **Modals**: NOT APPLICABLE
- **Table actions**: NOT APPLICABLE
- **P0 findings**: 0
- **P1 findings**: 1 (AUTH-FORM-04 — 2FA enrollment UI existence unclear)
- **P2 findings**: 2 (AUTH-FORM-02, AUTH-FORM-05)
- **P3 findings**: 2 (AUTH-FORM-01, AUTH-FORM-03)
- **Frontend/backend validation alignment**: Cannot verify — forms are library-managed, not custom Zod schemas
