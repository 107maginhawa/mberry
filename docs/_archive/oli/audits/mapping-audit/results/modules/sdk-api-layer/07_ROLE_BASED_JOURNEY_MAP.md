# 07 — Role-Based Journey Map: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: Auth flow, session management, token lifecycle, role-based routing

---

## 1. Authentication Provider Chain

```
apps/memberry (port 3004)
  └── ApiProvider (packages/sdk-ts/src/react/provider.tsx)
        ├── QueryClientProvider (TanStack Query)
        ├── AuthQueryProvider (@daveyplate/better-auth-tanstack)
        └── AuthClientContext.Provider (better-auth client instance)
```

**ApiProvider responsibilities**:
1. Sets `baseUrl` on generated client (`generatedClient.setConfig({ baseUrl })`)
2. Installs `errorInterceptor` once (guards with `useRef`)
3. Initializes `better-auth` client (`initAuthClient(apiBaseUrl)`)
4. Creates `QueryClient` with retry policy and 401 handler

---

## 2. Sign-In Journey

```
User submits credentials
  → better-auth client signs in via /api/auth/sign-in
  → Server sets session cookie (HttpOnly)
  → Auth client resolves with session object
  → AuthQueryProvider updates session query cache
  → Components reading useSession() re-render with user data
```

**Session storage**: HttpOnly cookie (no localStorage, no JS-accessible token).  
**SDK access**: `credentials: 'include'` on every generated fetch call sends cookie automatically.

---

## 3. Session Validation (Per Request)

```
SDK fetch call (generated hook)
  → customFetch({ credentials: 'include' })
  → Hono route
  → authMiddleware()
  → auth.api.getSession({ headers }) — reads cookie via Better-Auth Bearer plugin
  → If valid: ctx.user set
  → If expired/invalid: no session → UnauthorizedError(401)
  → error interceptor → SdkError{status:401}
  → QueryCache.onError / MutationCache.onError → createSessionExpiredHandler()
  → onSessionExpired() (if wired by app)
```

**No explicit token refresh**: Better-Auth manages session expiry server-side. No client-side refresh token flow exists in SDK.

---

## 4. Session Expiry Handling

**File**: `provider.tsx` — `createSessionExpiredHandler()`

```typescript
// Debounced: fires once per 2000ms
if (error instanceof SdkError && error.status === 401) {
  onSessionExpired()  // typically: redirect to /auth/sign-in
}
```

- Wired to both `QueryCache` and `MutationCache` — catches 401 from any query or mutation
- Debounce prevents multiple simultaneous 401s (e.g., parallel queries) from firing multiple redirects
- **`onSessionExpired` is optional** — if not provided, session expiry is not surfaced to the user

---

## 5. Role-Based Route Access (Frontend)

The SDK does not enforce role-based frontend routing. Role checks are:

1. **API-level** (server): `authMiddleware({ roles: [...] })` on each route
2. **Frontend convention**: Components/routes check session user role from `useSession()` or `better-auth-tanstack` query

No SDK utility for frontend role checking exists. Apps must implement their own guard components.

---

## 6. Privilege Escalation Journey (Officer)

```
Officer accesses officer-restricted route
  → authMiddleware() runs first (validates session)
  → officerAuthMiddleware() runs second
  → Queries officer_terms table: findActiveByPersonAndOrg(userId, orgId)
  → If privileged position (president/treasurer/secretary) + 2FA disabled → 403
  → If not officer → 403
  → If officer → ctx.orgMembership set, proceed
```

**2FA enforcement**: Only at middleware layer for privileged positions. Non-privileged officer positions (`board-member`, `officer`, `staff`) have no 2FA requirement.

---

## 7. Platform Admin Journey

```
Admin accesses /admin/* route
  → app.use('/admin/*', authMiddleware()) — session required
  → app.use('/admin/*', platformAdminAuthMiddleware())
  → Queries platform_admin table: findByUserId(userId)
  → If not in table → 403
  → If found → ctx.platformAdmin set, proceed
```

Platform admin access is checked via DB lookup on every request (no session-level caching).

---

## 8. Sign-Out Journey

```
User signs out
  → better-auth client calls /api/auth/sign-out
  → Server deletes session from DB
  → Cookie cleared
  → AuthQueryProvider invalidates session cache
  → Components re-render as unauthenticated
  → SDK fetch calls start returning 401
```

No SDK-level cleanup of TanStack Query cache on sign-out — stale data may persist in `QueryClient` until `gcTime` (30 min) elapses unless app explicitly calls `queryClient.clear()`.

---

## 9. Role Journeys by User Type

| User Type | Auth Path | Role Check | Special Requirements |
|---|---|---|---|
| Unauthenticated | No cookie → 401 | — | — |
| Regular member | Cookie → session | `authMiddleware()` | — |
| Officer | Cookie + officer_terms | `officerAuthMiddleware()` | 2FA if privileged position |
| Platform admin | Cookie + platform_admin | `platformAdminAuthMiddleware()` | DB check every request |
| Internal service | X-Internal-Service-Token + X-Expand-Context | Timing-safe token compare | No user session needed |

---

## 10. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| J-01 | P1 | **No token refresh flow** — session expiry relies entirely on server-side cookie management. If server session expires, client gets 401 with no automatic recovery. |
| J-02 | P1 | **`onSessionExpired` optional** — if not wired, expired sessions cause silent data failures, not redirect to sign-in |
| J-03 | P2 | **No QueryClient cache clear on sign-out** — stale data persists up to 30 min in `gcTime`. Another user on same device could see cached data. |
| J-04 | P2 | **Platform admin DB lookup every request** — no caching at session level. Under load, this adds a DB query per admin API call. |
| J-05 | P2 | **No frontend role guard utility in SDK** — apps implement their own role checking, risk of inconsistent enforcement across app. |
| J-06 | P3 | **2FA requirement only for top 3 officer positions** — board-member, officer, staff positions have no additional auth requirements despite access to sensitive org data. |
