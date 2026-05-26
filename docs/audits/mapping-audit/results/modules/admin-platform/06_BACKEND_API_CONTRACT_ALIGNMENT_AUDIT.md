# Audit 06 — Backend/API Contract Alignment
## Module: Admin / Platform Administration
**Date:** 2026-05-26
**Branch:** audit/codebase-improvements
**Auditor:** Claude Code (automated)

---

## 1. API Catalogue

All endpoints are under the `/admin/*` wildcard which applies `authMiddleware() + platformAdminAuthMiddleware()` before any route handler runs. Public endpoints bypass this wildcard.

### 1.1 Generated Routes (TypeSpec → OpenAPI → routes.ts)

| # | Method | Path | Route-Level Auth | Handler | OpenAPI OperationId |
|---|--------|------|-----------------|---------|---------------------|
| 1 | POST | `/admin/admins` | `authMiddleware()` | `inviteAdmin` | `inviteAdmin` |
| 2 | GET | `/admin/admins` | `authMiddleware()` | `listAdmins` | `listAdmins` |
| 3 | PATCH | `/admin/admins/:adminId` | `authMiddleware()` | `updateAdmin` | `updateAdmin` |
| 4 | DELETE | `/admin/admins/:adminId` | `authMiddleware()` | `revokeAdmin` | `revokeAdmin` |
| 5 | POST | `/admin/associations` | `authMiddleware()` | `createAssociation` | `createAssociation` |
| 6 | GET | `/admin/associations` | `authMiddleware()` | `listAssociations` | `listAssociations` |
| 7 | GET | `/admin/associations/:associationId` | `authMiddleware()` | `getAssociation` | `getAssociation` |
| 8 | PATCH | `/admin/associations/:associationId` | `authMiddleware()` | `updateAssociation` | `updateAssociation` |
| 9 | DELETE | `/admin/associations/:associationId` | `authMiddleware()` | `deleteAssociation` | `deleteAssociation` |
| 10 | GET | `/admin/committees` | `authMiddleware({ roles: ["platform_admin"] })` | `listAllCommittees` | `listAllCommittees` |
| 11 | GET | `/admin/committees/:id` | `authMiddleware({ roles: ["platform_admin"] })` | `getCommittee` | `getCommittee` |
| 12 | POST | `/admin/feature-flags` | `authMiddleware()` | `setFeatureFlag` | `setFeatureFlag` |
| 13 | GET | `/admin/feature-flags` | `authMiddleware()` | `listFeatureFlags` | `listFeatureFlags` |
| 14 | DELETE | `/admin/feature-flags/:flagId` | `authMiddleware()` | `deleteFeatureFlag` | `deleteFeatureFlag` |
| 15 | POST | `/admin/impersonate` | `authMiddleware()` | `startImpersonation` | `startImpersonation` |
| 16 | POST | `/admin/impersonate/:sessionId/end` | `authMiddleware()` | `endImpersonation` | `endImpersonation` |
| 17 | GET | `/admin/me/role` | `authMiddleware({ roles: ["platform_admin"] })` | `getAdminRole` | `getAdminRole` |
| 18 | GET | `/admin/national-dashboard/:associationId` | `authMiddleware({ roles: ["platform_admin", "national_officer"] })` | `getNationalDashboard` | `getNationalDashboard` |
| 19 | POST | `/admin/organizations` | `authMiddleware()` | `createOrganization` | `createOrganization` |
| 20 | GET | `/admin/organizations` | `authMiddleware()` | `listOrganizations` | `listOrganizations` |
| 21 | GET | `/admin/organizations/:organizationId` | `authMiddleware()` | `getOrganization` | `getOrganization` |
| 22 | PATCH | `/admin/organizations/:organizationId` | `authMiddleware()` | `updateOrganization` | `updateOrganization` |
| 23 | POST | `/admin/organizations/:organizationId/transition` | `authMiddleware()` | `transitionOrgStatus` | `transitionOrgStatus` |

### 1.2 Hand-Wired Routes (app.ts — under `/admin/*` wildcard)

| Method | Path | Auth Applied | Handler | Source Module | Notes |
|--------|------|-------------|---------|--------------|-------|
| GET | `/admin/national-dashboard/:associationId` | wildcard (`authMiddleware + platformAdminAuthMiddleware`) | `getNationalDashboard` | `platformadmin` | **DUPLICATE** of generated route #18 |
| GET | `/admin/committees` | wildcard | `listAllCommittees` | `platformadmin` | **DUPLICATE** of generated route #10 |
| GET | `/admin/committees/:id` | wildcard | `getCommittee` | `association:operations` | **DUPLICATE** of generated route #11 |
| GET | `/admin/surveys` | `authMiddleware() + platformAdminAuthMiddleware()` | `listAdminSurveys` | `surveys` | No TypeSpec; hand-wired only |

