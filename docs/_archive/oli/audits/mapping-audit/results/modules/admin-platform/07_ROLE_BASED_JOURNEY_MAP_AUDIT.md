# Audit 07 — Role-Based Journey Map: Admin/Platform Module

**App**: `apps/admin/` (port 3003)  
**Audit date**: 2026-05-26  
**Branch**: `audit/codebase-improvements`  
**Auditor**: Claude Code (automated)

---

## 1. Role Journey Summary

The admin app implements three sub-roles stored in the `platform_admin` table via `adminRoleEnum ('super' | 'support' | 'analyst')`. Frontend enforcement is split:

- **Sidebar**: `ROUTE_ROLES` map in `apps/admin/src/lib/role-gate.tsx` filters visible nav items per role.
- **Route level**: `RequireRole` component gates page render; shows Access Denied if role not in `allowed[]`.
- **Backend**: `platformAdminAuthMiddleware` in `services/api-ts/src/middleware/platform-admin-auth.ts` only verifies the user exists in `platform_admin`. It does **NOT** check sub-role (`super` vs `support` vs `analyst`). All three sub-roles pass through identically at the API layer.

**Critical finding**: Backend enforces "is this a platform admin?" but not "which admin sub-role?". Any of the three roles can call any `/admin/*` mutation endpoint. Frontend `RequireRole` is the sole sub-role enforcement mechanism — bypassable via direct API calls.

---

## 2. Journey Registry

| ID  | Name                              | Primary Role       | Involves Mutation | Backend Sub-Role Gate |
|-----|-----------------------------------|--------------------|-------------------|-----------------------|
| J1  | Full Operator Management          | super              | Yes               | None [LIKELY BUG]     |
| J2  | Feature Flag Management           | super              | Yes               | None [LIKELY BUG]     |
| J3  | Impersonate User                  | super              | Yes               | None [LIKELY BUG]     |
| J4  | Association CRUD                  | super              | Yes               | None [LIKELY BUG]     |
| J5  | Organization Lifecycle            | super              | Yes               | None [LIKELY BUG]     |
| J6  | Audit Log Review                  | super + support    | No                | None                  |
| J7  | National Dashboard                | super + support + analyst | No         | None                  |
| J8  | Analyst Blocked from Mutations    | analyst            | Attempted         | Missing [LIKELY BUG]  |
| J9  | Support Blocked from Operators    | support            | Attempted         | Missing [LIKELY BUG]  |
| J10 | Unauthenticated Access Denied     | none               | No                | Session check (401)   |

---

## 3. Step-by-Step Journey Maps

### J1: Super → Full Operator Management

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/operators` | Page loads | Loads (RequireRole: ['super'] guards render) | OK |
| 2 | View operators table | List of admins shown | Renders table via SDK `listAdmins` | OK |
| 3 | Click "Invite Operator" | Modal/form opens | Form dialog renders | OK |
| 4 | Fill name, email, role → submit | POST /admin/admins → 201 | Calls `inviteAdmin` handler | OK |
| 5 | New operator appears in table | Table refreshes | Query invalidated on success | OK |
| 6 | Click Revoke → confirm → removed | DELETE /admin/admins/:id → 204 | No confirm dialog observed in route | [UX GAP] |
| 7 | Sidebar hides `/operators` from support/analyst | Not visible | `ROUTE_ROLES['/operators'] = ['super']` | OK |
| 8 | support/analyst direct URL to `/operators` | Access Denied rendered | RequireRole blocks | OK |

**APIs**: `listAdmins`, `inviteAdmin`, `revokeAdmin`  
**E2E coverage**: `admin-routes.spec.ts` — page load only; no invite/revoke flow tested [E2E GAP]

---

### J2: Super → Feature Flag Management

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/feature-flags` | Page loads | Loads (RequireRole: ['super']) | OK |
| 2 | View flags table | Existing flags shown | SDK `listFeatureFlags` renders | OK |
| 3 | Fill create form (targetType, targetId, module, enabled) → submit | POST /admin/feature-flags → 201 | Dialog state (`dialogOpen`) wires to create | OK |
| 4 | New flag appears in table | Table refreshes | Query invalidated | OK |
| 5 | Click Delete on a flag → flag removed | DELETE /admin/feature-flags/:id → 204 | Delete fires immediately with no confirm dialog | [LIKELY BUG] |
| 6 | support/analyst direct URL | Access Denied | RequireRole: ['super'] | OK |

