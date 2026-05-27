# Audit 04 — Frontend Interaction Integrity
## Module: Admin/Platform (`apps/admin`)
**Date:** 2026-05-26
**Auditor:** Claude Code (claude-sonnet-4-6)
**Branch:** audit/codebase-improvements

---

## Executive Summary

The Admin app has **23 routes**, **26 backend handler files**, and **8 E2E spec files**. Core CRUD interactions (associations, operators, impersonation) are wired correctly through the SDK. However, four significant broken interactions exist, three routes use raw `fetch` instead of SDK hooks (bypassing type safety), two placeholder pages ship non-functional UI, and E2E coverage misses every write mutation. The backend `platformAdminAuthMiddleware` verifies admin existence but does NOT enforce sub-roles — all sub-role gates are frontend-only.

**Gate 4 Result: FAIL** — 4 broken interactions, 2 placeholder pages with fake data, E2E coverage of mutations = 0%.

---

## 1. Interaction Registry

All user-triggerable interactions catalogued by page.

| ID | Page | Route | Interaction | Type | SDK Hook / Fetch | Has Backend |
|----|------|-------|-------------|------|-----------------|-------------|
| I-01 | Dashboard | `/` | View stat cards (6 metrics) | Read | `listAssociationsOptions`, `listOrganizationsOptions`, `listAdminsOptions`, `listFeatureFlagsOptions`, `searchEventsOptions`, `listAuditLogsOptions` | Yes |
| I-02 | Dashboard | `/` | Click Quick Action: "Manage Operators" → `/operators` | Navigate | `<Link>` | N/A |
| I-03 | Dashboard | `/` | Click Quick Action: "Feature Flags" → `/feature-flags` | Navigate | `<Link>` | N/A |
| I-04 | Dashboard | `/` | Click Quick Action: "Impersonate User" → `/impersonate` | Navigate | `<Link>` | N/A |
| I-05 | Dashboard | `/` | Click Quick Action: "Member Lookup" → `/members` | Navigate | `<Link>` | N/A |
| I-06 | Dashboard | `/` | Click "View all →" → `/audit` | Navigate | `<Link>` | N/A |
| I-07 | Dashboard | `/` | Click "Refresh" button | Reload | `window.location.reload()` | N/A |
| I-08 | Associations | `/associations` | List associations table | Read | `listAssociationsOptions` | Yes |
| I-09 | Associations | `/associations` | Click "Create Association" button → open dialog | UI State | `useState` | N/A |
| I-10 | Associations | `/associations` | Submit Create Association form (name, country, currency) | Write | `createAssociationMutation` | Yes |
| I-11 | Associations | `/associations` | Click row → navigate to detail | Navigate | `<Link>` | N/A |
| I-12 | Association Detail | `/associations/$associationId` | Load association details | Read | `getAssociationOptions` | Yes |
| I-13 | Association Detail | `/associations/$associationId` | Click "Edit Association" → inline edit form | UI State | `useState` | N/A |
| I-14 | Association Detail | `/associations/$associationId` | Submit edit form (name, country, currency) | Write | `updateAssociationMutation` | Yes |
| I-15 | Association Detail | `/associations/$associationId` | Click "Delete" → confirmation dialog | UI State | `useState(confirmDelete)` | N/A |
| I-16 | Association Detail | `/associations/$associationId` | Confirm delete → delete association | Write | `deleteAssociationMutation` | Yes |
| I-17 | Association Detail | `/associations/$associationId` | Load orgs for this association | Read | `listOrganizationsOptions` | Yes |
| I-18 | Association Detail | `/associations/$associationId` | Load Chapter Health KPIs | Read | Raw `fetch /api/admin/national-dashboard/:id` | Yes (hand-wired) |
| I-19 | Association Detail | `/associations/$associationId` | Load recent events | Read | `searchEventsOptions` | Yes |
| I-20 | Association Detail | `/associations/$associationId` | Load recent training | Read | `searchCoursesOptions` | Yes |
| I-21 | Association Detail | `/associations/$associationId` | Click "Add Organization" button | Write | **STUB — no handler attached** | No |
| I-22 | Organizations | `/organizations` | List organizations table | Read | `listOrganizationsOptions` | Yes |
| I-23 | Organizations | `/organizations` | Click "Create Organization" button | Write | **STUB — no dialog/mutation** | No |
| I-24 | Organizations | `/organizations` | Click row / "View" link → detail | Navigate | `<Link>` | N/A |
| I-25 | Org Detail | `/organizations/$organizationId` | Load organization details + members | Read | `getOrganizationOptions` | Yes |
| I-26 | Org Detail | `/organizations/$organizationId` | Click "Edit Organization" button | Write | **STUB — no dialog/mutation** | No |
| I-27 | Org Detail | `/organizations/$organizationId` | View status transition dropdown | Write | **STUB — no mutation connected** | Partial (handler exists) |
| I-28 | Operators | `/operators` | List admins | Read | `listAdminsOptions` | Yes |
| I-29 | Operators | `/operators` | Click "Invite Operator" → open InviteDialog | UI State | `useState` | N/A |
| I-30 | Operators | `/operators` | Submit invite form (name, email, role) | Write | `inviteAdminMutation` | Yes |
| I-31 | Operators | `/operators` | Click trash icon → inline revoke confirm | UI State | `useState(revokeTarget)` | N/A |
| I-32 | Operators | `/operators` | Confirm revoke → revoke admin | Write | `revokeAdminMutation` | Yes |
| I-33 | Feature Flags | `/feature-flags` | List feature flags | Read | `listFeatureFlagsOptions` | Yes |
| I-34 | Feature Flags | `/feature-flags` | Click "Create Flag" → open CreateFlagDialog | UI State | `useState` | N/A |
| I-35 | Feature Flags | `/feature-flags` | Submit create flag form (targetType, targetId, moduleName, enabled) | Write | `setFeatureFlagMutation` | Yes |
| I-36 | Feature Flags | `/feature-flags` | Click trash → delete flag | Write | `deleteFeatureFlagMutation` | Yes |
| I-37 | Impersonate | `/impersonate` | Load organizations list | Read | `listOrganizationsOptions` | Yes |
| I-38 | Impersonate | `/impersonate` | Type in search box (min 2 chars) | Filter | Client-side filter | N/A |
| I-39 | Impersonate | `/impersonate` | Click "Impersonate" for a member | Write | `startImpersonationApi` (sdk.gen direct) | Yes |
| I-40 | Impersonate | `/impersonate` | Click "End Session" on active banner | Write | `endImpersonationApi` (sdk.gen direct) | Yes |
| I-41 | Members | `/members` | Load orgs | Read | `listOrganizationsOptions` | Yes |
| I-42 | Members | `/members` | Load roster per org (N queries) | Read | `listRosterMembersOptions` (useQueries) | Yes |
| I-43 | Members | `/members` | Search by name/email (min 2 chars) | Filter | Client-side filter | N/A |
| I-44 | Members | `/members` | Filter by org dropdown | Filter | Client-side filter | N/A |
| I-45 | Members | `/members` | Click member name → `/members/$personId` | Navigate | `<Link>` | N/A |
| I-46 | Member Detail | `/members/$personId` | (File exists but content TBD) | Read | Unknown | Unknown |
| I-47 | National Dashboard | `/national-dashboard` | Load associations list | Read | `listAssociationsOptions` | Yes |
| I-48 | National Dashboard | `/national-dashboard` | Select association dropdown | Filter | `useState` | N/A |
| I-49 | National Dashboard | `/national-dashboard` | Select snapshot month | Filter | `useState` | N/A |
| I-50 | National Dashboard | `/national-dashboard` | Load chapter metrics | Read | Raw `fetch /api/admin/national-dashboard/:id` | Yes (hand-wired) |
| I-51 | Committees | `/committees` | Load committees | Read | Raw `fetch /api/admin/committees` | Yes (hand-wired) |
| I-52 | Committees | `/committees` | Search committees (client-side, min 2 chars) | Filter | Client-side filter | N/A |
| I-53 | Committees | `/committees` | Paginate results | Paginate | Client-side slice | N/A |
| I-54 | Audit | `/audit` | Load audit logs | Read | `listAuditLogsOptions` | Yes |
| I-55 | Audit | `/audit` | Filter: action select | Filter | `useState` + re-query | N/A |
| I-56 | Audit | `/audit` | Filter: resourceType input | Filter | `useState` + re-query | N/A |
| I-57 | Audit | `/audit` | Filter: date range inputs | Filter | `useState` + re-query | N/A |
| I-58 | Audit | `/audit` | Filter: user ID input | Filter | `useState` + re-query | N/A |
| I-59 | Audit | `/audit` | Click "Refresh" button | Re-fetch | `refetch()` | N/A |
| I-60 | Audit | `/audit` | Paginate (Previous/Next) | Paginate | `setPage` + re-query | N/A |
| I-61 | Training | `/training` | Load courses | Read | `searchCoursesOptions` | Yes |
| I-62 | Training | `/training` | Search courses (min 2 chars) | Filter | Query param re-fetch | N/A |
| I-63 | Training | `/training` | Paginate | Paginate | `setPage` + re-query | N/A |
| I-64 | Events | `/events` | Load events | Read | `searchEventsOptions` | Yes |
| I-65 | Events | `/events` | Search events (min 2 chars) | Filter | Query param re-fetch | N/A |
| I-66 | Events | `/events` | Filter: status dropdown | Filter | Query param re-fetch | N/A |
| I-67 | Events | `/events` | Filter: org dropdown | Filter | Query param re-fetch | N/A |
| I-68 | Events | `/events` | Click row → side Sheet with details/registrations | UI State | `useState(selectedEvent)` | N/A |
| I-69 | Events | `/events` | Tab: "Registrations" in Sheet | Read | `listCustomEventRegistrationsOptions` | Yes |
| I-70 | Surveys | `/surveys` | Load surveys | Read | Raw `fetch /api/admin/surveys` | Yes (hand-wired) |
| I-71 | Surveys | `/surveys` | Filter: status, type | Filter | Re-fetch | N/A |
| I-72 | Surveys | `/surveys` | Paginate | Paginate | Re-fetch | N/A |
| I-73 | Surveys | `/surveys` | Click "Refresh" | Re-fetch | `refetch()` | N/A |
| I-74 | Communications | `/communications` | View broadcast stat cards (hardcoded values) | Read | **HARDCODED** — no API call | No |
| I-75 | Communications | `/communications` | "Send Platform Broadcast" form | Write | **STUB — placeholder text only** | No |
| I-76 | Comm. Templates | `/communications/templates` | View templates | Read | **STUB — empty state always** | No |
| I-77 | Comm. Templates | `/communications/templates` | Click "New Template" button | Write | **STUB — no handler** | No |
| I-78 | Comm. Moderation | `/communications/moderation` | View flagged content | Read | Unknown (TBD) | Unknown |
| I-79 | Comm. Email | `/communications/email` | View email queue | Read | Unknown (TBD) | Unknown |
| I-80 | Verifications | `/verifications` | View page | Read | **STUB — "Coming Soon"** | No |
| I-81 | Compliance | `/compliance` | View page | Read | Unknown (TBD) | Unknown |

