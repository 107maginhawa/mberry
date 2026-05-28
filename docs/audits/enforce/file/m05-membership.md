# Per-File Spec Traceability Report: M05 Membership

**Generated:** 2026-05-28
**Auditor:** oli-enforce-file (full re-audit)
**Scope:** `services/api-ts/src/handlers/membership/` + membership-related files in `association:member/`
**Spec:** `docs/product/modules/m05-membership/MODULE_SPEC.md`

## Summary

| Metric | Count |
|--------|-------|
| Files audited | 34 (15 membership/ handlers+jobs, 2 repos, 1 types, 9 association:member directory/transfer/application handlers, 5 utils, 2 schemas) |
| Findings total | 21 |
| P0 (Blocker) | 0 |
| P1 (Critical) | 5 |
| P2 (Warning) | 9 |
| P3 (Info) | 7 |

### Delta from Prior Audit (2026-05-27)

| Finding | Previous | Current | Reason |
|---------|----------|---------|--------|
| EF-M05-344c98c0 addMember no duplicate check | P0 | RESOLVED | ConflictError added, checks existing membership |
| EF-M05-5f67b806 addMember no auth guard | P0 | RESOLVED | ForbiddenError + officer check added |
| EF-M05-0ac7b5e5 compute-membership-status missing terminal states | P1 | RESOLVED | `expired`, `resigned`, `deceased`, `expelled` all present in type + function |
| EF-M05-831ee966 graceToLapsed no status history | P1 | RESOLVED | Now imports `membershipStatusHistory` and inserts records |
| EF-M05-0f378f1b updateMember no domain event | P1 | RESOLVED | `domainEvents.emit('membership.status.changed', ...)` added |
| EF-M05-c3a01407 addMember hardcoded active | P2 | RESOLVED | `addMember.ts` now references status properly |
| EF-M05-1c971b3e addMember missing ConflictError import | P3 | RESOLVED | Import present |

---

## File Inventory

### `membership/` handlers (implementation files)

| File | Role | Spec Trace |
|------|------|------------|
| `addMember.ts` | Handler | WF-030, BR-21, AC-M05-001 |
| `getMember.ts` | Handler | WF-030, BR-01 |
| `listMembers.ts` | Handler | WF-030, BR-01 |
| `listOrgMembers.ts` | Handler | WF-030 (org-scoped variant) |
| `updateMember.ts` | Handler | WF-030, BR-03, Section 8 |
| `reviewApplication.ts` | Handler | WF-029 |
| `listApplications.ts` | Handler | WF-029 |
| `listOrgApplications.ts` | Handler | WF-029 |
| `csvImport.ts` | Handler | WF-031, BR-22, AC-M05-003 |
| `importMembers.ts` | Handler | WF-031, BR-22, BR-25 |
| `listCategories.ts` | Handler | WF-033 |
| `upsertCategory.ts` | Handler | WF-033, BR-04 |
| `getOrgProfile.ts` | Handler | (cross-boundary) |
| `updateOrgProfile.ts` | Handler | (cross-boundary) |
| `import-types.ts` | Types | WF-031 shared types |
| `jobs/graceToLapsed.ts` | Job | BR-02, Section 8 |
| `jobs/index.ts` | Job registry | -- |

### `membership/repos/`

| File | Role | Spec Trace |
|------|------|------------|
| `membership.repo.ts` | Repository | All M05 endpoints |
| `membership.repo.test.ts` | Unit test | -- |

### `association:member/` (membership-related)

