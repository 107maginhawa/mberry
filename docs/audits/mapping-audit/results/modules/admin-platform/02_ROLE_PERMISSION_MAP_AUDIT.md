# Audit 02 — Role and Permission Map: Admin/Platform Module

**Module:** Admin/Platform (platformadmin handlers + admin app)
**Date:** 2026-05-26
**Status:** COMPLETE

---

## 1. Role Inventory

| Role | Source | Inferred Purpose | Frontend Usage | Backend Usage | API/Route Usage | Tests Found | E2E Tests Found | Notes |
|---|---|---|---|---|---|---|---|---|
| `super` | `platform-admin.schema.ts` AdminRole enum | Full platform control — all admin operations | `role-gate.tsx` ROUTE_ROLES: all routes | `platformAdminAuthMiddleware` + handler-level checks (startImpersonation) | All `/admin/*` endpoints | `ac-m03.platform-admin.test.ts` (25 assertions) | `admin-smoke.spec.ts`, `admin-routes.spec.ts` | Primary admin role |
| `support` | `platform-admin.schema.ts` AdminRole enum | Customer support — can impersonate, view data, limited mutations | `role-gate.tsx` ROUTE_ROLES: most routes except `/operators`, `/impersonate`, `/feature-flags`, `/communications/templates` | `startImpersonation.ts` IMPERSONATION_ALLOWED_ROLES | Most `/admin/*` endpoints via wildcard middleware | `ac-m03.platform-admin.test.ts` | `admin-smoke.spec.ts` | Cannot manage operators or feature flags per frontend |
| `analyst` | `platform-admin.schema.ts` AdminRole enum | Read-only analytics — dashboards, reports, member lookup | `role-gate.tsx` ROUTE_ROLES: subset of routes (no verifications, events, committees, operators, impersonate, feature-flags, audit, comms) | `platformAdminAuthMiddleware` allows access | Read-only `/admin/*` endpoints via wildcard middleware | `ac-m03.platform-admin.test.ts` | None | Analyst role-denial NOT tested in backend handlers |
| `platform_admin` | Generated `routes.ts` role restriction | Generated route-level role; maps to any user in `platform_admin` table | N/A (used in generated middleware) | `authMiddleware({ roles: ["platform_admin"] })` on 4 endpoints | `/admin/committees`, `/admin/committees/:id`, `/admin/me/role`, `/admin/national-dashboard/:associationId` | `route-protection-admin.test.ts` | None | This is the generated-route role; separate from handler-level super/support/analyst |
| `national_officer` | Generated `routes.ts` | National association officer — can view national dashboard | N/A (not used in admin app frontend) | `authMiddleware({ roles: ["platform_admin", "national_officer"] })` | `/admin/national-dashboard/:associationId` | `br-36.national-dashboard.test.ts` (99 assertions) | None | Cross-module role from association:member module |

---

## 2. Permission Model Summary

| Permission Pattern | Source File | Used By | Risk | Notes |
|---|---|---|---|---|
| Wildcard middleware `app.use('/admin/*')` | `services/api-ts/src/app.ts:200` | All `/admin/*` routes | LOW | Two-layer: `authMiddleware()` + `platformAdminAuthMiddleware()`. Checks user exists in `platform_admin` table. Applied BEFORE generated routes. |
| Generated route-level `authMiddleware({ roles: [...] })` | `services/api-ts/src/generated/openapi/routes.ts` | 4 endpoints with explicit `platform_admin` role | MEDIUM | Most admin endpoints use bare `authMiddleware()` without role restriction — relies entirely on wildcard middleware |
| Handler-level role checks | `startImpersonation.ts`, `revokeAdmin.ts` | Impersonation, admin self-delete prevention | LOW | Good: additional business-logic guards beyond middleware |
| Frontend `RequireRole` component | `apps/admin/src/lib/role-gate.tsx` | All admin route pages | LOW | UI-only gate — shows "Access Denied" for wrong sub-role |
| Frontend `ROUTE_ROLES` matrix | `apps/admin/src/lib/role-gate.tsx` | Sidebar nav filtering | LOW | Controls visibility only; no backend enforcement of sub-role restrictions per route |

