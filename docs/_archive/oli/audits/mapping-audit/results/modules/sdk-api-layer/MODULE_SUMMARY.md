# Module 12: SDK/API Layer — Audit Summary

**Date**: 2026-05-26  
**Auditor**: Journey Test Audit Agent  
**Scope**: `packages/sdk-ts/`, `services/api-ts/src/core/`, `services/api-ts/src/middleware/`

---

## Confidence Score: 5.5 / 10

**Rationale**: The auth middleware and generated infrastructure are well-structured and mostly well-tested. The SDK client has solid error handling design. However, zero SDK package tests, zero `officerAuthMiddleware` tests, dual error response shapes, 5 hand-wired modules outside type safety, and an optional session-expiry handler that silently swallows 401s collectively pull confidence below passing threshold.

---

## Executive Summary

The SDK/API layer is architecturally sound — spec-first generation, structured error types, cookie-based auth, typed transport with retry policy. The critical problems are in the gaps:

1. **Security test gap**: `officerAuthMiddleware` (guards president/treasurer/secretary financial routes) has **zero tests**
2. **SDK blind spot**: Zero test files in `packages/sdk-ts` — retry policy, session expiry debounce, error wrapping all unverified
3. **Silent 401 risk**: `onSessionExpired` is optional — if not wired, session expiry is silently swallowed
4. **Dual error shapes**: 325 handlers use direct `c.json()` instead of error classes — `SdkError.body.code` unreliable
5. **5 modules outside type safety**: membership, dues, training, elections, communications have no generated types on either side

---

## File Index

| Report | Focus | Key Finding |
|---|---|---|
| `02_ROLE_PERMISSION_MAP.md` | authMiddleware, role enforcement | `:owner`-only routes admit any authenticated user vacuously |
| `03_ROUTE_NAVIGATION_AUDIT.md` | SDK hooks → route mapping | 5 hand-wired modules have zero SDK coverage |
| `04_FRONTEND_INTERACTION_INTEGRITY.md` | Error handling, retry, timeout | `onSessionExpired` optional → silent 401 swallow |
| `05_FORM_MODAL_TABLE_ACTION.md` | Validation, mutation errors | No client-side pre-validation; no Zod error field extractor |
| `06_BACKEND_API_CONTRACT_ALIGNMENT.md` | Type alignment, error shapes | 2 handlers return 200 with error body; dual error pattern |
| `07_ROLE_BASED_JOURNEY_MAP.md` | Auth flow, session lifecycle | No QueryClient cache clear on sign-out; platform admin DB hit per request |
| `08_TEST_CONFIDENCE_GAP.md` | Test coverage | Officer auth: 0 tests; SDK package: 0 tests |

---

## P0 Issues (Fix Immediately)

| ID | File | Issue |
|---|---|---|
| C-01 | Multiple handlers | 2 handlers return HTTP 200 with error body — SDK treats as success |
| T-01 | `middleware/officer-auth.ts` | Zero test coverage on financial/governance auth guard |

---

## P1 Issues (Fix Before Next Release)

| ID | File | Issue |
|---|---|---|
| R-01 | `middleware/auth.ts:205-212` | `:owner`-only routes pass any authenticated user — ownership relies 100% on handler discipline |
| F-01 | `react/provider.tsx:51` | `onSessionExpired` optional → session expiry silently swallowed if not wired |
| T-02 | `packages/sdk-ts` | Zero SDK test files — retry, SdkError, debounce, optimistic rollback all unverified |
| T-03 | `middleware/auth.ts:152-153` | Banned user path (`user.banned`) untested |
| C-02 | Multiple handlers | Dual error shapes — 325 direct `c.json()` vs typed error class; `SdkError.body.code` unreliable |
| C-03 | 5 modules | membership, dues, training, elections, communications have no type contract on either side |
| N-01 | SDK generated | Same 5 modules have zero generated SDK hooks |

---

## P2 Issues (Fix in Next Milestone)

| ID | File | Issue |
|---|---|---|
| R-02 | `middleware/auth.ts:141-143` | Missing auth in context throws plain Error → potential 500 instead of 401 |
| R-03 | `middleware/auth.ts:180` | `required: false + roles` + no session passes without role check |
| J-03 | `react/provider.tsx` | No QueryClient cache clear on sign-out — stale data 30min window |
| J-04 | `middleware/platform-admin-auth.ts` | DB lookup every admin request — no session-level caching |
| F-04 | `client.ts:15` | `baseUrl` defaults to `localhost:7213` — no runtime assertion for production |
| V-02 | SDK consumers | No utility to extract Zod field errors from `SdkError.body` |
| N-03 | Generated pipeline | No CI check verifying generated files match current spec |

---

## What Works Well

- `authMiddleware` — clean, well-designed, 25 tests covering all happy/sad paths
- `officerAuthMiddleware` — 2FA enforcement for privileged positions is robust (when tested)
- `SdkError` — structured error type with status, url, method, body
- Retry policy — exponential backoff, correct 4xx no-retry logic
- Session expiry debounce — prevents redirect storm
- Timing-safe internal service token comparison (rotation-aware)
- Single source of truth (OpenAPI spec) for ~58% of routes
- `useOptimisticMutation` — clean rollback pattern

---

## Recommended Immediate Actions

1. **Add `officerAuthMiddleware` tests** — `middleware/officer-auth.test.ts`, covering all 6 branches (missing orgId, not officer, 2FA required, 2FA present, non-privileged, no user)
2. **Add SDK package tests** — at minimum: `SdkError` wrapping, `shouldRetry()`, `createSessionExpiredHandler()` debounce
3. **Audit `onSessionExpired` wiring** in `apps/memberry` — verify it redirects to `/auth/sign-in`
4. **Find and fix the 2 handlers** returning HTTP 200 with error body
5. **Add CI step** to detect generated file drift (`diff` generated files against fresh generation)
