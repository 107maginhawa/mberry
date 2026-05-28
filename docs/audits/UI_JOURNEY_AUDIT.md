# UI Journey Audit Report

**Phase:** 1.5 (oli-ui-journey)
**Date:** 2026-05-29
**Scope:** `apps/memberry/src/` -- routes, navigation, interactions

---

## Registry 2: Dead Interactions

### UJ-DEAD-01 | P1 | Dues gate banner uses `as any` type escape for Link target
- **File:** `apps/memberry/src/features/dues/components/dues-gate-banner.tsx:33`
- **Code:** `<Link to={\`/org/${orgSlug}/dues\` as any}>`
- **Issue:** Template literal route bypasses TanStack Router type checking. Route exists (`/org/$orgSlug/dues`) but the `as any` cast hides potential breakage if the route is ever renamed. Not a dead link today but a ticking bomb.

### UJ-DEAD-02 | P2 | payment-history-table uses `window.location.assign` instead of router navigation
- **File:** `apps/memberry/src/features/dues/components/payment-history-table.tsx:102`
- **Code:** `onClick={() => orgId && window.location.assign(\`/org/${orgId}/officer/payments/${p.id}\`)}`
- **Issue:** Uses raw `window.location.assign` with `orgId` (UUID) instead of `orgSlug`. The route pattern expects `$orgSlug`, so navigating with a UUID will 404. This is a broken navigation path.

### UJ-DEAD-03 | P2 | Member elections not in member sidebar navigation
- **File:** `apps/memberry/src/components/layout/member-sidebar.tsx`
- **Issue:** Member sidebar org sections have no entry for elections. Routes exist at `/org/$orgSlug/elections/*` and components link to them (voting ballot, election list), but members cannot discover elections from the sidebar. Elections are only reachable via alert banners on dashboard or direct URL.

### UJ-DEAD-04 | P3 | Officer mobile nav missing items present in desktop sidebar
- **Files:** `apps/memberry/src/components/layout/officer-mobile-nav.tsx` vs `officer-sidebar.tsx`
- **Issue:** Mobile nav is missing several items present in desktop sidebar: `institutional-memberships`, `finances` (overview), `finances/invoices`, `finances/members`, `finances/assessments`, `finances/funds`, `messages`, `communications/templates`, `surveys`, `reviews`, `documents`. Mobile officers see a reduced feature set without indication that more exists.

---

## Registry 4: Journey Completion

### UJ-JOURNEY-01 | P1 | Officer sidebar links to `/officer/national-dashboard` -- route does not exist
- **Nav:** Officer sidebar, "National Dashboard" item
- **Route file:** NONE
- **Issue:** Clicking "National Dashboard" in officer sidebar navigates to a route with no matching file. User sees 404. The feature was likely planned (Phase 47b commit messages reference it) but the route file is absent.

### UJ-JOURNEY-02 | P1 | Officer sidebar links to `/officer/settings/profile` -- route does not exist
- **Nav:** Officer mobile nav SETTINGS section, "Org Profile" labeled `settings/profile` in some code paths
- **Route file:** Route exists at `settings/org.tsx`, not `settings/profile.tsx`
- **Issue:** The mobile nav section historically used `settings/profile` in some iterations. Desktop sidebar correctly uses `settings/org`. **Verified:** both desktop and mobile now point to `settings/org`, so this is resolved. Keeping as P3 informational.
- **Revised severity:** P3

### UJ-JOURNEY-03 | P2 | Member bookings journey: no sidebar nav entry
- **Routes:** `/my/bookings`, `/my/bookings/$bookingId`, `/my/bookings/host/$personId`, `/my/bookings/host/$personId/$slotId`
- **Issue:** Complete booking flow exists (4 routes, booking-list, host-directory, booking form) but no sidebar entry. Only reachable via `/my/schedule` or in-page links. Members cannot discover the booking feature.

### UJ-JOURNEY-04 | P2 | Credits log page -- member can create credit entries but no officer approval UI
- **Routes:** `/my/credits/log` has a submit form for self-reported credits
- **Issue:** Members can submit credit log entries, but no officer-facing route exists to review/approve self-reported credits. Journey starts but has no admin completion.

### UJ-JOURNEY-05 | P2 | Member org notifications route mismatch
- **Routes:** `/org/$orgSlug/my-notifications` exists but member sidebar links to `/my/notifications` (personal context)
- **Issue:** Two separate notification pages serve different contexts (personal vs org-scoped), but member sidebar only links to the personal one. Org-specific notification preferences at `my-notifications` are not reachable from org sidebar.

### UJ-JOURNEY-06 | P3 | Duplicate directory pages
- **Routes:** `/org/$orgSlug/directory` AND `/org/$orgSlug/members`
- **Issue:** Both render `DirectorySearch` component. `/org/$orgSlug/directory` is in the sidebar; `/members` is not. The `members` route is reachable from breadcrumbs in some pages. Functional duplicate.

---

## Registry 5: Orphaned Routes

Routes with no sidebar nav entry. Classified by whether in-page links exist.

### Orphaned with in-page links (reachable but not discoverable):