---

## 2. Interaction Validation Matrix

| ID | Interaction | Form Validation | Error Handling | Loading State | Empty State | Success Feedback |
|----|-------------|-----------------|----------------|---------------|-------------|-----------------|
| I-10 | Create Association | `required` on name, maxLength+pattern on country/currency | `toast.error` | `isPending` disables button | N/A | `toast.success` |
| I-14 | Update Association | Input fields only (no required attr visible) | `toast.error` | `isPending` disables button | N/A | `toast.success` |
| I-16 | Delete Association | Confirmation dialog (text confirmation only) | `toast.error` | `isPending` disables button | N/A | `toast.success` + navigate |
| I-23 | Create Organization | **NONE** — button renders but no dialog exists | N/A | N/A | N/A | N/A |
| I-26 | Edit Organization | **NONE** — button renders but no form attached | N/A | N/A | N/A | N/A |
| I-30 | Invite Admin | `!email \|\| !name` disables button | `toast.error` | `isPending` disables button | N/A | `toast.success` |
| I-32 | Revoke Admin | Inline "Revoke?" confirm (Yes/No) | `toast.error` | `isPending` on Yes | N/A | `toast.success` |
| I-35 | Create Feature Flag | `required` fields via form state | `toast.error` | `isPending` disables button | N/A | `toast.success` |
| I-36 | Delete Feature Flag | **No confirmation dialog** — immediate delete | `toast.error` | N/A | N/A | `toast.success` |
| I-39 | Start Impersonation | Min 2-char search to show members | `toast.error` | `isPending` disables button | "No members" state | `toast.success` |
| I-40 | End Impersonation | Active session banner with End button | `toast.error` | N/A | N/A | `toast.success` |
| I-75 | Broadcast Form | **STUB** — no fields exist | N/A | N/A | N/A | N/A |
| I-77 | New Template | **STUB** — button exists, no handler | N/A | N/A | N/A | N/A |