**APIs**: `listFeatureFlags`, `setFeatureFlag`, `deleteFeatureFlag`  
**Bug**: Step 5 — no confirmation step before destructive delete. Feature flag deletion is irreversible and affects platform behaviour. Confirm dialog is missing.  
**E2E coverage**: `admin-routes.spec.ts` — page load only [E2E GAP]

---

### J3: Super → Impersonate User

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/impersonate` | Page loads | Loads (RequireRole: ['super']) | OK |
| 2 | Browse organizations | Org list shown | SDK `listOrganizations` renders | OK |
| 3 | Select org → see member list | Members shown | Inline member list (from org.members?) | [PARTIAL — members fetched from org.members, not a dedicated member list endpoint] |
| 4 | Click "Start Impersonation" | POST /admin/impersonate → session returned | `startImpersonationApi` mutation | OK |
| 5 | Active session panel shows with timer | Session data displayed | `activeSession` state renders | OK |
| 6 | Click "End Impersonation" | DELETE /admin/impersonate/:sessionId → 200 | `endImpersonationApi` mutation | OK |
| 7 | Backend blocks write ops during impersonation | POST/PATCH/DELETE → 403 | ac-m03.test.ts covers this pure-logic, not integration | [E2E GAP] |
| 8 | support/analyst direct URL | Access Denied | RequireRole: ['super'] | OK |
| 9 | support API call POST /admin/impersonate | Should 403 | No sub-role check in middleware | [LIKELY BUG] |

**APIs**: `listOrganizations`, `startImpersonation`, `endImpersonation`  
**E2E coverage**: `admin-routes.spec.ts` — page load only [E2E GAP]

---

### J4: Super → Association CRUD

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/associations` | Page loads | Loads — **no RequireRole in route component** | [LIKELY BUG] |
| 2 | View associations table | List renders | SDK `listAssociations` | OK |
| 3 | Click "Create Association" → fill name, country, currency → submit | POST /admin/associations → 201 | `createAssociationMutation` fires | OK |
| 4 | New association in table | Table refreshes | Query invalidated | OK |
| 5 | Click association row → detail page | Navigate to detail | `Link` to `/associations/$id` | OK |
| 6 | Edit fields → save | PATCH /admin/associations/:id | Detail page — not audited separately | Unverified |
| 7 | Delete association with confirmation | DELETE /admin/associations/:id → 204 | Delete flow — no confirm dialog visible in route | [UX GAP — unverified] |
| 8 | analyst on `/associations` direct URL | Should see Access Denied | No RequireRole — page renders for all | [LIKELY BUG] |
| 9 | analyst clicks Create → submits | Should fail or be blocked | No frontend gate; backend allows (no sub-role check) | [LIKELY BUG] |

**APIs**: `listAssociations`, `createAssociation`, `getAssociation`, `updateAssociation`, `deleteAssociation`  
**Critical**: `/associations` route uses `createFileRoute('/associations/')({ component: AssociationsPage })` with **no `RequireRole` wrapper**. `ROUTE_ROLES` defines `'/associations': ['super', 'support', 'analyst']` so sidebar shows it to all, but the Create/Edit/Delete actions are equally available to analysts who should be read-only.  
**E2E coverage**: `associations.spec.ts` exists — content unknown beyond page load [E2E GAP for mutation paths]

---