### 1.3 Public Endpoints (no auth)

| Method | Path | Handler | TypeSpec? |
|--------|------|---------|-----------|
| GET | `/public/orgs` | `listPublicOrgs` | No — hand-wired only |
| GET | `/public/org/:slug` | `getOrganizationBySlug` | No — hand-wired only |

### 1.4 Registration Order Issue

In `app.ts`, the wildcard middleware `app.use('/admin/*', authMiddleware(), platformAdminAuthMiddleware())` is registered at line ~200, then immediately followed by the hand-wired `/admin/national-dashboard`, `/admin/committees`, `/admin/committees/:id` registrations (lines 203–205). The generated routes are registered later via `registerOpenAPIRoutes(app)`. In Hono, the **first matching route wins**. The hand-wired routes registered after the wildcard but before the generated routes will match first. For the three duplicated routes, Hono serves the hand-wired handler; the generated route handler is **dead code at runtime**.

---

## 2. Frontend API Usage Matrix

All admin frontend pages live in `apps/admin/src/routes/`. They consume auto-generated SDK hooks from `@monobase/sdk-ts/generated/@tanstack/react-query.gen`.

| Frontend Route | SDK Hook(s) Used | Backend Endpoint(s) Hit | Notes |
|---------------|-----------------|------------------------|-------|
| `/` (dashboard) | `listAssociationsOptions`, `listOrganizationsOptions`, `listAdminsOptions`, `listFeatureFlagsOptions`, `searchEventsOptions`, `listAuditLogsOptions` | GET `/admin/associations`, `/admin/organizations`, `/admin/admins`, `/admin/feature-flags`, events search, audit logs | Multi-query dashboard |
| `/associations` | `listAssociationsOptions` | GET `/admin/associations` | With `limit: 100` |
| `/associations/:id` | `useQuery(getAssociation...)` | GET `/admin/associations/:id` | — |
| `/associations/:id` (mutations) | `createMutation`, `updateMut`, `deleteMut` via `useMutation` | POST/PATCH/DELETE `/admin/associations` | — |
| `/organizations` | `listOrganizationsOptions` | GET `/admin/organizations` | With `limit: 50` |
| `/organizations/:id` | `useQuery(getOrganization...)` | GET `/admin/organizations/:id` | — |
| `/operators` (admins) | `listAdminsOptions`, `invite`, `revoke` via `useMutation` | GET/POST/DELETE `/admin/admins` | — |
| `/impersonate` | `startImpersonation`, `endImpersonationMut` via `useMutation` | POST `/admin/impersonate`, POST `/admin/impersonate/:id/end` | — |
| `/feature-flags` | `listFeatureFlagsOptions`, `deleteFlag` via `useMutation` | GET/POST/DELETE `/admin/feature-flags` | — |
| `/national-dashboard` | `useQuery<NationalDashboardResponse>({...})` | GET `/admin/national-dashboard/:associationId` | **Raw `useQuery` with manual URL construction — not using SDK hook** |
| `/committees` | `useQuery<{ data: CommitteeItem[] }>({...})` | GET `/admin/committees` | **Raw `useQuery` with manual URL construction — not using SDK hook** |
| `/surveys` | `useQuery(...)` | GET `/admin/surveys` | **Raw `useQuery` — no SDK hook exists** (endpoint not in TypeSpec) |

---

## 3. Frontend/Backend Drift Report

### DRIFT-01: Duplicate route registration — three routes serve hand-wired handler, generated handler is dead code

**Severity: HIGH**

Routes `/admin/national-dashboard/:associationId`, `/admin/committees`, and `/admin/committees/:id` are registered twice:
1. Hand-wired in `app.ts` lines 203–205 (registered first, wins in Hono)
2. Generated in `routes.ts` (registered later, never reached)

The generated route for `getNationalDashboard` carries explicit role restriction `authMiddleware({ roles: ["platform_admin", "national_officer"] })`. The hand-wired route relies solely on the wildcard (`platformAdminAuthMiddleware` checks platform_admin table — national officers are NOT in that table). This means **national officers who are designated to see the national dashboard cannot access it**, because the winning (hand-wired) route rejects them — they are not in the `platform_admin` table.

The generated route for `listAllCommittees` carries `authMiddleware({ roles: ["platform_admin"] })` which is redundant-but-harmless over the wildcard. No functional difference for committees.

### DRIFT-02: `/admin/surveys` has no TypeSpec definition, no SDK hook

**Severity: MEDIUM**

`GET /admin/surveys` is hand-wired only. No TypeSpec definition exists, no generated SDK hook. The frontend constructs the query manually. Any future TypeSpec generation for this endpoint will not automatically propagate to consumers. Response shape is not contract-validated.

