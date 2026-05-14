# Phase 21: Officer Daily Ops - Research

**Researched:** 2026-05-13
**Domain:** Association member roster, bulk operations, officer RBAC (Hono + Drizzle + TypeSpec + TanStack Router)
**Confidence:** HIGH

## Summary

Phase 21 adds three capabilities to the officer dashboard: (1) a rich roster view with per-member dues and training status joined server-side, (2) a bulk-approve endpoint for membership applications with partial-success semantics, and (3) new query filters on the roster (`duesStatus`, `trainingCompliant`) applied at the DB level.

The single-record `approveMembershipApplication` handler already exists and is working. The `listRosterMembers` handler and the `MemberTable` frontend component also exist, but both are missing the new fields and filters. This phase is primarily about extending existing surfaces rather than building from scratch.

No new tables are needed. The data is already in `memberships`, `dues_invoice`, and `credit_entry` — it just needs to be JOINed in the roster query and surfaced in two new TypeSpec models plus a new bulk-approve operation.

**Primary recommendation:** TypeSpec-first. Add `OfficerRosterMember` (extends `RosterMember` + `duesStatus` + `creditSummary`), add `BulkApproveApplicationsRequest/Response` models, generate, then implement handlers and update `MemberTable`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single roster endpoint returns joined data: name, dues status, training credit summary (no N+1 — single query joining person, membership, dues, training tables)
- Org-scoped: officer sees only their chapter's members
- Supports pagination (existing OffsetPaginationParams pattern)
- Bulk approve: accepts array of application IDs; returns `{ succeeded: [...], failed: [{id, reason}] }`
- Each approval validated individually — org scope checked per record
- Wrap in transaction per-record (not all-or-nothing) to support partial success
- Roster filters: `?membershipStatus=active&duesStatus=overdue&trainingCompliant=true`
- Filters applied at DB level (WHERE clauses), not client-side

### Claude's Discretion
- All implementation details; follow existing handler patterns with `requirePosition` for officer endpoints
- Use existing roster/member endpoints if they exist, extend them

### Deferred Ideas (OUT OF SCOPE)
- None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Officer can view chapter roster with dues status and training summary (server-side JOINs) | `listRosterMembers` handler + `MembershipRepository.listMembers` extended with JOIN to `dues_invoice` and `credit_entry`; new TypeSpec model `OfficerRosterMember` needed |
| OPS-02 | Officer can bulk approve membership applications with partial-success response shape | New endpoint + handler needed — single-approve exists but no bulk; `approveMembershipApplication` logic is reusable |
| OPS-03 | Bulk operations validate per-record organization scope (not just outer isOfficer check) | Each record fetched individually; `organizationId` compared to officer's org before approval; failed records return `{id, reason}` |
| OPS-04 | Officer can filter roster by membership status, dues status, and training compliance | `ListRosterMembersQuery` currently has `status`/`categoryId`/`search` — needs `duesStatus` and `trainingCompliant` added to TypeSpec + validator + repo WHERE clause |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Roster with dues + training JOIN | API / Backend | — | Multi-table JOIN must stay server-side to avoid N+1; client cannot join across services |
| Bulk approve with per-record scope | API / Backend | — | Auth check per record; transaction per record; no client logic |
| Roster filters (duesStatus, trainingCompliant) | API / Backend | — | Filters map to DB WHERE clauses; must not be client-side |
| MemberTable UI (filter pills, dues/training columns) | Frontend (Vite) | — | Renders server response; adds column headers + filter controls |
| BulkApprove UI (select + submit) | Frontend (Vite) | — | Selection state already scaffolded in MemberTable; bulk action bar exists but no action wired |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeSpec | existing | API definition | Spec-first; generates OpenAPI + validators + handler stubs |
| Drizzle ORM | existing | DB queries | Type-safe; existing JOIN patterns in `membership.repo.ts` |
| Hono | existing | HTTP handlers | Existing handler pattern |
| Zod | existing (generated) | Validators | Auto-generated from TypeSpec |
| Bun test | existing | Unit tests | Project standard |
| TanStack Query | existing | Frontend data fetching | SDK hooks auto-generated |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `requirePosition` utility | existing | Officer RBAC | All officer-only endpoints |
| `auditAction` utility | existing | Audit trail | State-changing operations |
| `POSITION_TITLES` constants | existing | Avoid title typos | All `requirePosition` calls |
| `MembershipApplicationRepository` | existing | App record access | Reuse in bulk-approve handler |

## Architecture Patterns

### System Architecture Diagram

