# Module Specification: Credit Tracking (M10)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Track continuing professional development (CPD/CE) credits across organizations. Handles credit cycles, auto/manual entries, cross-org aggregation, excess carryover, compliance views, and transcript generation.

### Users
- **Member** — views credit summary, adds manual credits, downloads transcript
- **Officer (Secretary/President)** — adjusts credits, views org compliance rates
- **Platform Administrator** — configures credit cycle defaults per association

### Related Modules
- **M09 (Training)** — upstream: attendance confirmation triggers AUTO credit entries
- **M11 (Documents & Credentials)** — downstream: credit data feeds into certificates and transcripts
- **M14 (National Dashboard)** — downstream: aggregated credit compliance metrics
- **M05 (Membership)** — membership status gates credit tracking per org
- **M04 (Org Admin)** — org-level credit cycle configuration

### In Scope
- Credit entry creation (AUTO from training attendance, MANUAL self-entry)
- Credit cycle computation (configurable per association: 1/2/3 years from registration date)
- Cross-org credit aggregation for multi-org members
- Excess credit carryover to next cycle
- Officer credit adjustment (award/deduct) with mandatory reason
- Org-level credit compliance reporting
- Per-member credit transcript export (PDF/CSV)
- Per-org toggle to enable/disable credit tracking

### Out of Scope
- Training management (M09)
- Certificate generation (M11)
- PRC accreditation provider registry (M09 concern, consumed by M10)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|------------|
| **Credit Entry** | Single record of professional development credits. Two types: AUTO (generated on Training attendance) and MANUAL (self-entered, no approval required). |
| **Credit Cycle** | Per-member period for accumulating credits toward renewal. Starts from registration date. Duration configurable per association (1, 2, or 3 years). |
| **Credit Aggregation** | Computation of a member's total credits across all organizations within their current credit cycle. Cross-org. |
| **Excess Credits** | Credits earned beyond the cycle requirement. Carry over to the next cycle. |
| **Credit Transcript** | Downloadable compliance report showing a member's credit history within a cycle. |
| **Training** | Credit-bearing professional development activity. Instructor-led or live online. |
| **Attendance** | Confirmation that a registered member actually attended. Triggers credit generation for Training. |
| **CPD / CE** | Continuing Professional Development / Continuing Education. |
| **Active** | Membership status: dues are current, full access to org features. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-065: View Credit Summary | Member | Per-cycle breakdown, cross-org aggregation | P0 |
| WF-066: Add Manual Credit | Member | Self-entry with activity details, optional docs | P0 |
| WF-067: Officer Credit Adjustment | Officer | Award or deduct credits with mandatory reason | P1 |
| WF-068: Org Credit Compliance | Officer | Officer view of member compliance rates | P1 |
| WF-069: Credit Cycle Management | Officer/Admin | Configurable start date, excess carryover | P1 |
| WF-070: Credit Transcript Export | Member | Per-member PDF/CSV transcript | P2 |

## 4. Workflow Details

### Workflow: View Credit Summary (WF-065)

**Actor:** Member
**Preconditions:** Authenticated, has at least one org with credit tracking enabled
**Steps:**
1. Opens `/my/credits`.
2. Views current cycle: start date, end date, required credits, earned credits, remaining.
3. Progress bar shows completion percentage.
4. Credit breakdown: AUTO entries (from trainings) vs MANUAL entries.
5. Cross-org view: credits from all orgs aggregated.
**Alternate Flows:** If member belongs to only one org, skip org selector.
**Exception Flows:** If credit tracking disabled for all orgs, show empty state with explanation.
**Postconditions:** Member sees accurate, up-to-date credit summary.

### Workflow: Add Manual Credit (WF-066)

**Actor:** Member
**Preconditions:** Authenticated, credit tracking enabled for at least one org
**Steps:**
1. Opens `/my/credits` and clicks "Add Manual Credit."
2. Fills: activity name, provider, date, credit value, supporting document (optional PDF/image, max 5MB).
3. Submits. Entry immediately reflected in totals.
4. Entry editable until cycle closes.
**Alternate Flows:** Upload fails — show error, preserve form data.
**Exception Flows:** File exceeds 5MB or wrong format — validation error before submit.
**Postconditions:** CreditEntry created with type=MANUAL, totals recalculated.

### Workflow: Officer Credit Adjustment (WF-067)

**Actor:** Officer (Secretary or President)
**Preconditions:** Authenticated, officer role in org, credit tracking enabled
**Steps:**
1. Opens org member list, selects member.
2. Views member's credit summary.
3. Clicks "Adjust Credits" — enters value (positive=award, negative=deduct) and mandatory reason.
4. Submits. Immutable audit log entry created.
**Exception Flows:** Missing reason — validation error. Cannot adjust without reason.
**Postconditions:** CreditEntry created with type=ADJUSTED, audit log recorded.

