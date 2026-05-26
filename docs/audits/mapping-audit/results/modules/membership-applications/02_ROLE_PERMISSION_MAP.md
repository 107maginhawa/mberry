# 02 — Role Permission Map Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## Architecture Note

The membership domain spans TWO handler directories:
1. **`services/api-ts/src/handlers/membership/`** — 12 hand-wired handlers (MOSTLY DEAD CODE — see below)
2. **`services/api-ts/src/handlers/association:member/`** — TypeSpec-generated handlers (LIVE, used by frontend)
3. **`services/api-ts/src/handlers/invite/`** — 3 invite handlers (TypeSpec)

**Dead Code Finding:** Only 4 of the 12 `membership/` handlers are imported by the OpenAPI registry:
- `getOrgProfile` → registered at `GET /membership/org-profile/:organizationId`
- `updateOrgProfile` → registered at `PUT /membership/org-profile/:organizationId`
- `listOrgApplications` → imported by registry (route TBD) `[NEEDS MANUAL CONFIRMATION]`
- `listOrgMembers` → imported by registry (route TBD) `[NEEDS MANUAL CONFIRMATION]`

The remaining 8 handlers (`addMember`, `getMember`, `listMembers`, `updateMember`, `reviewApplication`, `listApplications`, `listCategories`, `upsertCategory`) are NOT imported by the registry and NOT registered in `app.ts`. They are **dead code** superseded by `association:member` TypeSpec handlers.

---

## Role Inventory

| Role | Source | Frontend Usage | Backend Usage | Notes |
|------|--------|---------------|---------------|-------|
| `user` (any authenticated) | Better-Auth | Can apply for membership, view own memberships, view org profile | `authMiddleware({ roles: ["user"] })` on application create, org profile read | Base role |
| `association:admin` (officer) | TypeSpec x-security-required-roles | Officer dashboard: roster, applications, categories, import, member detail | `authMiddleware({ roles: ["association:admin"] })` on all mutation/admin routes | Primary officer role |
| `PRESIDENT` | `POSITION_TITLES` constant | Frontend hides org profile edit from non-presidents | `requirePosition([PRESIDENT])` in `updateOrgProfile` handler | Position-level restriction |
| `SECRETARY` | `POSITION_TITLES` constant | Not visually restricted in frontend | `requirePosition([PRESIDENT, SECRETARY])` in `importMembers` handler | Position-level restriction for dead handler only |
| Unauthenticated | app.ts middleware config | Invite validation page | `/invite/validate/*` has NO auth middleware (by design) | Public endpoint |

---

## Role Access Matrix

| Role | Route/Action | Expected Access | Frontend Enforcement | Backend Enforcement | Status | Severity |
|------|-------------|----------------|---------------------|-------------------|--------|----------|
| user | `POST /association/member/applications` | Allow (apply) | Yes — application form accessible to members | `authMiddleware({ roles: ["user"] })` | OK | — |
| user | `GET /membership/org-profile/:orgId` | Allow (read) | Accessible via org pages | `authMiddleware({ roles: ["user"] })` | OK | — |
| user | `GET /association/member/roster` | Deny | Hidden (officer routes only) | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| user | `POST /association/member/applications/:id/approve` | Deny | Hidden (officer-only UI) | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `GET /association/member/roster` | Allow | Officer roster page | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `POST /association/member/roster` | Allow | "Add Member" button on roster | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `POST /association/member/roster/import` | Allow | CSV import page | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `PUT /association/member/roster/:memberId` | Allow | Member detail update/suspend/reinstate | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `GET /association/member/applications` | Allow | Applications list | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `POST /.../applications/:id/approve` | Allow | Approve button | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `POST /.../applications/:id/deny` | Allow | Deny button | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `POST /.../applications/bulk-approve` | Allow | Bulk approve button | `authMiddleware({ roles: ["association:admin"] })` | OK | — |
| association:admin | `PUT /membership/org-profile/:orgId` | Allow (officer) | Org profile edit page | `authMiddleware({ roles: ["association:admin"] })` + `requirePosition([PRESIDENT])` | OK | — |
| any auth user | `GET /membership/org-profile/:orgId` | Read any org | No cross-org check | roles: ["user"] — no org membership check | `[NEEDS PRODUCT DECISION]` | P2 |
| unauthenticated | `GET /invite/validate/:token` | Allow | Public invite page | No auth middleware (by design) | OK | — |
| unauthenticated | `POST /invite` | Deny | — | `authMiddleware() + orgContextMiddleware()` | OK | — |