### DRIFT-03: `/public/org/:slug` and `/public/orgs` have no TypeSpec definition

**Severity: LOW**

Both public org discovery endpoints are hand-wired only. No OpenAPI spec, no generated hook. Frontend consumers must maintain manual fetch logic. No schema validation on response shape.

### DRIFT-04: OpenAPI request body schemas missing `required` field declarations for most operations

**Severity: HIGH**

The OpenAPI spec lists `required: []` (empty) for the request bodies of: `inviteAdmin`, `updateAdmin`, `createAssociation`, `updateAssociation`, `setFeatureFlag`, `createOrganization`, `updateOrganization`. These bodies are represented as opaque `$ref` schemas (`PlatformAdminModulePlatformAdminRequestSchema`, etc.) that inline their required constraints inside the referenced schema — but the top-level `required` array in `requestBody` is empty. This means OpenAPI tooling and Schemathesis fuzzing cannot surface required-field violations as 400s. Only `startImpersonation` (`targetUserId`) and `transitionOrgStatus` (`status`) have explicit `required` arrays.

**Evidence:** The node analysis of `openapi.json` returned `"required": []` for 7 of 9 request body operations.

### DRIFT-05: Frontend national dashboard uses raw `useQuery` with manual URL, bypassing SDK type safety

**Severity: MEDIUM**

The admin `/national-dashboard` page constructs the fetch URL manually and types the response as `useQuery<NationalDashboardResponse>` with a local type definition. If the backend response shape changes, TypeScript will not catch the mismatch at compile time (no generated hook to update). Same pattern applies to `/committees`.

### DRIFT-06: `analyst` role visible on national-dashboard frontend but blocked by backend middleware

**Severity: HIGH**

The `ROUTE_ROLES` map in the admin frontend grants `/national-dashboard` access to `['super', 'support', 'analyst']`. However, the `platformAdminAuthMiddleware` wildcard gates all `/admin/*` routes — and the generated route specifies `roles: ["platform_admin", "national_officer"]`. The analyst role IS in the `platform_admin` table, so they pass the wildcard. But the hand-wired route (which wins) does not perform additional sub-role filtering. Result: analysts CAN currently reach the national dashboard via the winning hand-wired route. The generated route would restrict them to `platform_admin` only (which includes all sub-roles). This is **inconsistent with intent**: no decision exists in code about whether analysts should see national dashboard data.

### DRIFT-07: `getCommittee` handler sourced from `association:operations` module, not `platformadmin`

**Severity: LOW**

The hand-wired route `GET /admin/committees/:id` imports `getCommittee` from `@/handlers/association:operations/getCommittee`, while the generated route in `routes.ts` assigns the `getCommittee` registry entry (also from `association:operations`). This is consistent but worth noting: the committees feature spans two module boundaries.

---

## 4. Auth / Role / Ownership / Tenant Matrix

### 4.1 Auth Layer Stack

```
Request → CORS → RateLimit → ImpersonationResolver → ImpersonationWriteBlock
       → [route-specific] app.use('/admin/*', authMiddleware() + platformAdminAuthMiddleware())
       → [generated routes] authMiddleware() or authMiddleware({roles:[...]})
       → handler
```

### 4.2 platformAdminAuthMiddleware Behavior

- Reads `platformAdmin` from context (set by `authMiddleware`)
- Looks up user in `platform_admin` table by `userId`
- Sets `ctx.set('platformAdmin', record)` if found
- Throws `ForbiddenError` if user not in table
- Does **NOT** check sub-role (super/support/analyst) — that is left to individual handlers or route-level role checks

### 4.3 Role/Permission Matrix

