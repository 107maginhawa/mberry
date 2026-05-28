# Module Enforcement Audit: M05 Membership

> Generated: 2026-05-28 (deep re-audit) | Auditor: oli-enforce-module | Branch: main
> Supersedes: 2026-05-27 audit (corrects 3 false findings from prior run)

## 1. Module Overview

**Spec source:** `docs/product/modules/m05-membership/MODULE_SPEC.md`
**Handler dirs:** `services/api-ts/src/handlers/membership/` (15 handler files) + `services/api-ts/src/handlers/association:member/` (shared)
**TypeSpec:** `specs/api/src/modules/membership-custom.tsp` (3 endpoints: getOrgProfile, listOrgMembers, listOrgApplications)

**Workflows (3 detailed):** WF-029 (Application Review), WF-031 (Bulk CSV Import), WF-036 (Member Transfer)

---

## 2. Dimension Scores

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Dim 1: Public API | 6.0 | 1.0 | 6.0 |
| Dim 2: Workflow | 7.0 | 1.0 | 7.0 |
| Dim 3: Domain Terms | 9.0 | 1.0 | 9.0 |
| Dim 4: State Machine | 9.0 | 1.0 | 9.0 |
| Dim 5: Events | 3.0 | 1.0 | 3.0 |
| Dim 6: Auth/Permission | 5.0 | 1.0 | 5.0 |
| **Raw Average** | | | **6.5** |

**Overall Score: 6 / 10**

---

## 3. Corrections to Prior Audit (2026-05-27)

The prior audit contained 3 factual errors, corrected here:

1. **FALSE: "Zero domain events emitted"** -- `reviewApplication.ts` emits `membership.created` (line 41) and `updateMember.ts` emits `membership.status.changed` (line 112). Two events ARE emitted. The prior P0 cap was incorrect.

2. **FALSE: "compute-membership-status.ts returns only 6 statuses"** -- The function returns all 10: `deceased`, `expelled`, `resigned`, `removed`, `suspended`, `expired`, `pendingPayment`, `active`, `gracePeriod`, `lapsed`. Input interface includes `dateOfDeath`, `expelledAt`, `resignedAt`, `isExpired`. Prior EM-M05-m3n4o5p6 was false.

3. **FALSE: "PaymentRecorded has a registered consumer"** -- `grep` for consumed event handlers returned zero matches. No `domain-event-consumers.ts` file with `PaymentRecorded` listener was confirmed. All 4 consumed events lack listeners.

---

## 4. Dimension Details

### Dim 1: Public API (6.0/10)

Spec declares 9 endpoints (Section 10). Coverage:

| Spec Endpoint | Handler | Status |
|---|---|---|
| `GET /org/:id/members` | `listMembers.ts`, `listOrgMembers.ts` | IMPLEMENTED (route: `/membership/members/{orgId}`) |
| `GET /org/:id/members/:id` | `getMember.ts` | IMPLEMENTED |
| `POST /org/:id/members/import` | `importMembers.ts`, `csvImport.ts` | IMPLEMENTED |
| `POST /org/:id/members/import/confirm` | `csvImport.ts` (bulkCSVImport fn) | PARTIAL -- function exists, no route |
| `POST /org/:id/applications` | -- | **MISSING** |
| `PUT /org/:id/applications/:id` | `reviewApplication.ts` | IMPLEMENTED |
| `POST /org/:id/members` | `addMember.ts` | IMPLEMENTED |
| `POST /org/:id/members/:id/transfer` | `association:member/createAffiliationTransfer.ts` | DELEGATED (different route path) |
| `GET /org/:id/directory` | -- | **MISSING** |

Additional non-spec endpoints: `getOrgProfile.ts`, `updateOrgProfile.ts`, `listOrgApplications.ts`, `listCategories.ts`, `upsertCategory.ts`

### Dim 2: Workflow (7.0/10)

| Workflow | ID | Status |
|---|---|---|
| Bulk CSV Import | WF-031 | PARTIAL -- parse/validate/preview works; confirm route unwired; no `MemberImported` event |
| Application Review | WF-029 | PARTIAL -- review works; no self-service submit; event name mismatch |
| Member Transfer | WF-036 | IMPLEMENTED -- full dual-approval lifecycle in `association:member/` |