| File | Role | Spec Trace |
|------|------|------------|
| `repos/membership.schema.ts` | Schema | Section 7 Data Requirements |
| `repos/status-history.schema.ts` | Schema | Section 7 `MembershipStatusHistory` |
| `utils/compute-membership-status.ts` | Pure function | BR-01 (all 10 states) |
| `utils/status-transitions.ts` | State machine | Section 8 State Transitions |
| `utils/membership-lifecycle.ts` | Lifecycle service | BR-03, BR-07 |
| `utils/membership-status-middleware.ts` | Middleware | BR-01 query-time computation |
| `reinstateMembership.ts` | Handler | WF-035, M05-S8 |
| `deceaseMembership.ts` | Handler | M05-S10, LIF-04 |
| `createMembershipApplication.ts` | Handler | WF-029, M05-S3 |
| `approveMembershipApplication.ts` | Handler | WF-029, M05-S3 |
| `createAffiliationTransfer.ts` | Handler | WF-036, M05-S9 |
| `approveTransferBySource.ts` | Handler | WF-036, M05-S9 |
| `approveTransferByTarget.ts` | Handler | WF-036, M05-S9 |
| `completeAffiliationTransfer.ts` | Handler | WF-036, M05-S9 |
| `createDirectoryProfile.ts` | Handler | WF-034, M05-S6 |
| `listDirectoryProfiles.ts` | Handler | WF-034 |
| `searchDirectory.ts` | Handler | WF-034 |

### Frontend routes (membership-related)

| Route | Spec Screen |
|-------|-------------|
| `org/$orgSlug/officer/roster.tsx` | Screen: Member Roster |
| `org/$orgSlug/officer/roster/index.tsx` | Screen: Member Roster |
| `org/$orgSlug/officer/roster/import.tsx` | Screen: Bulk CSV Import |
| `org/$orgSlug/officer/roster/$memberId.tsx` | Member Detail |
| `org/$orgSlug/officer/applications.tsx` | Screen: Application Review |
| `org/$orgSlug/directory.tsx` | Screen: Member Directory |
| `org/$orgSlug/directory/$personId.tsx` | Directory Profile Detail |
| `org/$orgSlug/members.tsx` | Members list |
| `org/$orgSlug/officer/settings/membership-categories.tsx` | WF-033 Categories |

---

## Findings

### P1 -- Critical

#### EF-M05-04598714: `csvImport.ts` + `importMembers.ts` -- Duplicate import logic

- **Check:** Import boundaries / DRY
- **Spec ref:** WF-031

Two files implement overlapping CSV import logic. Both have local `findPersonMatch()` functions. Shared types (`importMemberRowSchema`, `normalizeLicense`, `ImportMemberRow`) are correctly extracted to `import-types.ts`, but person-matching logic remains duplicated:
- `csvImport.ts:296` -- local `findPersonMatch()`
- `importMembers.ts:150` -- local `findPersonMatch()`

Divergence risk for BR-22 (matching rules).

**Fix:** Extract `findPersonMatch` to `import-types.ts` or a new `membership/utils/person-matching.ts`.

---

#### EF-M05-adff0894: `csvImport.ts` -- No authorization guard

- **Check:** Authorization
- **Spec ref:** Section 6 Permissions -- "Import roster: super, admin, president (2FA), secretary (2FA)"

`csvImport.ts` reads `session.user.id` for audit fields but performs no role/permission check. `importMembers.ts` correctly implements `requirePosition`. Anyone authenticated can invoke the CSV import endpoint via `csvImport.ts`.

**Fix:** Add `requirePosition` or `officerAuthMiddleware` guard matching `importMembers.ts`.

---

#### EF-M05-e2e2e2e2: `reinstateMembership.ts` -- Rejects `expired` and `lapsed` statuses

- **Check:** State machine conformance
- **Spec ref:** Section 8 -- `expired: ['active', 'removed']`, `lapsed: ['active', ...]`; M05-S8 Reinstatement slice

`reinstatableStatuses = ['removed', 'suspended']` -- missing `expired` and `lapsed`. The canonical state machine in `status-transitions.ts` allows `expired -> active` and `lapsed -> active`. The spec's M05-S8 vertical slice is "Pay dues to restore Active from Lapsed."

**Fix:** Add `'expired'` and `'lapsed'` to `reinstatableStatuses`.

---

#### EF-M05-cee2b87c: `listApplications.ts` -- Silent error swallowing

- **Check:** Error taxonomy
- **Spec ref:** Section 15 Error Handling

