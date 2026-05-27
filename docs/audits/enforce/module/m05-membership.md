# Module Enforcement Audit: M05 Membership

> Generated: 2026-05-27 (deep audit) | Auditor: oli-enforce-module | Branch: audit/codebase-improvements

## 1. Module Overview

**Spec source:** `docs/product/modules/m05-membership/MODULE_SPEC.md`
**API contracts:** `docs/product/modules/m05-membership/API_CONTRACTS.md`
**Handler dirs:** `services/api-ts/src/handlers/membership/` (12 handlers) + `services/api-ts/src/handlers/association:member/` (shared, membership-related subset)

**Workflows (9):** WF-029 through WF-037 (Application Review, Roster, Bulk CSV Import, Status Computation, Categories, Directory, Reinstatement, Transfer, Cross-Org Matching)

---

## 2. Dimension Scores

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Dim 1: Public API | 7.0 | 1.0 | 7.0 |
| Dim 2: Workflow | 7.0 | 1.0 | 7.0 |
| Dim 3: Domain Terms | 8.0 | 1.0 | 8.0 |
| Dim 4: State Machine | 7.5 | 1.0 | 7.5 |
| Dim 5: Events | 1.0 | 1.0 | 1.0 |
| Dim 6: Auth/Permission | 7.0 | 1.0 | 7.0 |
| **Raw Average** | | | **6.25** |
| **P0 Cap Applied** | | | **3.0** |

**Overall Score: 3.0 / 10** (capped by P0: zero domain events emitted)

---

## 3. Dimension Details

### Dim 1: Public API (7.0/10)

**API_CONTRACTS specifies 11 endpoints.** Coverage:

| Endpoint | Handler Found | Location | Status |
|----------|--------------|----------|--------|
| GET `/org/:orgId/members` | `listMembers.ts` | membership/ | FOUND |
| GET `/org/:orgId/members/:memberId` | `getMember.ts` | membership/ | FOUND |
| POST `/org/:orgId/members` | `addMember.ts` | membership/ | FOUND |
| POST `/org/:orgId/members/:memberId/transfer` | `approveTransferBySource.ts` + `approveTransferByTarget.ts` | association:member/ | PARTIAL -- transfer creation handler exists as `createAffiliationTransfer.ts` but route path differs from spec |
| POST `/org/:orgId/applications` | None dedicated | -- | MISSING (see EM-M05-e5f6g7h8) |
| PUT `/org/:orgId/applications/:appId` | `reviewApplication.ts` | membership/ | FOUND |
| POST `/org/:orgId/members/import` | `csvImport.ts` (previewCSVImport) | membership/ | FOUND |
| POST `/org/:orgId/members/import/confirm` | `csvImport.ts` (bulkCSVImport) | membership/ | FOUND |
| GET `/org/:orgId/directory` | directory repo exists, no GET handler | association:member/ | PARTIAL (see EM-M05-u1v2w3x4) |
| GET `/org/:orgId/membership-categories` | `listCategories.ts` | membership/ | FOUND |
| POST `/org/:orgId/membership-categories` | `upsertCategory.ts` | membership/ | FOUND |
| PATCH `/org/:orgId/membership-categories/:catId` | `upsertCategory.ts` | membership/ | FOUND |

**Note:** Application submit endpoint (`POST /org/:orgId/applications`) has no dedicated self-service handler; `reviewApplication.ts` handles officer review only. Bulk approve exists in `association:member/bulkApproveMembershipApplications.ts`.

### Dim 2: Workflow (7.0/10)

| Workflow | Status | Evidence |
|----------|--------|----------|
| WF-029: Application Review | IMPLEMENTED | `reviewApplication.ts`, `approveMembershipApplication.ts`, `bulkApproveMembershipApplications.ts` |
| WF-030: Member Roster | IMPLEMENTED | `listMembers.ts`, `listOrgMembers.ts` with search, filter, pagination |
| WF-031: Bulk CSV Import | IMPLEMENTED | `csvImport.ts` (parse, validate, preview, bulk import), `importMembers.ts`, `importRosterMembers.ts` |
| WF-032: Status Computation | IMPLEMENTED | `compute-membership-status.ts` -- pure function, called at query time in `getMember.ts` and `listMembers.ts` |
| WF-033: Membership Categories | IMPLEMENTED | `listCategories.ts`, `upsertCategory.ts` |
| WF-034: Member Directory | PARTIAL | `publishMyDirectoryProfile.ts`, `directory.repo.ts`, `directoryAutoPopulate.ts` exist but no GET directory list handler found |
| WF-035: Reinstatement | IMPLEMENTED | `membership-lifecycle.ts` -- `PAYMENT_REACTIVATABLE_STATUSES` includes `lapsed`; payment extends expiry and sets status to `active` |
| WF-036: Member Transfer | IMPLEMENTED | `approveTransferBySource.ts`, `approveTransferByTarget.ts` -- dual-approval flow with status progression |
| WF-037: Cross-Org Matching | IMPLEMENTED | `importMembers.ts` -- email + license matching with normalization, conflict flagging |

