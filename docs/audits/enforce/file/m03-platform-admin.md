# Per-File Spec Traceability Report: M03 Platform Admin

**Module:** `services/api-ts/src/handlers/platformadmin/`
**Generated:** 2026-05-27
**Spec Version:** MODULE_SPEC v2.0 (2026-05-21)
**Total Files:** 59 (26 controllers, 28 tests, 2 entities, 2 repositories, 1 utility)

---

## Summary

| Metric | Value |
|--------|-------|
| Total files analyzed | 59 |
| Blockers | 1 |
| Warnings | 33 |
| Info | 2 |
| Total findings | 36 |
| Files with findings | 22 |
| Files clean | 37 |
| Test coverage (controllers with paired .test.ts) | 20/26 (77%) |

**Key patterns:**
- 30 of 33 warnings are inline error responses (`ctx.json({ error: ... })`) instead of a typed error taxonomy -- systemic, not per-file
- 1 blocker: `getCommittee.ts` is a stub (2 lines)
- 1 cross-module import boundary crossing in production code (`listAllCommittees.ts` imports from `association:operations`)
- 1 naming convention deviation (`revokeAdmin.ts` -- not verb-first)
- 6 controllers lack dedicated test files (3 have indirect acceptance test coverage)

---

## File Classification Table

| # | File | Classification | Lines | Has Test | Findings |
|---|------|---------------|-------|----------|----------|
| 1 | `ac-m03.platform-admin.test.ts` | test | 246 | -- | 0 |
| 2 | `ac-m14.national-dashboard.test.ts` | test | 420 | -- | 0 |
| 3 | `br-36.national-dashboard.test.ts` | test | 708 | -- | 0 |
| 4 | `createAssociation.test.ts` | test | 44 | -- | 0 |
| 5 | `createAssociation.ts` | controller | 48 | Y | 1 |
| 6 | `createOrganization.test.ts` | test | 58 | -- | 0 |
| 7 | `createOrganization.ts` | controller | 72 | Y | 1 |
| 8 | `deleteAssociation.test.ts` | test | 43 | -- | 0 |
| 9 | `deleteAssociation.ts` | controller | 39 | Y | 1 |
| 10 | `deleteFeatureFlag.test.ts` | test | 43 | -- | 0 |
| 11 | `deleteFeatureFlag.ts` | controller | 39 | Y | 1 |
| 12 | `endImpersonation.test.ts` | test | 149 | -- | 0 |
| 13 | `endImpersonation.ts` | controller | 44 | Y | 1 |
| 14 | `exportDashboardReport.ts` | controller | 171 | N | 7 |
| 15 | `getAdminRole.test.ts` | test | 25 | -- | 0 |
| 16 | `getAdminRole.ts` | controller | 25 | Y | 0 |
| 17 | `getAssociation.test.ts` | test | 40 | -- | 0 |
| 18 | `getAssociation.ts` | controller | 29 | Y | 1 |
| 19 | `getCommittee.ts` | controller | 1 | N | 1 |
| 20 | `getNationalDashboard.ts` | controller | 140 | N* | 4 |
| 21 | `getOrganization.test.ts` | test | 39 | -- | 0 |
| 22 | `getOrganization.ts` | controller | 29 | Y | 1 |
| 23 | `getOrganizationBySlug.test.ts` | test | 152 | -- | 0 |
| 24 | `getOrganizationBySlug.ts` | controller | 58 | Y | 0 |
| 25 | `inviteAdmin.test.ts` | test | 44 | -- | 0 |
| 26 | `inviteAdmin.ts` | controller | 46 | Y | 1 |
| 27 | `listAdmins.test.ts` | test | 43 | -- | 0 |
| 28 | `listAdmins.ts` | controller | 23 | Y | 1 |
| 29 | `listAllCommittees.test.ts` | test | 103 | -- | 0 |
| 30 | `listAllCommittees.ts` | controller | 22 | Y | 2 |
| 31 | `listAssociations.test.ts` | test | 43 | -- | 0 |
| 32 | `listAssociations.ts` | controller | 24 | Y | 1 |
| 33 | `listFeatureFlags.test.ts` | test | 43 | -- | 0 |
| 34 | `listFeatureFlags.ts` | controller | 24 | Y | 1 |
| 35 | `listOrganizations.test.ts` | test | 43 | -- | 0 |
| 36 | `listOrganizations.ts` | controller | 24 | Y | 1 |
| 37 | `listPublicOrgs.test.ts` | test | 240 | -- | 0 |
| 38 | `listPublicOrgs.ts` | controller | 102 | Y | 0 |
| 39 | `platformadmin.test.ts` | test | 279 | -- | 0 |
| 40 | `revokeAdmin.test.ts` | test | 43 | -- | 0 |
| 41 | `revokeAdmin.ts` | controller | 51 | Y | 2 |
| 42 | `setFeatureFlag.test.ts` | test | 60 | -- | 0 |
| 43 | `setFeatureFlag.ts` | controller | 37 | Y | 1 |
| 44 | `startImpersonation.test.ts` | test | 296 | -- | 0 |
| 45 | `startImpersonation.ts` | controller | 62 | Y | 1 |
| 46 | `transitionOrgStatus.test.ts` | test | 72 | -- | 0 |
| 47 | `transitionOrgStatus.ts` | controller | 59 | Y | 1 |
| 48 | `updateAdmin.test.ts` | test | 44 | -- | 0 |
| 49 | `updateAdmin.ts` | controller | 46 | Y | 1 |
| 50 | `updateAssociation.test.ts` | test | 44 | -- | 0 |
| 51 | `updateAssociation.ts` | controller | 45 | Y | 1 |
| 52 | `updateOrganization.test.ts` | test | 44 | -- | 0 |
| 53 | `updateOrganization.ts` | controller | 49 | Y | 1 |
| 54 | `repos/dashboard-snapshot.schema.ts` | entity | 113 | -- | 0 |
| 55 | `repos/dashboard.repo.ts` | repository | 150 | -- | 0 |
| 56 | `repos/platform-admin.repo.ts` | repository | 204 | -- | 0 |
| 57 | `repos/platform-admin.schema.ts` | entity | 142 | -- | 0 |
| 58 | `utils/slug.test.ts` | test | 73 | -- | 0 |
| 59 | `utils/slug.ts` | utility | 33 | Y | 0 |