Handler catches ALL errors and returns `{ data: [] }` with 200 status. This masks database errors, permission issues, and schema mismatches. Comment says "Table schema mismatch" but this catch-all hides real failures in production.

**Fix:** Remove catch-all. Return 500 for unknown errors. If schema mismatch is the concern, fix the schema query instead.

---

#### EF-M05-0f378f1b: `updateMember.ts` -- No status history insert

- **Check:** Data shape / Audit
- **Spec ref:** Section 7 Entity `MembershipStatusHistory`, Section 17 Observability

Domain event `membership.status.changed` IS now emitted (resolved), but `membership_status_history` table is NOT written to. The `graceToLapsed.ts` job correctly writes status history; `updateMember.ts` does not. Officer-initiated status changes lack audit trail.

**Fix:** After status change, insert into `membershipStatusHistory` with `changedBy = session.user.id`.

---

### P2 -- Warnings

#### EF-M05-181ccc65: `updateMember.ts` -- Silent rejection of invalid transitions

- **Check:** Error taxonomy
- **Spec ref:** Section 15 Error Handling -- spec says return 400 for invalid transitions; BR-03 says "rejected silently"

Contradiction between BR-03 ("Invalid transitions rejected silently") and Section 15 (400 error). Current implementation follows BR-03 (silent no-op, returns 200). API callers have no way to know the transition was rejected.

**Impact:** UX confusion. Officer changes status, gets 200, but status unchanged.

---

#### EF-M05-fd7eab23: `updateMember.ts` -- Duplicated transition map

- **Check:** Import boundaries
- **Spec ref:** Section 8

Local `OFFICER_TRANSITIONS` map covers only 5 source states (`active`, `grace`, `gracePeriod`, `lapsed`, `suspended`). The canonical `MEMBERSHIP_VALID_TRANSITIONS` in `status-transitions.ts` covers all 10 states including `expired`, `resigned`, `deceased`, `expelled`. These maps will diverge.

**Fix:** Import from `status-transitions.ts` and filter to officer-allowed subset.

---

#### EF-M05-6bc08206: `listMembers.ts` -- Untyped `any` casts

- **Check:** Data shape

Flattening logic uses `(row: any)` which bypasses TypeScript safety. Repo returns typed tuples -- should be properly typed.

---

#### EF-M05-02ba89fd: `getMember.ts` -- Unsafe `Record<string, unknown>` casting

- **Check:** Data shape

Handler casts repo result through `Record<string, unknown>` to access nested fields. Loses type safety.

---

#### EF-M05-41e59aae: `getOrgProfile.ts` -- Cross-boundary module import

- **Check:** Import boundaries

Imports `OrganizationRepository` from `platformadmin/repos/`. Direct coupling from M05 to M03. Per domain model, cross-context access should use ID-based refs or shared service.

---

#### EF-M05-abc60110: `listOrgApplications.ts` -- Raw Drizzle bypasses repository

- **Check:** Architecture

Performs raw `db.select().from(membershipApplications)` instead of using `MembershipRepository.listApplications()`. Inconsistent data access path.

---

#### EF-M05-b1042638: `membership/repos/` -- No own schema

- **Check:** Import boundaries

`membership.repo.ts` imports all schema from `association:member/repos/membership.schema`. Acceptable per ROADMAP.md deferred item P1-11 (mega-module split v1.2.0).

---

#### EF-M05-0e99b010: `csvImport.ts` -- No streaming for large CSV

- **Check:** Performance
- **Spec ref:** AC-M05-003 ("500 rows < 30s"), AI Instructions section 5

Parses entire CSV in memory. For 1000+ rows, could cause memory pressure.

---

#### EF-M05-d1d1d1d1: `membership.schema.ts` -- Status stored as mutable column vs BR-01

- **Check:** Data shape
- **Spec ref:** BR-01 -- "compute at query time, never store as mutable"