### Workflow: Org Credit Compliance (WF-068)

**Actor:** Officer
**Preconditions:** Officer role, credit tracking enabled
**Steps:**
1. Opens `/org/[id]/officer/credits`.
2. Views table: member name, cycle dates, required/earned/remaining, compliance status.
3. Filters by status (compliant/non-compliant), sorts by remaining.
**Postconditions:** Officer sees org-wide compliance snapshot.

### Workflow: Credit Transcript Export (WF-070)

**Actor:** Member
**Preconditions:** Authenticated, has credit entries
**Steps:**
1. Opens `/my/credits` and clicks "Download Transcript."
2. Selects format (PDF or CSV) and cycle.
3. Downloads file with all entries, sources, and totals.
**Postconditions:** Transcript file downloaded.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-11 | IF credit cycle THEN start from registration date, configurable per association (1/2/3 years) | Cycle computation | Not calendar year |
| BR-12 | IF excess credits THEN carry over to next cycle | Carryover | Automatic |
| BR-13 | IF attendance confirmed THEN award credits immediately (AUTO type, no approval) | AUTO entries | No approval needed |
| BR-14 | IF member has multiple orgs THEN aggregate credits cross-org | Aggregation | Transcript shows source per entry |
| M10-R1 | IF credit tracking disabled per org THEN hide UI, don't generate AUTO credits from that org | Toggle | Cross-org totals from other orgs unaffected |
| M10-R2 | IF same member + same training THEN no duplicate credits | AUTO entries | Idempotent (unique constraint) |
| M10-R3 | IF credit deducted THEN immutable audit log with reason | Deductions | All deductions logged |
| M10-R4 | IF officer adjusts credits THEN mandatory reason required | Manual adjustment | Cannot adjust without reason |
| M10-R5 | IF supporting document uploaded THEN PDF/image only, max 5MB | Manual entries | Format + size validation |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View credits | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (Own) | user | GA auth; member sees own only |
| Add manual credit | member (Own) | user | Self-entry only |
| Adjust credits | super, admin, president (2FA), officer | member, user, support | GA+HG auth |
| View org compliance | super, admin, president (2FA), officer | member, user | GA+HG auth |
| Export transcript | member (Own), super, admin | user | GA auth |

## 7. Data Requirements

### Entity: CreditEntry

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | Primary key | UUID |
| personId | Yes | Member FK | References person |
| organizationId | Yes | Source org FK | References organization |
| trainingId | No | Training FK (AUTO entries only) | NULL for MANUAL/ADJUSTED |
| type | Yes | Entry type | Enum: AUTO, MANUAL, ADJUSTED |
| creditValue | Yes | Number of credits | Positive decimal (or negative for deductions) |
| activityName | Yes | Description of activity | Required for MANUAL |
| activityDate | Yes | When activity occurred | Date |
| provider | No | Provider name | Optional |
| reason | Conditional | Required for ADJUSTED type | Mandatory if type=ADJUSTED |
| supportingDocumentUrl | No | Uploaded file URL | PDF/image, max 5MB |
| cpdCategory | No | CPD category (PRC) | Enum: General, Major, Self-Directed |
| createdBy | Yes | Who created the entry | personId of creator |
| createdAt | Yes | Timestamp | Auto-generated |

### Entity: CreditCycle (computed, not stored)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Member | — |
| associationId | Yes | Association | — |
| cycleStart | Yes | Computed from registration date | — |
| cycleEnd | Yes | cycleStart + period | — |
| requiredCredits | Yes | From association config | — |
| earnedCredits | Yes | Sum of entries in cycle | Aggregated cross-org |
| carryoverCredits | Yes | Excess from previous cycle | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| CreditEntry | — | — | AUTO entries linked to training. One AUTO per person per training (unique constraint). |

Note: Credit cycle is a computed view, not a stored aggregate.

## 8. State Transitions

### Credit Entry (no state machine — immutable records)

Credit entries are append-only. Once created, they cannot be modified or deleted. Corrections are made via new ADJUSTED entries with a mandatory reason. No state machine applies.

## 9. UI/UX Requirements

### Screen: My Credits (/my/credits)

**Purpose:** Member views credit summary and manages manual entries
**Users:** Member
**Components:** Cycle progress bar, credit breakdown table (AUTO vs MANUAL), "Add Manual Credit" button, transcript download button, org selector (multi-org)
**States:**
- Loading: Skeleton loader for credit table
- Empty: "No credits yet. Complete a training or add manual credits."
- Success: Cycle summary + entry list
- ValidationError: Inline errors on manual credit form
- PermissionError: N/A (all members can view own)
- UnexpectedError: "Unable to load credits. Please try again."

### Screen: Org Credit Compliance (/org/[id]/officer/credits)