---

## 3. Role Access Matrix

| Role | Allowed Routes (Frontend) | Denied Routes (Frontend) | Allowed Actions | Denied Actions | Backend/API Permissions | Ownership/Tenant Rules | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|
| `super` | ALL admin routes | None | Full CRUD on all entities, impersonate, manage operators, feature flags | None | All endpoints via wildcard + any handler-level check | N/A (platform-level, no tenant scoping) | STRONG (ac-m03 tests) | WEAK (page-load only) |
| `support` | Most routes (not `/operators`, `/impersonate`, `/feature-flags`, `/communications/templates`) | `/operators`, `/impersonate`, `/feature-flags`, `/communications/templates` | View data, impersonate users, moderate comms | Cannot manage operators, feature flags, templates | All endpoints via wildcard middleware — **backend does NOT enforce sub-role denial** [LIKELY BUG] | N/A | PARTIAL (ac-m03 tests role gate) | NONE for denial |
| `analyst` | Subset: `/`, `/associations`, `/organizations`, `/members`, `/compliance`, `/training`, `/national-dashboard`, `/surveys`, `/communications/email` | `/verifications`, `/events`, `/committees`, `/operators`, `/impersonate`, `/feature-flags`, `/audit`, `/communications`, `/communications/moderation`, `/communications/templates` | Read-only: view dashboards, reports, member lookup | Cannot create/edit/delete anything, no impersonation | All endpoints via wildcard middleware — **backend does NOT enforce sub-role denial** [LIKELY BUG] | N/A | PARTIAL (ac-m03 tests role gate) | NONE for denial |

---

## 4. Protected Route Matrix

