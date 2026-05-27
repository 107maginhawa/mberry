# Per-File Spec Traceability Report: M05 Membership

**Generated:** 2026-05-27
**Auditor:** oli-enforce-file (full re-audit)
**Scope:** `services/api-ts/src/handlers/membership/` + membership-related files in `association:member/`

## Summary

| Metric | Count |
|--------|-------|
| Files audited | 22 (12 handlers/jobs, 2 repos, 8 association:member utils) |
| Findings total | 26 |
| P0 (Blocker) | 2 |
| P1 (Critical) | 6 |
| P2 (Warning) | 10 |
| P3 (Info) | 8 |

---

## File Inventory

### `membership/` handlers (implementation files)

| File | Role | Lines | Spec Trace |
|------|------|-------|------------|
| `addMember.ts` | Handler | ~30 | WF-030, BR-01 (partial) |
| `getMember.ts` | Handler | ~50 | WF-030, BR-01 |
| `listMembers.ts` | Handler | ~55 | WF-030, BR-01 |
| `updateMember.ts` | Handler | ~80 | WF-030, BR-03 |
| `listApplications.ts` | Handler | ~15 | WF-029 |
| `listOrgApplications.ts` | Handler | ~60 | WF-029 |
| `listCategories.ts` | Handler | ~10 | WF-033 |
| `getOrgProfile.ts` | Handler | ~30 | (cross-boundary) |
| `importMembers.ts` | Handler | ~180 | WF-031, BR-22, BR-25 |
| `csvImport.ts` | Handler | ~250 | WF-031, BR-22, AC-M05-003 |
| `jobs/graceToLapsed.ts` | Job | ~100 | BR-02, GAP-015 |
| `jobs/index.ts` | Job registry | ~25 | GAP-015 |

### `membership/repos/`

| File | Role | Spec Trace |
|------|------|------------|
| `membership.repo.ts` | Repository | All M05 endpoints |
| `membership.repo.test.ts` | Unit test | -- |

### `association:member/` (membership-related)

| File | Role | Spec Trace |
|------|------|------------|
| `repos/membership.schema.ts` | Schema (source of truth) | Section 7 Data Requirements |
| `utils/compute-membership-status.ts` | Pure function | BR-01 |
| `utils/compute-membership-status.test.ts` | Unit test | -- |
| `utils/status-transitions.ts` | State machine | Section 8 State Transitions |
| `utils/status-transitions.test.ts` | Unit test | -- |
| `utils/membership-lifecycle.ts` | Lifecycle service | BR-03, BR-07 |

---

## Findings

### P0 -- Blockers

#### EF-M05-344c98c0: `addMember.ts` -- No duplicate membership check

- **Check:** Data shape / Business rule
- **Spec ref:** AC-M05-001 ("No Duplicate Accounts"), BR-21 (one membership per person per org)
- **Schema:** `membership` table has `uniqueIndex('membership_org_person_unique').on(organizationId, personId)`

The handler inserts directly without checking for existing membership. The unique index will throw a raw Postgres error (23505) instead of the spec-mandated `409 CONFLICT` with message "Already a member of this organization."

```typescript
// addMember.ts -- inserts without duplicate check
const member = await repo.addMember({
  organizationId: orgId,
  personId: body.personId,
  // ... no pre-check for existing membership
});
```

**Fix:** Add `repo.getMember(orgId, body.personId)` check before insert; throw `ConflictError` on match. API_CONTRACTS specifies error code `409 MEMBERSHIP_ALREADY_EXISTS`.

---

#### EF-M05-5f67b806: `addMember.ts` -- No authorization guard

- **Check:** Naming / Import boundaries
- **Spec ref:** Section 6 Permissions -- "Import roster: super, admin, president (2FA), secretary (2FA)"
- **API_CONTRACTS:** POST `/org/:id/members` requires `officer` auth with `hasMinimumRole('secretary')`

