# Module Specification: Credit Tracking (M10)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Track continuing professional development (CPD) credits across organizations. Handles credit cycles, auto/manual entries, cross-org aggregation, excess carryover, compliance views, and transcript generation.

### Users
- Member, Society Officer, System

### Related Modules
- M05 (Membership), M09 (Training — auto-credit source, circular dependency)
- M11 (Documents — transcript PDF), M14 (National Dashboard — credit analytics)

### In Scope
- Credit cycle configuration (per-association: 1/2/3 years from registration date)
- Credit entry types: AUTO (from training attendance) and MANUAL (self-reported)
- Cross-org aggregation (credits sum across all member orgs)
- Excess credit carryover, credit tracking toggle per org
- Compliance views (member + officer), credit transcript/compliance report PDF

### Out of Scope
- Training management (M09), certificate generation (M09/M11)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Credit Entry | Single CPD credit record. AUTO (system) or MANUAL (member self-reported). |
| Credit Cycle | Per-member period for credit accumulation. Starts from registration date, not calendar year. |
| Credit Aggregation | Sum of credits across all orgs within current cycle. |
| Excess Credits | Credits beyond cycle requirement. Carry over to next cycle. |
| Credit Transcript | Downloadable report of credit history within a cycle. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| View Credit Summary | Member | Current cycle progress and compliance status | P0 |
| Add Manual Credit | Member | Self-report external activity credits | P0 |
| Download Transcript | Member | PDF compliance report | P0 |
| View Org Credit Compliance | Officer | Member credit compliance across org | P0 |
| Review Member Credits | Officer | Individual member credit detail | P0 |
| Adjust Credits | Officer | Manual award or deduction with reason | P0 |

## 4. Workflow Details

### Workflow: View Credit Summary (M-22)

Actor: Member
Steps:
1. Opens /my/credits.
2. Views current cycle: start date, end date, required credits, earned credits, remaining.
3. Progress bar shows completion percentage.
4. Credit breakdown: AUTO entries (from trainings) vs MANUAL entries.
5. Cross-org view: credits from all orgs aggregated.

### Workflow: Add Manual Credit (M-23)

Actor: Member
Steps:
1. Opens /my/credits and clicks "Add Manual Credit."
2. Fills: activity name, provider, date, credit value, supporting document (optional PDF/image, max 5MB).
3. Submits. Entry immediately reflected in totals.
4. Entry editable until cycle closes.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-11 | IF credit cycle THEN start from registration date, configurable per association (1/2/3 years) | Cycle computation | Not calendar year |
| BR-12 | IF excess credits THEN carry over to next cycle | Carryover | Automatic |
| BR-13 | IF attendance confirmed THEN award credits immediately | AUTO entries | No approval needed |
| BR-14 | IF member has multiple orgs THEN aggregate credits cross-org | Aggregation | Transcript shows source per entry |
| M10-R1 | IF credit tracking disabled per org THEN hide UI, don't generate AUTO credits from that org | Toggle | Cross-org totals from other orgs unaffected |
| M10-R2 | IF same member + same training THEN no duplicate credits | AUTO entries | Idempotent |
| M10-R3 | IF credit deducted THEN immutable audit log with reason | Deductions | All deductions logged |
| M10-R4 | IF officer adjusts credits THEN mandatory reason | Manual adjustment | Cannot adjust without reason |
| M10-R5 | IF supporting document uploaded THEN PDF/image only, max 5MB | Manual entries | Format + size validation |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View own credits | All authenticated | — | GA |
| Add manual credit | member (own) | — | GA |
| View org credit compliance | president (2FA), officer | member | GA+HG |
| Adjust member credits | president (2FA), officer | member | GA+HG |

## 7. Data Requirements

### Entity: CreditEntry

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | — |
| organizationId | Yes | Source org FK | — |
| type | Yes | auto/manual | Enum |
| activityName | Yes | Activity description | — |
| creditValue | Yes | Credits earned | Decimal, > 0 |
| activityDate | Yes | When activity occurred | — |
| trainingId | No | Training FK (AUTO only) | — |
| supportingDocUrl | No | Uploaded document | PDF/image, max 5MB |
| cpdCategory | No | General/Major/Self-Directed | Enum |

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
| CreditEntry | — | — | AUTO entries linked to training. One AUTO per person per training. |

Note: Credit cycle is a computed view, not a stored aggregate.

## 8. State Transitions

### Credit Entry (no state machine — immutable records)
```txt
Created → (immutable, never modified)
Exception: Manual entries editable by member until cycle closes.
Officer adjustments create new entries (not modify existing).
```