*N\* = indirect coverage via acceptance test files (`ac-m14`, `br-36`)

---

## Findings Table

| ID | File | Line | Severity | Check | Confidence | SpecSource | Description |
|----|------|------|----------|-------|------------|------------|-------------|
| EF-M03-7c3f01a2 | `getCommittee.ts` | 1 | **blocker** | data-shape | high | MODULE_SPEC | Stub/empty handler file (2 lines). No implementation, no test. Possibly orphan from M19 committee management. |
| EF-M03-a1e80b31 | `createAssociation.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` instead of typed error response with code/type/detail fields. |
| EF-M03-b2f90c42 | `createOrganization.ts` | 19 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-c3a01d53 | `deleteAssociation.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-d4b12e64 | `deleteFeatureFlag.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-e5c23f75 | `endImpersonation.ts` | 19 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-f6d34086 | `exportDashboardReport.ts` | 46 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-f6d34087 | `exportDashboardReport.ts` | 50 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'associationId is required' }, 400)` -- no error code field. |
| EF-M03-f6d34088 | `exportDashboardReport.ts` | 63 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Forbidden' }, 403)` -- no error code field. |
| EF-M03-f6d34089 | `exportDashboardReport.ts` | 67 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Forbidden: export requires platform admin...' }, 403)`. |
| EF-M03-f6d3408a | `exportDashboardReport.ts` | 76 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Invalid JSON body' }, 400)` -- no error code field. |
| EF-M03-f6d3408b | `exportDashboardReport.ts` | 119 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Invalid date range' }, 400)` -- no error code field. |
| EF-M03-f6d3408c | `exportDashboardReport.ts` | 123 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'dateRangeStart must be before dateRangeEnd' }, 400)`. |
| EF-M03-07e45197 | `getAssociation.ts` | 17 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-18f562a8 | `getNationalDashboard.ts` | 72 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-18f562a9 | `getNationalDashboard.ts` | 78 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'associationId is required' }, 400)` -- no error code. |
| EF-M03-18f562aa | `getNationalDashboard.ts` | 91 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Forbidden' }, 403)` -- no error code field. |
| EF-M03-18f562ab | `getNationalDashboard.ts` | 95 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Forbidden: national dashboard access requires...' }, 403)`. |
| EF-M03-29067319 | `getOrganization.ts` | 17 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-3a17842a | `inviteAdmin.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-4b28953b | `listAdmins.ts` | 15 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-5c39a64c | `listAllCommittees.ts` | 10 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-5c39a64d | `listAllCommittees.ts` | 2 | info | import-boundary | high | MODULE_MAP | Cross-module import: `CommitteeRepository` from `@/handlers/association:operations/repos/committee.repo`. Production code crosses module boundary. |
| EF-M03-6d4ab75d | `listAssociations.ts` | 16 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-7e5bc86e | `listFeatureFlags.ts` | 16 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-8f6cd97f | `listOrganizations.ts` | 16 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-907dea80 | `revokeAdmin.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-907dea81 | `revokeAdmin.ts` | 1 | info | naming | medium | MODULE_SPEC | Handler filename `revokeAdmin` does not start with standard verb prefix. Expected `delete` or `remove` per convention. `revoke` is acceptable domain language but inconsistent with other handlers. |
| EF-M03-a18efb91 | `setFeatureFlag.ts` | 17 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-b290cca2 | `startImpersonation.ts` | 23 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-c3a1ddb3 | `transitionOrgStatus.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-d4b2eec4 | `updateAdmin.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-e5c3ffd5 | `updateAssociation.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |
| EF-M03-f6d400e6 | `updateOrganization.ts` | 18 | warning | error-taxonomy | high | API_CONTRACTS | Inline `ctx.json({ error: 'Unauthorized' }, 401)` -- same pattern. |

---

## Review Required

### Blocker (1)

**EF-M03-7c3f01a2 -- `getCommittee.ts` is a stub file.** Only 2 lines (likely a bare export or re-export). No implementation, no test file. MODULE_SPEC does not declare a `getCommittee` endpoint -- this is likely orphan code from M19 (Committee Management) that was placed in the wrong handler directory. Action: either implement with proper spec backing, or remove the file.

### Systemic Warning: Inline Error Taxonomy (30 findings)

All 26 controllers use `ctx.json({ error: '...' }, statusCode)` for error responses. API_CONTRACTS specifies structured error responses with `code`, `type`, and `detail` fields. This is a **module-wide pattern** affecting every handler, not individual bugs.

**Impact:** Clients cannot programmatically distinguish error types. Frontend error handling must string-match error messages.

**Recommended fix:** Create a shared error helper:
```typescript
// utils/errors.ts
export const unauthorized = (ctx: Context) =>
  ctx.json({ code: 'UNAUTHORIZED', type: 'auth', detail: 'Session required' }, 401);