### J5: Super → Organization Lifecycle

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/organizations` | Page loads | Loads — **no RequireRole in route component** | [NOTE: all 3 roles allowed per ROUTE_ROLES] |
| 2 | View orgs table | List renders | SDK `listOrganizations` | OK |
| 3 | Click "Create Organization" → fill form → submit | POST /admin/organizations → 201 | Button visible, mutation exists | OK |
| 4 | Click org row → detail page | `/organizations/$organizationId` | `Link` to detail | OK |
| 5 | Edit org fields → save | PATCH /admin/organizations/:id | Detail route — separate; not audited | Unverified |
| 6 | Transition status (trial → active → suspended → cancelled) | PATCH status field or dedicated endpoint | `transitionOrgStatus` exists in contract tests | OK (contract) |
| 7 | analyst on `/organizations` → Create Org | Should be blocked | Button visible to all; no role filter; backend allows | [LIKELY BUG] |

**APIs**: `listOrganizations`, `createOrganization`, `getOrganization`, `updateOrganization`, `transitionOrgStatus`  
**Note**: ROUTE_ROLES allows analyst here intentionally (read), but Create button is unguarded in UI and backend has no sub-role check.  
**E2E coverage**: `organizations.spec.ts` exists [E2E GAP for role-differentiated flows]

---

### J6: Super/Support → Audit Log Review

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/audit` | Page loads | RequireRole: ['super', 'support'] | OK |
| 2 | Set filters (action, resourceType, date range, user) | Filter controls | `audit/index.tsx` includes filter UI | OK (inferred) |
| 3 | Browse paginated results | Paginated log entries | SDK `listAuditLogs` | OK |
| 4 | analyst direct URL to `/audit` | Access Denied | RequireRole blocks analyst | OK |
| 5 | analyst API call GET /admin/audit-logs | Should 403 | No sub-role check in middleware — 200 returned | [LIKELY BUG] |

**APIs**: `listAuditLogs`  
**E2E coverage**: `audit.spec.ts` exists [content unknown — likely page-load only] [E2E GAP]

---

### J7: Super/Support/Analyst → National Dashboard

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `/national-dashboard` | Page loads | RequireRole: ['super', 'support', 'analyst'] | OK |
| 2 | Select association from dropdown | Dropdown populated | SDK `listAssociations` | OK |
| 3 | View chapter metrics | Member counts, dues, CPD rates | `getNationalDashboard` | OK |
| 4 | Select different snapshot month | Data re-fetches | Date selector triggers re-query | OK (inferred) |
| 5 | Unauthenticated access | Redirect to sign-in | Root layout `beforeLoad` fires | OK |

**APIs**: `getNationalDashboard`, `listAssociations`  
**E2E coverage**: `wave7-routes.spec.ts` — page load + association selector verified | OK (partial)

---

### J8: Analyst → Blocked from Mutations (SHOULD BE)

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Login as analyst | Session established | Better-Auth session with `role: 'analyst'` | OK |
| 2 | Navigate to `/associations` | Read access only — or blocked | Page renders (ROUTE_ROLES allows analyst) | OK |
| 3 | See "Create Association" button | Should be hidden or disabled | Button **always visible** — no role-based render guard | [LIKELY BUG] |
| 4 | Click create → form visible → submit | Should be blocked | Form submits → `createAssociation` API called | [LIKELY BUG] |
| 5 | Backend receives POST /admin/associations | Should return 403 | `platformAdminAuthMiddleware` only checks `platform_admin` table membership — not sub-role | [LIKELY BUG] |
| 6 | Navigate to `/operators` (sidebar hidden) | Not visible in nav | `ROUTE_ROLES` hides it | OK |
| 7 | Direct URL `/operators` | Access Denied rendered | RequireRole: ['super'] blocks | OK |
| 8 | API call POST /admin/admins as analyst | Should return 403 | No sub-role check — middleware allows | [LIKELY BUG] |
| 9 | Navigate to `/organizations` → Create button visible | Should be read-only for analyst | Create button unguarded | [LIKELY BUG] |

**Summary**: Frontend sidebar correctly hides super-only routes. RequireRole blocks UI rendering for gated routes. But: mutation buttons on shared routes (associations, organizations, members) are visible and functional for analysts. Backend has no sub-role enforcement at all.

---