---

## 3. Broken Interaction Report

### BUG-01 [P1] — "Create Organization" button is non-functional
**File:** `apps/admin/src/routes/organizations/index.tsx`
**Evidence:** `<Button>` with `<Plus>` and "Create Organization" label renders with no `onClick` handler, no `useState` for dialog, no mutation import. The button is completely inert.
**Impact:** Operators cannot create organizations from the UI at all. The backend handler `createOrganization` exists and is wired.
**Severity:** P1 — core write path missing.

### BUG-02 [P1] — "Edit Organization" button is non-functional
**File:** `apps/admin/src/routes/organizations/$organizationId.tsx`
**Evidence:** `<Button variant="outline"><Pencil/> Edit Organization</Button>` renders with no `onClick`, no edit state, no form, no mutation. The `updateOrganization` SDK mutation exists.
**Impact:** Organization edits require direct API calls. No admin UX path exists.
**Severity:** P1 — core write path missing.

### BUG-03 [P1] — Dashboard Quick Actions not role-filtered
**File:** `apps/admin/src/routes/index.tsx`
**Evidence:**
```typescript
const quickActions = [
  { to: '/operators', label: 'Manage Operators', ... },
  { to: '/feature-flags', label: 'Feature Flags', ... },
  { to: '/impersonate', label: 'Impersonate User', ... },
  { to: '/members', label: 'Member Lookup', ... },
] as const
// Rendered without any role check:
{quickActions.map((action) => (
  <Link key={action.to} to={action.to} ...>
```
`/operators`, `/feature-flags`, and `/impersonate` are all `super`-only per `ROUTE_ROLES`. A `support` or `analyst` admin sees these quick-action cards and can click them, landing on a `RequireRole` access-denied wall — confusing UX, discloses route existence.
**Severity:** P1 UX + information disclosure.