| Route | Source File | Protection Type | Allowed Roles | Denied Roles | Direct URL Behavior | Backend/API Enforcement | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|
| `/` (dashboard) | `routes/index.tsx` | Auth required (root layout) | super, support, analyst | Non-admin | Redirect to login | `platformAdminAuthMiddleware` wildcard | None specific | `admin-smoke.spec.ts` WEAK | P2 |
| `/associations` | `routes/associations/index.tsx` | Auth + no explicit RequireRole | super, support, analyst | Non-admin | Blocked by root auth | Wildcard middleware | None | `associations.spec.ts` | P2 |
| `/organizations` | `routes/organizations/index.tsx` | Auth + no explicit RequireRole | super, support, analyst | Non-admin | Blocked by root auth | Wildcard middleware | None | `organizations.spec.ts` | P2 |
| `/operators` | `routes/operators/index.tsx` | `RequireRole(['super'])` | super | support, analyst | Access Denied UI shown | **Backend: wildcard allows all admin sub-roles** [P1] | None | `admin-routes.spec.ts` WEAK (page-load) | **P1** |
| `/impersonate` | `routes/impersonate/index.tsx` | `RequireRole(['super'])` | super | support, analyst | Access Denied UI shown | Backend handler: checks super/support only | `startImpersonation.test.ts` | `admin-routes.spec.ts` WEAK | P2 |
| `/feature-flags` | `routes/feature-flags/index.tsx` | `RequireRole(['super'])` | super | support, analyst | Access Denied UI shown | **Backend: wildcard allows all admin sub-roles** [P1] | None for sub-role denial | `admin-routes.spec.ts` WEAK | **P1** |
| `/members` | `routes/members/index.tsx` | Auth + no explicit RequireRole | super, support, analyst | Non-admin | Blocked by root auth | Wildcard middleware | None | `members.spec.ts` | P2 |
| `/members/$personId` | `routes/members/$personId.tsx` | Auth + no explicit RequireRole | super, support, analyst | Non-admin | Blocked by root auth | Wildcard middleware | None | None | P2 |
| `/verifications` | `routes/verifications/index.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | **Backend: wildcard allows analyst** [P1] | None | None | **P1** |
| `/compliance` | `routes/compliance/index.tsx` | `RequireRole(['super', 'support', 'analyst'])` | ALL | Non-admin | Blocked by root auth | Wildcard middleware | None | None | P2 |
| `/events` | `routes/events/index.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | **Backend: wildcard allows analyst** [P1] | None | None | **P1** |
| `/training` | `routes/training/index.tsx` | `RequireRole(['super', 'support', 'analyst'])` | ALL | Non-admin | Blocked by root auth | Wildcard middleware | None | None | P2 |
| `/national-dashboard` | `routes/national-dashboard/index.tsx` | `RequireRole(['super', 'support', 'analyst'])` | ALL | Non-admin | Blocked by root auth | `authMiddleware({ roles: ["platform_admin", "national_officer"] })` | `br-36.national-dashboard.test.ts` STRONG | `wave7-routes.spec.ts` MODERATE | P3 |
| `/committees` | `routes/committees/index.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | `authMiddleware({ roles: ["platform_admin"] })` | `listAllCommittees.test.ts` | `wave7-routes.spec.ts` MODERATE | P2 |
| `/audit` | `routes/audit/index.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | **Backend: wildcard allows analyst** [P1] | None | `audit.spec.ts` | **P1** |
| `/surveys` | `routes/surveys/index.tsx` | `RequireRole(['super', 'support', 'analyst'])` | ALL | Non-admin | Blocked by root auth | Hand-wired in app.ts with `platformAdminAuthMiddleware` | None | None | P2 |
| `/communications` | `routes/communications/index.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | **Backend: wildcard allows analyst** [P1] | None | None | **P1** |
| `/communications/templates` | `routes/communications/templates.tsx` | `RequireRole(['super'])` | super | support, analyst | Access Denied UI shown | **Backend: wildcard allows all admin sub-roles** [P1] | None | None | **P1** |
| `/communications/email` | `routes/communications/email.tsx` | `RequireRole(['super', 'support', 'analyst'])` | ALL | Non-admin | Blocked by root auth | Wildcard middleware | None | None | P2 |
| `/communications/moderation` | `routes/communications/moderation.tsx` | `RequireRole(['super', 'support'])` | super, support | analyst | Access Denied UI shown | **Backend: wildcard allows analyst** [P1] | None | None | **P1** |

---

## 5. Protected Action Matrix

| Action | Route/Page | Component/File | Allowed Roles | Denied Roles | Frontend Rule | Backend/API Rule | Ownership/Tenant Rule | Existing Test | Existing E2E | Severity |
|---|---|---|---|---|---|---|---|---|---|---|
| Invite Admin | `/operators` | `operators/index.tsx` | super | support, analyst | RequireRole(['super']) | Wildcard middleware only — **no sub-role check in inviteAdmin handler** | N/A | `inviteAdmin.test.ts` (5 assertions) | NONE | **P1** |
| Revoke Admin | `/operators` | `operators/index.tsx` | super | support, analyst | RequireRole(['super']) | Handler: prevents last super removal but **no sub-role check** | N/A | `revokeAdmin.test.ts` (6 assertions) | NONE | **P1** |
| Create Feature Flag | `/feature-flags` | `feature-flags/index.tsx` | super | support, analyst | RequireRole(['super']) | Wildcard middleware only | N/A | `setFeatureFlag.test.ts` (10 assertions) | NONE | **P1** |
| Delete Feature Flag | `/feature-flags` | `feature-flags/index.tsx` | super | support, analyst | RequireRole(['super']) | Wildcard middleware only | N/A | `deleteFeatureFlag.test.ts` (4 assertions) | NONE | P2 |
| Start Impersonation | `/impersonate` | `impersonate/index.tsx` | super | support (frontend), support allowed (backend) | RequireRole(['super']) — **MISMATCH: frontend says super-only, backend allows support** | Handler: `IMPERSONATION_ALLOWED_ROLES = ['super', 'support']` | N/A | `startImpersonation.test.ts` (19 assertions) | NONE | **P1** |
| End Impersonation | `/impersonate` | `impersonate/index.tsx` | super | support, analyst (frontend) | RequireRole(['super']) | Wildcard middleware only | N/A | `endImpersonation.test.ts` (11 assertions) | NONE | P2 |
| Create Association | `/associations` | `associations/index.tsx` | super, support, analyst (all) | Non-admin | No RequireRole | Wildcard middleware only | N/A | `createAssociation.test.ts` (5 assertions) | NONE | P2 |
| Delete Association | `/associations/$associationId` | `associations/$associationId.tsx` | super, support, analyst (all) | Non-admin | No RequireRole | Wildcard middleware only | N/A | `deleteAssociation.test.ts` (4 assertions) | NONE | **P1** — analyst can delete associations |
| Create Organization | `/organizations` | `organizations/index.tsx` | super, support, analyst (all) | Non-admin | No RequireRole | Wildcard middleware only | N/A | `createOrganization.test.ts` (6 assertions) | NONE | P2 |
| Transition Org Status | `/organizations/$organizationId` | `organizations/$organizationId.tsx` | super, support, analyst (all) | Non-admin | No RequireRole | Wildcard middleware only | N/A | `transitionOrgStatus.test.ts` (9 assertions) | NONE | **P1** — analyst can transition org lifecycle |

---

## 6. Frontend/Backend Permission Mismatch Report

| ID | Mismatch | Role | Route/API/Component | Frontend Behavior | Backend Behavior | Evidence | Severity | Recommended Test |
|---|---|---|---|---|---|---|---|---|
| PERM-01 | Sub-role enforcement gap | support, analyst | ALL `/admin/*` except 4 endpoints with explicit roles | Frontend `RequireRole` hides pages from unauthorized sub-roles | Backend `platformAdminAuthMiddleware` only checks user IS a platform admin — does NOT check sub-role (super/support/analyst) | `platform-admin-auth.ts` checks `findByUserId` only | **P1** | API integration: analyst calls `/admin/feature-flags` POST → should get 403 |
| PERM-02 | Impersonation role mismatch | support | `/impersonate` page | Frontend: `RequireRole(['super'])` — support CANNOT see impersonate page | Backend: `startImpersonation.ts` allows `['super', 'support']` | `impersonate/index.tsx:8` vs `startImpersonation.ts:5` | **P1** | [NEEDS PRODUCT DECISION] — should support be able to impersonate? Frontend says no, backend says yes |
| PERM-03 | Destructive actions unguarded by sub-role | analyst | DELETE `/admin/associations/:id`, POST `/admin/organizations/:id/transition` | Frontend: page is visible to analyst (no RequireRole on associations) | Backend: wildcard middleware allows, no handler-level sub-role check | `deleteAssociation.ts` has no role check beyond session | **P1** | API integration: analyst calls DELETE association → should get 403 |
| PERM-04 | Operator management unguarded | support | `/admin/admins` endpoints (invite, update, revoke) | Frontend: RequireRole(['super']) hides the page | Backend: wildcard middleware allows support to call admin CRUD endpoints | `inviteAdmin.ts` has no sub-role check | **P1** | API integration: support calls POST `/admin/admins` → should get 403 |

---

## 7. Ownership / Tenant Boundary Matrix

| Boundary | Route/API/Action | Role | Expected Rule | Frontend Enforcement | Backend Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|
| Platform-level (no tenant scoping) | All `/admin/*` | ALL admin roles | Platform admins operate across all associations/orgs | N/A — platform admin is above tenant | N/A — intentionally cross-tenant | N/A | N/A | No gap — by design | N/A |
| Impersonation target safety | POST `/admin/impersonate` | super, support | Cannot impersonate another platform admin | N/A | Handler checks `targetAdmin` exists in platform_admin table | `startImpersonation.test.ts` | NONE | E2E gap for admin-impersonation-protection | P2 |

---

## 8. Role-Based Journey Permission Matrix

| Journey | Role | Route(s) | Action(s) | Permission Rule | Existing Test | Existing E2E | E2E Required? | Severity |
|---|---|---|---|---|---|---|---|---|
| Super admin → manage operators | super | `/operators` | Invite, update role, revoke | Frontend: RequireRole super. Backend: wildcard only | `inviteAdmin.test.ts`, `revokeAdmin.test.ts`, `updateAdmin.test.ts` | `admin-routes.spec.ts` WEAK | Yes | P1 |
| Analyst → blocked from operator management | analyst | `/operators` (denied) | N/A | Frontend: RequireRole blocks. Backend: **ALLOWS** | `ac-m03.platform-admin.test.ts` | NONE | Yes | **P1** |
| Super admin → manage feature flags | super | `/feature-flags` | Create, list, delete | Frontend: RequireRole super. Backend: wildcard only | `setFeatureFlag.test.ts`, `listFeatureFlags.test.ts`, `deleteFeatureFlag.test.ts` | `admin-routes.spec.ts` WEAK | Yes | P1 |
| Super admin → impersonate user | super | `/impersonate` | Start, end impersonation | Frontend: RequireRole super. Backend: handler checks super/support | `startImpersonation.test.ts` STRONG | `admin-routes.spec.ts` WEAK | Yes | P1 |
| Support → impersonate (mismatch) | support | `/impersonate` (blocked frontend) | Start impersonation | Frontend: BLOCKED. Backend: ALLOWED | `startImpersonation.test.ts` covers role check | NONE | Yes [NEEDS PRODUCT DECISION] | **P1** |
| Analyst → view dashboard only | analyst | `/`, `/associations`, `/organizations`, `/members` | View data | Frontend: pages visible. Backend: wildcard allows all | Partial | NONE | Yes | P1 |
| Analyst → blocked from destructive actions | analyst | All mutation endpoints | Create/delete/update associations, orgs | Frontend: no RequireRole on associations page (bug?) Backend: **ALLOWS** mutations | NONE | NONE | Yes | **P1** |

---

## 9. Permission Test Coverage Matrix

| Permission Rule | Existing Test | Test Type | Coverage Quality | Missing Test | Recommended Test Type | Severity |
|---|---|---|---|---|---|---|
| Non-admin blocked from `/admin/*` | `route-protection-admin.test.ts` | API/integration | STRONG (6 tests, checks 401/403) | None | N/A | OK |
| Platform admin wildcard middleware | `route-protection-admin.test.ts` | API/integration | STRONG | None | N/A | OK |
| Sub-role `super` can manage operators | `inviteAdmin.test.ts`, `revokeAdmin.test.ts` | Unit/handler | MODERATE (happy path, 5-6 assertions each) | **Deny test: support/analyst calling operator endpoints** | API/integration | **P1** |
| Sub-role `analyst` blocked from mutations | NONE | N/A | NONE | **All mutation endpoints need analyst denial test** | API/integration | **P1** |
| Sub-role `support` blocked from feature flags | NONE | N/A | NONE | **POST/DELETE feature-flags need support denial test** | API/integration | **P1** |
| Impersonation role restriction | `startImpersonation.test.ts` | Unit/handler | STRONG (checks IMPERSONATION_ALLOWED_ROLES) | Analyst denial test | API/integration | P2 |
| Last super admin deletion prevention | `revokeAdmin.test.ts` | Unit/handler | MODERATE | Edge case: revoke last super with concurrent request | API/integration | P2 |
| Impersonation target safety (block admin-on-admin) | `startImpersonation.test.ts` | Unit/handler | STRONG | None | N/A | OK |

---

## 10. E2E Role Access Coverage Matrix

| Route/Journey | Role | Expected Access | Existing E2E | E2E Quality | Missing Assertion | Recommended E2E Test | Severity |
|---|---|---|---|---|---|---|---|
| `/` dashboard | super | Allow | `admin-smoke.spec.ts` | WEAK (checks "Memberry Admin" text) | Dashboard stats loaded, sidebar visible | E2E: verify stat cards render with data | P2 |
| `/` dashboard | unauthenticated | Deny | `admin-smoke.spec.ts` | MODERATE (checks sidebar NOT visible) | Should verify redirect to login | E2E: verify redirect | P2 |
| `/operators` | super | Allow | `admin-routes.spec.ts` | WEAK (page-load only) | Operator table loaded, invite button present | E2E: full invite→verify→revoke journey | P1 |
| `/operators` | analyst | Deny | NONE | NONE | Access Denied shown | E2E: analyst login → navigate to `/operators` → see "Access Denied" | **P1** |
| `/feature-flags` | super | Allow | `admin-routes.spec.ts` | WEAK (page-load only) | Flag table loaded, create form works | E2E: create flag → verify in list → delete | P1 |
| `/impersonate` | super | Allow | `admin-routes.spec.ts` | WEAK (page-load only) | Impersonation form renders, user search works | E2E: start impersonation → verify session → end | P1 |
| `/associations` | super | Allow | `associations.spec.ts` | Unknown quality | Create → list → detail → edit journey | E2E: full CRUD journey | P1 |
| `/organizations` | super | Allow | `organizations.spec.ts` | Unknown quality | Create → list → detail → transition | E2E: full CRUD + lifecycle journey | P1 |
| `/national-dashboard` | super | Allow | `wave7-routes.spec.ts` | MODERATE | Charts render with chapter data | E2E: verify dashboard loads with data | P2 |

---

## 11. Product Decisions Needed

| Question | Affected Role/Route/API/Action | Why Needed | Blocks Implementation? |
|---|---|---|---|
| Should `support` role be able to impersonate users? | support / `/impersonate` / `startImpersonation` | Frontend says NO (RequireRole super-only). Backend says YES (allows super+support). Need to align. | Yes — either fix frontend or fix backend |
| Should `analyst` role have any mutation (create/edit/delete) permissions? | analyst / all mutation endpoints | Currently analyst can call any `/admin/*` mutation endpoint via API. Frontend hides some pages but not the associations/organizations pages. Is analyst truly read-only? | Yes — need sub-role enforcement in middleware or handlers |
| Should the `platformAdminAuthMiddleware` enforce sub-roles? | ALL `/admin/*` routes | Currently only checks user IS a platform admin. Does not distinguish super/support/analyst. All sub-role enforcement is frontend-only (RequireRole component). | Yes — architectural decision needed |

---

## 12. Gate 2 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 2 | Admin/Platform | **PASS** (with P1 findings) | Roles identified (5), permission model documented, protected routes listed (23), protected actions listed (10), 4 frontend/backend mismatches found, ownership boundaries checked, test gaps listed, E2E gaps listed | None — all sections completed |

---

## Key Finding Summary

### Critical Architecture Issue: Sub-Role Enforcement Gap

The `platformAdminAuthMiddleware` only verifies the user exists in the `platform_admin` table. It does **not** check the `role` column (super/support/analyst). This means:

1. **Frontend-only sub-role gating**: The `RequireRole` component hides pages, but any admin can call any `/admin/*` API endpoint directly.
2. **Analyst can perform destructive operations**: Delete associations, transition org status, manage feature flags — all via direct API calls.
3. **Support can manage operators**: Invite/revoke/update other admins via direct API calls.

**Evidence**: `services/api-ts/src/middleware/platform-admin-auth.ts` — the middleware calls `repo.findByUserId(user.id)` and only checks `if (!admin)`. It never reads `admin.role`.

**Risk**: Medium-High. The admin app is internal tooling (not member-facing), but an analyst or support user could escalate privileges via API calls.

**Recommended fix**: Add sub-role checking to `platformAdminAuthMiddleware` or create route-level sub-role middleware.
