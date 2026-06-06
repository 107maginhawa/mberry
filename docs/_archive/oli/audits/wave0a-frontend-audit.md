# Wave 0a Frontend Audit

**Date:** 2026-05-23  
**Scope:** 5 files — org switcher UI, org context provider, authenticated layout  
**Auditor:** Claude Code (automated)

---

## Files Audited

| # | File | Lines |
|---|------|-------|
| 1 | `apps/memberry/src/components/layout/org-icon-rail.tsx` | 109 |
| 2 | `apps/memberry/src/components/layout/org-picker-sheet.tsx` | 135 |
| 3 | `apps/memberry/src/hooks/useMyOrgs.ts` | 53 |
| 4 | `apps/memberry/src/providers/OrgProvider.tsx` | 103 |
| 5 | `apps/memberry/src/routes/_authenticated.tsx` | 73 |

---

## Test Coverage

| File | Test File | Assertion Quality |
|------|-----------|-------------------|
| `org-icon-rail.tsx` | NONE | NONE |
| `org-picker-sheet.tsx` | NONE | NONE |
| `useMyOrgs.ts` | NONE | NONE |
| `OrgProvider.tsx` | NONE | NONE |
| `_authenticated.tsx` | NONE | NONE |

**Verdict:** Zero test coverage across all 5 Wave 0a files.

---

## Findings

### Type Safety

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P1 | `useMyOrgs.ts` | 32, 34 | **`as any` usage (2x).** `api.get<any>` and `raw.map((m: any)` bypass type safety on the memberships response. API response shape is untyped — any backend change silently breaks mapping. |
| P2 | `OrgProvider.tsx` | 43 | **`as { orgSlug: string }` type assertion.** `useParams({ strict: false })` returns `Record<string, string>` — the cast hides the case where `orgSlug` is undefined. If component renders outside an `$orgSlug` route, `orgSlug` is `undefined` cast to `string`. |
| P2 | `OrgProvider.tsx` | 58 | **Untyped API response.** `api.get<{ data: { isOfficer: boolean; positions: OfficerPosition[] } }>` manually specifies shape rather than using generated SDK types. Drift risk if endpoint changes. |
| P3 | `org-icon-rail.tsx` | 60, 96 | **Route path cast `as '/'`** (2x). `navigate({ to: '/org/${org.orgSlug}/home' as '/' })` and `to={"/my/organizations" as "/"}` — works around TanStack Router strict typing but suppresses route-existence checks at build time. |
| P3 | `org-picker-sheet.tsx` | 54, 124 | **Same `as '/'` route cast** (2x). Same pattern as above. |

**Total `as any` count:** 2  
**Total `as unknown` count:** 0  
**Total `@ts-ignore`/`@ts-expect-error` count:** 0

---

### Security

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P2 | `OrgProvider.tsx` | 59 | **Org ID in URL path without validation.** `orgId` interpolated directly into API path `/api/persons/me/officer-role/${orgId}`. If `orgId` contains path traversal characters (unlikely from slug resolution, but defensive coding absent), it could hit unintended endpoints. Should validate UUID format. |
| P3 | `_authenticated.tsx` | 29 | **User object exposed to child components via route context.** `Route.useRouteContext()` returns full `user` object. Not a vulnerability per se, but child components should avoid rendering raw user data without sanitization. No `dangerouslySetInnerHTML` found anywhere — good. |
| OK | All files | — | **No XSS vectors.** No `dangerouslySetInnerHTML`, no raw HTML injection, no `eval()`. All user data rendered via React JSX (auto-escaped). |
| OK | `_authenticated.tsx` | 12 | **Auth guard in place.** `beforeLoad: requireAuth` correctly redirects unauthenticated users. Guard checks `context.auth.user` and throws redirect. |

---

### Error Handling

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P1 | `useMyOrgs.ts` | 29-46 | **No error handling on membership fetch.** `useQuery` has no `onError`, no error return, no fallback UI. If `/api/persons/me/memberships` fails (403, 500, network), the hook silently returns empty array `[]` — user sees no orgs with no error indication. |
| P2 | `OrgProvider.tsx` | 46-62 | **No error state exposed.** Both queries lack error propagation. If slug resolution fails, `org` is `null` and `orgId` is `''` — children receive an empty org context with no way to know it failed vs. is loading. Should expose `isError` / `error`. |
| P2 | `OrgProvider.tsx` | 55-62 | **Officer query fails silently.** If officer-role endpoint returns 403/500, `isOfficer` defaults to `false`. User appears as member when they may be an officer. No retry or error indication. |