### BUG-04 [P2] — "Add Organization" button inside Association Detail is non-functional stub
**File:** `apps/admin/src/routes/associations/$associationId.tsx`
**Evidence:**
```tsx
<Button variant="outline" size="sm">
  <Plus className="w-4 h-4" />
  Add Organization
</Button>
```
No `onClick`, no mutation. Unlike BUG-01, this is a secondary action on a detail page (lower impact) but still ships broken UI.
**Severity:** P2 — secondary write path missing.

### BUG-05 [P2] — Feature Flag delete has no confirmation
**File:** `apps/admin/src/routes/feature-flags/index.tsx`
**Evidence:** Delete button per row fires `deleteFeatureFlagMutation` immediately on click with no confirmation dialog. Feature flags affect module availability globally.
**Severity:** P2 — destructive action without guard.

### BUG-06 [P2] — Communications page ships hardcoded fake data
**File:** `apps/admin/src/routes/communications/index.tsx`
**Evidence:**
```tsx
<StatCard title="Broadcasts Sent" value="34" trend="This month" icon={Send} />
<StatCard title="Total Recipients" value="1,247" icon={Radio} />
<StatCard title="Email Queue" value="12" trend="Pending" icon={Mail} />
<StatCard title="Flagged Content" value="5" trend="Pending review" icon={ShieldAlert} />
```
All four stat values are hardcoded strings. No API calls. The broadcast form section is a `<p>` placeholder. This page is accessible to `super` and `support` roles and presents fabricated operational data.
**Severity:** P2 — fabricated data shown as real.

### BUG-07 [P2] — Communications Templates page is a complete stub
**File:** `apps/admin/src/routes/communications/templates.tsx`
**Evidence:** "New Template" button has no `onClick`. Template list is always the empty state card. The page renders inside `RequireRole(['super'])` — a super admin clicking "New Template" gets no response.
**Severity:** P2 — gated write path is non-functional.

### BUG-08 [P3] — Organization status transition visible with no mutation
**File:** `apps/admin/src/routes/organizations/$organizationId.tsx`
**Evidence:** Based on the described interaction and context from the audit brief (status transition dropdown: trial→active→suspended→cancelled), and the backend `transitionOrgStatus.ts` handler exists. Investigation shows the org detail page renders an "Edit Organization" button stub but the status dropdown mutation is not wired. [NEEDS VERIFICATION — detail route read was partial; org detail file may have more content not captured]
**Severity:** P3 — deferred to full org-detail read.

---

## 4. Role-Aware Interaction Matrix

Backend `platformAdminAuthMiddleware` only checks existence in `platform_admin` table — does NOT check the sub-role (`super`/`support`/`analyst`). Sub-role enforcement is **frontend-only** via `RequireRole`.

| Route | ROUTE_ROLES | RequireRole in Component | Backend Sub-Role Check | Gap |
|-------|------------|--------------------------|----------------------|-----|
| `/` | all | None | None | Quick actions link to super-only pages (BUG-03) |
| `/associations` | all | None | None | None |
| `/associations/$id` | all | None | None | None — but delete/update are sensitive ops |
| `/organizations` | all | None | None | None |
| `/organizations/$id` | all | None | None | Edit/status mutation stubs |
| `/operators` | super | `RequireRole(['super'])` | None | FE-only gate |
| `/feature-flags` | super | `RequireRole(['super'])` | None | FE-only gate |
| `/impersonate` | super | `RequireRole(['super'])` | Backend checks `['super','support']` via `IMPERSONATION_ALLOWED_ROLES` | **MISMATCH** — FE restricts to super; BE allows support |
| `/members` | all | None | None | None |
| `/national-dashboard` | all | `RequireRole(['super','support','analyst'])` | None | FE-only gate |
| `/committees` | super+support | `RequireRole(['super','support'])` | None | FE-only gate |
| `/audit` | super+support | `RequireRole(['super','support'])` | None | FE-only gate |
| `/training` | all | `RequireRole(['super','support','analyst'])` | None | FE-only gate |
| `/events` | super+support | `RequireRole(['super','support'])` | None | FE-only gate |
| `/surveys` | all | `RequireRole(['super','support','analyst'])` | None | FE-only gate |
| `/verifications` | super+support | `RequireRole(['super','support'])` | None | FE-only gate |
| `/compliance` | super+support+analyst | None visible | None | Unclear |
| `/communications` | super+support | `RequireRole(['super','support'])` | None | FE-only gate |
| `/communications/templates` | super | `RequireRole(['super'])` | None | FE-only gate |
| `/communications/moderation` | super+support | Unknown | None | Unclear |
| `/communications/email` | super+support+analyst | Unknown | None | Unclear |

**Key finding:** All sub-role enforcement is frontend-only. A `support` admin who knows the API endpoints can directly call `/admin/admins` (invite operator), `/admin/feature-flags`, etc. and the backend will accept the request.

