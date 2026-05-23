# Wave 0a Backend Audit

**Date:** 2026-05-23
**Scope:** 3 handler files, 3 migration files, associated tests

---

## 1. Handler Audit: `person/getMyMemberships.ts`

**File:** `services/api-ts/src/handlers/person/getMyMemberships.ts`
**Route:** `GET /persons/me/memberships` (wired in `registry.ts` line 348)

### Findings

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Security | P2 | Auth uses `session` instead of `user` | Uses `ctx.get('session')` and `session.user.id`. Works, but inconsistent with other handlers that use `ctx.get('user')`. If auth middleware changes session shape, this breaks silently. |
| 2 | Cross-module import | P3 | Imports `memberships` schema from `association:member` | `import { memberships } from '@/handlers/association:member/repos/membership.schema'` -- crosses handler boundary. Acceptable for read-only join but creates coupling. |
| 3 | Cross-module import | P3 | Imports `organizations` schema from `platformadmin` | `import { organizations } from '@/handlers/platformadmin/repos/platform-admin.schema'` -- crosses handler boundary. Same coupling concern. |
| 4 | Performance | P2 | No index on `membership.person_id` standalone | Query filters by `eq(memberships.personId, personId)`. The only index covering `person_id` is the composite unique `(organization_id, person_id)`. PG cannot use this efficiently for person_id-only lookups. For users with many orgs or large membership tables, this is a sequential scan. |
| 5 | Performance | P3 | Unbounded query -- no LIMIT | Returns ALL memberships for a user with no pagination. Low risk (users rarely have >20 memberships) but violates defensive query patterns. |
| 6 | Type safety | P3 | `as DatabaseInstance` cast | `ctx.get('database') as DatabaseInstance` -- common pattern in codebase, acceptable. |
| 7 | Observability | P3 | No logging | No logger usage. No correlation ID. Other handlers use `ctx.get('logger')`. |
| 8 | Response shape | P3 | Adds `orgSlug` to response | Includes `orgSlug: organizations.slug` in select. The `association:member` duplicate does NOT include this field. Frontend consumers may depend on this. |
| 9 | Response shape | P2 | Returns `total` in body | Returns `{ data, total }` but total is just `data.length` -- misleading name implies server-side count for paginated results, but there's no pagination. |

### Business Rules

| Rule | Implemented | Tested |
|------|------------|--------|
| Requires authentication | Yes (throws `UnauthorizedError`) | Yes (STRONG -- `profile-spec-compliance.test.ts` line 355) |
| Returns only caller's memberships | Yes (`eq(memberships.personId, personId)`) | WEAK -- mock stubs the entire DB chain; never verifies the WHERE clause actually filters |
| Enriches with org name | Yes (LEFT JOIN) | Yes (STRONG -- `profile-spec-compliance.test.ts` line 297) |
| Enriches with org slug | Yes | NONE -- no test verifies `orgSlug` in response |
| Adds `orgId` alias | Yes (`orgId: r.organizationId`) | Yes (STRONG -- `profile-spec-compliance.test.ts` line 333) |
| Multi-org independent statuses | Yes (returns all) | Yes (STRONG -- `profile-spec-compliance.test.ts` line 297) |
| Empty list for no memberships | Yes | Yes (STRONG -- `profile-spec-compliance.test.ts` line 337) |

### Test Coverage

**Test files:**
- `services/api-ts/src/handlers/person/getMyMemberships.test.ts` (2 tests)
- `services/api-ts/src/handlers/person/profile-spec-compliance.test.ts` (3 tests in AC-M02-005)

**Overall:** 5 tests, mostly WEAK assertions (mock entire DB chain, never verify actual SQL/WHERE). The auth guard test is STRONG. The multi-org test checks response shape but not data isolation.

---

## 2. Handler Audit: `association:operations/getTraining.ts`

**File:** `services/api-ts/src/handlers/association:operations/getTraining.ts`
**Route:** `GET /association/training/{trainingId}` (wired in `registry.ts` line 459)

