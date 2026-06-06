# Module 1: Auth/Session — Backend API Contract Alignment Audit

**Scope**: Auth API endpoints, middleware chain, frontend API usage
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. API Catalogue (Auth/Session Endpoints)

| Method | Path | Handler | Auth | Roles | Request | Response | Tests |
|--------|------|---------|------|-------|---------|----------|-------|
| POST | `/api/auth/sign-in/email` | Better-Auth | No | Any | `{ email, password }` | Session + user | `auth-session-hardening.test.ts` (STRONG) |
| POST | `/api/auth/sign-up/email` | Better-Auth | No | Any | `{ name, email, password }` | Session + user | `auth-events.test.ts` (STRONG) |
| POST | `/api/auth/sign-out` | Better-Auth | Yes | Any | — | Success | Implicit |
| POST | `/api/auth/forget-password` | Better-Auth | No | Any | `{ email }` | Success | NONE |
| POST | `/api/auth/magic-link/send` | Better-Auth (magicLink plugin) | No | Any | `{ email }` | Success | NONE |
| POST | `/api/auth/email-otp/send-verification-otp` | Better-Auth (emailOTP plugin) | No | Any | `{ email }` | Success | NONE |
| POST | `/api/auth/two-factor/enable` | Better-Auth (twoFactor plugin) | Yes | Any | TOTP setup | Secret + QR | NONE |
| POST | `/api/auth/two-factor/verify-totp` | Better-Auth (twoFactor plugin) | Yes* | Any | `{ code }` | Session | NONE |
| GET | `/api/auth/get-session` | Better-Auth | Yes | Any | — | Session + user | `auth-session-hardening.test.ts` (STRONG) |
| POST | `/api/auth/passkey/*` | Better-Auth (passkey plugin) | Varies | Any | WebAuthn | Credential | NONE |
| Various | `/api/auth/admin/*` | Better-Auth (admin plugin) | Yes | Admin | Varies | Varies | NONE |
| Various | `/api/auth/api-key/*` | Better-Auth (apiKey plugin) | Yes | Any | Varies | Varies | NONE |

**Note**: Better-Auth manages all `/api/auth/*` routes internally. These are not in the TypeSpec OpenAPI spec. The OpenAPI spec at `specs/api/dist/openapi/openapi.json` does not cover auth endpoints — Better-Auth generates its own OpenAPI doc at `@/generated/better-auth/openapi.json`.

---

## 2. Middleware Chain (Non-Auth Endpoints)

Auth/Session module provides middleware consumed by ALL other modules:

| Middleware | Applied Via | Effect | Error Response |
|-----------|-----------|--------|----------------|
| `authMiddleware({ required: true })` | Global `/association/*`, per-route, `app.use()` | Validates session, sets `ctx.user` | 401 Unauthorized |
| `authMiddleware({ roles: ['admin'] })` | Per-route | Session + role check (OR logic) | 403 Forbidden |
| `officerAuthMiddleware()` | Per-route | Active officer term + 2FA for privileged | 403 Forbidden / 400 Missing orgId |
| `platformAdminAuthMiddleware()` | Global `/admin/*` | `platform_admin` table check | 403 Forbidden |
| `orgContextMiddleware()` | Global `/association/*` | Resolves org from membership, sets `organizationId` + `role` | 403 if no membership |
| `orgContextOptionalMiddleware()` | Global for billing/booking/comms/etc. | Same but fails silently (no org = skip) | None — fail-open |
| `impersonationResolver()` | Global | Reads impersonation cookie, sets context | None |
| `impersonationWriteBlock()` | Global | Blocks POST/PUT/PATCH/DELETE during impersonation | 403 Forbidden |

---

## 3. Frontend API Usage Matrix

| Frontend Source | Action | API Called | Payload | Expected Response | Error Handling | Test Coverage |
|----------------|--------|-----------|---------|------------------|---------------|--------------|
| `AuthUIProviderTanstack` | Sign in | `POST /api/auth/sign-in/email` | `{ email, password }` | Session | Better-Auth UI handles errors | NONE |
| `AuthUIProviderTanstack` | Sign up | `POST /api/auth/sign-up/email` | `{ name, email, password }` | Session | Better-Auth UI handles errors | NONE |
| `AuthUIProviderTanstack` | Sign out | `POST /api/auth/sign-out` | — | Success | `onSessionChange` invalidates queries | NONE |
| `requireAuth()` guard | Session check | `context.auth.user` (pre-loaded) | — | User object or null | Redirect to sign-in | NONE |
| `_authenticated.tsx` | Officer detection | GET officer terms per org | `{ orgId }` | `{ data: positions[] }` | Silent failure (useQueries) | NONE |
| Various pages | API calls with expired session | Any | — | 401 response | [LIKELY BUG] — no global 401 interceptor | NONE |