**Impersonation mismatch (from Audit 02):**
- Frontend gate: `RequireRole(['super'])` — support cannot reach `/impersonate`
- Backend handler: `IMPERSONATION_ALLOWED_ROLES = ['super', 'support']` — support would be allowed
- This is a **design inconsistency**: either the frontend should allow support, or the backend should restrict to super only. Currently the tighter frontend gate is the effective policy, but the backend intent is wider.

---

## 5. Frontend/Backend Interaction Mapping

| Interaction | Frontend Hook/API | Backend Handler | Handler File | Wired In |
|-------------|-------------------|-----------------|--------------|----------|
| List associations | `listAssociationsOptions` | `listAssociations` | `platformadmin/listAssociations.ts` | OpenAPI generated |
| Create association | `createAssociationMutation` | `createAssociation` | `platformadmin/createAssociation.ts` | OpenAPI generated |
| Get association | `getAssociationOptions` | `getAssociation` | `platformadmin/getAssociation.ts` | OpenAPI generated |
| Update association | `updateAssociationMutation` | `updateAssociation` | `platformadmin/updateAssociation.ts` | OpenAPI generated |
| Delete association | `deleteAssociationMutation` | `deleteAssociation` | `platformadmin/deleteAssociation.ts` | OpenAPI generated |
| List orgs | `listOrganizationsOptions` | `listOrganizations` | `platformadmin/listOrganizations.ts` | OpenAPI generated |
| Create org | **STUB — no frontend** | `createOrganization` | `platformadmin/createOrganization.ts` | OpenAPI generated |
| Get org | `getOrganizationOptions` | `getOrganization` | `platformadmin/getOrganization.ts` | OpenAPI generated |
| Update org | **STUB — no frontend** | `updateOrganization` | `platformadmin/updateOrganization.ts` | OpenAPI generated |
| Transition org status | **STUB — no frontend mutation** | `transitionOrgStatus` | `platformadmin/transitionOrgStatus.ts` | OpenAPI generated |
| List admins | `listAdminsOptions` | `listAdmins` | `platformadmin/listAdmins.ts` | OpenAPI generated |
| Invite admin | `inviteAdminMutation` | `inviteAdmin` | `platformadmin/inviteAdmin.ts` | OpenAPI generated |
| Revoke admin | `revokeAdminMutation` | `revokeAdmin` | `platformadmin/revokeAdmin.ts` | OpenAPI generated |
| Get admin role | `getAdminRole` (sdk.gen) | `getAdminRole` | `platformadmin/getAdminRole.ts` | OpenAPI generated |
| List feature flags | `listFeatureFlagsOptions` | `listFeatureFlags` | `platformadmin/listFeatureFlags.ts` | OpenAPI generated |
| Set feature flag | `setFeatureFlagMutation` | `setFeatureFlag` | `platformadmin/setFeatureFlag.ts` | OpenAPI generated |
| Delete feature flag | `deleteFeatureFlagMutation` | `deleteFeatureFlag` | `platformadmin/deleteFeatureFlag.ts` | OpenAPI generated |
| Start impersonation | `startImpersonationApi` (sdk.gen) | `startImpersonation` | `platformadmin/startImpersonation.ts` | OpenAPI generated |
| End impersonation | `endImpersonationApi` (sdk.gen) | `endImpersonation` | `platformadmin/endImpersonation.ts` | OpenAPI generated |
| List roster members | `listRosterMembersOptions` | `listRosterMembers` | `association:member` module | OpenAPI generated |
| Search events | `searchEventsOptions` | `searchEvents` | `events` module | OpenAPI generated |
| Search courses | `searchCoursesOptions` | `searchCourses` | `training` module | OpenAPI generated |
| List audit logs | `listAuditLogsOptions` | `listAuditLogs` | `audit` module | OpenAPI generated |
| List event registrations | `listCustomEventRegistrationsOptions` | `listCustomEventRegistrations` | `events` module | OpenAPI generated |
| National dashboard | Raw `fetch /api/admin/national-dashboard/:id` | `getNationalDashboard` | `platformadmin/getNationalDashboard.ts` | Hand-wired (`app.ts:203`) |
| List all committees | Raw `fetch /api/admin/committees` | `listAllCommittees` | `platformadmin/listAllCommittees.ts` | Hand-wired (`app.ts:204`) |
| List admin surveys | Raw `fetch /api/admin/surveys` | `listAdminSurveys` | `platformadmin/listAdminSurveys.ts` | Hand-wired (`app.ts:330`) |
| Platform broadcasts | **STUB — no API** | None | None | Not implemented |
| Platform templates | **STUB — no API** | None | None | Not implemented |
| Verifications | **"Coming Soon" — no API** | None | None | Not implemented |

**Raw fetch anomalies (not using SDK):**
1. `apps/admin/src/routes/national-dashboard/index.tsx` — uses raw `fetch` for `/api/admin/national-dashboard/:id`
2. `apps/admin/src/routes/associations/$associationId.tsx` — uses raw `fetch` for chapter health KPIs (same endpoint)
3. `apps/admin/src/routes/committees/index.tsx` — uses raw `fetch` for `/api/admin/committees?limit=100`
4. `apps/admin/src/routes/surveys/index.tsx` — uses raw `fetch` for `/api/admin/surveys`