**Gap:** WF-034 directory GET listing endpoint not found as standalone handler.

### Dim 3: Domain Terms (8.0/10)

Verified against DOMAIN_MODEL Section 2 (Membership bounded context):

| Term | Spec Definition | Code Usage | Status |
|------|----------------|------------|--------|
| Membership | Central entity with computed status | `membership.schema.ts`, `membership.repo.ts` | ALIGNED |
| MembershipApplication | Application lifecycle | `membershipApplications` table, `reviewApplication.ts` | ALIGNED |
| MembershipCategory / MembershipTier | Per-org classification | `membershipCategories` table, `listCategories.ts`, `upsertCategory.ts` | ALIGNED |
| MembershipStatusHistory | Audit trail for transitions | `status-history.schema.ts` | ALIGNED |
| AffiliationTransfer | Inter-org transfer | `AffiliationTransferRepository`, dual-approval handlers | ALIGNED |
| ComputedMembershipStatus | Enum: active, gracePeriod, lapsed, etc. | `compute-membership-status.ts` type definition | PARTIAL (missing 4 terminal statuses) |
| DirectoryProfile | Privacy-filtered member info | `directory.schema.ts`, `directory.repo.ts` | ALIGNED |

**Minor gap:** Spec defines `expired`, `deceased`, `expelled`, `resigned` as terminal computed statuses; compute function only returns 6 of 10.

### Dim 4: State Machine (7.5/10)

**Status Computation (`compute-membership-status.ts`):**
- Priority ordering: removed > suspended > pendingPayment > active > gracePeriod > lapsed
- Life/honorary members (null expiry) always active
- Grace period window calculation correct

**Officer Transitions (`status-transitions.ts`):**
- Full VALID_TRANSITIONS map with terminal states: `removed`, `resigned`, `deceased`, `expelled`, `expired`
- Covers all 10 statuses: pendingPayment, active, gracePeriod, lapsed, suspended, expired, removed, resigned, deceased, expelled
- Terminal states correctly return empty arrays

**Officer Subset (`updateMember.ts`):**
- Restricted OFFICER_TRANSITIONS map: active->suspended/removed, grace->suspended, lapsed->suspended/active, suspended->active
- No-op transitions always valid
- Silently rejects invalid transitions (no error thrown) -- matches BR-03

**Gaps:**
1. `compute-membership-status.ts` returns only 6 statuses (`pendingPayment`, `active`, `gracePeriod`, `lapsed`, `suspended`, `removed`). Spec requires 10 including `expired`, `resigned`, `deceased`, `expelled`. The extended set exists in `status-transitions.ts` but NOT in the compute function.
2. Spec says `expired` is a terminal computed status with configurable threshold beyond lapse. No `expired` computation logic exists.
3. `graceToLapsed.ts` handles automatic gracePeriod->lapsed as daily cron. No corresponding lapsed->expired job exists.

### Dim 5: Events (1.0/10) -- P0

**Spec declares 6 published events:**

| Event | Required By | Emitted in Code? |
|-------|-------------|-----------------|
| MembershipApproved | M01, M06, M07 | NO |
| MembershipSuspended | M04, M07 | NO |
| MembershipStatusChanged | M02, M06, M07, M11 | NO |
| MembershipResigned | M07 | NO |
| MembershipDeceased | M07 | NO |
| MemberImported | M07 | NO |

**Spec declares 4 consumed events:**

| Event | Source | Handler Exists? |
|-------|--------|----------------|
| PaymentRecorded (dues.payment.recorded) | M06 | YES -- `domain-event-consumers.ts` updates duesExpiryDate |
| PaymentRefunded | M06 | PARTIAL -- `membership-lifecycle.ts` processRefund handles directly, no event consumer registered |
| MemberSuspended | M04 | NO |
| MemberRemoved | M04 | NO |

**Summary:** Domain event infrastructure exists (`DomainEventBus` class with `emit`/`on`). One consumer registered (`dues.payment.recorded`). **Zero events are emitted** from any membership handler. Cross-module integration is fully broken for event-driven workflows.

### Dim 6: Auth/Permission (7.0/10)