---

## Permission Gap Report

| ID | Gap | Role | Route/API/Component | Evidence | Risk | Severity | Recommended Test Type |
|----|-----|------|-------------------|----------|------|----------|---------------------|
| PG-M4-01 | Any authenticated user can read any org's profile by organizationId — no org membership check | `user` | `GET /membership/org-profile/:organizationId` | Handler reads org by ID with no ownership check. Route auth is `roles: ["user"]`. | Low — read-only, org data is semi-public. But leaks contactEmail and region to non-members. | P2 | API/integration test |
| PG-M4-02 | `listOrgApplications` and `listOrgMembers` imported from `membership/` into registry — handler-level auth unknown, route-level auth needs confirmation | association:admin? | Registry lines 373-374 | `services/api-ts/src/generated/openapi/registry.ts:373-374` | If route-level auth is missing, any auth user could list org members/applications. `[NEEDS MANUAL CONFIRMATION]` | P1 | API/integration test |
| PG-M4-03 | 8 dead handlers in `membership/` directory with no auth guards | N/A | `addMember`, `getMember`, `listMembers`, `updateMember`, `reviewApplication`, `listApplications`, `listCategories`, `upsertCategory` | Not imported by registry, not registered in app.ts | Low — unreachable. Cleanup recommended to prevent confusion. | P3 | N/A (dead code removal) |
| PG-M4-04 | `upsertCategory` dead handler has no role check — if ever re-connected, any auth user could modify categories | any auth user | `services/api-ts/src/handlers/membership/upsertCategory.ts` | Handler accesses `session.user.id` but performs no role/position check | Medium — currently dead, but risk if revived without adding auth | P3 | N/A (dead code) |
| PG-M4-05 | `reviewApplication` dead handler has no role check — if ever re-connected, any auth user could approve/deny applications | any auth user | `services/api-ts/src/handlers/membership/reviewApplication.ts` | Handler accesses session but performs no role check | Medium — currently dead, critical if revived | P3 | N/A (dead code) |
| PG-M4-06 | No org-scoping enforcement in `getOrgProfile` — user in org A can read org B's profile | user | `services/api-ts/src/handlers/membership/getOrgProfile.ts` | Takes `organizationId` from URL param, does `repo.findById(orgId)` with no user→org membership check | Low — read-only data | P2 | API/integration test |
| PG-M4-07 | Frontend category editor sends fields (`duesAmount`, `billingCycle`, `sortOrder`, `active`, `id`) NOT in TypeSpec `UpsertCategoryBody` — uses type cast to bypass | association:admin | `apps/memberry/src/features/membership/components/category-editor.tsx` | `as UpsertCategoryBody as Parameters<...>` double-cast | Medium — backend may silently ignore extra fields, or hand-wired handler may accept them without validation | P1 | Integration test |

---

## Test Coverage Recommendations

| Permission Rule | Existing Test | Missing Test | Recommended Test Type |
|----------------|--------------|-------------|---------------------|
| Only `association:admin` can list roster | None found for role denial | Deny test: user role calling `GET /association/member/roster` | API/integration |
| Only `association:admin` can approve/deny applications | None found for role denial | Deny test: user role calling approve/deny endpoints | API/integration |
| Only `PRESIDENT` can update org profile | None found for position denial | Deny test: non-president officer calling `PUT /membership/org-profile/:orgId` | API/integration |
| Any auth user can create application | E2E touches this | Happy path + duplicate application test | API/integration |
| Unauthenticated user can validate invite | `invite.test.ts` exists | Verify 401 on create/claim without auth | API/integration |
| Cross-org isolation: user can't access other org's roster | None found | User from org A calling roster for org B | API/integration + E2E |
| Bulk approve requires `association:admin` | Backend test exists | Deny test: user role calling bulk-approve | API/integration |

---

## Gate 2 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 2 | Membership/Applications | **PASS** | Roles identified, access matrix built, gaps documented with evidence | PG-M4-02 needs manual confirmation for listOrgApplications/listOrgMembers route auth |
