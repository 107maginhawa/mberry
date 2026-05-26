# MODULE SUMMARY — App Shell / Navigation

**Module**: App Shell / Navigation (Module 11)
**Audit Date**: 2026-05-26
**Auditor**: Automated Journey Audit Agent

---

## Confidence Score: 6.5 / 10

---

## What Was Audited

| File | Type |
|---|---|
| `apps/memberry/src/routes/__root.tsx` | Root layout |
| `apps/memberry/src/routes/_authenticated.tsx` | Auth layout + member shell |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/route.tsx` | Org layout |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer.tsx` | Officer layout |
| `apps/memberry/src/utils/guards.ts` | Route guards |
| `apps/memberry/src/components/layout/member-sidebar.tsx` | Member sidebar |
| `apps/memberry/src/components/layout/member-bottom-nav.tsx` | Mobile bottom nav |
| `apps/memberry/src/components/layout/member-header.tsx` | Member header |
| `apps/memberry/src/components/layout/officer-sidebar.tsx` | Officer sidebar |
| `apps/memberry/src/components/layout/officer-mobile-nav.tsx` | Officer mobile nav |
| `apps/memberry/src/components/layout/org-icon-rail.tsx` | Desktop org switcher |
| `apps/memberry/src/components/layout/org-picker-sheet.tsx` | Mobile org picker |
| `apps/memberry/src/components/patterns/error-boundary.tsx` | Error boundary |
| `apps/memberry/src/config/position-nav.ts` | Position→nav section config |
| `apps/memberry/src/hooks/useMyOrgs.ts` | Org membership hook |
| `apps/memberry/src/main.tsx` | Router context bootstrap |
| E2E tests: auth.spec, session-expiry.spec, session-management.spec, navigation.spec, error-boundaries.spec | Tests |
| Unit tests: org-icon-rail.test, org-picker-sheet.test | Tests |

---

## Architecture Summary

The shell uses a 3-tier layout hierarchy:

1. **Root** (`__root.tsx`): Wraps everything in `AuthUIProviderTanstack` + `Toaster`. No auth logic.
2. **Authenticated** (`_authenticated.tsx`): `requireAuth` guard. Member shell (sidebar, header, bottom nav, org rail). Detects officer routes to avoid double-wrapping.
3. **Officer** (`officer.tsx`): `requireOrgOfficer` guard. Officer shell (sidebar/mobile nav) with position-based section filtering.

The org route (`org/$orgSlug/route.tsx`) handles UUID normalization only — it is NOT a membership gate.

---

## Strengths

- **Guard chain is robust**: `requireAuth` at layout, `requireOrgOfficer` at officer layout — no route under `/_authenticated` is reachable without auth; no officer route is reachable without officer role
- **Double-render prevention**: Officer layout detected via `routeId.includes("/officer")` — clean pattern
- **Position-based sidebar filtering**: UX filtering with explicit safety fallback + acknowledged backend enforcement
- **Caching strategy**: Org slug→ID cached with `staleTime: Infinity`; officer roles cached 5 min
- **A11y foundations**: Skip-to-main in both layouts, `aria-label` on all nav elements, 44px touch targets on mobile
- **Error boundary**: Present in both member and officer layouts, wraps `<Outlet />`
- **Session bootstrap**: Session loaded before router renders — no auth flash

---

## Findings Summary

| Severity | Count | Key Issues |
|---|---|---|
| P0 | 0 | None |
| P1 | 0 | None |
| P2 | 8 | See below |
| P3 | 2 | See below |
| INFO | 5 | See below |

### P2 Issues

1. **No membership check on org member pages** (`route.tsx`): Any authenticated user can access `/org/:slug/home`, `/org/:slug/directory`, etc. The org route only normalizes UUIDs — it does not verify the user is a member of that org. Backend API must enforce membership. No frontend gate.

2. **Dual cache keys for officer-role endpoint**: Layout uses `['me-officer-role', orgId]`; guard uses `['me-officer-role-raw', orgId]`. Same API, different keys = two API calls, no cache sharing.

3. **`/api/public/org/:slug` response shape inconsistency**: Guard handles `orgData?.id ?? orgData?.data?.id` — double-nesting suggests API response shape is not stable.

4. **`/join` route unconfirmed**: Both `OrgIconRail` and `OrgPickerSheet` link to `/join`. No route file found. If absent, navigating there renders a 404.

5. **OfficerMobileNav drawer stays open on navigation**: Links inside Sheet do not call `setDrawerOpen(false)`. After clicking a nav item, the drawer remains open.

6. **Unknown officer position shows all nav sections**: `POSITION_NAV_CONFIG` fallback: unrecognized position titles see all sections. Not a security bug (backend guards), but confusing UX.

7. **ErrorBoundary 401 does not redirect**: Shows "session expired" message but Retry button re-renders component, not re-authenticate. User is stuck until they manually navigate to sign-in.

8. **Non-officer accessing officer routes**: Test gap — relies entirely on `requireOrgOfficer` with no E2E verification.

### P3 Issues

1. `OrgPickerSheet` "Join another org" → `/join` not tested.
2. Skip-to-main a11y link not tested.

### INFO

1. `persistClient: false` — session re-fetched on every page load.
2. Officer sidebar position filtering is UX-only — backend `requirePosition()` is the actual gate.
3. 5-min officer role cache may show stale status after role removal.
4. `person: null` in bootstrap — downstream guards using `context.auth.person` would fail silently.
5. `ORG_ID` hardcoded as UUID in navigation.spec.ts — brittle seed data dependency.

---

## Test Confidence Breakdown

| Area | Score |
|---|---|
| Auth guards | 8/10 — well tested |
| Officer layout guard | 5/10 — happy path only |
| Member sidebar | 4/10 — post-login smoke only |
| Officer sidebar | 6/10 — president tested, other positions not |
| Mobile nav | 1/10 — almost no coverage |
| Org switching | 2/10 — unit tests, no E2E nav |
| Error handling | 6/10 — API 500 + org 404 covered |
| Position filtering | 2/10 — treasurer/secretary untested |

---

## Recommended Actions (Priority Order)

1. **(P2 fix)** Add membership check to org route or individual org child routes — redirect non-members.
2. **(P2 fix)** Close OfficerMobileNav drawer on link click: add `onClick={() => setDrawerOpen(false)}` to drawer links.
3. **(P2 fix)** Unify officer-role cache key between layout and guard, or remove the layout query and rely on guard context.
4. **(P2 fix or doc)** Confirm `/join` route exists, or replace links with `/my/organizations`.
5. **(P2 test)** Add E2E test: non-officer accessing officer route → verifies redirect to dashboard.
6. **(P2 test)** Add E2E tests for treasurer and secretary position-based nav filtering.
7. **(P2 test)** Add E2E test for org switching via OrgIconRail and OrgPickerSheet.
8. **(P3 test)** Add E2E test for UUID URL normalization redirect.