export const forbidden = (ctx: Context, detail: string) =>
  ctx.json({ code: 'FORBIDDEN', type: 'auth', detail }, 403);
export const badRequest = (ctx: Context, code: string, detail: string) =>
  ctx.json({ code, type: 'validation', detail }, 400);
```

### Cross-Module Import (1 finding)

**EF-M03-5c39a64d -- `listAllCommittees.ts` imports `CommitteeRepository` from `association:operations`.** This is the only production-code cross-module import in the module. The MODULE_MAP shows platformadmin has a dependency on association:operations for committee data. This is read-only access. Low severity but should ideally use an interface or facade.

### Naming Convention (1 finding)

**EF-M03-907dea81 -- `revokeAdmin.ts`** uses `revoke` instead of `delete`/`remove`. Domain-appropriate but inconsistent with the verb-first pattern used by all other handlers (`create*`, `get*`, `list*`, `update*`, `delete*`, `set*`, `start*`, `end*`, `transition*`, `export*`, `invite*`).

### Controllers Without Dedicated Test Files

| Controller | Lines | Coverage Notes |
|-----------|-------|---------------|
| `exportDashboardReport.ts` | 171 | **No test coverage.** Highest risk -- 7 error paths, complex auth check. |
| `getNationalDashboard.ts` | 140 | Indirect coverage via `ac-m14.national-dashboard.test.ts` and `br-36.national-dashboard.test.ts`. |
| `getCommittee.ts` | 1 | Stub -- needs implementation first. |

---

## Checks Performed Per File

| # | Check | Description | Spec Source |
|---|-------|-------------|------------|
| 1 | Error taxonomy | Scanned for `ctx.json({ error: ... })` without structured error codes. Compared against API_CONTRACTS error response schemas. | API_CONTRACTS |
| 2 | Domain terms | Checked for forbidden synonyms: `tenant`, `customer`, `subscriber`, `company`, `account` (outside established identifiers). **None found.** | MODULE_SPEC s2 |
| 3 | Data shape | Validated for `any` types in production code, stub files, raw SQL. `any` types found only in test files (acceptable). No raw SQL detected. | MODULE_SPEC, DOMAIN_MODEL |
| 4 | Naming conventions | Verified handler filenames follow verb-first pattern per MODULE_SPEC convention. | MODULE_SPEC s20 |
| 5 | Import boundaries | Cross-referenced all `@/handlers/` imports against MODULE_MAP allowlist. | MODULE_MAP |

---

## Spec Artifacts Used

| Artifact | Path | Used For |
|----------|------|----------|
| MODULE_SPEC | `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` | Entity definitions, workflows, business rules, naming, acceptance criteria, domain terms |
| API_CONTRACTS | `docs/product/modules/m03-platform-admin/API_CONTRACTS.md` | Endpoint signatures, error response shapes, status codes, request/response fields |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | Entity schema validation (s8 Platform Admin), aggregate boundaries, state machines, anti-corruption layers |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | Platform admin journey (WF-015 through WF-022), role activity mapping (s3.5) |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | Auth middleware stack (s2), platform admin permission matrix s3.7 (super/admin/support levels) |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | Import boundary allowlist, cross-module dependency validation |

---

## Methodology

**Classification rules:**
- `*.test.ts` -> test
- `repos/*.schema.ts` -> entity
- `repos/*` -> repository
- `utils/*` -> utility
- `jobs/*` -> service
- All other `*.ts` -> controller

**Finding IDs:** `EF-M03-{hash8}` where hash is content-based (file + line + check type).

**Severity scale:**
- **blocker** -- Prevents correct operation; must fix before ship
- **warning** -- Spec divergence or quality issue; should fix
- **info** -- Style, convention, or optimization suggestion