## 9. UI / UX Requirements

### Screen: My Credits (/my/credits)
Purpose: Credit summary with progress and history
Components: Cycle progress bar, required/earned/remaining, credit entry list (AUTO/MANUAL tabs), "Add Manual Credit" button, "Download Transcript" button

### Screen: Org Credit Compliance (/org/[id]/officer/credits)
Purpose: Officer view of member compliance across org
Components: Member table (name, earned, required, compliance status), filters, export CSV

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /my/credits | Credit summary | — | Cycle data + entries | 401 |
| POST /my/credits | Add manual credit | Activity data | creditEntryId | 400 validation |
| GET /my/credits/transcript | Download transcript | cycleId | PDF binary | 404, 500 |
| GET /org/:id/credits | Org compliance view | filters | Member credit list | 403 |
| POST /org/:id/credits/:personId/adjust | Adjust credits | value, reason | adjustmentId | 403, 400 no reason |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CreditAwarded | AUTO or MANUAL credit created | personId, creditValue, source | M14 (analytics) |
| CreditAdjusted | Officer adjustment | personId, adjustedBy, value, reason | Audit |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| TrainingCompleted | M09 | Generate AUTO credit entries for attendees | CreditEntry created |

## 11. Acceptance Criteria

### AC-M10-001: Cross-Org Aggregation
Credits from all member orgs aggregate into single cycle total. Transcript shows source per entry.

### AC-M10-002: No Duplicate AUTO Credits
Same member + same training = exactly one AUTO credit entry.

### AC-M10-003: Excess Carryover
Credits exceeding cycle requirement automatically carry over to next cycle.

### AC-M10-004: Toggle Independence
Disabling credit tracking in org A does not affect credits from org B.

## 12. Test Expectations

Required tests:
- Cycle computation: registration-date-based, 1/2/3 year periods
- Cross-org aggregation: credits from multiple orgs
- AUTO credits: generated on attendance, no duplicates
- Manual credits: creation, editing (within cycle), document upload
- Excess carryover: correct computation across cycle boundaries
- Credit tracking toggle: disabled org hides UI, preserves data
- Officer adjustment: with reason, audit logging

## 13. Edge Cases

- Member joins mid-cycle: cycle starts from their registration date.
- Training attended at org with credit tracking disabled: no AUTO credit from that org.
- 0 required credits configured: member always compliant. [VERIFY]
- Member transfers between orgs: credits from source org still count in aggregation.
- Enabling credit tracking retroactively: does NOT award credits for past activities.

## 14. Dependencies

### Internal Dependencies
- M05 (Membership), M09 (Training — circular dependency, same development wave)
- M11 (Documents — transcript PDF)

### External Dependencies
- PDF generation (transcript)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate AUTO credit | Skip silently | (No error — idempotent) |
| Invalid document format | Block upload | "PDF or image files only, max 5MB." |
| Officer adjustment without reason | Block | "Reason is required." |
| Transcript generation fails | Retry | "Could not generate transcript. Try again." |

## 16. Performance Expectations

- Expected data volume: 50+ credit entries per member per cycle
- Acceptable response times: Credit summary < 500ms, transcript PDF < 3s
- Caching requirements: Cycle summary cached, invalidated on new entry

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| credit.auto.awarded | INFO | Attendance confirmed | personId, trainingId, value | No |
| credit.manual.added | INFO | Member adds credit | personId, value | No |
| credit.adjusted | WARN | Officer adjustment | personId, adjustedBy, value, reason | No |
| credit.transcript.generated | INFO | PDF created | personId, cycleId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| credits_awarded_total | counter | type | Credit count by type |
| credit_compliance_rate | gauge | associationId | % members meeting requirement |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| credit_tracking_enabled | ops | true | Master toggle | — |
| credit_manual_entry | release | true | Allow self-reported credits | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M10-S1 | Credit Cycle Configuration | Association-level cycle config | M05 | P0 |
| M10-S2 | AUTO Credit Generation | Credits from training attendance | M10-S1, M09 | P0 |
| M10-S3 | Manual Credit Entry | Member self-reporting | M10-S1 | P0 |
| M10-S4 | Cross-Org Aggregation | Aggregate credits across orgs | M10-S1 | P0 |
| M10-S5 | Compliance View (Member) | Credit summary + progress | M10-S4 | P0 |
| M10-S6 | Compliance View (Officer) | Org-wide compliance report | M10-S4 | P0 |
| M10-S7 | Credit Transcript | PDF generation | M10-S5 | P0 |
| M10-S8 | Excess Carryover | Cross-cycle carryover logic | M10-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