The handler reads `session` but performs zero role/permission checks. Any authenticated user can add members to any org.

```typescript
// addMember.ts -- no auth check at all
const session = ctx.get('session') as Session;
// session.user.id used only for createdBy/updatedBy audit fields
```

**Fix:** Add `officerAuthMiddleware` + `requirePosition([PRESIDENT, SECRETARY])` or equivalent `hasMinimumRole` guard. Compare with `importMembers.ts` which correctly implements `requirePosition`.

---

### P1 -- Critical

#### EF-M05-cee2b87c: `listApplications.ts` -- Silent error swallowing

- **Check:** Error taxonomy
- **Spec ref:** Section 15 Error Handling

Handler catches ALL errors and returns `{ data: [] }` with 200 status. This masks database errors, permission issues, and schema mismatches.

```typescript
} catch {
  // Table schema mismatch — return empty until data model unification
  return ctx.json({ data: [] }, 200);
}
```

**Fix:** Remove catch-all. If schema mismatch is expected, catch only the specific Drizzle error and log it. Return 500 for unknown errors.

---

#### EF-M05-04598714 / EF-M05-adff0894: `csvImport.ts` + `importMembers.ts` -- Duplicate import logic

- **Check:** Import boundaries / DRY
- **Spec ref:** WF-031

Two files implement nearly identical CSV import logic with person matching (BR-22), license normalization, conflict flagging, and batch insert. Both have `findPersonMatch`, `normalizeLicense`, `ImportMemberRow` schema, and matching result types. Divergence risk is high.

- `csvImport.ts`: preview + full import, has `IMPORT_BATCH_SIZE`, audit logging
- `importMembers.ts`: full import only, has `requirePosition` auth guard

**Fix:** Extract shared logic into `membership/utils/csv-import-logic.ts`. Both handlers should delegate to it. Keep auth guards in individual handlers.

---

#### EF-M05-0ac7b5e5: `computeMembershipStatus` -- Missing `expired`, `resigned`, `deceased`, `expelled` states

- **Check:** Domain terms
- **Spec ref:** Section 8 State Transitions lists 10 membership statuses
- **Schema:** `membershipStatusEnum` has: `pendingPayment | active | gracePeriod | lapsed | expired | suspended | removed | resigned | deceased | expelled`

The `ComputedMembershipStatus` type only covers 6 states:

```typescript
export type ComputedMembershipStatus =
  | 'pendingPayment' | 'active' | 'gracePeriod'
  | 'lapsed' | 'suspended' | 'removed';
```

Missing: `expired`, `resigned`, `deceased`, `expelled`. The function cannot return these even when the schema stores them. The spec says `resigned`, `deceased`, and `expelled` are terminal states (LIF-04).

**Fix:** Extend `ComputedMembershipStatus` and `MembershipStatusInput` to handle all 10 states. Add checks for `resignedAt`, `dateOfDeath`, `expelledAt` fields (some exist in schema: `dateOfDeath`).

---

#### EF-M05-831ee966: `graceToLapsed.ts` -- No `membership_status_history` logging

- **Check:** Data shape
- **Spec ref:** Section 7 Entity `MembershipStatusHistory`, Section 17 Observability Hooks
- **API_CONTRACTS:** Domain event `membership.status.changed` required on transition

The job transitions members from `gracePeriod` to `lapsed` but does not insert into `membership_status_history` table. The spec requires all status changes to be logged with `previousStatus`, `newStatus`, `changedBy` (null for system), and `reason`.

**Fix:** After each batch update, insert corresponding `membership_status_history` records. Emit `membership.status.changed` domain event.

---

#### EF-M05-0f378f1b: `updateMember.ts` -- No audit log or status history

- **Check:** Data shape / Observability
- **Spec ref:** Section 17 -- `membership.status.changed` log event, `MembershipStatusHistory` entity

Officer-initiated status changes via `updateMember` are not logged to `membership_status_history`. The spec requires: `changedBy` = officer personId, `reason` = required for officer-initiated changes. No domain event emitted.