| Endpoint | Wildcard (platformAdmin table) | Route-Level Role | Handler Sub-Role Check | Effective Access |
|----------|-------------------------------|-----------------|----------------------|-----------------|
| POST `/admin/admins` (inviteAdmin) | Yes | None extra | None | All platform admins |
| GET `/admin/admins` | Yes | None extra | None | All platform admins |
| PATCH `/admin/admins/:adminId` | Yes | None extra | None | All platform admins |
| DELETE `/admin/admins/:adminId` | Yes | None extra | Prevents last super deletion | All platform admins (business guard on super removal) |
| POST `/admin/associations` | Yes | None extra | None | All platform admins |
| GET `/admin/associations` | Yes | None extra | None | All platform admins |
| GET `/admin/associations/:id` | Yes | None extra | None | All platform admins |
| PATCH `/admin/associations/:id` | Yes | None extra | None | All platform admins |
| DELETE `/admin/associations/:id` | Yes | None extra | None | All platform admins |
| GET `/admin/committees` | Yes | `platform_admin` (dead — hand-wired wins) | None | All platform admins via wildcard |
| GET `/admin/committees/:id` | Yes | `platform_admin` (dead — hand-wired wins) | None | All platform admins via wildcard |
| POST `/admin/feature-flags` | Yes | None extra | None | All platform admins |
| GET `/admin/feature-flags` | Yes | None extra | None | All platform admins |
| DELETE `/admin/feature-flags/:flagId` | Yes | None extra | None | All platform admins |
| POST `/admin/impersonate` | Yes | None extra | `super` or `support` only | super + support |
| POST `/admin/impersonate/:id/end` | Yes | None extra | Session ownership check | Admin who started session |
| GET `/admin/me/role` | Yes | `platform_admin` (redundant) | Uses `ctx.get('platformAdmin')` | All platform admins |
| GET `/admin/national-dashboard/:id` | Yes (hand-wired wins) | `platform_admin + national_officer` (dead) | Association-level access check | **All platform admins** (national officers excluded by wildcard) |
| POST `/admin/organizations` | Yes | None extra | None | All platform admins |
| GET `/admin/organizations` | Yes | None extra | None | All platform admins |
| GET `/admin/organizations/:id` | Yes | None extra | None | All platform admins |
| PATCH `/admin/organizations/:id` | Yes | None extra | None | All platform admins |
| POST `/admin/organizations/:id/transition` | Yes | None extra | State machine validation | All platform admins |
| GET `/admin/surveys` | `authMiddleware() + platformAdminAuthMiddleware()` (explicit) | None | None | All platform admins |
| GET `/public/orgs` | None | None | None | Public |
| GET `/public/org/:slug` | None | None | None | Public |

### 4.4 Critical Auth Gaps

**GAP-AUTH-01:** `inviteAdmin`, `updateAdmin`, `revokeAdmin` have no sub-role restriction. Any platform admin (including `analyst`) can invite/update/revoke other admins. The spec intent (M03) restricts admin management to `super` only.

**GAP-AUTH-02:** `createAssociation`, `updateAssociation`, `deleteAssociation` have no sub-role restriction. `analyst` role can mutate association records. Intent: `super` + `support` for writes.

**GAP-AUTH-03:** `createOrganization`, `updateOrganization`, `transitionOrgStatus` have no sub-role restriction. `analyst` can create/modify/transition organizations. Intent: `super` + `support` for writes.

**GAP-AUTH-04:** `setFeatureFlag`, `deleteFeatureFlag` have no sub-role restriction. `analyst` can toggle feature flags for any org/tier. Intent: `super` only.

**GAP-AUTH-05:** `startImpersonation` correctly restricts to `super`/`support` via handler-level check. However, the route-level auth (`authMiddleware()`) does not enforce this — the sub-role check is only inside the handler. If the handler logic changes, the route has no defense-in-depth.

**GAP-AUTH-06:** National officers (legitimate designated users) cannot reach `GET /admin/national-dashboard/:associationId` because the hand-wired route (which wins) requires the platform_admin table entry — national officers are not in that table. The generated route intended to allow them is dead code.

### 4.5 Impersonation Write-Block

The `impersonationWriteBlock()` middleware runs globally (`app.use('*', ...)`). It blocks POST/PUT/PATCH/DELETE for any session with a valid `memberry-imp-token` cookie. Session expiry is enforced at 2 hours (`MAX_IMPERSONATION_DURATION_MS = 2 * 60 * 60 * 1000`) plus DB-stored `expiresAt`. Double-checked: cookie expiry AND `session.expiresAt > new Date()`. This is correctly implemented.

---

## 5. Validation Alignment Matrix

### 5.1 Request Body Validation

| Operation | Zod Validator Applied | Fields Validated | Required in OpenAPI | Gap |
|-----------|----------------------|-----------------|--------------------|----|
| inviteAdmin | `InviteAdminBody` (refs `PlatformAdminModulePlatformAdminRequestSchema`) | email, name, role | `[]` in spec | OpenAPI `required` array empty — spec does not enforce required fields to clients |
| updateAdmin | `UpdateAdminBody` | role (partial) | `[]` in spec | Same |
| createAssociation | `CreateAssociationBody` | name, country, currency, locale, licenseFormatRegex, creditCyclePeriod, requiredCreditsPerCycle, carryoverEnabled | `[]` in spec | name, country, currency not declared required in OpenAPI top-level |
| updateAssociation | `UpdateAssociationBody` | All fields optional (patch semantics) | `[]` in spec | Correct for PATCH — no gap |
| createOrganization | `CreateOrganizationBody` (refs `PlatformAdminModuleOrganizationRequestSchema`) | name, associationId, orgType, contactEmail, etc. | `[]` in spec | name, associationId not declared required in OpenAPI top-level |
| updateOrganization | `UpdateOrganizationBody` | All optional (patch semantics) | `[]` in spec | Correct for PATCH |
| setFeatureFlag | `SetFeatureFlagBody` | moduleName, targetType, targetId, enabled | `[]` in spec | targetType not validated as enum in OpenAPI required array |
| startImpersonation | Zod validates `targetUserId` (required), `targetOrgId` (optional) | Both fields | `["targetUserId"]` | Aligned |
| transitionOrgStatus | Zod validates `status` as `OrgLifecycleStatus` enum | status | `["status"]` | Aligned |
| endImpersonation | Param only: `sessionId` | sessionId | N/A | Aligned |
| deleteAssociation | Param only: `associationId` | associationId | N/A | Aligned |
| deleteFeatureFlag | Param only: `flagId` | flagId | N/A | Aligned |
| revokeAdmin | Param only: `adminId` | adminId | N/A | Aligned |