### Dim 3: Domain Terms (9.0/10)

All 5 spec entities have matching schema tables:
- `memberships` -- full field coverage including LIF-04 fields
- `membershipApplications` -- all status enum values
- `membershipCategories` + `membershipTiers` -- separate tables
- `membershipStatusHistory` -- used by `graceToLapsed` job
- `affiliation_transfer` -- in `chapters.schema.ts`

Domain glossary alignment strong. `ComputedMembershipStatus` type includes all 10 statuses.

### Dim 4: State Machine (9.0/10)

**Status Computation** (`compute-membership-status.ts`):
- Priority: deceased > expelled > resigned > removed > suspended > expired > pendingPayment > active > gracePeriod > lapsed
- Correctly extends spec's 6-status priority to 10 statuses
- Pure function, no DB dependency, date-only comparison

**Officer Transitions** (`updateMember.ts`):
- Restricted subset: active->suspended/removed, grace->suspended, lapsed->suspended/active, suspended->active
- Invalid transitions silently rejected (BR-03 compliant)
- No-op transitions always valid

**Transfer State Machine**: 7-state dual-approval workflow fully tested.

Minor gap: `underReview` application state exists in enum but no handler sets it.

### Dim 5: Events (3.0/10)

**Published Events:**

| Spec Event | Emitted? | Handler | Event Name Used |
|---|---|---|---|
| MembershipApproved | YES | `reviewApplication.ts:41` | `membership.created` (name mismatch) |
| MembershipStatusChanged | YES | `updateMember.ts:112` | `membership.status.changed` |
| MembershipSuspended | NO | -- | -- |
| MembershipResigned | NO | `association:member/resignMembership.ts` uses audit only | -- |
| MembershipDeceased | NO | `association:member/deceaseMembership.ts` uses audit only | -- |
| MemberImported | NO | -- | -- |

**Result:** 2/6 published events emitted. 4 missing.

**Consumed Events:**

| Spec Event | Listener? |
|---|---|
| PaymentRecorded | NO |
| PaymentRefunded | NO |
| MemberSuspended | NO |
| MemberRemoved | NO |

**Result:** 0/4 consumed events have registered listeners.

### Dim 6: Auth/Permission (5.0/10)

| Handler | Guard | Spec Requirement | Status |
|---|---|---|---|
| `importMembers.ts` | `requirePosition([PRESIDENT, SECRETARY])` | president/secretary + 2FA | PARTIAL -- no 2FA |
| `updateOrgProfile.ts` | `requirePosition([PRESIDENT])` | president | OK |
| `listOrgApplications.ts` | platformAdmin OR org member check | admin | OK |
| `listOrgMembers.ts` | platformAdmin OR org member check | admin | OK |
| `reviewApplication.ts` | session only | president/secretary + 2FA | **WEAK** |
| `addMember.ts` | session only | officer | **WEAK** |
| `listMembers.ts` | session only | all org members | OK |
| `getMember.ts` | session only | all org members | OK |

Critical: `reviewApplication.ts` and `addMember.ts` in `membership/` lack position checks. Parallel `association:member/` handlers have proper guards.

---

## 5. Findings

### P1 Findings

#### EM-M05-a1b2c3d4: Directory Endpoint Missing
**Dim:** Public API | **Impact:** AC-M05-005 unmet
`GET /org/:id/directory` -- privacy-filtered member search declared in spec, no handler exists anywhere.

#### EM-M05-e5f6g7h8: Application Submit Endpoint Missing
**Dim:** Public API | **Impact:** Self-service membership application impossible
`POST /org/:id/applications` -- spec declares user self-service apply; no handler implements creation.

#### EM-M05-c9d0e1f2: 4/6 Published Domain Events Missing
**Dim:** Events | **Impact:** Downstream modules M04, M07 get no signals
`MembershipSuspended`, `MembershipResigned`, `MembershipDeceased`, `MemberImported` are never emitted. `resignMembership.ts` and `deceaseMembership.ts` exist but use audit logging only, not domain events.