---

## 4. Frontend/Backend Drift Report

| ID | Issue | Frontend File | Backend File/API | Evidence | Severity | Recommended Test |
|----|-------|-------------|-----------------|---------|----------|-----------------|
| AUTH-DRIFT-01 | No global 401 response handler in API client — expired session causes silent failures | `apps/memberry/src/lib/api.ts` [NEEDS MANUAL CONFIRMATION] | All authenticated endpoints | No interceptor found in API client setup | P1 | Integration: mock 401 → verify redirect |
| AUTH-DRIFT-02 | Better-Auth OpenAPI spec separate from TypeSpec OpenAPI — two specs, potential confusion | `@/generated/better-auth/openapi.json` | `specs/api/dist/openapi/openapi.json` | Two separate OpenAPI docs, auth endpoints not in main spec | P3 — by design, but consumers must know both exist |
| AUTH-DRIFT-03 | Account lockout error response format unknown — frontend may not handle lockout-specific error messages | `core/auth.ts` → `applyLockout()` | `POST /api/auth/sign-in/email` | Lockout uses custom hook; Better-Auth UI may show generic error | P2 | API test: trigger lockout → verify response includes lockout info |
| AUTH-DRIFT-04 | Internal service token (`X-Internal-Service-Token`) not documented in OpenAPI spec | `middleware/auth.ts` | All endpoints | Token bypass is implementation detail, not in spec | P3 — acceptable for internal use |
| AUTH-DRIFT-05 | `orgContextMiddleware` sets `role='member'` unconditionally — handler-level `requireOrgRole()` becomes a no-op for any org member | `middleware/org-context.ts` | `utils/org-auth.ts` | Code comment confirms: "unable to distinguish members from officers" | P1 — see AUTH-GAP-02 | Unit test: verify behavior |

---

## 5. API Test Gap Matrix

| API | Existing Tests | Missing Tests | Recommended Test Type | Priority |
|-----|---------------|--------------|----------------------|----------|
| `POST /api/auth/sign-in/email` | `auth-session-hardening.test.ts` (STRONG) | Account lockout response format | API integration | P2 |
| `POST /api/auth/sign-up/email` | `auth-events.test.ts` (STRONG) | Duplicate email handling, weak password rejection | API integration | P2 |
| `POST /api/auth/sign-out` | Implicit | Explicit test: sign-out invalidates session | API integration | P2 |
| `POST /api/auth/forget-password` | NONE | Full flow: request → email → reset | API integration | P1 |
| `POST /api/auth/magic-link/send` | NONE | Send link, verify link works | API integration | P2 |
| `POST /api/auth/two-factor/*` | NONE | Enable 2FA, verify TOTP, disable 2FA | API integration | P1 |
| `POST /api/auth/passkey/*` | NONE | Register passkey, authenticate with passkey | API integration | P2 |
| Auth middleware (all routes) | `auth.test.ts` (STRONG), `auth-gate-coverage.test.ts` (STRONG) | Coverage for 24 hand-wired routes | API integration | P1 |
| Officer auth middleware | `officer-check.test.ts` (STRONG) | 2FA enforcement integration test | API integration | P2 |
| Impersonation guards | `impersonation-guard.test.ts` (STRONG) | — | — | — |

---

## Summary

- **Auth API endpoints**: ~12 (all Better-Auth managed, not in TypeSpec)
- **Middleware functions**: 8 (serving all other modules)
- **Frontend/Backend drift issues**: 5
- **P0 findings**: 0
- **P1 findings**: 3 (AUTH-DRIFT-01, AUTH-DRIFT-05, missing tests for password reset + 2FA)
- **P2 findings**: 4
- **P3 findings**: 2
- **Key insight**: Auth endpoints are Better-Auth managed — not in TypeSpec/OpenAPI contract. Testing depends on Better-Auth behavior, not custom code.