### 5.2 Query Parameter Validation

| Operation | Zod Validator | Notable Constraints |
|-----------|--------------|---------------------|
| listAdmins | None (no query params) | — |
| listAssociations | `ListAssociationsQuery` | offset, limit, page, pageSize, q, sort |
| listOrganizations | `ListOrganizationsQuery` | offset, limit, q, sort, associationId, status enum |
| listFeatureFlags | `ListFeatureFlagsQuery` | moduleName, targetType, targetId filters |
| getNationalDashboard | Param `associationId` only | No query params validated |

### 5.3 Missing Validation

**VAL-01:** `setFeatureFlag` — `targetType` is validated as a string in Zod (`PlatformAdminModuleFeatureFlagTargetTypeSchema`) but the contract spec defines it as enum `tier | org`. If the referenced schema uses `.enum(['tier','org'])`, this is aligned; if it uses `.string()`, invalid values pass through to the database.

**VAL-02:** `createAssociation` — `licenseFormatRegex` is passed directly to the database without regex validity check. An invalid regex string stored and later used for member license validation could cause runtime errors.

**VAL-03:** `createOrganization` / `updateOrganization` — `trialStartDate`/`trialEndDate` are accepted but no validator enforces `trialEndDate > trialStartDate`. The handler does not check this constraint.

**VAL-04:** `listOrganizations` query — `associationId` filter accepts any string (no UUID format validation). Non-UUID values will produce a DB type error instead of a clean 400.

---

## 6. Error Contract Matrix

### 6.1 OpenAPI Declared Error Codes vs Handler Reality

| Operation | OpenAPI Codes | Handler Throws | Direct `ctx.json` | Gap |
|-----------|--------------|---------------|------------------|-----|
| inviteAdmin | 201, 400, 401, 409 | ConflictError (409) | 401 | 403 not declared (analyst could attempt, gets 403 from wildcard — undocumented) |
| listAdmins | 200, 401 | — | 401 | No 403 declared (wildcard adds it) |
| updateAdmin | 200, 400, 404 | NotFoundError | 401 | Missing 401 in spec (wildcard enforces it) |
| revokeAdmin | 204, 404, 409 | NotFoundError, BusinessLogicError (LAST_SUPER_ADMIN → 422) | 401 | Spec says 409 for conflict; handler throws `BusinessLogicError` which maps to 422 — **mismatch** |
| createAssociation | 201, 400, 401, 403 | ConflictError | 401 | Spec declares 403 but no handler checks sub-role — 403 only from wildcard for non-admins |
| listAssociations | 200, 401 | — | 401 | Same wildcard 403 gap |
| getAssociation | 200, 401, 404 | NotFoundError | 401 | — |
| updateAssociation | 200, 400, 404 | NotFoundError | 401 | Missing 401 in spec |
| deleteAssociation | 204, 404, 409 | NotFoundError | 401 | No 409 currently thrown by handler (no delete-guard logic) — spec declares it |
| listAllCommittees | 200, 401 | — | 401 | — |
| getCommittee | 200, 401, 404 | NotFoundError | 401 | — |
| setFeatureFlag | 200/201, 400, 401 | — | 401 | — |
| listFeatureFlags | 200, 401 | — | 401 | — |
| deleteFeatureFlag | 204, 404, 401 | NotFoundError | 401 | — |
| startImpersonation | 200, 400, 401, 403 | ForbiddenError (sub-role), NotFoundError | 401 | 403 from handler for analyst — aligned |
| endImpersonation | 200, 401, 404 | NotFoundError | 401 | — |
| getAdminRole | 200, 401, 403 | ForbiddenError | — | Correctly uses ForbiddenError |
| getNationalDashboard | 200, 401, 403 | ForbiddenError (cross-chapter) | 401 | — |
| createOrganization | 201, 400, 401 | ConflictError | 401 | 409 not declared for duplicate org name |
| listOrganizations | 200, 401 | — | 401 | — |
| getOrganization | 200, 401, 404 | NotFoundError | 401 | — |
| updateOrganization | 200, 400, 404 | NotFoundError | 401 | Missing 401 in spec |
| transitionOrgStatus | 200, 400, 404, 422 | BusinessLogicError, NotFoundError | 401 | Aligned |