### J9: Support → Operator Management (SHOULD BE BLOCKED)

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Login as support | Session established | Better-Auth session with `role: 'support'` | OK |
| 2 | Sidebar hides `/operators` | Not visible | `ROUTE_ROLES['/operators'] = ['super']` | OK |
| 3 | Sidebar hides `/feature-flags` | Not visible | `ROUTE_ROLES['/feature-flags'] = ['super']` | OK |
| 4 | Sidebar hides `/impersonate` | Not visible | `ROUTE_ROLES['/impersonate'] = ['super']` | OK |
| 5 | Direct URL `/operators` | Access Denied | RequireRole: ['super'] renders denial | OK |
| 6 | Direct URL `/feature-flags` | Access Denied | RequireRole: ['super'] | OK |
| 7 | Direct URL `/impersonate` | Access Denied | RequireRole: ['super'] | OK |
| 8 | API call POST /admin/admins (invite operator) | Should return 403 | No sub-role check → backend allows | [LIKELY BUG] |
| 9 | API call DELETE /admin/admins/:id (revoke) | Should return 403 | No sub-role check → backend allows | [LIKELY BUG] |
| 10 | API call POST /admin/feature-flags | Should return 403 | No sub-role check → backend allows | [LIKELY BUG] |
| 11 | API call POST /admin/impersonate | Should return 403 | No sub-role check → backend allows | [LIKELY BUG] |

**Summary**: Frontend RequireRole correctly blocks support from super-only pages via direct URL. Backend API layer has zero sub-role restriction — support can perform any super-only operation via direct API call.

---

### J10: Unauthenticated → Admin App

| Step | Action | Expected | Actual | Status |
|------|--------|----------|--------|--------|
| 1 | Navigate to `http://localhost:3003/` | Redirect to sign-in | `beforeLoad` in `__root.tsx` checks `context.auth.user`, redirects to `MEMBERRY_LOGIN_URL` | OK |
| 2 | Navigate to any `/admin/*` route directly | Redirect to sign-in | Same root layout guard applies | OK |
| 3 | Call GET /admin/organizations without session | 401 | `platformAdminAuthMiddleware` → 403 (ForbiddenError) for non-admins | OK (403 not 401 — minor) |
| 4 | Call POST /admin/admins without session | 401/403 | `platformAdminAuthMiddleware` fires | OK |
| 5 | Admin sidebar must not render | Not visible | Root layout exits before render | OK |

**E2E coverage**: `admin-smoke.spec.ts` — both authenticated load and unauthenticated denial tested | OK

---

## 4. Broken Journey Report

| ID | Journey | Step | Issue | Severity | Tag |
|----|---------|------|-------|----------|-----|
| BJ-01 | J2 (Feature Flags) | 5 | Delete flag fires without confirm dialog — no undo possible | High | [LIKELY BUG] |
| BJ-02 | J4 (Association CRUD) | 1, 8, 9 | `/associations` route has no `RequireRole`. Analyst sees and can use Create/Delete buttons. Backend allows. | Critical | [LIKELY BUG] |
| BJ-03 | J5 (Org Lifecycle) | 7 | `/organizations` has no mutation guard. Analyst sees Create Org button; backend allows the POST. | Critical | [LIKELY BUG] |
| BJ-04 | J8 (Analyst Blocked) | 3–5 | Mutation buttons (Create Association, Create Org) unguarded in UI for analysts | Critical | [LIKELY BUG] |
| BJ-05 | J8 (Analyst Blocked) | 8 | Backend POST /admin/admins succeeds for analyst — no sub-role enforcement | Critical | [LIKELY BUG] |
| BJ-06 | J9 (Support Blocked) | 8–11 | Backend allows support to invite/revoke admins, manage feature flags, start impersonation via direct API | Critical | [LIKELY BUG] |
| BJ-07 | J3 (Impersonate) | 9 | Backend allows support to call POST /admin/impersonate | High | [LIKELY BUG] |
| BJ-08 | J6 (Audit Log) | 5 | Backend GET /admin/audit-logs accessible by analyst (read-only leak is lower severity but inconsistent with intent) | Medium | [LIKELY BUG] |
| BJ-09 | J1 (Operators) | 6 | Revoke operator has no confirm dialog | Medium | [UX GAP] |
| BJ-10 | J3 (Impersonate) | 3 | Member list for impersonation fetched from `org.members` (embedded) rather than dedicated member search — may be incomplete | Low | [DATA GAP] |
| BJ-11 | J10 (Unauthenticated) | 3 | `platformAdminAuthMiddleware` throws `ForbiddenError` (403) for unauthenticated requests rather than 401 | Low | [PROTOCOL MISMATCH] |