| Handler | Guard | Spec Requirement | Status |
|---------|-------|-----------------|--------|
| `importMembers.ts` | `requirePosition([PRESIDENT, SECRETARY])` | president(2FA), secretary(2FA) | PARTIAL -- position check present, 2FA not verified in handler |
| `updateOrgProfile.ts` | `requirePosition([PRESIDENT])` | president | OK |
| `listOrgApplications.ts` | platformAdmin check via DB query | admin | OK |
| `listOrgMembers.ts` | platformAdmin check via DB query | admin | OK |
| `approveMembershipApplication.ts` | `requirePosition([SECRETARY, PRESIDENT])` | secretary(2FA), president(2FA) | PARTIAL -- 2FA not verified in handler |
| `bulkApproveMembershipApplications.ts` | `requirePosition([SECRETARY, PRESIDENT])` | secretary(2FA), president(2FA) | PARTIAL -- 2FA not verified in handler |
| `addMember.ts` | session only | officer | WEAK |
| `listMembers.ts` | session only | all org members | OK for read |
| `getMember.ts` | session only | all org members | OK for read |
| `reviewApplication.ts` | session only | officer | WEAK |

**Gaps:**
1. `addMember.ts` and `reviewApplication.ts` (in `membership/` dir) have no position/role check beyond session auth.
2. The parallel `association:member/` handlers DO have proper `requirePosition` guards -- creating an inconsistent security surface.

---

## 4. Findings

### P0 Findings (Score Cap: 3.0)

#### EM-M05-00a1b2c3: Zero Domain Events Emitted

**Severity:** P0
**Dimension:** Events (Dim 5)
**Description:** MODULE_SPEC section 10b declares 6 published events (MembershipApproved, MembershipSuspended, MembershipStatusChanged, MembershipResigned, MembershipDeceased, MemberImported). The domain event bus infrastructure exists (`core/domain-events.ts`) with `emit()` capability. However, NO membership handler calls `domainEvents.emit()` for any event. Downstream modules M01, M06, M07, M11 receive no signals.

**Impact:** M06 cannot auto-generate dues invoices on approval. M07 cannot send welcome emails. M01 cannot complete onboarding. M11 cannot issue credentials. Cross-module integration is completely broken for event-driven workflows.

**Evidence:**
- `grep -rn 'emit\|domainEvent' handlers/membership/` -- zero matches for event emission
- `grep -rn 'emit\|domainEvent' handlers/association:member/` -- zero matches (only `publishedAt` for directory profiles, unrelated)
- `core/domain-event-consumers.ts` registers only 1 consumer (`dues.payment.recorded`)

**Fix:** Add `domainEvents.emit()` calls to `approveMembershipApplication.ts`, `reviewApplication.ts`, `updateMember.ts` (for suspension/removal/resignation), `bulkApproveMembershipApplications.ts`, and import handlers. Register event types in `domain-events.registry.ts`.

---

### P1 Findings

#### EM-M05-d4e5f6g7: Consumed Events Not Registered (3 of 4)

**Severity:** P1
**Dimension:** Events (Dim 5)
**Description:** Of 4 consumed events declared in spec, only `PaymentRecorded` has a registered consumer (`domain-event-consumers.ts`). `PaymentRefunded`, `MemberSuspended`, and `MemberRemoved` have no registered consumers.

**Impact:** Refunds don't revert membership status via event bus (only works through direct `processRefund` call). Suspension/removal from M04 doesn't propagate to membership status flags via events.

**Evidence:** `domain-event-consumers.ts` only registers handler for `dues.payment.recorded`.

#### EM-M05-e5f6g7h8: Missing Application Submit Endpoint

**Severity:** P1
**Dimension:** Public API (Dim 1)
**Description:** API_CONTRACTS specifies `POST /org/:orgId/applications` for self-service application submission (actor: user). No handler implements this. `reviewApplication.ts` handles officer review only. `approveMembershipApplication.ts` handles approval only.

**Impact:** Members cannot self-apply for membership through the API. The WF-029 workflow assumes applications already exist but provides no creation path.

**Evidence:** No file matching `*submit*Application*` or `*create*Application*` in either handler directory.

#### EM-M05-i9j0k1l2: Weak Auth Guards on membership/ Handlers

**Severity:** P1
**Dimension:** Auth/Permission (Dim 6)
**Description:** `addMember.ts` and `reviewApplication.ts` in `membership/` directory require only session auth (no role/position check). The parallel `association:member/` handlers (`approveMembershipApplication.ts`, `bulkApproveMembershipApplications.ts`) correctly use `requirePosition([SECRETARY, PRESIDENT])`. If both route sets are active, the `membership/` handlers create a bypass path.

**Impact:** Any authenticated user could potentially add members or review applications if these routes are exposed without middleware guards.