### 6.2 Critical Mismatches

**ERR-01:** `revokeAdmin` — spec declares `409 Conflict` for "cannot revoke last super admin." Handler throws `BusinessLogicError` which maps to **422 Unprocessable Entity**. Frontend receives 422 but spec documents 409. The frontend generic error handler (`err instanceof Error ? err.message : 'Failed...'`) masks this — user gets a toast with the message but the HTTP semantics are wrong.

**ERR-02:** `deleteAssociation` — spec declares `409 Conflict`. Handler has no conflict guard. If an association with active organizations/members is deleted, the DB may throw a FK constraint error which produces an unhandled 500, not a 409.

**ERR-03:** `createOrganization` — handler throws `ConflictError` on duplicate names (409) but OpenAPI only declares 201/400/401. The 409 is uncontracted.

**ERR-04:** Mixed error patterns — handlers inconsistently use `return ctx.json({ error: '...' }, 401)` (direct) vs `throw new UnauthorizedError(...)`. Both coexist in the platformadmin module. The direct `ctx.json` path bypasses the structured error handler, producing `{ error: 'Unauthorized' }` instead of the standard `{ code: 'UNAUTHORIZED', message: '...' }` envelope. Frontend code cannot reliably parse both shapes.

### 6.3 Frontend Error Handling

All admin frontend mutations use the same generic pattern:
```typescript
onError: (err: unknown) => {
  const msg = err instanceof Error ? err.message : 'Failed to ...'
  toast.error(msg)
}
```

No component individually handles 401 (re-auth redirect), 403 (role denial), or 409 (conflict) with distinct UX. The root error component handles global auth failures. This means:
- A 403 from a sub-role denial shows as a toast with the error message — no redirect, no explanation of which role is needed
- A 422 (BusinessLogicError) shows as a toast — indistinguishable from a 409 in UX
- A 401 mid-session (token expiry) shows as a toast error, not a re-auth redirect

---

## 7. API Test Gap Matrix

### 7.1 Existing Test Coverage (platformadmin module)

| Handler | Test File | Auth 401 | Happy Path | Not Found 404 | Sub-Role 403 | Business Logic 422 | Conflict 409 |
|---------|-----------|----------|-----------|--------------|-------------|-------------------|-------------|
| inviteAdmin | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | **No** |
| listAdmins | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| updateAdmin | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| revokeAdmin | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | **No** (last super) | N/A |
| createAssociation | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | **No** |
| listAssociations | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| getAssociation | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| updateAssociation | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| deleteAssociation | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | **No** |
| listAllCommittees | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| getCommittee | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| setFeatureFlag | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| listFeatureFlags | `listFeatureFlags.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| deleteFeatureFlag | `deleteFeatureFlag.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| startImpersonation | `startImpersonation.test.ts` | Yes | Yes | Yes | **Yes** (analyst denied) | N/A | N/A |
| endImpersonation | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| getAdminRole | `platformadmin.test.ts` | Yes | Yes | N/A | N/A | N/A | N/A |
| getNationalDashboard | `br-36.national-dashboard.test.ts` | Yes | Yes | Yes | **Yes** | N/A | N/A |
| createOrganization | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | **No** |
| listOrganizations | `platformadmin.test.ts` | Yes | Yes | N/A | **No** | N/A | N/A |
| getOrganization | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| updateOrganization | `updateOrganization.test.ts` | Yes | Yes | Yes | **No** | N/A | N/A |
| transitionOrgStatus | `platformadmin.test.ts` | Yes | Yes | Yes | **No** | Yes | N/A |
| listAdminSurveys | None found | **No** | **No** | **No** | **No** | **No** | **No** |

### 7.2 Summary

- **401 coverage:** 23/24 handlers (listAdminSurveys missing)
- **Happy path coverage:** 23/24 handlers
- **Sub-role denial (403) coverage:** 2/24 handlers (startImpersonation, getNationalDashboard only)
- **Business logic guard coverage:** 2/24 handlers (transitionOrgStatus, getNationalDashboard)
- **Conflict guard (409) coverage:** 0/24 handlers
- **listAdminSurveys:** Zero test coverage

### 7.3 Missing Tests (Priority Order)