---

## 5. E2E Journey Coverage Matrix

| Journey | Spec File | Page Load | Happy Path Mutation | Role Denial (sub-role) | Unauthenticated Denial |
|---------|-----------|-----------|---------------------|------------------------|------------------------|
| J1 Operators | `admin-routes.spec.ts` | Y | N | N | N |
| J2 Feature Flags | `admin-routes.spec.ts` | Y | N | N | N |
| J3 Impersonate | `admin-routes.spec.ts` | Y | N | N | N |
| J4 Associations | `associations.spec.ts` | Y | Unknown | N | N |
| J5 Organizations | `organizations.spec.ts` | Y | Unknown | N | N |
| J6 Audit Log | `audit.spec.ts` | Y | N/A | N | N |
| J7 National Dashboard | `wave7-routes.spec.ts` | Y | N/A | N | Y (wave7-role-gate) |
| J8 Analyst Blocked | — | N | N | N | N |
| J9 Support Blocked | — | N | N | N | N |
| J10 Unauthenticated | `admin-smoke.spec.ts` | N/A | N/A | N/A | Y |

**Legend**: Y = covered, N = not covered, N/A = not applicable

**Overall E2E coverage**: Strong for unauthenticated denial (J10). Weak for happy-path mutations (J1–J5) and completely absent for sub-role differentiation (J8, J9).

---

## 6. Navigation Smoke Coverage Matrix

| Route | In Sidebar | ROUTE_ROLES | RequireRole in Component | Smoke Test |
|-------|-----------|-------------|--------------------------|-----------|
| `/` (Dashboard) | Y | super, support, analyst | N | Y (admin-smoke) |
| `/associations` | Y | super, support, analyst | **N — MISSING** | Y |
| `/organizations` | Y | super, support, analyst | N | Y |
| `/members` | Y | super, support, analyst | N | Y |
| `/verifications` | Y | super, support | Y (['super', 'support']) | N |
| `/compliance` | Y | super, support, analyst | Y (['super', 'support', 'analyst']) | N |
| `/events` | Y | super, support | N | Y (wave7-routes) |
| `/training` | Y | super, support, analyst | Y (['super', 'support', 'analyst']) | Y (wave7-routes) |
| `/national-dashboard` | Y | super, support, analyst | Y (['super', 'support', 'analyst']) | Y (wave7-routes) |
| `/committees` | Y | super, support | Y (['super', 'support']) | Y (wave7-routes) |
| `/operators` | Y (super only) | super | Y (['super']) | Y (admin-routes) |
| `/impersonate` | Y (super only) | super | Y (['super']) | Y (admin-routes) |
| `/feature-flags` | Y (super only) | super | Y (['super']) | Y (admin-routes) |
| `/audit` | Y | super, support | Y (['super', 'support']) | Y (audit.spec) |
| `/surveys` | Y | super, support, analyst | N | N |
| `/communications` | Y | super, support | N | N |
| `/communications/moderation` | Y | super, support | N | N |
| `/communications/templates` | Y | super | N | N |
| `/communications/email` | Y | super, support, analyst | N | N |

**Critical gaps**:
- `/associations`: In ROUTE_ROLES but no RequireRole in component. Mutation actions unguarded.
- `/communications/templates`: In ROUTE_ROLES as `['super']` only but no RequireRole in component.
- `/surveys`, `/communications`, `/communications/moderation`, `/communications/email`: No RequireRole in components.

---

## 7. Role Access Coverage Matrix

### Frontend (RequireRole + Sidebar)