**Evidence:**
- `addMember.ts`: No `requirePosition` or `requireOrgRole` call
- `reviewApplication.ts`: No `requirePosition` or `requireOrgRole` call

---

### P2 Findings

#### EM-M05-m3n4o5p6: Computed Status Missing 4 Terminal States

**Severity:** P2
**Dimension:** State Machine (Dim 4)
**Description:** `compute-membership-status.ts` returns only 6 statuses (`pendingPayment`, `active`, `gracePeriod`, `lapsed`, `suspended`, `removed`). Spec section 8 requires 10 including `expired`, `resigned`, `deceased`, `expelled`. The `status-transitions.ts` VALID_TRANSITIONS map includes all 10, but the compute function doesn't check `deceasedAt`, `expelledAt`, `resignedAt` flags or implement the `expired` threshold.

**Impact:** `getMember.ts` and `listMembers.ts` will never return `deceased`, `expelled`, `resigned`, or `expired` status since they delegate to the compute function. Terminal states are only reflected via the stored `status` field.

**Evidence:** `MembershipStatusInput` interface has no `deceasedAt`, `expelledAt`, or `resignedAt` fields. `ComputedMembershipStatus` type union excludes these 4 values.

#### EM-M05-q7r8s9t0: No Lapsed-to-Expired Transition Job

**Severity:** P2
**Dimension:** State Machine (Dim 4)
**Description:** Spec section 8 defines `expired` as a terminal state triggered by "configurable threshold beyond lapse." `graceToLapsed.ts` handles grace->lapsed as daily cron, but no equivalent job exists for lapsed->expired.

**Impact:** Members stay in `lapsed` indefinitely instead of transitioning to `expired` (which requires re-application per spec).

#### EM-M05-u1v2w3x4: Directory GET Listing Handler Missing

**Severity:** P2
**Dimension:** Workflow (Dim 2)
**Description:** WF-034 and API_CONTRACTS `GET /org/:orgId/directory` specify a privacy-filtered searchable member list. Code has `directory.repo.ts`, `directory.schema.ts`, and `publishMyDirectoryProfile.ts` (for updating own profile), but no handler for the GET listing endpoint.

**Impact:** Member directory search/browse not available through API.

---

### P3 Findings

#### EM-M05-y5z6a7b8: Duplicate Handler Paths (membership/ vs association:member/)

**Severity:** P3
**Dimension:** Public API (Dim 1)
**Description:** Two handler directories implement overlapping functionality. `membership/reviewApplication.ts` and `association:member/approveMembershipApplication.ts` both handle application approval with different auth patterns. `membership/importMembers.ts` and `association:member/importRosterMembers.ts` both handle import. The `association:member/` versions are generally higher quality (proper auth guards, transactions, audit logging).

**Impact:** Maintenance burden, inconsistent behavior depending on which route is hit.

#### EM-M05-c9d0e1f2: Incomplete MembershipStatusHistory Writes

**Severity:** P3
**Dimension:** Domain Terms (Dim 3)
**Description:** `status-history.schema.ts` exists. Only `graceToLapsed.ts` writes to it. Officer-initiated transitions in `updateMember.ts` and application approval flows do not record status history entries.

**Impact:** Incomplete audit trail for membership status changes.

---

## 5. Summary

| Category | Count |
|----------|-------|
| P0 | 1 |
| P1 | 3 |
| P2 | 3 |
| P3 | 2 |
| **Total Findings** | **9** |

**Strengths:**
- Robust CSV bulk import with per-row validation, matching, conflict flagging (BR-22, M5-R3, M5-R8, AC-M05-003, AC-M05-004)
- Well-designed computed status pattern -- pure function at query time in `getMember.ts` and `listMembers.ts` (BR-01)
- Comprehensive state machine in `status-transitions.ts` with 10 statuses and terminal states
- Dual-approval transfer flow (source + target) with correct status progression
- `membership-lifecycle.ts` centralizes payment->membership orchestration (settlePayment, processRefund, recomputeStatus)
- `graceToLapsed.ts` daily cron job with notifications and idempotency
- Good test coverage (20+ test files across both directories)
- `approveMembershipApplication.ts` uses transactions wrapping approval + membership creation

**Critical Gap:** Zero domain events emitted. The event bus infrastructure is ready (`DomainEventBus` with `emit`/`on`) but unused by membership handlers. This blocks all cross-module integration: invoice generation on approval (M06), welcome emails (M07), onboarding completion (M01), credential issuance (M11).

**Recommendation:** Fix P0 first (add `domainEvents.emit()` calls to all mutation handlers), then P1s (register missing consumed event handlers, add application submit endpoint, add auth guards to `membership/` handlers). P2/P3 can follow in subsequent iterations.
