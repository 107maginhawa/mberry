# Module 1: Auth/Session — Route Navigation Audit

**Scope**: Auth routes, middleware route application, frontend auth flow
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Route Registry

| Route | Type | Component/Page | Auth Required | Roles | Params | Source File | Test Coverage |
|-------|------|---------------|--------------|-------|--------|------------|---------------|
| `/auth/$authView` | Frontend | `apps/memberry/src/routes/auth/$authView.tsx` | No | Any | `authView`: sign-in, sign-up, forgot-password, etc. | `$authView.tsx` | NONE — no E2E test |
| `/api/auth/*` | Backend | Better-Auth handles all auth API routes | No | Any | Various | `core/auth.ts` → `registerAuthRoutes()` | Implicit via Better-Auth; `auth-session-hardening.test.ts` tests session behavior |
| `/_authenticated` | Frontend layout | `apps/memberry/src/routes/_authenticated.tsx` | Yes | Any authenticated user | — | `_authenticated.tsx` | NONE — no E2E test for redirect |
| `/_authenticated/*` | Frontend (all member/officer pages) | Various nested routes | Yes | Varies by page | — | `routes/_authenticated/**` | NONE — no auth redirect E2E |

### Backend Auth Middleware Application Points

| Route Pattern | Auth Middleware | Additional Middleware | Source |
|--------------|----------------|----------------------|--------|
| `/admin/*` | `authMiddleware()` | `platformAdminAuthMiddleware()` | `app.ts` |
| `/association/*` (non-public) | `authMiddleware()` (conditional) | `orgContextMiddleware()` (conditional) | `app.ts` — skips `ASSOCIATION_PUBLIC_PATHS` |
| `/billing/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/booking/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/comms/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/storage/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/reviews/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/audit/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/persons/*` | Per-route (generated) | `orgContextOptionalMiddleware()` | `app.ts` |
| `/invite` (POST) | `authMiddleware()` | `orgContextMiddleware()` | `app.ts` |
| `/invite/claim/*` | `authMiddleware()` | — | `app.ts` |
| `/invite/validate/*` | None (public) | — | `app.ts` |
| `/accredited-providers/*` | `authMiddleware()` via `app.use()` | — | `app.ts` — codegen gap workaround |
| `/email/unsubscribe` | None (public) | — | `app.ts` |
| `/email/suppressions` | None (public) | — | `app.ts` — [LIKELY BUG] see AUTH-GAP-01 |

### Public Routes (Explicitly No Auth)

| Route | Purpose | Evidence |
|-------|---------|---------|
| `/public/orgs` | Org discovery | `app.ts` — registered before auth middleware |
| `/og/events/:slug` | OG meta for social sharing | `app.ts` — HTML response for crawlers |
| `/credentials/lookup/:credentialNumber` | Public credential verification | `app.ts` |
| `/certificates/verify/:certificateNumber` | Public certificate verification | `app.ts` |
| `/pay/:token/validate` | One-tap payment validation | `app.ts` — before wildcard auth |
| `/pay/:token/process` | One-tap payment processing | `app.ts` — before wildcard auth |
| `/invite/validate/:token` | Invite link validation | `app.ts` — intentionally no auth |
| 6 association public paths | Directory, credentials, ethics | `ASSOCIATION_PUBLIC_PATHS` array in `app.ts` |

---

## 2. Navigation Registry

| Source | Label | Target Route | Role Visibility | Route Exists? | Risk | Evidence |
|--------|-------|-------------|----------------|--------------|------|---------|
| `__root.tsx` | N/A — no nav links | N/A | All | — | — | Root renders `AuthUIProviderTanstack` + `Outlet` |
| `_authenticated.tsx` | Member sidebar | Various member routes | Authenticated | Yes | — | `MemberSidebar` component |
| `_authenticated.tsx` | Officer sidebar link | `/org/:slug/officer/*` | Officers only (detected via `isOfficerForActiveOrg`) | Yes | Low | Officer link conditionally shown |
| `_authenticated.tsx` | Org icon rail | Org switcher | Members with orgs | Yes | — | `OrgIconRail` component |
| Auth page | Sign-in form | POST `/api/auth/sign-in` | Unauthenticated | Yes | — | Better-Auth handles |
| Auth page | Sign-up flow | POST `/api/auth/sign-up` | Unauthenticated | Yes | — | Better-Auth handles |

---

## 3. Broken Navigation Report

| ID | Issue | Source File | Target | Affected Role | Severity | Recommended Fix | Recommended Test |
|----|-------|-----------|--------|--------------|----------|----------------|-----------------|
| AUTH-NAV-01 | No explicit redirect after successful login — relies on Better-Auth default behavior | `$authView.tsx`, `guards.ts` | Dashboard or `redirect` search param | All | P2 | Verify post-login redirect respects `?redirect=` param from `requireAuth()` | E2E: login → verify redirected to originally requested page |
| AUTH-NAV-02 | No session expiry redirect — if session expires mid-use, API calls fail silently | `_authenticated.tsx` | Sign-in page | All authenticated | P2 | Add session expiry detection + redirect | E2E: simulate expired session → verify redirect to sign-in |

---

## 4. Route Test Gap Matrix

| Route | Existing Tests | Missing Tests | Recommended Test Type | Priority |
|-------|---------------|--------------|----------------------|----------|
| `/auth/$authView` (sign-in) | NONE | Login flow, post-login redirect, invalid credentials, lockout | E2E | P1 |
| `/auth/$authView` (sign-up) | NONE | Registration flow, duplicate email, email verification | E2E | P1 |
| `/_authenticated` redirect | NONE | Unauthenticated → redirect to sign-in with return URL | E2E | P1 |
| `/api/auth/*` (Better-Auth) | `auth-session-hardening.test.ts` (STRONG), `auth-events.test.ts` (STRONG) | 2FA enrollment/verification flow | API integration | P2 |
| Backend auth middleware | `auth.test.ts` (STRONG) | — | — | — |
| Backend officer auth | `officer-check.test.ts` (STRONG) | 2FA enforcement for privileged positions | API integration | P2 |
| Backend route protection | `auth-gate-coverage.test.ts` (STRONG) | Coverage for 24 hand-wired pre-migration routes | API integration | P1 |
| Frontend officer UI gating | NONE | Non-officer cannot see officer nav links | E2E | P2 |

---

## Summary

- **Backend route auth application**: STRONG — comprehensive middleware layering with public path bypasses
- **Frontend auth flow**: Working but UNTESTED — `requireAuth()` guard + Better-Auth UI
- **P0 findings**: 0
- **P1 findings**: 3 (missing E2E for login, signup, auth redirect)
- **P2 findings**: 4 (post-login redirect, session expiry, 2FA flow, officer UI gating)
- **Key risk**: 24 hand-wired pre-migration routes not covered by `auth-gate-coverage.test.ts`