```
Officer browser
  → GET /association/member/roster?organizationId=X&duesStatus=overdue&trainingCompliant=false
      → [Hono route, generated]
      → listRosterMembers handler
          → requirePosition(ctx, [Secretary, President, Society Officer])
          → OfficerRosterRepository.listWithStatus(filters)
              → SELECT memberships JOIN persons JOIN dues_invoice (latest) JOIN credit_entry (SUM)
              → WHERE org + membership status + dues status + training compliance
          → return { data: OfficerRosterMember[], pagination }

Officer browser
  → POST /association/member/applications/bulk-approve
      → [new Hono route, TypeSpec-generated]
      → bulkApproveMembershipApplications handler
          → requirePosition(ctx, [Secretary, President])
          → for each applicationId:
              → fetch application
              → check application.organizationId === officer's orgId
              → if mismatch → push to failed[]
              → else → db.transaction(per-record approve + membership create)
              → push to succeeded[] or failed[]
          → return { succeeded: [...], failed: [{id, reason}] }
```

### Recommended Project Structure

Extend within existing module — no new directories needed:

```
specs/api/src/association/member/
  membership.tsp                    # add OfficerRosterMember + BulkApprove models + operations

services/api-ts/src/handlers/association:member/
  listRosterMembers.ts              # EXTEND: add duesStatus + trainingCompliant filter passthrough
  bulkApproveMembershipApplications.ts  # NEW handler
  repos/
    membership.repo.ts              # EXTEND: add listWithOfficerStatus() with full JOIN

apps/memberry/src/features/membership/components/
  member-table.tsx                  # EXTEND: add duesStatus + trainingCompliant filter UI; add dues/training columns
  application-list.tsx              # EXTEND: add bulk-approve flow (select → confirm → POST)
```

### Pattern 1: Extending listRosterMembers with Joined Dues + Training

The existing `MembershipRepository.listMembers()` in `services/api-ts/src/handlers/membership/repos/membership.repo.ts` already JOINs `persons` and `membershipCategories`. Extend it (or add a new method) to also JOIN `dues_invoice` (latest per membership) and aggregate `credit_entry` (SUM per person/org/cycle).

Dues status derivation: `duesInvoiceStatusEnum` has values `generated | sent | paid | overdue | cancelled | writtenOff`. The `status` field of the latest invoice per membership is the dues status.

Training compliance: sum `creditAmount` from `credit_entry` where `organizationId = orgId` and `cycleStart <= now <= cycleEnd`. Compare to a configurable threshold (default 40 from existing `getCreditCompliance.ts` pattern).

```typescript
// Source: [VERIFIED: /services/api-ts/src/handlers/association:member/getCreditCompliance.ts]
// Pattern for credit aggregation — reuse in JOIN
const creditRepo = new CreditEntryRepository(db, logger);
const earned = await creditRepo.sumCreditsForCycle(personId, cycle.cycleStart, cycle.cycleEnd, orgId);
const compliant = earned >= requiredCredits;
```

For the roster JOIN, use a subquery or lateral join to avoid N+1:

```typescript
// Source: [VERIFIED: /services/api-ts/src/handlers/membership/repos/membership.repo.ts]
// Existing JOIN pattern — extend with dues_invoice + credit_entry subqueries
this.db
  .select({
    membership: memberships,
    person: { id: persons.id, firstName: persons.firstName, lastName: persons.lastName },
    latestInvoiceStatus: sql<string>`(
      SELECT status FROM dues_invoice
      WHERE membership_id = ${memberships.id}
      ORDER BY created_at DESC LIMIT 1
    )`,
    totalCredits: sql<number>`(
      SELECT COALESCE(SUM(credit_amount), 0) FROM credit_entry
      WHERE person_id = ${memberships.personId}
        AND organization_id = ${memberships.organizationId}
        AND cycle_start <= NOW() AND cycle_end >= NOW()
    )`,
  })
  .from(memberships)
  .leftJoin(persons, eq(memberships.personId, persons.id))
  .where(whereClause)
```

### Pattern 2: Bulk Approve with Partial Success

```typescript
// Source: [VERIFIED: /services/api-ts/src/handlers/association:member/approveMembershipApplication.ts]
// Single-approve logic to replicate per record in bulk loop

const succeeded: string[] = [];
const failed: { id: string; reason: string }[] = [];

for (const applicationId of body.applicationIds) {
  try {
    const application = await appRepo.findOneById(applicationId);
    if (!application) {
      failed.push({ id: applicationId, reason: 'Not found' });
      continue;
    }
    // OPS-03: per-record org scope check
    if (application.organizationId !== officerOrgId) {
      failed.push({ id: applicationId, reason: 'Org scope violation' });
      continue;
    }
    if (!['submitted', 'underReview'].includes(application.status)) {
      failed.push({ id: applicationId, reason: `Status '${application.status}' is not approvable` });
      continue;
    }
    // Per-record transaction (NOT all-or-nothing)
    await db.transaction(async (tx) => {
      // ... same logic as approveMembershipApplication ...
    });
    succeeded.push(applicationId);
  } catch (err) {
    failed.push({ id: applicationId, reason: 'Internal error' });
  }
}

return ctx.json({ succeeded, failed }, 200);
```