**Fix:** After successful update where `status !== currentStatus`, insert into `membership_status_history` and emit `membership.status.changed`.

---

#### EF-M05-e2e2e2e2: `reinstateMembership.ts` (association:member) -- Rejects `expired` status

- **Check:** Domain terms / State machine
- **Spec ref:** Section 8 -- `expired: ['active', 'removed']`

The reinstatement handler allows reinstating from `removed` and `suspended` but rejects `expired`. The canonical state machine in `status-transitions.ts` allows `expired -> active`.

**Fix:** Add `expired` to the set of reinstatable statuses.

---

### P2 -- Warnings

#### EF-M05-c3a01407: `addMember.ts` -- Hardcoded `status: 'active'`

- **Check:** Domain terms
- **Spec ref:** Section 8 -- initial state should be `pendingPayment` per the state machine

The handler always sets `status: 'active'` on new members. Per spec, new members should start as `pendingPayment` unless manually overridden by an officer with an explicit status. The schema default is also `pendingPayment`.

---

#### EF-M05-6bc08206: `listMembers.ts` -- Untyped `any` casts

- **Check:** Data shape

The flattening logic uses `(row: any)` which bypasses TypeScript type safety. The repo returns `{ membership, person, category }` tuples -- these should be properly typed.

---

#### EF-M05-02ba89fd: `getMember.ts` -- Unsafe `Record<string, unknown>` casting

- **Check:** Data shape

The handler casts the repo result through `Record<string, unknown>` to access nested fields. This loses type safety and could silently return null for misnamed fields.

---

#### EF-M05-181ccc65: `updateMember.ts` -- Silent rejection of invalid transitions

- **Check:** Error taxonomy
- **Spec ref:** Section 15 Error Handling -- spec says return 400 for invalid transitions

The handler silently ignores invalid status transitions (returns current status unchanged, 200 OK). The API_CONTRACTS spec says invalid transitions should return `400 INVALID_STATUS_TRANSITION`.

```typescript
const status = isValidOfficerTransition(currentStatus, requestedDbStatus)
  ? requestedDbStatus
  : currentStatus; // silent no-op
```

Note: The `[BR-03]` comment says "silently reject" but this contradicts Section 15 error handling which mandates a 400 response.

---

#### EF-M05-fd7eab23: `updateMember.ts` -- Duplicated transition map instead of importing

- **Check:** Import boundaries
- **Spec ref:** Section 8 State Transitions

`updateMember.ts` defines its own `OFFICER_TRANSITIONS` map and `isValidOfficerTransition()` function instead of importing from `association:member/utils/status-transitions.ts`. The canonical `MEMBERSHIP_VALID_TRANSITIONS` in `status-transitions.ts` could diverge from the local copy.

**Fix:** Export `isValidMembershipTransition` from `status-transitions.ts` and use it in `updateMember.ts`, filtering to officer-allowed subset.

---

#### EF-M05-41e59aae: `getOrgProfile.ts` -- Cross-boundary module import

- **Check:** Import boundaries
- **Spec ref:** Module Map -- Organization belongs to Platform Admin (M03)

Handler imports `OrganizationRepository` from `platformadmin/repos/`. This creates a direct coupling from M05 (Membership) to M03 (Platform Admin). Per the domain model's anti-corruption layer guidance, cross-context access should go through ID-based references or a shared service.

---

#### EF-M05-abc60110: `listOrgApplications.ts` -- Raw Drizzle queries bypass repository

- **Check:** Naming / Architecture

Handler performs raw Drizzle `db.select().from(membershipApplications)` instead of using `MembershipRepository.listApplications()`. This bypasses the repository pattern used by all other handlers, creating an inconsistent data access path.

---

#### EF-M05-b1042638: `membership/repos/` -- No own schema, imports from `association:member`

- **Check:** Import boundaries