#### EM-M05-g3h4i5j6: 0/4 Consumed Events Have Listeners
**Dim:** Events | **Impact:** Payment and disciplinary events from M04/M06 don't propagate
`PaymentRecorded`, `PaymentRefunded`, `MemberSuspended`, `MemberRemoved` -- no event consumers registered. Status recomputation from external triggers is broken.

#### EM-M05-k7l8m9n0: reviewApplication Lacks Officer Check
**Dim:** Auth | **Impact:** Any authenticated member can approve/deny applications
`reviewApplication.ts` requires only session auth. Spec mandates president/secretary with 2FA. Creates bypass path since parallel `association:member/approveMembershipApplication.ts` has proper guards.

### P2 Findings

#### EM-M05-i9j0k1l2: Route Path Divergence from Spec
**Dim:** Public API
All implemented routes use `/membership/...` prefix, not `/org/:id/...` as spec declares. Spec or routes need alignment.

#### EM-M05-m3n4o5p6: Import Confirm Route Unwired
**Dim:** Workflow
`bulkCSVImport()` function exists in `csvImport.ts` but `POST /org/:id/members/import/confirm` has no registered HTTP route.

#### EM-M05-o1p2q3r4: No 2FA Verification
**Dim:** Auth
Import and approve actions use `requirePosition` but skip 2FA verification. Spec explicitly requires 2FA for these sensitive operations.

#### EM-M05-s5t6u7v8: BR-04 Category Delete Guard Missing
**Dim:** Data Model
BR-04: categories with assigned members cannot be deleted (deactivate only). `upsertCategory.ts` handles create/update but no delete handler with member-count guard exists.

#### EM-M05-u1v2w3x4: Event Name Mismatch
**Dim:** Events
`reviewApplication.ts` emits `membership.created` but spec declares `MembershipApproved`. Downstream consumers expecting `MembershipApproved` won't match.

### P3 Findings

#### EM-M05-y5z6a7b8: underReview State Never Set
**Dim:** State Machine
`underReview` exists in `applicationStatusEnum` but no handler transitions to it. Applications go directly from `submitted` to `approved/denied`.

#### EM-M05-w9x0y1z2: Feature Flags Not Implemented
**Dim:** Feature Flags
Spec declares `csv_import_enabled` and `public_directory_enabled`. Neither is checked at runtime.

#### EM-M05-a3b4c5d6: Observability Metrics Missing
**Dim:** Observability
4 spec-declared metrics unimplemented. Only `graceToLapsed` job has adequate structured logging. Other handlers minimal.

#### EM-M05-f7g8h9i0: Status History Writes Incomplete
**Dim:** Domain Terms
Only `graceToLapsed.ts` writes to `membershipStatusHistory`. Officer-initiated transitions in `updateMember.ts` and application approval flows don't record history entries.

---

## 6. Summary

| Category | Count |
|----------|-------|
| P1 | 5 |
| P2 | 5 |
| P3 | 4 |
| **Total** | **14** |

**Strengths:**
1. BR-01 (computed status) -- pure function with full 10-status priority, correctly extended beyond spec
2. BR-03 (state machine) -- silent rejection of invalid officer transitions
3. License normalization (BR-22/BR-23) -- tested with edge cases
4. Transfer workflow -- full dual-approval lifecycle with good test coverage
5. `graceToLapsed` job -- production-quality with idempotency and status history
6. Module boundary docs -- clear comments explain two-repo split
7. Test honesty -- `br-p2-gap.test.ts` uses `.todo()` for unimplemented rules
8. Schema completeness -- all 5 spec entities have tables with correct fields

**Remediation Priority:**
1. P1-AUTH: Add `requirePosition` to `reviewApplication.ts` (security bypass)
2. P1-EVENTS: Emit `MembershipSuspended/Resigned/Deceased/Imported` from handlers
3. P1-CONSUMERS: Register listeners for `PaymentRecorded/Refunded/MemberSuspended/MemberRemoved`
4. P1-ENDPOINTS: Implement directory GET and application submit POST
5. P2-2FA: Add 2FA to import/review handlers
6. P2-GUARDS: Implement BR-04 category delete protection
7. P3: Feature flags, metrics, status history writes