**Purpose:** Officer views member compliance rates
**Users:** Officer, President, Admin
**Components:** Compliance table (member, cycle, required, earned, remaining, status), filter/sort controls
**States:**
- Loading: Skeleton table
- Empty: "No members with credit tracking enabled."
- Success: Compliance table with summary stats
- PermissionError: "You don't have permission to view this page."
- UnexpectedError: "Unable to load compliance data."

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /credits/my | View own credit summary | cycleId (optional) | CreditSummary + entries | 401 |
| POST /credits/manual | Add manual credit | activityName, date, value, doc? | CreditEntry | 400, 401 |
| POST /credits/adjust | Officer adjustment | personId, value, reason | CreditEntry | 400, 401, 403 |
| GET /orgs/{id}/credits/compliance | Org compliance report | orgId, filters | ComplianceReport[] | 401, 403 |
| GET /credits/transcript | Download transcript | format (pdf/csv), cycleId | File | 401 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CreditAwarded | AUTO or MANUAL credit created | personId, creditValue, source, organizationId | M14 (analytics) |
| CreditAdjusted | Officer adjustment | personId, adjustedBy, value, reason | Audit |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| TrainingCompleted | M09 (Training) | Generate AUTO credit entries for attendees | CreditEntry created (type=AUTO) |
| MembershipStatusChanged | M05 (Membership) | Check if credit tracking still applies | No-op if status still active |
| AccountDeletionProcessed | M02 (Person) | Retain anonymized credit records | PII stripped, records preserved |

## 11. Acceptance Criteria

### AC-M10-001: Cross-Org Aggregation
**Given** a member belongs to Org A and Org B, both with credit tracking enabled
**When** the member views `/my/credits`
**Then** total credits shown = sum of entries from both orgs, with source org per entry.

### AC-M10-002: No Duplicate AUTO Credits
**Given** a member attends Training T1
**When** attendance is confirmed twice (e.g., retry)
**Then** exactly one AUTO credit entry exists for that member + training combination.

### AC-M10-003: Excess Carryover
**Given** a member earns 50 credits in a cycle requiring 40
**When** the next cycle starts
**Then** 10 excess credits carry over to the new cycle.

### AC-M10-004: Toggle Independence
**Given** Org A disables credit tracking
**When** the member views credits
**Then** credits from Org B are unaffected; Org A entries hidden but preserved.

### AC-M10-005: Mandatory Adjustment Reason
**Given** an officer attempts to adjust credits
**When** no reason is provided
**Then** the API returns 400 and the adjustment is rejected.

## 12. Test Expectations

Required test categories:
- **Unit:** Credit cycle computation (start date, end date, carryover), cross-org aggregation logic
- **Integration:** AUTO credit creation on TrainingCompleted event, duplicate prevention (idempotency), officer adjustment with audit logging
- **Contract:** POST /credits/manual validation (missing fields, file size), GET /credits/my response shape
- **E2E:** Member adds manual credit and sees updated summary; officer adjusts credit and member sees change

## 13. Edge Cases

- Member belongs to 5+ orgs — aggregation performance with large entry sets
- Credit cycle boundary: entry date falls exactly on cycle start/end
- Officer deducts more credits than member has earned — BLOCKED. Show error: "Cannot deduct below 0. Current balance: N credits." Prevents accounting confusion and audit trail issues.
- Manual credit with future activity date — should it be allowed?
- Association changes cycle duration mid-cycle — existing cycles keep original dates. New duration applies to next cycle only. No retroactive recomputation.
- Member's registration date changes (data correction) — cycle recalculation needed
- Concurrent AUTO credit creation from same training (race condition) — unique constraint handles
- Negative credit deduction attempted: BLOCK. Credit adjustments must be zero or positive. To remove credits, use the officer adjustment workflow with an explicit audit reason.
- Mid-cycle configuration change (org changes required credits mid-cycle): No retroactive recomputation. New requirement applies from the next cycle. Current cycle members keep their existing target.

## 14. Dependencies

### Internal Dependencies
- M09 (Training) — TrainingCompleted event triggers AUTO entries
- M05 (Membership) — membership status determines credit tracking eligibility
- M04 (Org Admin) — credit cycle configuration per org/association
- M02 (Person) — personId for credit ownership

### External Dependencies
- S3/MinIO (via storage handlers) — supporting document uploads
- PDF generation library — transcript export

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|----------------|-------------------|---------------------|
| Duplicate AUTO credit | Silently skip (idempotent) | — |
| Missing adjustment reason | 400 Bad Request | "Reason is required for credit adjustments." |
| File too large (>5MB) | 400 Bad Request | "File must be under 5MB." |
| Invalid file type | 400 Bad Request | "Only PDF and image files are accepted." |
| Credit tracking disabled for org | 404 or feature-gated | "Credit tracking is not enabled for this organization." |
| Cycle computation error | 500 Internal Server Error | "Unable to compute credit cycle. Please contact support." |