These are hand-wired routes with no SDK coverage. No generated types, no automatic auth token injection via SDK transport, no request/response type safety.

---

## 6. E2E Interaction Coverage Matrix

| Interaction | Type | E2E Spec | Test Approach | Verdict |
|-------------|------|----------|---------------|---------|
| I-08 List associations | Read | `associations.spec.ts` | Table visible or empty state | WEAK — table presence only |
| I-10 Create association | Write | `associations.spec.ts` | API POST via `request.post`, then table visible | PARTIAL — uses API directly, not UI flow |
| I-16 Delete association | Write | `associations.spec.ts` | API DELETE via `request.delete`, then name not in table | PARTIAL — API-only, no UI delete click |
| I-22 List organizations | Read | `organizations.spec.ts` | Table visible | WEAK — presence only |
| I-23 Create org (stub) | Write | None | — | MISSING |
| I-28 List admins | Read | `admin-routes.spec.ts` | Page load only | WEAK |
| I-30 Invite admin | Write | None | — | MISSING |
| I-32 Revoke admin | Write | None | — | MISSING |
| I-33 List feature flags | Read | `admin-routes.spec.ts` | Page load only | WEAK |
| I-35 Create feature flag | Write | None | — | MISSING |
| I-36 Delete feature flag | Write | None | — | MISSING |
| I-39 Start impersonation | Write | None | — | MISSING |
| I-40 End impersonation | Write | None | — | MISSING |
| I-41–44 Members search/filter | Read+Filter | `members.spec.ts` | Table and search visible | WEAK |
| I-54 List audit logs | Read | `audit.spec.ts` | Table visible, filter inputs present | MODERATE |
| I-55–60 Audit filters/pagination | Filter | `audit.spec.ts` | Filter inputs visible | WEAK — no filter+result validation |
| I-61–63 Training | Read | `wave7-routes.spec.ts` | Heading + search input visible | WEAK |
| I-64–69 Events | Read | `wave7-routes.spec.ts` | Heading + stat cards visible | WEAK |
| I-70–73 Surveys | Read | None | — | MISSING |
| I-01 Dashboard stat cards | Read | `wave7-routes.spec.ts` | Recent Activity heading visible | WEAK |
| I-02–06 Quick actions | Navigate | None (BUG-03 untested) | — | MISSING + BUG UNTESTED |
| I-47–50 National Dashboard | Read | `wave7-routes.spec.ts` | Association selector visible | WEAK |
| I-51–53 Committees | Read | `wave7-routes.spec.ts` | Stats + search visible | WEAK |
| I-74–75 Communications | Placeholder | None | — | MISSING |
| I-80 Verifications (stub) | Placeholder | None | — | MISSING |

**E2E coverage summary:**
- **Write mutations tested via UI click**: 0 of 12 write interactions
- **Write mutations tested via API call**: 2 (create/delete association — API-only, not UI)
- **Read interactions**: 13 tested (mostly page-load only, weak assertions)
- **Role-gated write paths tested by role**: 0
- **Broken interactions caught by tests**: 0 (BUG-01, BUG-02, BUG-03, BUG-04 all untested)

---

## 7. Accessibility Interaction Matrix

Evaluated based on source code patterns. No automated a11y run performed.

| ID | Interaction | ARIA Labels | Keyboard Accessible | Focus Management | Screen Reader | Issues |
|----|-------------|-------------|---------------------|-----------------|---------------|--------|
| I-09 | Open Create Association dialog | Modal uses fixed overlay | Close button has `aria-label="Close"` | Focus not explicitly trapped | No `role="dialog"` on modal div | No `aria-modal`, no focus trap |
| I-10 | Submit Create Association | Form with `<form onSubmit>` | Enter key submits | N/A | Implicit | OK |
| I-15 | Open delete confirm | Same fixed overlay | No `aria-label` on trigger (Delete button has icon only) | No focus trap | No `role="dialog"` | Trash icon button lacks label |
| I-29 | Open Invite dialog | Same fixed overlay | Close button has `aria-label="Close"` | No focus trap | No `role="dialog"` | No focus trap |
| I-31 | Revoke inline confirm | Inline expand (no modal) | Tab accessible | No focus change | Confirm text visible | OK |
| I-34 | Open Create Flag dialog | Same fixed overlay | Close button has `aria-label="Close"` | No focus trap | No `role="dialog"` | No focus trap |
| I-36 | Delete feature flag | Icon button (Trash2) | No `aria-label` on delete row button | N/A | Silent | **Missing aria-label** |
| I-39 | Start impersonation | Button with text "Impersonate" | Tab accessible | N/A | OK | None |
| I-55 | Audit action select | `<Select>` component | Keyboard via Radix | N/A | OK | None |
| I-07 | Refresh | `<Button>` with icon + text | Tab accessible | N/A | OK | None |
| Error states | Various | `role="alert" aria-live="polite"` present on error `<p>` tags | N/A | N/A | Good | Consistent pattern |