`membership.repo.ts` imports all schema types from `../../association:member/repos/membership.schema`. The `membership/` module has no `repos/membership.schema.ts` of its own. This means `membership/` is fully dependent on `association:member/` for its data model -- a consequence of the mega-module split being incomplete.

**Impact:** Acceptable as-is per ROADMAP.md deferred item P1-11 (mega-module split). Track for resolution in v1.2.0.

---

#### EF-M05-0e99b010: `csvImport.ts` -- No streaming for large CSV files

- **Check:** Data shape / Performance
- **Spec ref:** AC-M05-003 ("500 rows < 30s"), Section 16 Performance

The handler parses the entire CSV string in memory. For large files (1000+ rows), this could cause memory pressure. The spec mentions "streaming CSV parse" in AI Instructions section 5.

---

#### EF-M05-d1d1d1d1: `membership.schema.ts` stores status as mutable column vs BR-01

- **Check:** Data shape
- **Spec ref:** BR-01 -- "compute from dues_expiry_date + grace period at query time. Never store as mutable field."

The schema has `status: membershipStatusEnum('status').notNull().default('pendingPayment')` as a mutable column. BR-01 says status should be computed, not stored. Current implementation stores AND computes -- the `computeMembershipStatus` function is used at read time in handlers, but the DB column is also written to by `graceToLapsed.ts` and `updateMember.ts`.

**Impact:** Dual-write pattern (store + compute) works but risks inconsistency. The stored value and computed value can diverge if a handler writes without going through `computeMembershipStatus`.

---

#### EF-M05-3a468fe4: `listCategories.ts` -- No error handling

- **Check:** Error taxonomy

Handler has zero error handling. If the DB query fails, the error propagates to the global handler. While the global handler catches it, the spec (Section 15) defines specific error codes for this endpoint (403 for non-members).

---

### P3 -- Info

#### EF-M05-1c971b3e: `addMember.ts` -- Missing `ConflictError` import

The handler doesn't import `ConflictError` from `@/core/errors`. When duplicate check is added (per P0 fix), this import will be needed.

---

#### EF-M05-3c42ea2d: `getMember.ts` -- No `MembershipStatusHistory` query

Spec Section 9 UI shows member detail should include status history. The handler returns only current computed status with no history data.

---

#### EF-M05-info-01: Inconsistent context typing across handlers

`importMembers.ts` uses `BaseContext`, `addMember.ts` uses `Context` from Hono, `listOrgApplications.ts` uses `ValidatedContext`. Should standardize on one approach.

---

#### EF-M05-info-02: `csvImport.ts` has two exported handlers in one file

`previewCSVImport` and `bulkCSVImport` in a single file. Convention in this codebase is one handler per file.

---

#### EF-M05-info-03: `membership-lifecycle.ts` calls repo methods not in `membership/repos/`

The lifecycle service calls `findMany()` and `updateOneById()` on MembershipRepository, but `membership/repos/membership.repo.ts` only has `listMembers()` and `updateMember()`. These are methods on a different repo instance in `association:member/`.

---

#### EF-M05-info-04: Status enum alias fragility

`VALID_STATUSES` in `updateMember.ts` includes `'grace'` (aliased to `'gracePeriod'`). The alias mapping works but is undocumented -- if a client sends `'gracePeriod'` directly, it passes Zod but skips the mapping (correct behavior, but fragile).

---

#### EF-M05-info-05: Duplicate key in test factory

`membership.repo.test.ts` `makeCategory` has `organizationId: 'org-1'` listed twice. Harmless (last wins) but indicates copy-paste.

---

#### EF-M05-info-06: `compute-membership-status.ts` -- Exemplary isolation

Pure function with no DB dependency, deterministic, injectable `now` parameter for testing. Good pattern to replicate.

---

## Spec Coverage Matrix

### API Endpoints (from API_CONTRACTS Section 2)