---

### Performance

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P2 | `_authenticated.tsx` | 55-59 | **AnimatePresence re-mounts on every pathname change.** `key={location.pathname}` causes full unmount/remount animation on every navigation. This destroys component state inside `<Outlet />` on each route change. May cause unnecessary refetches in child route queries. |
| P2 | `OrgProvider.tsx` | 68-82 | **Context value object created every render.** The `value={{...}}` object literal in `<OrgContext.Provider>` creates a new reference on every render, causing all `useContext(OrgContext)` consumers to re-render even when values haven't changed. Should `useMemo` the value. |
| P3 | `useMyOrgs.ts` | 29 | **No staleTime configured.** Membership query uses default staleTime (0), meaning it refetches on every mount/focus. For org membership data that rarely changes, `staleTime: 5 * 60 * 1000` (5 min) would reduce unnecessary network requests. |
| P3 | `org-icon-rail.tsx` | 34-36 | **`useMyOrgs()` called in rail + potentially in other components.** Multiple consumers trigger the same query key `['my-memberships']` — TanStack Query deduplicates, so this is fine. Not a bug but worth noting the shared query pattern works correctly. |

---

### Accessibility

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| OK | `org-icon-rail.tsx` | 49, 67, 68, 98 | **Good.** `aria-label="Organization switcher"` on nav, per-button `aria-label={Switch to ${org.orgName}}`, `aria-current` for active org. |
| OK | `_authenticated.tsx` | 44-49 | **Skip-to-content link present.** Proper `sr-only` with focus styles. Links to `#main-content` which is set on the `<main>` element. |
| P3 | `org-picker-sheet.tsx` | 75-116 | **Missing aria-current on active org button.** Desktop rail has `aria-current` but mobile sheet does not mark the active org for screen readers. Visual "Current" label exists but no ARIA equivalent. |
| P3 | `org-picker-sheet.tsx` | 69 | **Scrollable list without keyboard hint.** `overflow-y-auto` div has no `role="listbox"` or keyboard navigation support. Users navigating by keyboard can tab through buttons, but there's no list semantics. |

---

### Business Logic / Guard Clauses

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P2 | `OrgProvider.tsx` | 42-82 | **No guard for empty/invalid orgSlug.** If `orgSlug` is empty string (possible from `useParams({ strict: false })`), the query fires with `enabled: !!orgSlug` — empty string is falsy, so query is disabled. But `orgSlug` is still set to `''` in context, and consumers may not check. |
| P2 | `useMyOrgs.ts` | 33-44 | **Defensive field mapping hides API contract issues.** `m.organizationId || m.orgId` and `m.orgName || m.organizationName` suggest the API response shape is unstable or has multiple formats. This masks contract violations that should be caught at the API layer. |
| P3 | `org-icon-rail.tsx` | 38 | **Early return for 0 orgs.** `if (orgs.length === 0) return null` — correct guard, but no loading state. While `orgs` is loading, rail flashes as absent then appears. |
| P3 | `_authenticated.tsx` | 37-39 | **Officer route bypass.** `isOfficerRoute` check via `routeId.includes("/officer")` is string-match based. If any non-officer route accidentally includes "officer" in its path, it would bypass the member layout. Fragile. |

---

### State Management

| Sev | File | Line(s) | Finding |
|-----|------|---------|---------|
| P2 | `OrgProvider.tsx` + `useMyOrgs.ts` | — | **Dual org resolution paths.** `useMyOrgs` resolves active org from URL regex (`/org/([^/]+)/`). `OrgProvider` resolves from `useParams`. These are independent — if they disagree (e.g., stale URL vs. param), components get inconsistent org state. |
| P3 | `OrgProvider.tsx` | 46-48 | **Slug→org cached with `staleTime: Infinity`.** Correct for immutable slugs, but if a slug is ever recycled or org renamed, the cache never refreshes without a hard reload. Documented as intentional for Wave 0. |
| OK | `OrgProvider.tsx` | 89-95 | **Provider throw guard.** `useOrgProvider()` throws if used outside provider — correct fail-fast pattern. `useOrgProviderOptional()` returns null — good for cross-route components. |

