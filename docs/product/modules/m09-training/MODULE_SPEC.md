# Module Specification: Training (M09)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Manage instructor-led and live professional development activities. Covers training creation, enrollment, attendance, auto-credit award, certificate generation, and accredited provider management. Training is network-wide by default (visible across association).

### Users
- Society Officer, Officers, Member, System

### Related Modules
- M05 (Membership — eligibility), M06 (Dues — training fees)
- M07 (Communications — notifications), M10 (Credit Tracking — auto-credit award)
- M11 (Documents — certificates)

### In Scope
- Training CRUD (5 types: Seminar, Workshop, Convention, Online Webinar, Skills Training)
- Enrollment with capacity, attendance confirmation, auto-credit award
- Certificate generation (PDF with QR), accredited provider management
- Training analytics (completion rates, revenue)
- Network-wide visibility (cross-chapter)

### Out of Scope
- Non-credit events (M08), credit cycle management (M10), marketplace courses (M17)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Training | Credit-bearing professional development activity. Instructor-led or live online. |
| Training Types | 5 platform-defined: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. |
| Credit Entry | Record of CPD credits. AUTO type generated on attendance confirmation. |
| Certificate | PDF certifying training completion with credits earned and QR code. |
| Accredited Provider | PRC-accredited organization that can deliver training. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Create & Publish Training | Officer | Training creation with credits, fee, capacity | P0 |
| Manage Enrollments | Officer | View, approve, cancel enrollments | P0 |
| Confirm Attendance & Award Credits | Officer | Mark attendance, auto-generate credits | P0 |
| Browse & Enroll | Member | Find trainings, enroll, pay fee | P0 |
| View Training History | Member | Past trainings + credits earned | P0 |
| Download Certificate | Member | PDF with QR verification | P0 |

## 4. Workflow Details

### Workflow: Confirm Attendance & Award Credits (SO-3)

Actor: Society Officer
Steps:
1. Opens /org/[id]/officer/training/[id]/attendance.
2. Views enrollment list. Marks members as attended (QR or manual).
3. For each confirmed attendee, system auto-generates credit entry (AUTO type).
4. Certificate becomes available for download.
5. Credits immediately reflected in member's credit summary.

Exception Flows:
- Member already has credits for this training: "Credits already awarded."
- Training not yet completed: "Mark training as completed first."

### Workflow: Download Certificate (M-21)

Actor: Member
Steps:
1. Opens /my/certificates/[id].
2. Views certificate preview: member name, training title, date, credits, QR code.
3. Downloads PDF. Shares verification link.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-13 | IF attendance confirmed THEN award credits immediately | Auto-credit | No delay |
| BR-11 | IF credit cycle configured THEN start from registration date, not calendar year | Credit computation | Per-association config |
| M9-R1 | IF training type THEN one of 5 platform-defined types | Training creation | Fixed, not org-customizable |
| M9-R2 | IF paid training THEN enrollment requires payment | Enrollment | Via M06 gateway |
| M9-R3 | IF training completed THEN lock enrollments | Completion | No changes post-completion |
| M9-R4 | IF certificate generated THEN include HMAC-signed QR | Certificates | Tamper-proof verification |
| M9-R5 | IF training cancelled THEN refund enrolled members | Cancellation | Via M06 |
| M9-R6 | IF training network-wide THEN visible to all association members | Visibility | Default for training |
| M9-R7 | IF duplicate check-in THEN no duplicate credits | Check-in | Idempotent credit award |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create/update training | president (2FA), officer (Society Officer) | member | GA+HG |
| Publish/cancel training | president (2FA), officer | member | GA+HG |
| Manage enrollments | president (2FA), officer | member | GA+HG |
| Check-in / mark attendance | president (2FA), officer | member | GA+HG |
| View credits | All authenticated (own), officers (any) | — | GA |

## 7. Data Requirements

### Entity: Training

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| title | Yes | Training name | — |
| trainingType | Yes | Seminar/Workshop/Convention/OnlineCourse/SkillsTraining | Enum |
| status | Yes | draft/published/cancelled/completed | Enum |
| startDate | Yes | Start | — |
| endDate | Yes | End | After start |
| creditValue | Yes | CPD credits awarded | Decimal, > 0 |
| capacityLimit | No | Max enrollments | Nullable |
| feeAmount | No | Registration fee | Nullable |
| accreditedProviderId | No | Provider FK | — |

### Entity: TrainingEnrollment

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| trainingId | Yes | Training FK | — |
| personId | Yes | Person FK | — |
| status | Yes | enrolled/completed/cancelled/noShow | Enum |