| Priority | Test Needed | Reason |
|----------|------------|--------|
| P0 | `revokeAdmin` → 422 for last super deletion | Known business rule, no test |
| P0 | `inviteAdmin` → 403 for analyst/support roles | Security gap, no enforcement |
| P0 | `setFeatureFlag` / `deleteFeatureFlag` → 403 for non-super | Security gap |
| P0 | `deleteAssociation` → FK conflict guard (or 500 regression) | Undefined behavior |
| P1 | `createAssociation` → 409 Conflict for duplicate name | Existing guard untested |
| P1 | `listAdminSurveys` → full coverage (any test) | Zero coverage |
| P1 | `createOrganization` → 409 for duplicate | Existing guard untested |
| P2 | `transitionOrgStatus` → invalid status transition | State machine edge cases |
| P2 | `startImpersonation` → `endedAt` session reuse | Session lifecycle edge |

### 7.4 Contract Test Coverage (Hurl)

`admin-flow.hurl` covers a 20-step flow including:
- Anonymous → 401 (step 0)
- Sign in (step 1)
- Verify admin role (step 2)
- Create/List/Get/Update/Transition organization (steps 3–7)
- Create/List/Get association (steps 8–10)
- Update association (step 11)
- Create/List/Get admin (steps 12–14)
- Update/Revoke admin (steps 15–16)
- Set/List/Delete feature flag (steps 17–19)
- Delete organization (step 20)

**Not covered in contract tests:** impersonation flow, national dashboard, committees, surveys, public endpoints, sub-role denial, last-super-admin guard.

---

## 8. Frontend Integration Test Matrix

Frontend integration tests are handled by the admin E2E suite:

| Spec File | Coverage |
|-----------|----------|
| `admin-smoke.spec.ts` | Basic page load / auth smoke |
| `admin-routes.spec.ts` | Route navigation and access control |
| `organizations.spec.ts` | Organization CRUD flows |
| `associations.spec.ts` | Association CRUD flows |
| `members.spec.ts` | Member list/search |
| `audit.spec.ts` | Audit log viewing |
| `wave7-role-gate.spec.ts` | Role gate enforcement (UI level) |
| `wave7-routes.spec.ts` | Route protection for Wave 7 routes |

**Missing frontend integration tests:**
- Impersonation flow: start → browse as user → end session
- Feature flag toggle with side effects
- National dashboard with associationId selection
- Committee browse
- Survey list (no spec exists)
- Sub-role denial UX (analyst attempts `setFeatureFlag`, sees error toast)
- `revokeAdmin` → last super admin error message displayed

---

## 9. E2E API-Backed Journey Matrix

| Journey | E2E Coverage | API Endpoints Hit | Status |
|---------|-------------|-----------------|--------|
| Admin signs in, views dashboard | `admin-smoke.spec.ts` | GET `/admin/me/role`, dashboard queries | Covered (smoke) |
| Create association → create org under it → transition org active | `associations.spec.ts`, `organizations.spec.ts` | POST/GET `/admin/associations`, POST/PATCH `/admin/organizations` | Partially covered |
| Invite admin → verify in list → update role → revoke | `admin-routes.spec.ts` | POST/GET/PATCH/DELETE `/admin/admins` | Basic coverage |
| Set feature flag for org → verify in list → delete | Not found | POST/GET/DELETE `/admin/feature-flags` | **No E2E** |
| Start impersonation → browse as target user → end | Not found | POST `/admin/impersonate`, POST `.../end` | **No E2E** |
| National officer views national dashboard | Not found | GET `/admin/national-dashboard/:id` | **No E2E** (also blocked by DRIFT-01) |
| Admin views committees cross-org | Not found | GET `/admin/committees` | **No E2E** |
| Admin views survey analytics | Not found | GET `/admin/surveys` | **No E2E** |
| Analyst attempts restricted mutation → denied | Not found | Any write endpoint | **No E2E** |
| revokeAdmin → last super → error displayed | Not found | DELETE `/admin/admins/:id` | **No E2E** |

---

## 10. Product Decisions Needed

### DECISION-01: Should `analyst` role be read-only?
**Context:** The API contract spec (M03) implies analysts are read-only. No sub-role checks exist on write endpoints. Analysts can currently create associations, create organizations, transition org status, set feature flags, invite/revoke admins. The frontend `ROUTE_ROLES` map grants analysts access to all read-only pages but also shows them mutation UI that the backend does not block.
**Required action:** Decide if analyst = read-only. If yes, add sub-role guards to all write endpoints. If no, document which writes analysts are permitted.