**Pattern finding:** All modal dialogs (`CreateAssociationDialog`, `InviteDialog`, `CreateFlagDialog`, `ConfirmDelete`) use custom `div` overlays with no `role="dialog"`, no `aria-modal="true"`, and no focus trap. Keyboard users can tab outside the modal. Screen readers won't identify these as dialogs.

**Mobile gate:** `MobileGate` component blocks sub-`lg` screens with a full-page overlay. Admin is desktop-only by design — documented.

---

## 8. Missing Test Matrix

Highest-priority missing tests for the Admin/Platform module:

| Priority | What to Test | Test Type | Spec File (suggested) | Why |
|----------|-------------|-----------|----------------------|-----|
| P0 | BUG-01: Create Organization button fires no action | E2E | `organizations.spec.ts` | Core write path broken |
| P0 | BUG-02: Edit Organization button fires no action | E2E | `organizations.spec.ts` | Core write path broken |
| P0 | BUG-03: Quick actions shown to non-super roles | E2E | `admin-smoke.spec.ts` | Role disclosure |
| P1 | Invite admin via UI (form fill + submit) | E2E | `operators.spec.ts` (new) | Write mutation untested |
| P1 | Revoke admin via UI (click trash → confirm Yes) | E2E | `operators.spec.ts` (new) | Write mutation untested |
| P1 | Create feature flag via UI dialog | E2E | `feature-flags.spec.ts` (new) | Write mutation untested |
| P1 | Delete feature flag — no confirmation fires immediately | E2E | `feature-flags.spec.ts` (new) | Destructive without guard |
| P1 | Start impersonation session | E2E | `impersonate.spec.ts` (new) | Write mutation + role gate untested |
| P1 | End impersonation session | E2E | `impersonate.spec.ts` (new) | Write mutation untested |
| P1 | Create association via UI dialog (not API) | E2E | `associations.spec.ts` | Existing test uses API, not UI |
| P2 | Audit filter by action → results change | E2E | `audit.spec.ts` | Filter effectiveness untested |
| P2 | Audit date range filter | E2E | `audit.spec.ts` | Filter effectiveness untested |
| P2 | Audit pagination Previous/Next | E2E | `audit.spec.ts` | Pagination untested |
| P2 | National dashboard: select assoc → chapter table loads | E2E | `wave7-routes.spec.ts` | Conditional load untested |
| P2 | Member search min-2-char triggers results | E2E | `members.spec.ts` | Filter behavior untested |
| P2 | Events sheet opens on row click | E2E | `events.spec.ts` (new) | Sheet interaction untested |
| P2 | Registrations tab in events sheet loads | E2E | `events.spec.ts` (new) | Nested query untested |
| P2 | Surveys page loads real data (not stub) | E2E | `surveys.spec.ts` (new) | Currently no test at all |
| P3 | Modal focus trap (a11y) | Unit/a11y | New | No focus trap in any dialog |
| P3 | Dashboard stat cards show non-zero counts when data exists | E2E | `admin-smoke.spec.ts` | Currently not asserted |
| P3 | Support role: /operators access denied gracefully | E2E | `role-gate.spec.ts` (new) | FE gate only, no test |
| P3 | Analyst role: sidebar hides super-only items | E2E | `role-gate.spec.ts` (new) | ROUTE_ROLES filtering untested |

---

## 9. Product Decisions Needed

### PD-01 [NEEDS PRODUCT DECISION] — Impersonation: super-only or super+support?
**Context:** Frontend `RequireRole(['super'])` blocks support from `/impersonate`. Backend `IMPERSONATION_ALLOWED_ROLES = ['super', 'support']` would allow it. Which is correct?
- Option A: Support can impersonate → update frontend to `RequireRole(['super','support'])`
- Option B: Super only → update backend constant to `['super']`
**File pair:** `apps/admin/src/routes/impersonate/index.tsx` + `services/api-ts/src/handlers/platformadmin/startImpersonation.ts`

### PD-02 [NEEDS PRODUCT DECISION] — Backend sub-role enforcement: add or by-design absent?
**Context:** Backend only checks `platform_admin` table membership, not sub-roles. A support admin can call `/admin/admins` (invite), `/admin/feature-flags` (create/delete), `/admin/impersonate` (start) if they bypass the frontend.
- Option A: Add sub-role middleware checks per endpoint → true RBAC
- Option B: Accept frontend-only enforcement → document as known limitation

### PD-03 [NEEDS PRODUCT DECISION] — Communications and Templates: stub or remove?
**Context:** `/communications` shows fake stat values (34 broadcasts, 1,247 recipients — hardcoded). `/communications/templates` is always empty. Both are gated by `RequireRole`.
- Option A: Remove from sidebar + ROUTE_ROLES until implemented
- Option B: Show real data / partial implementation
- Option C: Replace hardcoded values with `--` or "N/A" placeholders until API is wired

### PD-04 [NEEDS PRODUCT DECISION] — Feature flag delete: confirmation dialog required?
**Context:** Delete fires immediately on trash click — no confirm. Feature flags affect module availability globally (per-org or per-association).
- Option A: Add confirmation dialog (consistent with association delete)
- Option B: Keep immediate delete (flag can be re-created)

