# 06 Backend API Contract Alignment — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## API Calls Made by Shell Components

| Component | Endpoint | Method | Purpose |
|---|---|---|---|
| `_authenticated.tsx` | `/api/persons/me/officer-role/:orgId` | GET | Check if user is officer for each org |
| `guards.ts` (requireAuth) | N/A | N/A | Uses RouterContext.auth.user (pre-loaded session) |
| `guards.ts` (requireOrgOfficer) | `/api/public/org/:orgSlug` | GET | Resolve slug → orgId |
| `guards.ts` (requireOrgOfficer) | `/api/persons/me/officer-role/:orgId` | GET | Verify officer positions |
| `useMyOrgs` hook | `/api/persons/me/memberships` | GET | Fetch user's org memberships |
| `org/$orgSlug/route.tsx` | `getOrganization({ path: { organizationId } })` | GET (SDK) | UUID→slug redirect normalization |
| `main.tsx` (`InnerApp`) | Session endpoint (via `useSession()`) | GET | Bootstrap session before routing |

---

## Endpoint Contract Analysis

### `/api/persons/me/officer-role/:orgId`
**Used in**: `_authenticated.tsx`, `guards.ts`

Expected response shape (inferred from usage):
```ts
{ data: Array<{ positionTitle: string; [key: string]: unknown }> }
```

- `_authenticated.tsx` checks: `Array.isArray(q.data?.data)`
- `guards.ts` checks: `Array.isArray(json?.data)`
- Both normalize response as `json.data || []`
- `positions.length === 0` → non-officer conclusion

**Alignment concern**: Two different access patterns:
- `q.data?.data` in component (useQueries result)
- `json?.data` in guard (raw api.get result)

This is consistent with how `useQueries` wraps query results — not a bug, but double-nesting `data.data` is fragile if API response shape changes.

### `/api/persons/me/memberships`
**Used in**: `useMyOrgs.ts`

Expected response:
```ts
{ data: Array<{ id, organizationId, orgName, orgSlug, memberNumber, status, tierId, startDate, duesExpiryDate }> }
```

- Hook accesses `json.data || []` — null-safe
- Maps to `OrgMembership[]` type — typed

**Alignment**: Appears consistent with `association:member` module patterns. No TypeSpec definition confirmed for this exact endpoint in this audit scope.

### `/api/public/org/:orgSlug`
**Used in**: `guards.ts` (requireOrgOfficer)

Expected response:
```ts
{ id: string } | { data: { id: string } }
```

Guard code:
```ts
orgId = orgData?.id ?? orgData?.data?.id
```

Double-access pattern handles both direct and nested response shapes — defensive but indicates API response shape may not be fully consistent.

### Session API
**Used in**: `main.tsx` via `useSession()` from `@monobase/sdk-ts/react/hooks/use-auth`

- Session loaded before router renders
- Context passed as `{ auth: { session, user, person: null } }`
- `person: null` — person data not loaded in bootstrap (intentional, per comment)

### `getOrganization` (SDK)
**Used in**: `org/$orgSlug/route.tsx`

- From `@monobase/sdk-ts/generated/sdk.gen` — auto-generated from OpenAPI
- Returns `{ data }` — standard SDK envelope
- UUID regex validated before calling — only fires for UUID-shaped slugs

---

## Auth API Integration

- `AuthUIProviderTanstack` from `@daveyplate/better-auth-ui/tanstack` wraps root
- `useAuthClient()` from `@monobase/sdk-ts/react/auth` — SDK-level Better-Auth client
- `onSessionChange` invalidates `['session']` query + person query + `router.invalidate()`
- `persistClient: false` — no localStorage persistence (session-only)

---

## Query Caching Strategy

| Query | Cache Key | staleTime | Notes |
|---|---|---|---|
| Officer role (layout) | `['me-officer-role', orgId]` | 5 min | Parallel per org |
| Officer role (guard) | `['me-officer-role-raw', orgId]` | SDK default | Different key from layout |
| Org by slug (guard) | `['org-by-slug', slug]` | Infinity | Never re-fetched |
| My memberships | `['my-memberships']` | SDK default | Used by OrgIconRail, OrgPickerSheet |
| Session | `['session']` | N/A | Via useSession hook |

**Issue**: Layout uses `['me-officer-role', orgId]` but guard uses `['me-officer-role-raw', orgId]`. These are different cache keys for the same endpoint — guard result does not warm the layout cache and vice versa. Two API calls to the same endpoint may fire in sequence.

---

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| P2 | Dual query keys for same officer-role endpoint — cache not shared between guard and layout | Guard key: `'me-officer-role-raw'`, layout key: `'me-officer-role'` |
| P2 | `/api/public/org/:slug` response shape inconsistency — guard handles two shapes with `?.id ?? ?.data?.id` | `guards.ts`: `orgData?.id ?? orgData?.data?.id` |
| P2 | `person: null` in bootstrap context — any guard relying on `context.auth.person` would fail | `main.tsx`: `person: null` |
| INFO | `_authenticated.tsx` officer queries use staleTime 5min — may show stale officer status for 5 min after role changes | Layout officerQueries: `staleTime: 5 * 60_000` |
| INFO | `persistClient: false` in Better-Auth UI — no localStorage session, requires server round-trip on every page load | `__root.tsx`: `persistClient={false}` |