### DECISION-02: Should national officers have a separate identity or be platform admins?
**Context:** The generated route for `getNationalDashboard` specifies `roles: ["platform_admin", "national_officer"]`. The `platformAdminAuthMiddleware` checks the `platform_admin` DB table only. National officers are presumably association-level officers, not platform admins. The hand-wired route (which wins) only accepts platform admins — national officers are excluded.
**Required action:** Define where national officers are authenticated. Options: (a) add them to a separate `national_officer` table + middleware, (b) add a special designation flag on the officer record, (c) restrict national dashboard to platform admins only and remove the `national_officer` role from the route spec.

### DECISION-03: Resolve duplicate route registration for committees and national-dashboard
**Context:** Three routes are registered twice: committees (×2) and national-dashboard (×1). The hand-wired versions win. The generated versions are dead code. This is a maintenance hazard — future TypeSpec changes to these routes will not take effect.
**Required action:** Remove the three hand-wired duplicate registrations from `app.ts` and rely on the generated routes. Ensure the generated routes carry the correct auth middleware, then restart API.

### DECISION-04: Should `/admin/surveys` be in TypeSpec?
**Context:** `GET /admin/surveys` is hand-wired, has no SDK hook, no contract test, no unit test. It is the only admin endpoint completely outside the spec pipeline.
**Required action:** Either add TypeSpec definition and generate the route/hook, or formally document it as a "dark" hand-wired endpoint with manual test coverage.

### DECISION-05: OpenAPI `required` array missing from most request bodies
**Context:** 7 of 9 request body operations have `required: []` in the OpenAPI spec. This prevents contract tools (Schemathesis) from generating missing-field test cases.
**Required action:** Fix TypeSpec model definitions to emit required arrays for mandatory fields (`name`, `country`, `currency` for createAssociation; `name`, `associationId` for createOrganization; `email`, `name`, `role` for inviteAdmin; `moduleName`, `targetType`, `targetId`, `enabled` for setFeatureFlag).

### DECISION-06: Standardize error envelope — direct `ctx.json` vs `throw new XxxError`
**Context:** ~170 direct `return ctx.json({ error: '...' }, 401)` calls coexist with `throw new UnauthorizedError()`. The platformadmin module uses both. Frontend receives inconsistent shapes: `{ error: 'Unauthorized' }` vs `{ code: 'UNAUTHORIZED', message: '...' }`.
**Required action:** Standardize all handlers to `throw new XxxError(...)` and remove direct `ctx.json` error returns. Or document the dual-shape and update frontend parsers to handle both.

---

## 11. Gate 6 Evaluation

### Scoring Rubric (0 = critical blocker, 5 = fully aligned)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| API Catalogue completeness | 4/5 | All routes documented; 3 duplicates and 1 dark endpoint (surveys) are known gaps |
| Frontend/Backend alignment | 3/5 | 3 pages bypass SDK hooks; national dashboard effectively broken for national officers |
| Auth / Role / Ownership | 2/5 | No sub-role enforcement on write endpoints for analyst; national officer path dead code |
| Validation alignment | 3/5 | Zod schemas correct per-handler; OpenAPI `required` arrays missing for 7/9 operations |
| Error contract alignment | 2/5 | revokeAdmin 422 vs spec 409; deleteAssociation unguarded FK; mixed error envelopes |
| Backend test coverage | 3/5 | 401/happy-path strong; sub-role denial weak (2/24); business guards weak; surveys zero |
| Frontend integration tests | 3/5 | CRUD flows covered; impersonation, feature flags, national dashboard, surveys missing |
| E2E API-backed journeys | 2/5 | Core CRUD journeys exist; impersonation, feature flags, national dashboard, surveys missing |

### Overall Gate Status: **CONDITIONAL PASS**

**Must fix before v1.0 ship:**
1. DRIFT-01 + GAP-AUTH-06: Remove hand-wired duplicate routes (committees, national-dashboard) — national officer access is broken today
2. GAP-AUTH-01 through GAP-AUTH-04: Add sub-role enforcement to write endpoints (analyst must be read-only if that is the intent)
3. ERR-01: Fix `revokeAdmin` to throw `ConflictError` (→ 409) not `BusinessLogicError` (→ 422)
4. VAL-02: Add regex validity check before storing `licenseFormatRegex`

**Should fix before v1.0 ship:**
5. DRIFT-04: Fix OpenAPI `required` arrays in TypeSpec for 7 operations
6. DRIFT-06: Clarify analyst access to national dashboard in spec and code
7. ERR-04: Standardize error envelope — eliminate direct `ctx.json` error returns
8. Add unit test for `revokeAdmin` last-super guard (P0 business rule untested)
9. Add unit test for `listAdminSurveys` (zero coverage)

**Can defer:**
- DRIFT-02/03: TypeSpec coverage for surveys + public endpoints (functional but not spec-driven)
- Frontend 403/401 specific UX handling (generic toast is acceptable MVP)
- E2E coverage for impersonation and feature flag flows (covered by unit tests)