---

### TODO / FIXME / STUB Markers

| File | Count | Details |
|------|-------|---------|
| All 5 files | 0 | No TODO, FIXME, HACK, XXX, or STUB markers found. |

---

### Cross-Module Imports

| File | External Imports | Assessment |
|------|------------------|------------|
| `org-icon-rail.tsx` | `@monobase/ui`, `@/components/patterns/avatar-initials`, `@/hooks/useMyOrgs` | Clean — uses shared UI and local hook |
| `org-picker-sheet.tsx` | `@monobase/ui`, `@/components/patterns/avatar-initials`, `@/hooks/useMyOrgs` (type only) | Clean — type-only import from hook |
| `useMyOrgs.ts` | `@/lib/api` | Clean — uses project API wrapper |
| `OrgProvider.tsx` | `@monobase/sdk-ts/generated/react-query`, `@monobase/sdk-ts/generated/types.gen`, `@/lib/api` | Mixed — uses both generated SDK and raw API. Should use SDK for officer endpoint too. |
| `_authenticated.tsx` | `@/components/layout/*`, `@/components/patterns/*`, `@/components/motion/*`, `@/utils/guards`, `framer-motion` | Clean — layout composition |

---

## Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| **P0** | 0 | No critical security or data loss issues |
| **P1** | 2 | Type safety (`as any` x2), silent error swallowing on membership fetch |
| **P2** | 8 | Missing error states, context re-render, AnimatePresence re-mount, dual org resolution, unvalidated orgId, type assertion on params, unstable API mapping, empty slug guard |
| **P3** | 8 | Route casts, missing staleTime, aria-current on mobile, loading flash, officer route string match, slug cache, scrollable list semantics, info note |

---

## Recommended Fixes (Priority Order)

### P1 — Fix immediately

1. **Type the membership API response.** Replace `api.get<any>` in `useMyOrgs.ts` with a proper type from `@monobase/sdk-ts/generated/types.gen` or define an explicit interface. Remove `(m: any)` mapper cast.

2. **Surface query errors in `useMyOrgs`.** Return `isError` and `error` from the hook. Add error UI in `OrgIconRail` / `OrgPickerSheet` (even a simple retry prompt).

### P2 — Fix in current wave

3. **Memoize OrgProvider context value.** Wrap the `value` prop in `useMemo` with deps `[org, orgId, orgSlug, role, permissions, isOfficer, orgLoading, officerLoading]`.

4. **Expose error state from OrgProvider.** Add `isError` and `error` to `OrgContextValue`. Consumers can then show error boundaries or retry UI.

5. **Validate orgId format** before interpolating into API path. Simple UUID regex check: `/^[0-9a-f-]{36}$/i`.

6. **Unify org resolution.** Either use `useMyOrgs` everywhere or `OrgProvider` everywhere. Document which is canonical.

7. **Use SDK-generated hook for officer query** instead of raw `api.get` in `OrgProvider.tsx` line 57-61.

### P3 — Fix when convenient

8. Add `aria-current="true"` to active org button in `OrgPickerSheet`.
9. Add `staleTime: 5 * 60 * 1000` to `useMyOrgs` query.
10. Consider `role="listbox"` on mobile org list.
11. Replace `as '/'` route casts with proper typed route references when TanStack Router supports dynamic segments.

---

## Test Recommendations

All 5 files lack tests. Minimum coverage to add:

| Component | Test Type | Key Assertions |
|-----------|-----------|----------------|
| `useMyOrgs` | Unit (hook) | Returns mapped orgs from API; extracts slug from URL; handles empty response; handles API error |
| `OrgProvider` | Unit (context) | Resolves slug to org; fetches officer role; exposes correct `isOfficer`; throws outside provider |
| `OrgIconRail` | Component | Renders org avatars; highlights active; navigates on click; hides when 0 orgs |
| `OrgPickerSheet` | Component | Opens/closes; lists orgs with status; navigates and closes on select |
| `_authenticated.tsx` | Integration | Redirects unauthenticated; renders layout; skips layout for officer routes |