### Pattern 3: TypeSpec New Models

New models needed in `membership.tsp`:

```typespec
// Source: [VERIFIED: specs/api/src/association/member/membership.tsp - existing RosterMember pattern]

@doc("Roster member with officer-view fields: dues and training status")
model OfficerRosterMember extends RosterMember {
  @doc("Status of latest dues invoice (null if no invoice exists)")
  duesInvoiceStatus?: string;

  @doc("Total CPD credits earned in current cycle")
  creditsEarned: int32;

  @doc("Whether member meets training compliance threshold")
  trainingCompliant: boolean;
}

@doc("Request body for bulk membership application approval")
model BulkApproveApplicationsRequest {
  @doc("Array of application IDs to approve")
  applicationIds: string[];
}

@doc("Result of a bulk approval operation")
model BulkApproveApplicationsResponse {
  @doc("IDs of successfully approved applications")
  succeeded: string[];

  @doc("Applications that failed with reasons")
  failed: BulkApproveFailure[];
}

@doc("Single failure record in a bulk operation")
model BulkApproveFailure {
  id: string;
  reason: string;
}
```

### Anti-Patterns to Avoid

- **N+1 for dues/training per roster row:** Do not loop over roster rows and call `sumCreditsForCycle` individually — use SQL subquery inline. `getCreditCompliance.ts` uses `Promise.all` over members but that is acceptable only for small orgs; roster endpoint must use the SQL subquery pattern.
- **All-or-nothing transaction for bulk approve:** The CONTEXT.md decision is per-record transactions, not a single outer transaction. Wrapping all in one `db.transaction` would silently revert every successful approval if one fails.
- **Outer-only officer check for bulk approve:** `requirePosition` checks the officer's org. OPS-03 requires an additional per-record check that `application.organizationId === officerOrgId`. Do not skip this inner check.
- **Client-side filtering:** Do not filter by `duesStatus` or `trainingCompliant` after fetch. Must be WHERE clause in query.
- **Editing generated files:** Never edit `services/api-ts/src/generated/openapi/*` — always edit TypeSpec and regenerate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Officer auth check | Custom middleware | `requirePosition(ctx, [...])` | Already handles 2FA enforcement, case-insensitive title match, org context |
| Audit logging | Custom logger calls | `auditAction(ctx, {...})` | Consistent format, correlation IDs |
| Pagination | Manual offset math | `OffsetPaginationParams` from TypeSpec + existing `page`/`pageSize` pattern | Already in `ListRosterMembersQuery` |
| Validator types | Zod schemas | Generated `validators.ts` from TypeSpec | Single source of truth |
| SDK React hooks | Fetch calls | `@monobase/sdk-ts/generated/react-query` hooks | Auto-generated after TypeSpec + codegen pipeline |

## Common Pitfalls

### Pitfall 1: listRosterMembers Uses Wrong Repo
**What goes wrong:** `listRosterMembers.ts` imports from `membership/repos/membership.repo.ts` (the simpler legacy repo), not from `association:member/repos/membership.repo.ts` (the DatabaseRepository subclass). The two have different interfaces.
**Why it happens:** There are two `MembershipRepository` classes in the codebase.
**How to avoid:** The officer roster handler should use (or extend) `membership/repos/membership.repo.ts` which has `listMembers()`. Add `listWithOfficerStatus()` there.
**Warning signs:** TypeScript error on `repo.listWithOfficerStatus` — means you imported from the wrong repo file.

### Pitfall 2: duesStatus Filter at DB Level is Non-Trivial
**What goes wrong:** `duesStatus` is not a column on `memberships` — it's the `status` of the latest `dues_invoice` for that membership. Filtering requires a correlated subquery or lateral join in the WHERE clause, not a simple column compare.
**Why it happens:** Dues status is computed from related invoice data.
**How to avoid:** Use `sql` template with a correlated subquery in the WHERE:
```sql
AND (SELECT status FROM dues_invoice WHERE membership_id = memberships.id ORDER BY created_at DESC LIMIT 1) = 'overdue'
```
**Warning signs:** `duesStatus` filter param has no effect — means it was applied client-side or not applied at all.