### Findings

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Security | P1 | `findOneById` does NOT scope by org -- relies on post-fetch check | `repo.findOneById(params.trainingId)` fetches ANY training globally, then checks `training.organizationId !== orgId`. This is a TOCTOU pattern -- the training data is loaded into memory before the org check. If the NotFoundError message leaks info or if future code accesses the training before the check, it's a data leak. Should use `findOne({ id, organizationId })` pattern. |
| 2 | Security | P2 | Auth guard returns raw JSON instead of throwing | `if (!user) return ctx.json({ error: 'Unauthorized' }, 401)` -- inconsistent with `UnauthorizedError` pattern used elsewhere. May bypass error middleware logging/formatting. |
| 3 | Security | P2 | Org guard returns raw JSON instead of throwing | `if (!orgId) return ctx.json({ error: 'Organization context required' }, 403)` -- same issue as above. Should throw `ForbiddenError`. |
| 4 | Security | P3 | No role check | Any authenticated user in the org can read any training. May be intentional (members should see trainings) but no RBAC verification. |
| 5 | Type safety | P3 | `as DatabaseInstance` cast | Same pattern as person handler -- acceptable. |
| 6 | Observability | P2 | Logger obtained but not used for request tracking | Gets logger (`ctx.get('logger')`) and passes to repo but no request-level logging (entry/exit/error). |

### Business Rules

| Rule | Implemented | Tested |
|------|------------|--------|
| Requires authentication | Yes (manual check) | Yes (WEAK -- `training.test.ts` line 27, only checks 401 status) |
| Requires org context | Yes (manual check) | NONE |
| Returns 404 for missing training | Yes (throws `NotFoundError`) | NONE -- test file tests the WRONG getTraining (see below) |
| Cross-org isolation | Yes (post-fetch check) | NONE -- see below |

### Test Coverage

**Test files:**
- `services/api-ts/src/handlers/association:operations/training.test.ts` -- line 27 tests auth guard only
- `services/api-ts/src/handlers/training/getTraining.test.ts` -- **tests the WRONG handler** (`training/getTraining.ts`, not `association:operations/getTraining.ts`)

| # | Severity | Finding |
|---|----------|---------|
| T1 | P1 | `training/getTraining.test.ts` imports from `./getTraining` which resolves to `training/getTraining.ts` -- a DEAD CODE handler not wired in routes. All 4 tests (including the cross-org attack test) validate the wrong implementation. |
| T2 | P1 | The wired handler (`association:operations/getTraining.ts`) has ZERO happy-path or cross-org isolation tests. Only auth guard tested. |
| T3 | P2 | `training.test.ts` lines 53-66 test static assertions (array lengths, math) not actual handler behavior. These are NONE-strength tests masquerading as coverage. |

---

## 3. Duplicate Handler: `association:member/getMyMemberships.ts`

**File:** `services/api-ts/src/handlers/association:member/getMyMemberships.ts`

### Findings

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Dead code | P2 | Not wired in routes | `registry.ts` imports from `person/getMyMemberships.ts` only. This file is dead code. |
| 2 | Divergence | P2 | Missing fields vs person/ version | Does NOT include `orgSlug`, `createdAt`, `updatedAt`, `version`, `createdBy`, `updatedBy`. Does NOT return `total` in response. Uses `HandlerContext` type instead of `BaseContext`. |
| 3 | Security | P2 | Auth pattern differs | Uses `ctx.json({ error: 'Unauthorized' }, 401)` return instead of `throw new UnauthorizedError()`. If someone accidentally wires this version, auth errors bypass error middleware. |
| 4 | Maintenance | P2 | Confusing for developers | Two files with same function name, same purpose, different implementations. Developer could edit wrong one. |

**Recommendation:** Delete `services/api-ts/src/handlers/association:member/getMyMemberships.ts`. It is dead code with a weaker implementation.

---

## 4. Dead Code Handler: `training/getTraining.ts`

**File:** `services/api-ts/src/handlers/training/getTraining.ts`

### Findings

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Dead code | P2 | Not wired in routes | `registry.ts` imports from `association:operations/getTraining.ts` only. |
| 2 | Security | P1 | No auth check at all | Does not check `user` or `session`. Any request reaching this handler would execute as anonymous. Fortunately, it's dead code. |
| 3 | Security | P1 | No org isolation | Gets `orgId` from URL param, not session context. Attacker could supply any orgId. Dead code, but if accidentally wired, critical vulnerability. |
| 4 | N+1 | P2 | 3 sequential repo calls | `getByOrg` then `getEnrollmentCount` then `getAttendanceStats` -- 3 queries where 1 with JOINs would suffice. Dead code, but the test file validates this pattern. |
| 5 | Tests | P1 | Test file validates dead code | `training/getTraining.test.ts` has 4 well-structured tests including cross-org attack prevention -- but they test THIS dead handler, not the wired one. False sense of security. |