| Endpoint | Handler | Status | Gaps |
|----------|---------|--------|------|
| GET `/org/:id/members` | `listMembers.ts` | Implemented | P2: `any` casts |
| GET `/org/:id/members/:id` | `getMember.ts` | Implemented | P2: unsafe casts, P3: no history |
| POST `/org/:id/members` | `addMember.ts` | Implemented | **P0: no duplicate check, no auth** |
| POST `/org/:id/members/:id/transfer` | -- | **MISSING** | No handler exists |
| POST `/org/:id/applications` | -- | **MISSING** | No submit-application handler |
| PUT `/org/:id/applications/:id` | -- | **MISSING** | No review-application handler (repo method exists) |
| POST `/org/:id/members/import` | `csvImport.ts` / `importMembers.ts` | Implemented (2x) | P1: duplicated logic |
| POST `/org/:id/members/import/confirm` | -- | **MISSING** | Two-step import confirm not wired |
| GET `/org/:id/directory` | -- | **MISSING** | No directory handler |
| GET `/org/:id/membership-categories` | `listCategories.ts` | Implemented | P3: no error handling |
| POST `/org/:id/membership-categories` | -- | **MISSING** | No create-category handler |
| PATCH `/org/:id/membership-categories/:id` | -- | **MISSING** | No update-category handler |

### Domain Events (from API_CONTRACTS Section 3-4)

| Event | Emitted By | Status |
|-------|-----------|--------|
| `membership.created` | `addMember.ts` | **NOT EMITTED** |
| `membership.status.changed` | `updateMember.ts`, `graceToLapsed.ts` | **NOT EMITTED** |
| `membership.approved` | (no handler) | **MISSING** |
| `membership.transferred` | (no handler) | **MISSING** |
| `membership.imported` | `csvImport.ts` | **NOT EMITTED** |
| `membership.lapsed` | `graceToLapsed.ts` | **NOT EMITTED** (notification sent, no domain event) |

### Business Rules (from MODULE_SPEC Section 5)

| BR | Description | Implementation | Gaps |
|----|-------------|---------------|------|
| BR-01 | Status computed at query time | `compute-membership-status.ts` | P1: missing 4 terminal states |
| BR-02 | Grace-to-lapsed daily job | `graceToLapsed.ts` | P1: no status history |
| BR-03 | Officer transitions restricted | `updateMember.ts` | P2: silent reject vs spec's 400 |
| BR-07 | Payment reactivates lapsed | `membership-lifecycle.ts` | Implemented correctly |
| BR-21 | Multi-org isolation | Schema unique constraint | P0: handler doesn't enforce pre-check |
| BR-22 | Cross-org person matching | `csvImport.ts`, `importMembers.ts` | P1: duplicated |
| BR-25 | Import requires president/secretary | `importMembers.ts` | Correct. `csvImport.ts` missing. |

---

## Recommendations (Priority Order)

1. **P0 Fix `addMember.ts`**: Add duplicate check + auth guard. Estimated: 30min.
2. **P1 Consolidate CSV import logic**: Extract shared module, delete duplication. Estimated: 2hr.
3. **P1 Extend `ComputedMembershipStatus`**: Add 4 missing terminal states. Estimated: 1hr.
4. **P1 Add `membership_status_history` writes**: To `updateMember.ts` and `graceToLapsed.ts`. Estimated: 1hr.
5. **P1 Fix `listApplications.ts` error swallowing**: Remove catch-all. Estimated: 15min.
6. **P1 Fix `reinstateMembership.ts` expired rejection**: Add expired to reinstatable set. Estimated: 15min.
7. **P2 Fix silent transition rejection**: Return 400 per spec. Estimated: 15min.
8. **P2 Import status-transitions**: Replace local map in `updateMember.ts`. Estimated: 15min.
9. **Missing handlers**: 7 endpoints from API_CONTRACTS have no handler. Plan as vertical slices per MODULE_SPEC Section 19.
10. **Domain events**: Zero of 6 specified events are emitted. Requires event bus integration.