### Pitfall 3: Training Compliance Filter Needs Cycle Bounds
**What goes wrong:** Summing credits without cycle bounds returns all-time credits, not current-cycle credits. `trainingCompliant=false` would then be permanently false for new members.
**Why it happens:** `credit_entry` has `cycleStart`/`cycleEnd` columns — they must be used.
**How to avoid:** Use `cycle_start <= NOW() AND cycle_end >= NOW()` in the correlated subquery for credit SUM. Default `requiredCredits = 40` (matches existing `getCreditCompliance.ts` default).
**Warning signs:** All members show compliant even with no credits (cycle bounds missing).

### Pitfall 4: Bulk Approve TypeSpec Route Conflicts
**What goes wrong:** Adding `POST /association/member/applications/bulk-approve` might conflict with the existing `POST /association/member/applications/{applicationId}/approve` if TypeSpec route ordering is wrong.
**Why it happens:** Hono resolves static segments before path params, but TypeSpec generation may order routes differently.
**How to avoid:** Use a distinct path segment: `/applications/bulk-approve` (not `/applications/:id/approve`). Verify generated `routes.ts` has correct ordering.
**Warning signs:** 404 on bulk-approve endpoint even though it's registered.

### Pitfall 5: QAL-01 — Roster 500 Error
**What goes wrong:** REQUIREMENTS.md notes a pre-existing 500 on `GET /association/member/roster` (param mismatch). Extending this handler may surface or mask the bug.
**Why it happens:** `listRosterMembers.ts` passes `query.organizationId` directly but the `MembershipRepository.listMembers()` signature may expect it non-optional.
**How to avoid:** Fix the param mismatch as part of the roster extension (OPS-01 naturally touches this path). QAL-01 is Phase 24 but the fix is a one-liner here.
**Warning signs:** 500 response on roster endpoint in any test.

## Code Examples

### listRosterMembers — current shape
```typescript
// Source: [VERIFIED: services/api-ts/src/handlers/association:member/listRosterMembers.ts]
// Current: delegates to MembershipRepository(db).listMembers() — no dues/training JOIN
const result = await repo.listMembers({
  organizationId: query.organizationId,
  status: query.status,
  categoryId: query.categoryId,
  search: query.q ?? query.search,
  limit: pageSize,
  offset,
});
// Missing: duesStatus, trainingCompliant filters + joined dues/credit columns
```

### approveMembershipApplication — per-record transaction pattern to replicate in bulk
```typescript
// Source: [VERIFIED: services/api-ts/src/handlers/association:member/approveMembershipApplication.ts]
const updatedApplication = await db.transaction(async (tx: DatabaseInstance) => {
  const txAppRepo = new MembershipApplicationRepository(tx, logger);
  const txMembershipRepo = new MembershipRepository(tx, logger);
  const updated = await txAppRepo.updateOneById(applicationId, {
    status: 'approved', reviewedBy: session.user.id, reviewedAt: now,
  } as any);
  await txMembershipRepo.createOne({
    organizationId: application.organizationId,
    personId: application.personId,
    tierId: application.tierId,
    startDate: today as string,
    duesExpiryDate: null,
    status: 'pendingPayment' as any,
    joinedAt: now,
  } as any);
  return updated;
});
```

### requirePosition usage (canonical)
```typescript
// Source: [VERIFIED: services/api-ts/src/utils/officer-check.ts + position-titles.ts]
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

const denied = await requirePosition(ctx, [
  POSITION_TITLES.SECRETARY,
  POSITION_TITLES.PRESIDENT,
  POSITION_TITLES.SOCIETY_OFFICER,
]);
if (denied) return denied;
```