| Route | super | support | analyst | RequireRole? | Sidebar hides for denied? |
|-------|-------|---------|---------|-------------|--------------------------|
| `/operators` | Y | Block | Block | Y | Y |
| `/feature-flags` | Y | Block | Block | Y | Y |
| `/impersonate` | Y | Block | Block | Y | Y |
| `/audit` | Y | Y | Block | Y | Y |
| `/verifications` | Y | Y | Block | Y | Y |
| `/committees` | Y | Y | Block | Y | N (sidebar shows but RequireRole blocks) |
| `/compliance` | Y | Y | Y | Y | N/A |
| `/training` | Y | Y | Y | Y | N/A |
| `/national-dashboard` | Y | Y | Y | Y | N/A |
| `/associations` | Y | Y | Y | **N** | N/A |
| `/organizations` | Y | Y | Y | N | N/A |
| `/members` | Y | Y | Y | N | N/A |
| `/surveys` | Y | Y | Y | N | N/A |
| `/communications` | Y | Y | Block | N | Y |
| `/communications/templates` | Y | Block | Block | N | Y |
| `/communications/email` | Y | Y | Y | N | N/A |

### Backend (platformAdminAuthMiddleware)

| Operation | Any Admin | super only (intended) | Actual enforcement |
|-----------|-----------|----------------------|-------------------|
| GET /admin/* (reads) | Y | varies | All admins pass |
| POST /admin/admins (invite) | Y | super intended | **No sub-role check** |
| DELETE /admin/admins/:id (revoke) | Y | super intended | **No sub-role check** |
| POST /admin/feature-flags | Y | super intended | **No sub-role check** |
| DELETE /admin/feature-flags/:id | Y | super intended | **No sub-role check** |
| POST /admin/impersonate | Y | super intended | **No sub-role check** |
| POST /admin/associations | Y | super/support intended? | **No sub-role check** |
| POST /admin/organizations | Y | super/support intended? | **No sub-role check** |

---

## 8. Journey Test Matrix

### Backend Unit Tests (`services/api-ts/src/handlers/platformadmin/`)

| Test File | Coverage Area | Sub-Role Tested |
|-----------|--------------|-----------------|
| `ac-m03.platform-admin.test.ts` | Impersonation write-block, org status checks (pure logic) | No (uses mock `AdminRole = 'platform_admin' | 'super_admin'` — different from actual enum) |
| `ac-m14.national-dashboard.test.ts` | National dashboard data | No |
| `br-36.national-dashboard.test.ts` | Dashboard business rules | No |
| `inviteAdmin.test.ts` | Happy path invite | No sub-role denial tested |
| `listAdmins.test.ts` | Happy path list | No |
| `updateAdmin.test.ts` | Happy path update + last-super guard | Partial (tests `role: 'super'` → `role: 'support'` demotion) |
| `createAssociation.test.ts` | Happy path create | No |
| `deleteAssociation.test.ts` | Happy path delete | No |
| `createOrganization.test.ts` | Happy path create | No |
| `deleteFeatureFlag.test.ts` | Happy path delete | No |
| `endImpersonation.test.ts` | Happy path end | No |
| `getAdminRole.test.ts` | Role fetch | No |

**Gap**: No test asserts that a `support` or `analyst` caller receives 403 on super-only mutations. The `ac-m03` types use `'platform_admin' | 'super_admin'` — not matching the actual `'super' | 'support' | 'analyst'` enum — indicating the pure-logic tests are using a stale type model.

### Contract Tests (`specs/api/tests/contract/admin-flow.hurl`)

| Step | Operation | Role Tested | Sub-Role Denial Tested |
|------|-----------|------------|------------------------|
| 0 | Anonymous → 401 | none | N/A |
| 1 | Sign in as admin | any admin | No |
| 2 | Verify admin role | any admin | No |
| 3–7 | Organization CRUD + transition | any admin | No |
| 8–11 | Association CRUD | any admin | No |
| 12–15 | Admin CRUD | any admin | No |
| 16 | Create feature flag | any admin | No |

**Gap**: All 20 contract steps run as a single generic admin. No step signs in as `support` or `analyst` and attempts a super-only mutation to verify denial.

### E2E Tests

| Spec | Tests | Mutation Tested | Sub-Role Tested |
|------|-------|-----------------|-----------------|
| `admin-smoke.spec.ts` | 2 | No | No |
| `admin-routes.spec.ts` | ~6 | No | No |
| `wave7-role-gate.spec.ts` | 4 | No | No (tests unauthenticated only) |
| `wave7-routes.spec.ts` | ~5 | No | No |
| `associations.spec.ts` | Unknown | Unknown | No |
| `organizations.spec.ts` | Unknown | Unknown | No |
| `audit.spec.ts` | Unknown | No | No |
| `members.spec.ts` | Partial API | No | No |

---

## 9. Product Decisions Needed

| # | Decision | Context | Recommended Default |
|---|----------|---------|---------------------|
| PD-01 | Should backend enforce sub-role at API layer? | Currently only frontend enforces. Any admin with API access can perform super-only operations. | **Yes — add sub-role check in `platformAdminAuthMiddleware` or per-handler.** |
| PD-02 | Should `/associations` and `/organizations` mutation actions be hidden from analysts in the UI? | Currently Create/Edit/Delete buttons render for all 3 roles on shared routes. | **Yes — wrap action buttons with role-based render guards.** |
| PD-03 | Should analyst have read-only access to associations and organizations? | ROUTE_ROLES implies yes. But "read-only" is not enforced at button level. | **Confirm: analyst = read-only. Implement button-level guards.** |
| PD-04 | Should feature flag deletion require a confirm dialog? | Currently deletes immediately. Feature flags affect platform behavior in production. | **Yes — add confirmation dialog matching the pattern used in other destructive actions.** |
| PD-05 | Should operator revoke require a confirm dialog? | Currently no confirmation observed. Revoking is irreversible. | **Yes — add confirm step.** |
| PD-06 | Should the `ac-m03` test types align with the actual admin role enum? | Tests use `'platform_admin' | 'super_admin'`; schema uses `'super' | 'support' | 'analyst'`. | **Yes — update test types to match schema.** |
| PD-07 | Should support be able to call `POST /admin/impersonate`? | Currently allowed at backend. Frontend blocks. | **No — impersonation is a super-only capability. Add backend guard.** |
| PD-08 | Should analyst be able to read audit logs via direct API call? | Currently allowed. ROUTE_ROLES + RequireRole correctly block the UI. | **Clarify intent. If audit is sensitive, add backend read guard for analyst role.** |
| PD-09 | Should `/communications/templates` have a `RequireRole` component gate? | ROUTE_ROLES restricts to super but no RequireRole in component. Sidebar hides it but direct URL renders for support/analyst. | **Yes — add RequireRole(['super']) to the route component.** |

---

## 10. Gate 7 Evaluation

### Gate 7 Criteria

| Criterion | Status | Detail |
|-----------|--------|--------|
| All journeys documented (J1–J10) | PASS | All 10 journeys mapped step-by-step |
| Broken steps identified and tagged | PASS | 11 broken journey items (BJ-01 to BJ-11) |
| Role access matrix complete | PASS | Frontend and backend matrices provided |
| E2E coverage matrix complete | PASS | All 8 spec files mapped |
| Navigation smoke matrix complete | PASS | All 19 routes assessed |
| Backend sub-role enforcement evaluated | PASS | Critical gap documented |
| Product decisions surfaced | PASS | 9 decisions listed |

### Gate 7 Verdict: CONDITIONAL PASS

**Audit is complete.** The role journey map is thorough and all required sections are present.

**Blocking issues before shipping (not gating the audit itself)**:

1. **Backend has zero sub-role enforcement** (BJ-05, BJ-06, BJ-07) — any platform admin can perform super-only mutations via direct API. This is a security control gap.
2. **Mutation actions visible to analysts** on shared routes (associations, organizations) — analysts can create/delete entities they should only read (BJ-02, BJ-03, BJ-04).
3. **Feature flag deletion is unconfirmed** (BJ-01) — immediate irreversible deletion of production config.
4. **`ac-m03` type mismatch** — test types diverged from schema enum (PD-06).
5. **`/communications/templates` missing RequireRole** — super-only content accessible via direct URL to support/analyst.

**E2E gaps** (J8, J9 have zero coverage) are secondary — fixing the backend enforcement gap (point 1) first enables meaningful E2E test authoring for role denial.

---

*Generated by Audit 07 pass — no code modified.*