## 16. Performance Expectations

- **Data volume:** ~50 credit entries per member per year across all orgs
- **Concurrent users:** Up to 500 members viewing credits simultaneously during training events
- **Response times:** Credit summary <200ms, compliance report <500ms for 1000-member org
- **Caching:** Credit summary cacheable per member per cycle (invalidate on new entry)

## 17. Observability Hooks

**Log Events:**

| Event | Level | Fields |
|-------|-------|--------|
| credit.auto.created | info | personId, trainingId, creditValue, organizationId |
| credit.manual.created | info | personId, creditValue, activityName |
| credit.adjusted | info | personId, adjustedBy, value, reason |
| credit.duplicate.skipped | warn | personId, trainingId |
| credit.cycle.computed | debug | personId, cycleStart, cycleEnd, earned, required |

**Metrics:**

| Metric | Type | Labels |
|--------|------|--------|
| credits_created_total | counter | type (AUTO/MANUAL/ADJUSTED), orgId |
| credit_compliance_rate | gauge | orgId |
| credit_summary_latency_ms | histogram | — |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|-----------|------|---------|-------------|-------------|
| credit_tracking_enabled | per-org | true | Enable/disable credit tracking per org | — (permanent) |
| credit_transcript_export | per-org | false | Enable transcript PDF/CSV export | After M10 GA |
| credit_cpd_categories | per-association | false | Enable PRC CPD category tracking | After Phase 22 |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|--------------|----------|
| M10-S1 | View Credit Summary | GET /credits/my with cycle computation + cross-org aggregation | M09 (for test data) | P0 |
| M10-S2 | Add Manual Credit | POST /credits/manual with file upload | M10-S1 | P0 |
| M10-S3 | AUTO Credit on Training | Consume TrainingCompleted, create AUTO entry | M09, M10-S1 | P0 |
| M10-S4 | Officer Adjustment | POST /credits/adjust with audit logging | M10-S1 | P1 |
| M10-S5 | Org Compliance Report | GET /orgs/{id}/credits/compliance | M10-S1 | P1 |
| M10-S6 | Transcript Export | GET /credits/transcript (PDF/CSV) | M10-S1 | P2 |

## 20. AI Instructions

- **Schema location:** `services/api-ts/src/handlers/association:member/repos/credits.schema.ts` (credit_entry table, 12 columns)
- **Handler pattern:** Follow `services/api-ts/src/handlers/person/createPerson.ts` for handler structure
- **TypeSpec first:** Define API in `specs/api/src/modules/credit-tracking.tsp` before implementing handlers
- **Idempotency:** Use unique constraint on (personId, trainingId) for AUTO entries to prevent duplicates
- **Cycle computation:** Implement as a pure function — no stored cycle entity. Calculate from person's registration date + association's cycle duration config.
- **Cross-org aggregation:** Query credit_entry across all orgs for a personId, group by computed cycle boundaries
- **Vertical TDD:** Follow VERTICAL_TDD.md — write failing tests first for each slice

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | — |
| 2. Domain Terms | COMPLETE | — |
| 3. Workflows | COMPLETE | |
| 4. Workflow Details | COMPLETE | — |
| 5. Business Rules | COMPLETE | — |
| 6. Permissions | COMPLETE | Matches ROLE_PERMISSION_MATRIX |
| 7. Data Requirements | COMPLETE | — |
| 7b. Aggregate Boundaries | COMPLETE | — |
| 8. State Transitions | COMPLETE | No state machine (immutable records) |
| 9. UI/UX Requirements | COMPLETE | — |
| 10. API Expectations | COMPLETE | — |
| 10b. Domain Events | COMPLETE | — |
| 11. Acceptance Criteria | COMPLETE | — |
| 12. Test Expectations | COMPLETE | — |
| 13. Edge Cases | COMPLETE | Negative balance, mid-cycle config change, negative deduction all addressed |
| 14. Dependencies | COMPLETE | — |
| 15. Error Handling | COMPLETE | — |
| 16. Performance | COMPLETE | — |
| 17. Observability | COMPLETE | — |
| 18. Feature Flags | COMPLETE | — |
| 19. Vertical Slice Plan | COMPLETE | — |
| 20. AI Instructions | COMPLETE | — |

## 22. Downstream Impact

- **M11 (Documents & Credentials):** Certificate generation depends on credit data; if credit entry schema changes, certificate templates may need updating
- **M14 (National Dashboard):** Compliance metrics depend on credit aggregation logic; changes to cycle computation affect dashboard accuracy
- **M09 (Training):** TrainingCompleted event contract must include creditValue and trainingId; changes break AUTO credit generation
