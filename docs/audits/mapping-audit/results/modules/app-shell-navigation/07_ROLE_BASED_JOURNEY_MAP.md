# 07 Role-Based Journey Map — App Shell / Navigation

**Module**: App Shell / Navigation
**Audit Date**: 2026-05-26

---

## Persona Definitions

| Persona | Role | Description |
|---|---|---|
| Guest | Unauthenticated | No session |
| Member | Authenticated, no officer position | Standard member with org membership |
| Officer (President) | Authenticated, president position | Full officer access |
| Officer (Treasurer) | Authenticated, treasurer position | Finance-scoped officer |
| Officer (Secretary) | Authenticated, secretary position | Comms/members-scoped officer |
| Multi-Org Member | Authenticated, member of 2+ orgs | Uses org switcher |

---

## Journey 1: Guest → Dashboard (Login Flow)

```
Guest visits /dashboard
  → _authenticated.tsx beforeLoad → requireAuth fires
  → context.auth.user is null
  → redirect to /auth/sign-in?redirect=/dashboard
  → User fills email + password
  → Better-Auth signIn succeeds
  → onSessionChange: invalidate ['session'] + person query + router.invalidate()
  → Router re-evaluates with new session context
  → requireAuth passes (user now present)
  → AuthenticatedLayout renders
  → MemberSidebar, MemberHeader, OrgIconRail visible
  → User lands on /dashboard
```

**Status**: CORRECT — tested in `auth.spec.ts` (A2 tests)

---

## Journey 2: Member Navigation (Personal)

```
Member on /dashboard
  → MemberSidebar shows PERSONAL_SECTIONS (no orgSlug in URL)
  → Click "Training" → navigate to /my/training
  → Click "Certificates" → navigate to /my/certificates
  → OrgIconRail shows org avatars (fetched via useMyOrgs)
  → Click org avatar → navigate to /org/:orgSlug/home
  → MemberSidebar switches to buildOrgSections(orgSlug)
  → Bottom nav switches from PERSONAL_NAV to buildOrgNav(orgSlug)
```

**Status**: CORRECT — sidebar mode switch is URL-driven, no state bugs possible

---

## Journey 3: Member → Officer View

```
Member with officer position in activeOrg
  → _authenticated.tsx runs officerQueries (parallel per org)
  → officerOrgIds.has(activeOrg.organizationId) = true
  → isOfficerForActiveOrg = true
  → MemberSidebar receives isOfficer=true → shows "Officer View" link
  → Member clicks "Officer View" → navigates to /org/:orgSlug/officer/dashboard
  → officer.tsx beforeLoad: requireOrgOfficer fires
  → Auth check: passes (already authed)
  → Slug resolve: /api/public/org/:slug → orgId
  → Position check: /api/persons/me/officer-role/:orgId → positions.length > 0
  → OfficerContext injected: { officerPositions, orgId }
  → OfficerLayout renders with OfficerSidebar + OfficerMobileNav
  → _authenticated.tsx detects isOfficerRoute = true → returns <Outlet /> only
  → No double shell
```

**Status**: CORRECT — double-render prevention logic confirmed

**Edge case**: Officer visits `/org/:orgSlug/officer/dashboard` directly (cold load)
- `requireOrgOfficer` runs without prior cache
- `['org-by-slug', slug]` fetched fresh
- `['me-officer-role-raw', orgId]` fetched fresh
- Both cached on first visit

---

## Journey 4: Non-Officer Accessing Officer Route

```
Regular member visits /org/:orgSlug/officer/dashboard
  → requireAuth passes (user is authenticated)
  → requireOrgOfficer fires
  → /api/persons/me/officer-role/:orgId returns empty array []
  → positions.length === 0 → redirect to /dashboard
  → MemberSidebar at /dashboard shows personal sections
  → No officer nav visible
```

**Status**: CORRECT — guard redirects correctly

---

## Journey 5: Position-Based Officer Navigation (Treasurer)

```
Treasurer logs in, visits officer dashboard
  → OfficerSidebar receives positions = [{ title: 'Treasurer', ... }]
  → POSITION_NAV_CONFIG['treasurer'] = ['FINANCES', 'DOCUMENTS', 'SETTINGS']
  → allowedSections = { '', 'SETTINGS', 'FINANCES', 'DOCUMENTS' }
  → filteredSections shows: Dashboard, FINANCES, DOCUMENTS, SETTINGS
  → MEMBERS, ACTIVITIES, COMMUNICATIONS, GOVERNANCE, FEEDBACK hidden
```

**Status**: CORRECT (UX filtering) — backend enforces at API level

**Edge case**: Treasurer title stored as "treasurer" vs "Treasurer" in DB
- Guard code: `pos.title.trim().toLowerCase()`
- Config keys are lowercase — normalization is correct

---

## Journey 6: Multi-Org Switching (Desktop)

```
User has 2 orgs: org-a (member), org-b (officer)
  → OrgIconRail shows 2 org avatars
  → Org-a avatar: badge "Member" (no officer position)
  → Org-b avatar: badge "Officer" (officerOrgIds.has(org-b.organizationId) = true)
  → Click org-a → navigate to /org/org-a/home
  → MemberSidebar switches to org-a sections
  → isOfficerForActiveOrg = false (org-a not in officerOrgIds)
  → No officer link in member sidebar
  → Click org-b → navigate to /org/org-b/home
  → isOfficerForActiveOrg = true
  → MemberSidebar shows "Officer View" link
```

**Status**: CORRECT — org-aware officer detection is per-activeOrg

---

## Journey 7: Multi-Org Switching (Mobile)

```
User taps avatar in MemberHeader
  → OrgPickerSheet opens
  → Shows all orgs with status dots and role badges
  → Taps org → handleSelectOrg → navigate(/org/:slug/home) + close sheet
```

**Status**: CORRECT

---

## Journey 8: Session Expiry

```
User session expires mid-session
  → Any navigation to protected route triggers beforeLoad
  → requireAuth: context.auth.user is null (session invalidated)
  → redirect to /auth/sign-in?redirect=<current-path>
  → User re-authenticates
  → onSessionChange → router.invalidate()
  → User returned to original path
```

**Status**: CORRECT — redirect param preserves destination

**Gap**: ErrorBoundary catches 401 errors in component renders but does not redirect to sign-in. It shows "Your session has expired. Please sign in again." message with a Retry button. Retry re-renders the component without re-authenticating — user must manually navigate to sign-in.

---

## Journey 9: org UUID in URL (Legacy Link)

```
User visits /org/ed8e3a96-.../home (UUID-style)
  → org/$orgSlug/route.tsx beforeLoad fires
  → UUID_RE.test(params.orgSlug) = true
  → getOrganization({ path: { organizationId: uuid } }) called
  → org.slug resolved → redirect to /org/pda-metro-manila/home
  → New URL renders normally
```

**Status**: CORRECT

---

## Dead Ends / Missing States

| Journey | Gap | Severity |
|---|---|---|
| Error boundary 401 | Shows error message but no auto-redirect to sign-in | P2 |
| `/join` destination | OrgIconRail and OrgPickerSheet both link to `/join` — route may not exist | P2 |
| Org route (member-only orgs) | No membership check on `/org/:orgSlug/*` — non-member can access member pages | P2 |
| Officer with unknown position | Sees all nav sections (fallback) | P2 |
| OfficerMobileNav drawer | Does not close after link navigation | P2 |
