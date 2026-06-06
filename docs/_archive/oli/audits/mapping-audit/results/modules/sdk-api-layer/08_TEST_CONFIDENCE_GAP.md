# 08 — Test Confidence Gap: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: SDK tests, auth middleware tests, core infrastructure test coverage

---

## 1. Test File Inventory

| File | Framework | Test Count | Coverage Area |
|---|---|---|---|
| `services/api-ts/src/middleware/auth.test.ts` | Bun test | 25 tests | `authMiddleware` — all branches |
| `services/api-ts/src/middleware/platform-admin-auth.test.ts` | Bun test | ~8 tests | `platformAdminAuthMiddleware` |
| `services/api-ts/src/middleware/custom-routes-auth.test.ts` | Bun test | Unknown | Custom route auth patterns |
| `services/api-ts/src/core/auth-events.test.ts` | Bun test | ~10 tests | Auth event audit logging |
| `services/api-ts/src/core/auth-session-hardening.test.ts` | Bun test | ~10 tests | Session security hardening |
| `services/api-ts/src/core/session-limit.test.ts` | Bun test | ~6 tests | Session concurrency limits |
| `packages/sdk-ts/src/*.test.ts` | **None found** | 0 | — |

---

## 2. `authMiddleware` Test Coverage (25 tests)

The auth middleware has the strongest test coverage in the SDK/API layer.

**Covered scenarios**:
- ✅ Factory returns middleware function (3 tests)
- ✅ Missing auth instance in context → plain Error
- ✅ Required auth: no session → UnauthorizedError(401)
- ✅ Required auth: valid session → next() called
- ✅ Sets user + session on context
- ✅ Defaults missing role to "user"
- ✅ Optional auth: no session → next() (no error)
- ✅ Optional auth: session present → sets user
- ✅ Role check: user has required role → allowed
- ✅ Role check: user lacks role → ForbiddenError(403)
- ✅ OR logic across multiple roles
- ✅ Comma-separated multi-role user
- ✅ Empty roles array → no restriction
- ✅ `:owner` syntax → defers to handler
- ✅ Internal service token bypass → next()
- ✅ Token bypass sets `isInternalExpand = true`
- ✅ Wrong token → UnauthorizedError
- ✅ Missing X-Expand-Context → UnauthorizedError
- ✅ Missing X-Internal-Service-Token → UnauthorizedError
- ✅ Token rotation (old token accepted)
- ✅ Multi-token list (active token accepted)
- ✅ Unknown token rejected
- ✅ Empty token list falls through to normal auth
- ✅ `required: false + roles: ['admin']` + no session → next() (role check skipped)

**Gaps in auth middleware tests**:
- ❌ Banned user → ForbiddenError (behavior exists in code, not tested)
- ❌ No test for role with spaces or case sensitivity in comma-separated string
- ❌ No test for `required: false + roles: ['admin']` + session that lacks role → expected ForbiddenError? (edge case ambiguity)

---

## 3. `officerAuthMiddleware` Test Coverage

No dedicated test file found for `services/api-ts/src/middleware/officer-auth.ts`.

**Untested branches**:
- ❌ Missing `:organizationId` param → ValidationError(400)
- ❌ No active officer terms → ForbiddenError(403)
- ❌ Privileged position + 2FA disabled → ForbiddenError(403)
- ❌ Privileged position + 2FA enabled → next()
- ❌ Non-privileged position → next()
- ❌ No `ctx.user` → ForbiddenError crash path

**Severity**: P1 — officer auth guards financial and governance routes. Zero test coverage.

---

## 4. SDK Package Tests — Zero Coverage

**Files searched**: `packages/sdk-ts/src/*.test.ts`, `packages/sdk-ts/src/**/*.spec.ts`  
**Result**: No test files found in `packages/sdk-ts`.

**Untested critical paths**:
- ❌ `SdkError` construction from `wrapError()`
- ❌ `errorInterceptor` wrapping non-2xx responses
- ❌ `shouldRetry()` logic (4xx no retry, 5xx retry, 408 retry)
- ❌ `createSessionExpiredHandler()` debounce behavior
- ❌ `customFetch` credentials injection
- ❌ `setSdkBaseUrl()` / `getSdkBaseUrl()` runtime config
- ❌ `useOptimisticMutation` rollback on error
- ❌ `createDefaultQueryClient()` defaults
- ❌ Duplicate interceptor guard (`interceptorInstalledRef`)

---

## 5. Core Infrastructure Tests

| Component | Test File | Coverage Assessment |
|---|---|---|
| `core/errors.ts` | No dedicated test | Error classes used across 1000+ handler invocations — integration tested implicitly |
| `core/config.ts` | No dedicated test | Config parsing logic untested — bad env vars silently fallback or crash |
| `core/database.ts` | No dedicated test | DB connection untested |
| `core/auth.ts` (Better-Auth config) | `core/auth-events.test.ts` | Login/logout audit events covered |
| Session hardening | `core/auth-session-hardening.test.ts` | Session security paths covered |
| Session limits | `core/session-limit.test.ts` | Concurrency limit covered |

---

## 6. Contract Test Coverage

From CLAUDE.md and ROADMAP.md:
- **97 Hurl contract test files** cover TypeSpec-defined routes
- **33 routes** have no contract tests (9 by-design, 24 pre-migration)
- Auth routes (`/api/auth/*`) not covered by Hurl (Better-Auth owned)

---

## 7. Confidence Score by Area

| Area | Score | Rationale |
|---|---|---|
| `authMiddleware` | 8/10 | 25 tests, all major branches; banned user + edge cases missing |
| `officerAuthMiddleware` | 1/10 | Zero dedicated tests; guards financial/governance routes |
| `platformAdminAuthMiddleware` | 5/10 | Test file exists; coverage details unverified |
| SDK client/transport | 1/10 | Zero tests; critical error handling path |
| SDK provider/retry | 1/10 | Zero tests; retry, debounce, session expiry untested |
| SDK hooks (generated) | N/A | Generated code — spec is the test |
| Core errors | 4/10 | Implicitly tested via handler tests |
| Contract tests | 7/10 | 97 Hurl files, good coverage of TypeSpec routes |

**Overall SDK/API layer test confidence: 4/10**

---

## 8. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| T-01 | P0 | **`officerAuthMiddleware` has zero test coverage** — guards financial/governance routes, 2FA enforcement untested |
| T-02 | P1 | **SDK package has zero test files** — `SdkError`, retry policy, session expiry, optimistic mutation all untested |
| T-03 | P1 | **Banned user path in `authMiddleware` untested** — code exists but no test verifies ForbiddenError thrown |
| T-04 | P2 | **`core/config.ts` has no tests** — bad env var handling unknown |
| T-05 | P2 | **`createSessionExpiredHandler` debounce untested** — redirect storm prevention code path unverified |
| T-06 | P2 | **`useOptimisticMutation` rollback untested** — rollback on error critical for data integrity |
| T-07 | P3 | 33 routes without contract tests — gaps in API surface validation |