### PD-05 [NEEDS PRODUCT DECISION] — "Add Organization" from Association Detail: scope?
**Context:** Button exists in association detail page but is a stub. Should this navigate to Organizations page with association pre-selected, or open an inline dialog?
- Option A: Link to `/organizations` with `?associationId=` param
- Option B: Inline create-org dialog (mirrors create-association pattern)

---

## 10. Gate 4 Evaluation

### Evaluation Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All interactions map to backend handlers | FAIL | 3 write stubs (BUG-01, 02, 04), 2 placeholder pages (BUG-06, 07) |
| Write mutations have error + success feedback | PARTIAL | Implemented mutations: OK. Stub buttons: N/A |
| Role gates enforced at interaction level (not just page) | FAIL | Quick actions not role-filtered (BUG-03); backend sub-roles absent |
| No interactions silently fail | FAIL | BUG-01, 02, 04: buttons do nothing on click |
| E2E tests cover write mutations via UI | FAIL | 0/12 write mutations tested via UI |
| Destructive interactions have confirmation | FAIL | Feature flag delete has no confirmation (BUG-05) |
| No hardcoded data presented as real | FAIL | Communications stats are hardcoded (BUG-06) |
| Raw fetch usage consistent with SDK patterns | FAIL | 4 routes bypass SDK (committees, surveys, national-dashboard ×2) |

### Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| Interaction completeness | 3/5 | Core CRUD wired for assoc/ops/flags/impersonation; org write paths broken |
| Role enforcement at interaction level | 2/5 | FE-only gates; quick actions bypass role filtering |
| Error/loading/empty state quality | 4/5 | Consistent pattern across implemented interactions |
| E2E mutation coverage | 0/5 | Zero write mutations tested via UI click |
| Accessibility | 2/5 | No focus traps, no `role="dialog"` on any custom modal |
| Data integrity | 2/5 | Hardcoded values in communications; 4 raw-fetch routes bypass SDK types |
| **Overall** | **13/30** | **FAIL** |

### Gate 4 Verdict: **FAIL**

**Blockers before passing Gate 4:**
1. BUG-01: Implement Create Organization dialog + mutation
2. BUG-02: Implement Edit Organization form + mutation
3. BUG-03: Filter dashboard quick actions through `ROUTE_ROLES` or `user.role`
4. BUG-05: Add confirmation to feature flag delete
5. BUG-06: Remove hardcoded stats from Communications page or wire real API
6. PD-02: Decide on backend sub-role enforcement strategy
7. PD-01: Resolve impersonation role mismatch (super vs super+support)
8. E2E: Add at least one passing UI-level test per write mutation for Operators, Feature Flags, and Impersonation

---

## File Reference

| File | Role in Audit |
|------|--------------|
| `apps/admin/src/lib/role-gate.tsx` | `RequireRole` + `ROUTE_ROLES` matrix |
| `apps/admin/src/main.tsx` | Auth initialization via `getAdminRole` |
| `apps/admin/src/routes/__root.tsx` | Root layout, sidebar, nav + auth redirect |
| `apps/admin/src/routes/index.tsx` | Dashboard + hardcoded quick actions (BUG-03) |
| `apps/admin/src/routes/associations/index.tsx` | Create Association dialog (working) |
| `apps/admin/src/routes/associations/$associationId.tsx` | Edit/Delete wired; "Add Organization" stub (BUG-04) |
| `apps/admin/src/routes/organizations/index.tsx` | Create Organization stub (BUG-01) |
| `apps/admin/src/routes/organizations/$organizationId.tsx` | Edit Organization stub (BUG-02) |
| `apps/admin/src/routes/operators/index.tsx` | Invite + Revoke (working) |
| `apps/admin/src/routes/feature-flags/index.tsx` | Create (working); Delete without confirm (BUG-05) |
| `apps/admin/src/routes/impersonate/index.tsx` | Start/End (working); role mismatch (PD-01) |
| `apps/admin/src/routes/communications/index.tsx` | Hardcoded stats (BUG-06) |
| `apps/admin/src/routes/communications/templates.tsx` | Complete stub (BUG-07) |
| `apps/admin/src/routes/committees/index.tsx` | Raw fetch, no SDK |
| `apps/admin/src/routes/surveys/index.tsx` | Raw fetch, no SDK; `createFileRoute('/surveys/' as any)` type hack |
| `apps/admin/src/routes/national-dashboard/index.tsx` | Raw fetch, no SDK |
| `apps/admin/src/routes/verifications/index.tsx` | "Coming Soon" stub |
| `services/api-ts/src/middleware/platform-admin-auth.ts` | Admin gate — membership only, no sub-roles |
| `services/api-ts/src/handlers/platformadmin/startImpersonation.ts` | Allows super+support (FE allows only super) |
| `services/api-ts/src/app.ts:200,203-205,330` | Admin middleware + hand-wired routes |
| `apps/admin/tests/e2e/` | All 8 E2E specs |
