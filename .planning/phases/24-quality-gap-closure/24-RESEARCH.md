# Phase 24: Quality Gap Closure - Research

**Researched:** 2026-05-13
**Domain:** Bug fixes (TypeSpec query params, Drizzle repo) + deferred business-rule test coverage
**Confidence:** HIGH

## Summary

Phase 24 resolves three pre-existing defects: a runtime 500 on the roster endpoint, an audit-log filter that silently ignores `eventType`/`category` query params, and six deferred business rules (BR-35 through BR-40) that need test coverage without module implementations.

**Primary recommendation:** Fix root causes in TypeSpec + handler code, then write targeted unit tests. No schema migrations required; no new endpoints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Roster API 500: fix handler parameter mismatch on GET /association/member/roster
- Audit log filter bug: fix WHERE clause to apply eventType/category filter params
- BR-35 through BR-40: implement deferred business rules with unit tests; follow existing BR pattern (test-first)

### Claude's Discretion
All implementation details at Claude's discretion. Diagnose each bug, implement fix, write tests.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QAL-01 | Roster API 500 on /association/member/roster fixed | Root cause identified: likely `requirePosition` throws when `ctx.get('organizationId')` is null/undefined in some path; secondary risk is raw-SQL table name mismatch at runtime |
| QAL-02 | Audit log filter bug fixed — eventType/category params actually filter results | Root cause confirmed: TypeSpec `listAuditLogs` operation missing `@query eventType` and `@query category` params → Zod strips them on parse → filters never reach `buildWhereConditions` |
| QAL-03 | BR-35 through BR-40 implemented and tested | BR-36/37/38/39 test files exist with passing pure-logic tests; BR-35 and BR-40 test files are missing entirely; all six rules deferred because modules (M13-M19) don't exist |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Roster 500 fix | API / Backend | — | Handler + middleware interaction; pure backend |
| Audit filter fix | API / Backend (TypeSpec layer) | — | TypeSpec → OpenAPI → validator → handler chain |
| BR-35/40 test coverage | API / Backend (test layer) | — | Pure business logic, no module exists yet |

## Standard Stack

### Core (already present — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun test | bundled | Unit test runner | Project standard |
| drizzle-orm | project version | Typed SQL queries | Project standard |
| TypeSpec | project version | API contract definition | Spec-first requirement |
| zod | project version | Request validation | Generated validators use it |

**No new packages needed.** All fixes use existing stack.

## Architecture Patterns

### System Architecture Diagram

```
Client Request
     │
     ▼
app.use('/association/*') → orgContextMiddleware → sets ctx.organizationId
     │
     ▼
generated route → authMiddleware({ roles: ["association:admin"] })
     │
     ▼
zValidator('query', ListRosterMembersQuery) — requires organizationId
     │
     ▼
listRosterMembers handler → requirePosition() → MembershipRepository.listMembersWithOfficerStatus()
     │
     ▼
Raw SQL subqueries: credit_entry (cycle_start/cycle_end), dues_invoice (membership_id)
```

```
Client ?eventType=data-access
     │
     ▼
zValidator('query', ListAuditLogsQuery) — STRIPS eventType (not in schema) ← BUG
     │
     ▼
parseFilters(query, allowedFields) — eventType not in query object
     │
     ▼
AuditRepository.buildWhereConditions() — eventType filter never applied
```