| ID | Severity | Route | In-page refs | Notes |
|----|----------|-------|-------------|-------|
| UJ-NAV-orphan1 | P2 | `/my/bookings` | 12 | Booking feature not in sidebar |
| UJ-NAV-orphan2 | P2 | `/my/billing` | 2 | Payment/billing page, no sidebar |
| UJ-NAV-orphan3 | P2 | `/my/organizations` | 8 | Org list page, no sidebar |
| UJ-NAV-orphan4 | P2 | `/my/payments` | 3 | Payment history, linked from dashboard |
| UJ-NAV-orphan5 | P2 | `/my/training` | 3 | Personal training page, linked from credit-breakdown |
| UJ-NAV-orphan6 | P2 | `/my/notifications` | 4 | Linked from header bell icon + mobile nav |
| UJ-NAV-orphan7 | P3 | `/my/id-card` | 4 | Digital ID card, in-page links exist |
| UJ-NAV-orphan8 | P3 | `/my/data-export` | 2 | GDPR data export |
| UJ-NAV-orphan9 | P3 | `/my/schedule` | 1 | Booking schedule, minimal links |

### Orphaned with NO navigation path:

| ID | Severity | Route | Notes |
|----|----------|-------|-------|
| UJ-NAV-orphan10 | P0 | `/discover/events` | Public event discovery, no link from any authenticated page or landing. Only reachable by direct URL. |
| UJ-NAV-orphan11 | P2 | `/org/$orgSlug/elections/$electionId` | Election detail for members, only reachable from member-election-list which itself is orphaned from sidebar |
| UJ-NAV-orphan12 | P2 | `/org/$orgSlug/elections/$electionId/vote` | Voting page, reachable from alert-banner and election-detail but elections section absent from member sidebar |
| UJ-NAV-orphan13 | P3 | `/org/$orgSlug/my-notifications` | Org notification prefs, no sidebar or in-page link |
| UJ-NAV-orphan14 | P3 | `/org/$orgSlug/members` | Duplicate of `/org/$orgSlug/directory` |

---

## Registry 6: Legacy/Conflicting Routes

### UJ-LEGACY-01 | P3 | `officer/dues/*` redirect stubs alongside `officer/finances/*` canonical routes
- **Files:**
  - `routes/_authenticated/org/$orgSlug/officer/dues/treasurer.tsx` -- redirects to `/officer/finances`
  - `routes/_authenticated/org/$orgSlug/officer/dues/assessments.tsx` -- redirects to `/officer/finances/assessments`
  - `routes/_authenticated/org/$orgSlug/officer/dues/member.$memberId.tsx` -- redirects to `/officer/finances/members/$memberId`
- **Issue:** These are intentional redirect stubs from the old `officer/dues/*` paths to the new `officer/finances/*` structure. Functionally correct but adds 3 route files that exist only as redirects. Low priority cleanup candidate.

### UJ-LEGACY-02 | P3 | Duplicate `invoices.tsx` layout + `invoices/index.tsx` 
- **Files:**
  - `routes/_authenticated/org/$orgSlug/officer/finances/invoices.tsx` (layout, 12.8KB)
  - `routes/_authenticated/org/$orgSlug/officer/finances/invoices/index.tsx` (page, 17.5KB)
- **Issue:** TanStack Router layout convention -- `invoices.tsx` is the layout wrapper, `invoices/index.tsx` is the content. This is valid TanStack Router pattern, NOT a duplicate. No action needed.

### UJ-LEGACY-03 | P2 | `/org/$orgSlug/members` duplicates `/org/$orgSlug/directory`
- **Files:**
  - `routes/_authenticated/org/$orgSlug/members.tsx` -- renders `DirectorySearch`
  - `routes/_authenticated/org/$orgSlug/directory.tsx` -- renders directory with different header
- **Issue:** Two routes serve the same purpose. Sidebar uses `directory`, some breadcrumbs use `members`. Should consolidate to one with redirect from the other.

---

## Summary

| Registry | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| 2: Dead Interactions | 0 | 1 | 2 | 1 | 4 |
| 4: Journey Completion | 0 | 1 | 3 | 2 | 6 |
| 5: Orphaned Routes | 1 | 0 | 7 | 6 | 14 |
| 6: Legacy/Conflicting | 0 | 0 | 1 | 2 | 3 |
| **Total** | **1** | **2** | **13** | **11** | **27** |

### Top Priority Fixes

1. **P0 UJ-NAV-orphan10:** `/discover/events` is completely unreachable -- add link from landing page or dashboard
2. **P1 UJ-JOURNEY-01:** `/officer/national-dashboard` route file missing -- creates 404 from sidebar click
3. **P1 UJ-DEAD-01:** `as any` type cast on dues gate banner Link -- replace with proper typed route
4. **P2 UJ-DEAD-02:** `window.location.assign` with `orgId` instead of `orgSlug` -- will 404 on click
5. **P2 UJ-DEAD-03:** Member elections not discoverable from sidebar -- add elections nav item
6. **P2 UJ-JOURNEY-03:** Bookings feature has 4 routes but zero sidebar presence