### MemberTable bulk selection — already scaffolded, needs wiring
```typescript
// Source: [VERIFIED: apps/memberry/src/features/membership/components/member-table.tsx]
// selected: Set<string> — IDs of checked roster rows
// Bulk action bar renders when selected.size > 0 — but only has "Clear" button
// OPS-02: add "Approve Selected" button in this bar for applications page
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-record single approve only | Bulk approve with partial success | Phase 21 | Officer can approve entire applicant batch in one action |
| Roster shows only membership status | Roster shows dues + training status | Phase 21 | Officer can triage members needing attention without navigating to each record |
| Client-side status filter only | Server-side duesStatus + trainingCompliant filters | Phase 21 | Works correctly at scale; not limited by page size |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `requiredCredits` threshold is 40 (hardcoded default from getCreditCompliance.ts) | Pitfall 3, Code Examples | If orgs have different thresholds, compliance flag will be wrong; would need per-org config |
| A2 | Credit cycle is current — `cycle_start <= NOW() <= cycle_end` identifies the active cycle | Pitfall 3 | If CPD cycles are not continuous, some members would show no active cycle |
| A3 | Officer positions that can bulk-approve are [Secretary, President, Society Officer] — same as single approve | Code Examples | If bulk approve requires a different permission level, RBAC must be adjusted |

## Open Questions

1. **TrainingCompliant threshold: hardcoded 40 or per-org config?**
   - What we know: `getCreditCompliance.ts` defaults to 40, passed as a query param
   - What's unclear: Should the roster's `trainingCompliant` boolean use a fixed 40 or an org-level setting?
   - Recommendation: Use 40 as default for Phase 21; add per-org setting in Phase 22 (PRC requirements)

2. **Do both `member-table.tsx` and `application-list.tsx` need bulk-approve UI, or only applications?**
   - What we know: `member-table.tsx` has selection state for roster members; `application-list.tsx` has `selectedIds` state and single-approve buttons
   - What's unclear: OPS-02 is for applications only; roster selection currently has no action
   - Recommendation: Wire bulk-approve only in `application-list.tsx`; remove or leave stub in `member-table.tsx` bulk bar

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure API + frontend code changes on existing infra).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | `services/api-ts/package.json` (`"test": "bun test"`) |
| Quick run command | `cd services/api-ts && bun test src/handlers/association:member/bulkApproveMembershipApplications.test.ts` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | Roster returns joined duesInvoiceStatus + creditsEarned + trainingCompliant | unit | `bun test src/handlers/association:member/listRosterMembers.test.ts` | ❌ Wave 0 |
| OPS-02 | Bulk approve returns `{ succeeded, failed }` shape | unit | `bun test src/handlers/association:member/bulkApproveMembershipApplications.test.ts` | ❌ Wave 0 |
| OPS-03 | Bulk approve rejects application from wrong org with failure entry | unit | same file, `'rejects cross-org application'` test | ❌ Wave 0 |
| OPS-04 | Roster filtered by duesStatus=overdue returns only overdue members | unit | `bun test src/handlers/association:member/listRosterMembers.test.ts` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `src/handlers/association:member/listRosterMembers.test.ts` — covers OPS-01, OPS-04
- [ ] `src/handlers/association:member/bulkApproveMembershipApplications.test.ts` — covers OPS-02, OPS-03

*(No framework install needed — Bun test is active)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session check (`ctx.get('session')`) |
| V3 Session Management | yes | Existing session middleware |
| V4 Access Control | yes | `requirePosition()` — officer role + org scope per record |
| V5 Input Validation | yes | Generated Zod validators from TypeSpec |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org bulk approve (officer approves another chapter's applications) | Elevation of Privilege | Per-record `application.organizationId === officerOrgId` check (OPS-03) |
| Roster data leak (officer sees another chapter's members) | Information Disclosure | `requirePosition` sets org context; `listMembers` filters by `organizationId` from officer's org |
| Mass approval without 2FA | Elevation of Privilege | `requirePosition` enforces 2FA for President/Secretary in production |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: `listRosterMembers.ts`] — current handler shape, import chain
- [VERIFIED: `membership.repo.ts` (membership module)] — `listMembers()` with existing JOIN pattern
- [VERIFIED: `approveMembershipApplication.ts`] — per-record transaction pattern to replicate in bulk
- [VERIFIED: `officer-check.ts` + `position-titles.ts`] — `requirePosition` API, POSITION_TITLES constants
- [VERIFIED: `dues.schema.ts`] — `duesInvoiceStatusEnum` values, `dues_invoice` table structure
- [VERIFIED: `credits.schema.ts`] — `credit_entry` columns including `cycleStart`, `cycleEnd`, `creditAmount`
- [VERIFIED: `getCreditCompliance.ts`] — credit aggregation pattern, default 40 threshold
- [VERIFIED: `member-table.tsx`] — selection state, filter UI, SDK hook usage
- [VERIFIED: `application-list.tsx`] — single approve mutation, `selectedIds` state
- [VERIFIED: `membership.tsp` (lines 415-450)] — current `RosterMember` model, no dues/training fields
- [VERIFIED: `validators.ts` (ListRosterMembersQuery)] — current query params, missing `duesStatus`/`trainingCompliant`

### Secondary (MEDIUM confidence)
- [VERIFIED: `bulkUpdatePersonSubscriptions.ts`] — bulk loop pattern within existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture: HIGH — existing patterns traced in source; new endpoint follows established handler pattern
- Pitfalls: HIGH — derived from actual code inspection, not assumptions

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable stack)