### Recommended Project Structure (no changes needed)
```
specs/api/src/modules/
└── audit.tsp              # ADD @query eventType and @query category

services/api-ts/src/handlers/
├── audit/
│   └── listAuditLogs.ts   # No change needed once TypeSpec fixed
├── association:member/
│   └── listRosterMembers.ts  # Diagnose + fix 500
└── communications/
    └── br-35.feed-moderation.test.ts    # CREATE
    └── br-40.survey-anonymity.test.ts   # CREATE
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Adding query params to audit endpoint | Manual validator edit | TypeSpec → bun run build → bun run generate | Generated files must never be edited by hand (CLAUDE.md) |
| SQL filter logic | Custom filter builder | Existing `buildWhereConditions` in `AuditRepository` | Already correct; bug is upstream |
| BR test helpers | New test framework | Bun test + plain functions (see existing BR-36/37/38/39 pattern) | Consistent with deferred-module BR pattern |

## Bug Root Cause Analysis

### QAL-01: Roster API 500

**Suspected root causes (in order of likelihood):**

1. **`requirePosition` throws when `orgId` is null** — `ctx.get('organizationId')` returns `null`/`undefined` for callers who do not pass `?organizationId=xxx`. The app-level `orgContextMiddleware` extracts `organizationId` from query, param, or body. If none present, it may set null. `requirePosition` then passes null to `OfficerTermRepository.findActiveByPersonAndOrg(userId, null)` — the Drizzle `eq(officerTerms.organizationId, null)` would produce a SQL error (comparing UUID column to null without `isNull`). [VERIFIED: code inspection]

2. **OfficerTermRepository DB query error** — if `orgId` is null, `eq(officerTerms.organizationId, orgId)` generates invalid SQL (Postgres rejects `WHERE organization_id = NULL`; must use `IS NULL`). This throws an unhandled error → 500. [VERIFIED: code inspection]

3. **`listMembersWithOfficerStatus` raw SQL table names** — subqueries reference `credit_entry` and `dues_invoice` as literal strings. If tables haven't migrated on the target DB, Postgres throws "relation does not exist" → 500. Less likely since migrations run on startup. [ASSUMED]

**Fix path:**
- In `listRosterMembers.ts`: ensure `organizationId` is always present (validator already requires it — but verify org-context sets it correctly for this route)
- In `requirePosition` or the caller: guard against null `orgId` before calling the repo (currently returns 403 — but the issue may be in the DB call itself)
- Confirm with a live test after applying fix

### QAL-02: Audit Log Filter Bug

**Root cause: confirmed via code inspection.** [VERIFIED: code inspection]

The TypeSpec operation `listAuditLogs` (in `specs/api/src/modules/audit.tsp`, lines 194-210) is missing two `@query` parameters:
- `@query eventType?: AuditEventType`
- `@query category?: AuditCategory`

Because they are absent from TypeSpec, the generated Zod validator `ListAuditLogsQuery` (validators.ts:11522) strips them on `ctx.req.valid('query')`. The handler's `parseFilters()` therefore receives an object without those keys, so `buildWhereConditions` never receives them.

**The repo itself is correct** — `AuditRepository.buildWhereConditions` already handles `eventType` and `category` filters (lines 49-55 of audit.repo.ts).

**Fix path (3 steps, as per CLAUDE.md API-first workflow):**
1. Add `@query eventType?: AuditEventType` and `@query category?: AuditCategory` to `listAuditLogs` in `audit.tsp`
2. `cd specs/api && bun run build` — regenerates OpenAPI + types
3. `cd services/api-ts && bun run generate` — regenerates validators; `ListAuditLogsQuery` will now include both fields

No handler changes needed after codegen.

### QAL-03: BR-35 through BR-40

**Status of each rule:** [VERIFIED: code inspection + file system]

| BR | Rule | Module | Test File | Status |
|----|------|--------|-----------|--------|
| BR-35 | Feed Content Moderation | M13 | `communications/br-35.feed-moderation.test.ts` | **MISSING — must create** |
| BR-36 | National Dashboard Access | M14 | `platformadmin/br-36.national-dashboard.test.ts` | EXISTS, passes (11 tests) |
| BR-37 | Job Posting Expiry | M15 | `events/br-37.job-posting-expiry.test.ts` | EXISTS |
| BR-38 | Marketplace Referral Disclosure | M17 | `billing/br-38.marketplace-disclosure.test.ts` | EXISTS |
| BR-39 | Committee Dissolution | M19 | `membership/br-39.committee-dissolution.test.ts` | EXISTS |
| BR-40 | Survey Anonymity | M18 | `communications/br-40.survey-anonymity.test.ts` | **MISSING — must create** |

**Pattern (from BR-36 as reference):** [VERIFIED: code inspection]
- Pure TypeScript functions extracted inline (no DB, no handlers)
- Each file has: type definitions, pure rule functions, `describe('[BR-XX]')` block
- Tests cover: access control, edge cases, structural shape (no `.members` field etc.)
- No imports from handler code — fully self-contained

**BR-35 rules to implement as pure functions:**
- `canRemoveContent(role, targetOrgId, contentOrgId): boolean` — officers limited to own org; platform-admin unrestricted
- `canReportContent(role): boolean` — any member can report
- `getFlaggedContentVisibility(userRole): 'visible' | 'hidden'` — officers see flagged; members don't
- `shouldNotifyOnRemoval(): boolean` — always true
- Edge: remover identity NOT disclosed to content owner

**BR-40 rules to implement as pure functions:**
- `generateAnonymousResponse(content, timestamp): AnonymousResponse` — no member_id, no mapping
- `canDeanonymize(role): boolean` — always false (platform-admin included)
- `shouldWarnSmallPool(responseCount, threshold = 10): boolean`
- `shouldWarnFreeText(): boolean` — always true for anonymous surveys
- Edge: identified survey officer-visible, platform-admin cannot deanonymize

## Common Pitfalls

### Pitfall 1: Editing generated validators directly
**What goes wrong:** Adding `eventType` to `validators.ts` by hand — wiped on next `bun run generate`
**How to avoid:** Always fix in TypeSpec source; run the two-step codegen pipeline

### Pitfall 2: Skipping codegen after TypeSpec change
**What goes wrong:** TypeSpec updated but validator still old; tests pass (they mock), runtime still broken
**How to avoid:** Always run `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` after TypeSpec edits

### Pitfall 3: Using `eq(col, null)` in Drizzle
**What goes wrong:** Postgres treats `col = NULL` as always-false; Drizzle does not auto-convert
**How to avoid:** Use `isNull(col)` for null checks; guard against null before building conditions

### Pitfall 4: BR tests importing from non-existent modules
**What goes wrong:** Import from `@/handlers/communications/feed` throws module-not-found
**How to avoid:** Follow the established BR pattern — define all types and logic inline, no external imports

### Pitfall 5: Forgetting to update br-registry.json
**What goes wrong:** Registry shows no test files for BR-35/BR-40; CI may flag as untested
**How to avoid:** Update `br-registry.json` entries for BR-35 and BR-40 to reference the new test file paths

## Code Examples

### TypeSpec fix for QAL-02

```typescript
// Source: specs/api/src/modules/audit.tsp (current, lines 194-210)
// ADD these two @query params to listAuditLogs:

listAuditLogs(
   @query resourceType?: SafeQueryString,
   @query resource?: UUID,
   @query user?: UUID,
   @query action?: AuditAction,
   @query eventType?: AuditEventType,   // ADD THIS
   @query category?: AuditCategory,     // ADD THIS
   @query startDate?: StrictUtcDateTime,
   @query endDate?: StrictUtcDateTime,
   @query orderBy?: SafeQueryString,
   ...PaginationQuery
): ApiOkResponse<PaginatedResponse<AuditLogEntry>> | ApiUnauthorizedResponse | ApiForbiddenResponse;
```

### BR test pattern (from BR-36 reference)

```typescript
// Source: services/api-ts/src/handlers/platformadmin/br-36.national-dashboard.test.ts
// Pure functions + describe block — no imports from handler code

type DashboardRole = 'platform_admin' | 'national_officer' | 'chapter_officer' | 'member';

function canAccessNationalDashboard(role: DashboardRole, isDesignatedNational: boolean): boolean {
  if (role === 'platform_admin') return true;
  if (role === 'national_officer' && isDesignatedNational) return true;
  return false;
}

describe('[BR-36] National Dashboard Access', () => {
  test('platform admins can access national dashboard', () => {
    expect(canAccessNationalDashboard('platform_admin', false)).toBe(true);
  });
  // ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-edit validators | Fix in TypeSpec, regenerate | Project start | Never edit generated files |
| Ad-hoc SQL | Drizzle typed queries | Project start | Raw SQL only for complex subqueries |

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| Bun | Test runner | ✓ | — |
| TypeSpec CLI | QAL-02 codegen | ✓ (project deps) | — |
| PostgreSQL | Runtime validation | ✓ (local dev) | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (bundled) |
| Config file | none — bun.test.ts convention |
| Quick run command | `cd services/api-ts && bun test src/handlers/audit/listAuditLogs.test.ts` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QAL-01 | Roster endpoint returns 200, not 500 | unit | `bun test src/handlers/association:member/listRosterMembers.test.ts` | ✅ |
| QAL-02 | eventType filter applied to audit query | unit | `bun test src/handlers/audit/listAuditLogs.test.ts` | ✅ (add test case) |
| QAL-03 | BR-35 pure-logic tests pass | unit | `bun test src/handlers/communications/br-35.feed-moderation.test.ts` | ❌ Wave 0 |
| QAL-03 | BR-40 pure-logic tests pass | unit | `bun test src/handlers/communications/br-40.survey-anonymity.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `services/api-ts/src/handlers/communications/br-35.feed-moderation.test.ts` — covers BR-35
- [ ] `services/api-ts/src/handlers/communications/br-40.survey-anonymity.test.ts` — covers BR-40
- [ ] Add `eventType` + `category` filter test cases to `listAuditLogs.test.ts`

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `requirePosition()` + org-scoping in middleware |
| V5 Input Validation | yes | TypeSpec → Zod validators (fixing QAL-02 extends this) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Audit log tampering visibility | Info Disclosure | eventType/category filter restricts data surface |
| Roster access by non-officers | Elevation of Privilege | `requirePosition()` gate already present |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Roster 500 is caused by null orgId reaching `eq(officerTerms.organizationId, orgId)` | QAL-01 root cause | If wrong, actual 500 source differs; diagnosis step needed in Wave 0 |
| A2 | Raw SQL table names (`credit_entry`, `dues_invoice`) exist in prod DB (migrations applied) | QAL-01 | If tables missing, second 500 path exists; fix would require migration |

## Open Questions

1. **QAL-01 exact stack trace unavailable**
   - What we know: CONTEXT says "handler parameter mismatch"; code shows orgId null risk in `requirePosition`
   - What's unclear: exact line that throws — cannot reproduce without a live DB
   - Recommendation: Wave 0 task = reproduce locally and confirm root cause before writing fix

## Sources

### Primary (HIGH confidence)
- Code inspection: `specs/api/src/modules/audit.tsp` lines 194-210 — missing eventType/category params [VERIFIED]
- Code inspection: `services/api-ts/src/generated/openapi/validators.ts` lines 11522-11537 — ListAuditLogsQuery confirmed missing fields [VERIFIED]
- Code inspection: `services/api-ts/src/handlers/audit/repos/audit.repo.ts` lines 49-55 — buildWhereConditions already handles both fields [VERIFIED]
- Code inspection: `services/api-ts/src/handlers/association:member/listRosterMembers.ts` — full handler code [VERIFIED]
- Code inspection: `services/api-ts/src/middleware/officer-check.ts` — requirePosition null-orgId path [VERIFIED]
- File system: BR test file presence verified [VERIFIED]
- Code inspection: `docs/ver-3/business/br-registry.json` — deferred-module classification for BR-35 through BR-40 [VERIFIED]

## Metadata

**Confidence breakdown:**
- QAL-02 root cause: HIGH — confirmed by code inspection
- QAL-01 root cause: MEDIUM — suspected via code path analysis; needs live reproduction to confirm
- QAL-03 scope: HIGH — file system verified which test files exist vs missing
- BR rule implementations: HIGH — rules are fully specified in business-rules.md

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase, no external dependencies)