**Recommendation:** Delete `services/api-ts/src/handlers/training/getTraining.ts` and `services/api-ts/src/handlers/training/getTraining.test.ts`. Port the test patterns (especially the cross-org attack test) to `association:operations/`.

---

## 5. Migration Audit

### 0038: `rename_terminated_to_removed.sql`

**File:** `services/api-ts/src/generated/migrations/0038_rename_terminated_to_removed.sql`

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Safety | P3 | No-op migration | Contains `SELECT 1;` only. Original DDL commented out. Already applied manually. |
| 2 | Reversibility | P3 | Not reversible (but no-op) | Since it's a no-op, irrelevant. The original RENAME VALUE is irreversible in PG <14 but that's moot. |
| 3 | Idempotency | OK | Safe to re-run | `SELECT 1` is idempotent. |

**Verdict:** Safe. No concerns.

### 0040: `slug_backfill.sql`

**File:** `services/api-ts/src/generated/migrations/0040_slug_backfill.sql`

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Safety | P2 | Step 3 collision fix is destructive | The collision-handling UPDATE appends `-{rn}` to existing slugs. If run twice, it would double-suffix: `my-org-2` becomes `my-org-2-1`. Migration journal prevents re-run, but manual execution is unsafe. |
| 2 | Safety | P3 | Step 1 regex strips non-ASCII | `[^a-zA-Z0-9\s-]` strips accented characters (e.g., Filipino org names with n-tilde). Acceptable for URL slugs but lossy for internationalized names. |
| 3 | Idempotency | P2 | NOT idempotent | Step 1 has `WHERE slug IS NULL` guard, but Steps 2-3 would re-execute on already-slugged rows if run again. Step 3's window function would find "collisions" with its own previously-suffixed values. |
| 4 | Reversibility | P2 | Not reversible | No way to recover original NULL slugs after backfill. Should have a compensating migration (but slug backfill is a one-way operation by design). |
| 5 | Performance | P3 | Full table scan | Three sequential UPDATEs on entire `organization` table. Fine for small datasets (<10K orgs). |

**Verdict:** Functional for initial run. The non-idempotency (P2) is mitigated by Drizzle's migration journal preventing re-execution.

### 0041: `slug_not_null.sql`

**File:** `services/api-ts/src/generated/migrations/0041_slug_not_null.sql`

| # | Category | Severity | Finding | Detail |
|---|----------|----------|---------|--------|
| 1 | Safety | P2 | Depends on 0040 completing successfully | If 0040 fails mid-way (e.g., some rows still NULL), this migration will fail with a NOT NULL constraint violation. No pre-check. |
| 2 | Safety | OK | Correct expand-then-contract pattern | 0040 backfills, 0041 enforces. This is the standard safe migration pattern (D5). |
| 3 | Reversibility | P3 | Reversible via `ALTER COLUMN slug DROP NOT NULL` | Standard DDL, easily reversed. |
| 4 | Idempotency | OK | Idempotent | `SET NOT NULL` on an already NOT NULL column is a no-op in PostgreSQL. |

**Verdict:** Safe assuming 0040 succeeded. The dependency is correctly sequenced.

---

## 6. Summary by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| **P0** | 0 | -- |
| **P1** | 4 | getTraining cross-org fetch-then-check pattern; test files validate dead code (2 handlers); training handler has zero real tests for wired version |
| **P2** | 10 | Dead code duplicates (2); missing person_id index; inconsistent auth patterns; non-idempotent migration; no orgSlug test coverage; migration dependency risk |
| **P3** | 8 | Cross-module imports; unbounded query; no logging; static test assertions; regex strips non-ASCII |

### Recommended Actions

1. **P1 -- Fix getTraining org isolation:** Replace `findOneById` + post-check with `findOne({ id, organizationId })` in `association:operations/getTraining.ts`
2. **P1 -- Port tests:** Move cross-org attack test from `training/getTraining.test.ts` to `association:operations/` targeting the wired handler
3. **P1 -- Delete dead code:** Remove `training/getTraining.ts`, `training/getTraining.test.ts`, `association:member/getMyMemberships.ts`
4. **P2 -- Add index:** Add `index('membership_person_idx').on(table.personId)` to membership schema
5. **P2 -- Standardize auth:** Use `throw new UnauthorizedError()` / `throw new ForbiddenError()` instead of `ctx.json()` returns in `association:operations/getTraining.ts`
6. **P2 -- Add orgSlug test:** Add test verifying `orgSlug` presence in getMyMemberships response