Schema has `status` as mutable column. Implementation uses dual-write pattern (store + compute via `membership-status-middleware.ts`). Risk of inconsistency if any handler writes status without going through `persistWithComputedStatus()`.

---

### P3 -- Info

#### EF-M05-3c42ea2d: `getMember.ts` -- No status history in response

Spec Section 9 UI shows member detail should include status history. Handler returns only current computed status.

---

#### EF-M05-info-01: Inconsistent context typing across handlers

`importMembers.ts` uses `BaseContext`, `addMember.ts` uses `Context`, `listOrgApplications.ts` uses `ValidatedContext`. Should standardize.

---

#### EF-M05-info-02: `csvImport.ts` has two exported handlers in one file

`previewCSVImport` and `bulkCSVImport` in one file. Convention is one handler per file.

---

#### EF-M05-info-03: `reviewApplication.ts` -- Approved members default to `status: 'active'`

When application is approved, membership is created with `status: 'active'`. Per spec state machine, new memberships should start as `pendingPayment` unless dues are pre-paid. However, if dues config exists and invoice is generated simultaneously (which this handler does), `active` may be intentional.

---

#### EF-M05-info-04: Status enum alias fragility

`VALID_STATUSES` in `updateMember.ts` includes `'grace'` (aliased to `'gracePeriod'`). The alias mapping works but is undocumented.

---

#### EF-M05-info-05: `graceToLapsed.ts` -- No domain event emission

Job writes status history to `membership_status_history` (resolved from prior audit) but does not emit `membership.status.changed` domain event. `updateMember.ts` emits the event but not the job. Inconsistent.

---

#### EF-M05-info-06: `compute-membership-status.ts` -- Exemplary isolation

Pure function with no DB dependency, deterministic, injectable `now` parameter. All 10 states covered with correct priority ordering. Good pattern.

---

#### EF-M05-info-07: `reviewApplication.ts` emits `membership.created` event

Handler correctly emits `domainEvents.emit('membership.created', ...)` on approval. This is the only handler emitting this event.

---

## Spec Coverage Matrix

### API Endpoints (from MODULE_SPEC Section 10)

| Spec Endpoint | Handler(s) | Status | Notes |
|---------------|-----------|--------|-------|
| GET `/org/:id/members` | `listMembers.ts`, `listOrgMembers.ts` | IMPLEMENTED | P2: any casts |
| GET `/org/:id/members/:id` | `getMember.ts` | IMPLEMENTED | P2: unsafe casts, P3: no history |
| POST `/org/:id/members` | `addMember.ts` | IMPLEMENTED | Auth + duplicate check now present |
| POST `/org/:id/members/import` | `csvImport.ts` / `importMembers.ts` | IMPLEMENTED (2x) | P1: duplicated logic, P1: csvImport no auth |
| POST `/org/:id/members/import/confirm` | `csvImport.ts` (bulkCSVImport) | PARTIAL | Two-step via preview+confirm in same file |
| POST `/org/:id/applications` | `createMembershipApplication.ts` (assoc:member) | IMPLEMENTED | TypeSpec-covered |
| PUT `/org/:id/applications/:id` | `reviewApplication.ts` + `approveMembershipApplication.ts` (assoc:member) | IMPLEMENTED | Both hand-wired and TypeSpec versions |
| POST `/org/:id/members/:id/transfer` | `createAffiliationTransfer.ts` (assoc:member) | IMPLEMENTED | TypeSpec-covered, dual-approval |
| GET `/org/:id/directory` | `searchDirectory.ts`, `listDirectoryProfiles.ts` (assoc:member) | IMPLEMENTED | TypeSpec-covered |

### Domain Events (from MODULE_SPEC Section 10b)

| Event | Status | Emitter |
|-------|--------|---------|
| `membership.created` | EMITTED | `reviewApplication.ts` on approval |
| `membership.status.changed` | PARTIAL | `updateMember.ts` emits; `graceToLapsed.ts` does NOT |
| `membership.approved` | NOT EMITTED | No handler emits this distinct event |
| `membership.transferred` | NOT VERIFIED | Likely in `completeAffiliationTransfer.ts` |
| `membership.imported` | NOT EMITTED | Neither import handler emits |
| `membership.lapsed` | NOT EMITTED | `graceToLapsed.ts` writes history but no event |

