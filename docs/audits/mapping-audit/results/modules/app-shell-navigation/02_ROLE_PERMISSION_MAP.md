# 02 Role Permission Map — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Guard Inventory

| Guard Function | File | Behavior |
|---|---|---|
| `requireAuth` | `src/utils/guards.ts` | Redirects unauthenticated to `/auth/sign-in?redirect=…` |
| `requireGuest` | `src/utils/guards.ts` | Redirects authenticated users to `/` |
| `requireOrgOfficer` | `src/utils/guards.ts` | Resolves slug→UUID, checks positions via `/api/persons/me/officer-role/:orgId`, redirects to `/dashboard` if non-officer |
| `requirePerson` | `src/utils/guards.ts` | Requires person profile; redirects to onboarding if missing |
| `composeGuards` | `src/utils/guards.ts` | Utility to chain multiple guards |

---

## Route-Level Guard Application

### Auth Guard (`requireAuth`)
Applied as `beforeLoad` on:
- `_authenticated.tsx` — covers ALL routes under `/_authenticated/*`

This is a root layout guard. Every child route (dashboard, my/*, org/$orgSlug/*, officer/*) inherits it via TanStack Router's nested `beforeLoad` execution chain. No authenticated child route skips this.

### Officer Guard (`requireOrgOfficer`)
Applied as `beforeLoad` on:
- `_authenticated/org/$orgSlug/officer.tsx` — layout parent for all officer subroutes

All routes under `/org/:orgSlug/officer/*` are nested children of this layout. Guard fires before any officer child renders.

**Guard logic**:
1. Check `context.auth.user` — redirect to sign-in if missing
2. Resolve `orgSlug` → `orgId` via `/api/public/org/:slug` (cached, staleTime: Infinity)
3. Call `/api/persons/me/officer-role/:orgId`
4. If positions array is empty → redirect to `/dashboard`
5. Inject `officerPositions` + `orgId` into route context

### Org Route Guard
Applied as `beforeLoad` on:
- `_authenticated/org/$orgSlug/route.tsx`

This guard only handles UUID→slug redirect normalization. It does NOT enforce membership. A non-member authenticated user can reach member org pages (`/org/:slug/home`, `/org/:slug/directory`, etc.).

---

## Position-Based UI Filtering (Officer Sidebar)

File: `src/config/position-nav.ts`

```ts
// UX convenience only — backend requirePosition() is the real security guard
'president': ['MEMBERS', 'FINANCES', 'ACTIVITIES', 'COMMUNICATIONS', 'GOVERNANCE', 'FEEDBACK', 'DOCUMENTS', 'SETTINGS'],
'treasurer': ['FINANCES', 'DOCUMENTS', 'SETTINGS'],
'secretary': ['MEMBERS', 'COMMUNICATIONS', 'FEEDBACK', 'SETTINGS'],
'society officer': ['ACTIVITIES', 'FEEDBACK', 'DOCUMENTS', 'SETTINGS'],
```

- Dashboard section (unlabeled) always visible to all officers
- SETTINGS always visible to all officers
- Unrecognized position titles: fallback shows ALL sections (safety-net behavior)

**Risk**: Unrecognized/typo position title (e.g., `"Vice President"`) shows all officer nav sections to that user. Backend guards must be relied upon in that case — the comment acknowledges this.

---

## Shell-Level Role Display

### `_authenticated.tsx` (AuthenticatedLayout)
- Runs parallel `useQueries` for officer role per org — cached 5 min
- Computes `officerOrgIds: Set<string>`
- Passes `isOfficerForActiveOrg` boolean to `MemberSidebar` (controls "Officer View" link visibility)
- Passes `officerOrgIds` to `OrgIconRail` (controls "Officer" badge on org avatar)

### Double-render Prevention
```ts
const isOfficerRoute = matches.some((m) => m.routeId.includes("/officer"))
if (isOfficerRoute) return <Outlet />
```
Officer routes bypass the member shell and render their own shell via `OfficerLayout`. This prevents layout double-wrapping.

---

## Role Summary Table

| Role | Layout Used | Guard | Officer Nav Visible |
|---|---|---|---|
| Unauthenticated | None | `requireAuth` → redirect | No |
| Authenticated (non-member) | `AuthenticatedLayout` | `requireAuth` | No |
| Member (no officer role) | `AuthenticatedLayout` | `requireAuth` | No |
| Officer (active positions) | `OfficerLayout` | `requireAuth` + `requireOrgOfficer` | Yes (position-filtered) |

---

## Findings

| Severity | Finding | Evidence |
|---|---|---|
| P2 | `org/$orgSlug/route.tsx` has no membership check — any authenticated user can access member org pages | `route.tsx` `beforeLoad` only handles UUID redirect, not membership check |
| P2 | Unrecognized officer position title falls back to showing ALL nav sections | `officer-sidebar.tsx`: `else { sections.forEach(s => allowedSections.add(s.label || '')) }` |
| INFO | Position-based nav filtering is UX-only, not a security boundary | `position-nav.ts` comment: "Backend `requirePosition()` is the real security guard" |
| INFO | `requireOrgOfficer` correctly checks both auth AND role in sequence | `guards.ts` lines 1-2: auth check, then slug resolve, then positions check |