### Entity: Certificate

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| trainingId | Yes | Training FK | — |
| personId | Yes | Person FK | Unique with trainingId |
| certificateNumber | Yes | Unique identifier | Unique globally |
| pdfUrl | No | Generated PDF URL | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Training | TrainingEnrollment, Certificate | — | Enrollment count <= capacity. One certificate per person per training. |
| AccreditedProvider | — | — | Status: active/suspended/expired. |

## 8. State Transitions

### Training Status
```txt
Draft → Published → Completed
Draft → Published → Cancelled
```

### Enrollment Status
```txt
Enrolled → Completed (attendance confirmed)
Enrolled → Cancelled (member or officer)
Enrolled → NoShow (post-training)
```

## 9. UI / UX Requirements

### Screen: Training Dashboard (/org/[id]/officer/training)
Purpose: Training management for officers
Components: Training list (status, type, date, enrollment count), create button, analytics summary

### Screen: Training Attendance (/org/[id]/officer/training/[id]/attendance)
Purpose: Mark attendance and award credits
Components: Enrollment list, QR scanner, manual check, bulk "Mark All Attended", credit award confirmation

### Screen: My Training (/my/training)
Purpose: Member's training history and certificates
Components: Upcoming/completed tabs, training cards with credit value, certificate download links

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/trainings | Create training | Training data | trainingId | 403 |
| POST /org/:id/trainings/:id/enroll | Enroll member | personId | enrollmentId | 409 full, 402 payment |
| POST /org/:id/trainings/:id/attendance | Mark attendance | personId | creditEntryId | 400 not enrolled |
| GET /my/training | My training history | — | Training list | — |
| GET /my/certificates/:id/pdf | Download certificate | — | PDF binary | 404, 500 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| TrainingPublished | Training published | trainingId, orgId | M07 (notification) |
| TrainingCompleted | Training marked complete | trainingId, orgId | M10 (credits) |
| CreditAwarded | Attendance confirmed | personId, trainingId, creditValue | M10 (aggregation) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Confirm paid enrollment | Enrollment status→enrolled |

## 11. Acceptance Criteria

### AC-M09-001: Auto-Credit Award
When attendance confirmed, credit entry created immediately with correct value.

### AC-M09-002: Certificate Verification
Certificate QR code verifiable via public URL. Shows training details and credit value.

### AC-M09-003: No Duplicate Credits
Same member at same training: only one credit entry regardless of how many times check-in attempted.

## 12. Test Expectations

Required tests:
- Training CRUD: state machine, type validation
- Enrollment: capacity, paid/free, cancellation
- Attendance: QR + manual, auto-credit generation, duplicate prevention
- Certificate: PDF generation, QR verification, unique number
- Network visibility: cross-chapter access for published trainings

## 13. Edge Cases

- Training cancelled with 100 enrolled and paid: all refunded via M06.
- Member enrolled but attendance not confirmed post-training: status=noShow, no credits.
- Training with 0 credits configured: [VERIFY] — should this be allowed?
- Two officers mark same member attended simultaneously: idempotent, one credit entry.

## 14. Dependencies

### Internal Dependencies
- M05 (Membership), M06 (Dues — fees), M07 (Communications)
- M10 (Credit Tracking — circular dependency, same wave)

### External Dependencies
- PDF generation (certificates), QR code generation, HMAC signing

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Training full | Block enrollment | "Training is full." |
| Payment required but no gateway | Block enrollment | "Online payment unavailable." |
| Certificate generation fails | Retry available | "Could not generate certificate. Try again." |

## 16. Performance Expectations

- Expected data volume: 20+ trainings per org per year, 200+ enrollments per training
- Acceptable response times: Attendance marking < 1s, certificate PDF < 3s

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| training.published | INFO | Goes live | trainingId, orgId, type | No |
| training.attendance.confirmed | INFO | Check-in | trainingId, personId | No |
| training.credit.awarded | INFO | Credit created | trainingId, personId, value | No |
| training.certificate.generated | INFO | PDF created | certificateId, personId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| training_enrollments_total | counter | status | Enrollment count |
| training_credits_awarded_total | counter | type | Credits awarded |
| certificate_generation_seconds | histogram | — | PDF gen time |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| training_online_enrollment | release | true | Online enrollment | — |
| training_certificate_qr | release | true | QR on certificates | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M09-S1 | Training CRUD | Create, publish, cancel, complete | M04 | P0 |
| M09-S2 | Enrollment | Register with capacity management | M09-S1, M05 | P0 |
| M09-S3 | Attendance & Credit Award | Mark attendance, auto-credit | M09-S2, M10 | P0 |
| M09-S4 | Certificates | PDF generation with QR | M09-S3 | P0 |
| M09-S5 | Paid Training | Fee collection via M06 | M09-S2, M06 | P1 |
| M09-S6 | Training Analytics | Completion rates, revenue | M09-S3 | P1 |
| M09-S7 | Accredited Providers | Provider CRUD | M09-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