### Business Rules Coverage

| BR | Implementation | Status |
|----|---------------|--------|
| BR-01 | `compute-membership-status.ts` | COMPLETE (all 10 states) |
| BR-02 | `graceToLapsed.ts` | COMPLETE (org-specific grace) |
| BR-03 | `updateMember.ts` | PARTIAL (silent reject, no 400) |
| BR-04 | `upsertCategory.ts` | NEEDS VERIFICATION |
| BR-21 | `addMember.ts` unique check | COMPLETE |
| BR-22 | `csvImport.ts` + `importMembers.ts` | COMPLETE (duplicated) |
| BR-23 | `import-types.ts` normalizeLicense | COMPLETE |
| M5-R1 | `status-transitions.ts` | COMPLETE |
| M5-R2 | `import-types.ts` normalizeLicense | COMPLETE |
| M5-R3 | Both import handlers | COMPLETE |
| M5-R5 | `createMembershipApplication.ts` | NEEDS VERIFICATION |
| M5-R6 | Transfer handlers | NEEDS VERIFICATION |
| M5-R8 | Both import handlers | COMPLETE (= M5-R3) |
| M5-R10 | Schema constraint + compute function | COMPLETE |

### Vertical Slice Coverage

| Slice | Status | Notes |
|-------|--------|-------|
| M05-S1 Status Computation | COMPLETE | All 10 states, priority ordering correct |
| M05-S2 Member Roster | COMPLETE | List, search, filter implemented |
| M05-S3 Application Flow | COMPLETE | Submit + review in both handler dirs |
| M05-S4 Bulk CSV Import | COMPLETE (duplicated) | Two implementations |
| M05-S5 Cross-Org Matching | COMPLETE | Email + license normalization |
| M05-S6 Member Directory | COMPLETE | Full CRUD + search in assoc:member |
| M05-S7 Categories | PARTIAL | List + upsert present, no explicit deactivate |
| M05-S8 Reinstatement | PARTIAL | Missing `expired` + `lapsed` from reinstatable set |
| M05-S9 Member Transfer | COMPLETE | Create + dual-approve + complete |
| M05-S10 Terminal States | COMPLETE | `deceaseMembership.ts` handles terminal check |

### UI Screen Coverage

| Spec Screen | Route | Status |
|-------------|-------|--------|
| Member Roster (`/org/[id]/officer/roster`) | `officer/roster/index.tsx` | PRESENT |
| Bulk CSV Import (`/org/[id]/officer/roster/import`) | `officer/roster/import.tsx` | PRESENT |
| Member Directory (`/org/[id]/members`) | `directory.tsx` | PRESENT |
| Application Review (`/org/[id]/officer/applications`) | `officer/applications.tsx` | PRESENT |

---

## Recommendations (Priority Order)

1. **P1 Fix `csvImport.ts` auth**: Add officer role guard. Estimated: 15min.
2. **P1 Consolidate `findPersonMatch`**: Extract to shared module. Estimated: 1hr.
3. **P1 Fix `reinstateMembership.ts`**: Add `expired` and `lapsed` to reinstatable set. Estimated: 15min.
4. **P1 Fix `listApplications.ts`**: Remove catch-all error swallowing. Estimated: 15min.
5. **P1 Add status history to `updateMember.ts`**: Insert `membershipStatusHistory` on change. Estimated: 30min.
6. **P2 Resolve BR-03 vs Section 15 contradiction**: Decide silent reject or 400 and align. Estimated: 15min.
7. **P2 Import canonical transitions**: Replace local `OFFICER_TRANSITIONS` in `updateMember.ts`. Estimated: 15min.
8. **Domain events**: 3 of 6 specified events are not emitted. Wire up `membership.approved`, `membership.imported`, `membership.lapsed`.
