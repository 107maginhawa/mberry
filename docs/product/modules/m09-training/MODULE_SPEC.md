# Module Specification: Training (M09)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Manage instructor-led and live professional development activities. Covers training creation, enrollment, attendance confirmation, auto-credit award (BR-13), certificate generation, and accredited provider management. Training is network-wide by default (visible across association). Distinct from M08 Events which handles non-credit social/governance activities.

### Users
- Society Officer -- create trainings, manage enrollments, confirm attendance, award credits
- Officers (President) -- publish/cancel trainings (2FA required)
- Member -- browse trainings, enroll, view history, download certificates
- System -- auto-credit award on attendance confirmation, certificate generation

### Related Modules
- M05 (Membership -- enrollment eligibility), M06 (Dues -- training fees, refunds)
- M07 (Communications -- training notifications), M10 (Credit Tracking -- auto-credit award, aggregation)
- M11 (Documents/Certificates -- certificate storage and verification)

### In Scope
- Training CRUD (5 types: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training)
- Enrollment with capacity management, attendance confirmation (QR or manual)
- Auto-credit award on attendance confirmation (BR-13, cross-module with M10)
- Certificate generation (PDF with HMAC-signed QR code for verification)
- Accredited provider management (PRC-accredited organizations)
- Course management (self-paced online courses with quiz attempts)
- Training analytics (completion rates, credit distribution, revenue)
- Network-wide visibility by default (cross-chapter)

### Out of Scope
- Non-credit events (M08 Events), credit cycle management (M10)
- Marketplace courses from external providers (M17), certificate template design (M11)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Training | Credit-bearing professional development activity. Instructor-led or live online. |
| Training Types | 5 platform-defined: Seminar, Workshop, Convention/Conference, Online Course/Webinar, Skills Training. Not org-customizable. |
| Credit Entry | Record of CPD credits. AUTO type generated on attendance confirmation. |
| Certificate | PDF certifying training completion with credits earned and HMAC-signed QR code. |
| Accredited Provider | PRC-accredited organization that can deliver training. Status: active/suspended/expired. |
| Course | Self-paced online course with progress tracking and quiz attempts. |
| Enrollment | Member's registration in a training or course. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Create & Publish Training | [INFERRED] | Officer | Training creation with credits, fee, capacity, type | P0 |
| Manage Enrollments | [INFERRED] | Officer | View, approve, cancel enrollments | P0 |
| Confirm Attendance & Award Credits | SO-3 | Society Officer | Mark attendance, auto-generate credit entries | P0 |
| Browse & Enroll | [INFERRED] | Member | Find trainings, enroll, pay fee | P0 |
| View Training History | [INFERRED] | Member | Past trainings + credits earned | P0 |
| Download Certificate | M-21 | Member | PDF with QR verification link | P0 |
| Manage Accredited Providers | [INFERRED] | Officer | Provider CRUD, status management | P1 |

## 4. Workflow Details

### Workflow: Create & Publish Training

**Actor:** Society Officer or President
**Preconditions:** Officer authenticated, org exists, officer role verified
**Steps:**
1. Opens `/org/[id]/officer/training/new`.
2. Fills: title, training type (5 enum values), date/time, location, description, instructor name/id.
3. Sets credit value (required, > 0), capacity limit (optional), fee (optional via M06), accredited provider (optional).
4. Visibility defaults to network (association-wide). Can override to internal.
5. Saves as draft. Previews.
6. Publishes. System emits `TrainingPublished`. Members notified via M07.

**Alternate Flows:**
- Internal visibility: training visible only to org members.
- No fee: free enrollment.

**Exception Flows:**
- Credit value = 0: [VERIFY] -- should this be blocked or allowed for non-credit trainings?
- Fee set but no payment gateway: "Online payment unavailable. Configure billing first."

**Postconditions:** Training in `published` status. Notification sent to eligible members.

### Workflow: Confirm Attendance & Award Credits (SO-3)

**Actor:** Society Officer
**Preconditions:** Training published or completed, enrollments exist
**Steps:**
1. Opens `/org/[id]/officer/training/[id]/attendance`.
2. Views enrollment list. Marks members as attended (QR scan or manual check).
3. For each confirmed attendee, system auto-generates credit entry (AUTO type) per BR-13.
4. Certificate becomes available for download for each confirmed attendee.
5. Credits immediately reflected in member's credit summary (M10).

**Alternate Flows:**
- Bulk "Mark All Attended" for small trainings.
- QR scanner for large venue check-in.

**Exception Flows:**
- Member already has credits for this training: "Credits already awarded." (idempotent per BR M9-R7)
- Training not yet completed: "Mark training as completed first."
- Duplicate check-in attempt: no duplicate credits, success response.

**Postconditions:** Enrollment status = `completed`. Credit entries created. Certificates available.

### Workflow: Browse & Enroll

**Actor:** Member
**Preconditions:** Training published, member authenticated
**Steps:**
1. Opens `/my/training/browse` or `/org/[id]/training`.
2. Views available trainings: title, type, date, credits, fee, capacity remaining.
3. Clicks enroll. If paid, redirected to payment flow (M06).
4. On success: enrollment status = `enrolled`.

**Exception Flows:**
- Training full: "Training is full." (no waitlist for training -- different from events [INFERRED]).
- Payment fails: enrollment not created.

**Postconditions:** Enrollment record created. Member appears in attendance list.

### Workflow: Download Certificate (M-21)

**Actor:** Member
**Preconditions:** Enrollment completed, certificate generated
**Steps:**
1. Opens `/my/certificates/[id]` or `/my/training` and clicks certificate link.
2. Views certificate preview: member name, training title, date, credits earned, QR code.
3. Downloads PDF. QR code links to public verification URL.

**Exception Flows:**
- Certificate not yet generated: "Certificate is being generated. Try again shortly."
- PDF generation fails: retry available.

**Postconditions:** PDF downloaded. Verification URL accessible publicly.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-13 | IF attendance confirmed THEN award credits immediately (AUTO type credit entry) | Auto-credit | No delay. Cross-module: M09 -> M10. |
| BR-11 | IF credit cycle configured THEN start from registration date, not calendar year | Credit computation | Per-association config (enforced in M10) |
| BR-15 | IF activity is training THEN credit-bearing; events are not | Training vs Events | Training always has creditValue > 0 |
| BR-17 | IF attendance confirmation THEN only by officer (not self-service) | Check-in | Officers scan or mark manually |
| BR-20 | IF training completed THEN certificate generated with HMAC-signed QR | Certificates | Post-activity certificate generation |
| M9-R1 | IF training type THEN one of 5 platform-defined types (not org-customizable) | Training creation | Enum enforced at schema level |
| M9-R2 | IF paid training THEN enrollment requires payment confirmation | Enrollment | Via M06 gateway |
| M9-R3 | IF training completed THEN lock enrollments (no changes post-completion) | Completion | Status frozen |
| M9-R4 | IF certificate generated THEN include HMAC-signed QR for tamper-proof verification | Certificates | HMAC signing key per org |
| M9-R5 | IF training cancelled THEN refund all enrolled members via M06 | Cancellation | Automated refund cascade |
| M9-R6 | IF training network-wide THEN visible to all association members (default) | Visibility | Internal override available |
| M9-R7 | IF duplicate attendance confirmation THEN no duplicate credits awarded | Check-in | Idempotent credit award |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create training | president (2FA), officer, admin, super | member, staff, VP, secretary, treasurer, board-member | GA+HG |
| Update training | president (2FA), officer, admin, super | member, staff | GA+HG |
| Delete training | president (2FA), officer, admin, super | member, staff | GA+HG |
| Publish training | president (2FA), officer, admin, super | member, staff | GA+HG |
| Cancel training | president (2FA), officer, admin, super | member, staff | GA+HG |
| Manage enrollments | president (2FA), officer, admin, super | member, staff | GA+HG |
| Check-in / mark attendance | president (2FA), officer, admin, super | member, staff | GA+HG |
| View own credits | All authenticated | -- | GA (own only) |
| View any member credits | Officers, admin, super | member | GA+OA |
| Create/update course | president (2FA), officer, admin, super | member, staff | GA+HG |
| Delete course | president (2FA), officer, admin, super | member, staff | GA+HG |
| Analytics (read) | All officers, admin, super, support | member | GA+OA |

## 7. Data Requirements

### Entity: Training (13 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | -- |
| title | Yes | Training name | Max 300 chars |
| description | No | Training description | Rich text |
| trainingType | Yes | seminar/workshop/convention/onlineCourse/skillsTraining | Enum (`training_type`) |
| status | Yes | draft/published/cancelled/completed | Enum (`training_status`) |
| instructorName | No | Instructor display name | Max 200 chars |
| instructorId | No | Instructor Person FK | Nullable |
| location | No | Venue or online link | Max 500 chars |
| startDate | Yes | Training start datetime | -- |
| endDate | Yes | Training end datetime | Must be after startDate |
| capacity | No | Max enrollments | Nullable, positive integer |
| registrationFee | No | Enrollment fee | Bigint, default 0 |
| currency | No | Fee currency | Default 'PHP' |
| creditBearing | No | Awards credits | Boolean, default false |
| creditAmount | No | CPD credits awarded | Integer, default 0 |
| accreditedProviderId | No | Provider FK | -- |

### Entity: TrainingEnrollment (5 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| trainingId | Yes | Training FK | -- |
| personId | Yes | Person FK | Unique with trainingId |
| status | Yes | enrolled/completed/cancelled/noShow | Enum (`enrollment_status`) |
| enrolledAt | Yes | Enrollment timestamp | Auto-set |
| completedAt | No | Completion timestamp | Set when attendance confirmed |

### Entity: Course (5 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | -- |
| title | Yes | Course name | -- |
| description | No | Course description | -- |
| status | Yes | draft/published/archived | Enum (`course_status`) |
| creditValue | No | CPD credits on completion | -- |

### Entity: CourseEnrollment (5+ columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| courseId | Yes | Course FK | -- |
| personId | Yes | Person FK | -- |
| progress | Yes | Completion percentage | 0-100 |
| status | Yes | enrolled/completed | -- |
| completedAt | No | Completion timestamp | -- |

### Entity: QuizAttempt (7 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| courseEnrollmentId | Yes | CourseEnrollment FK | -- |
| quizId | Yes | Quiz identifier | -- |
| score | Yes | Attempt score | Numeric |
| passed | Yes | Pass/fail | Boolean |
| answers | No | JSON answers | JSONB |
| attemptNumber | Yes | Attempt count | Integer |
| submittedAt | Yes | Submission time | Timestamp |

### Entity: AccreditedProvider (5 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| name | Yes | Provider name | -- |
| accreditationNumber | Yes | PRC accreditation ref | Unique |
| status | Yes | active/suspended/expired | Enum (`accredited_provider_status`) |
| expiresAt | No | Accreditation expiry | -- |
| organizationId | Yes | Managing org FK | -- |

### Entity: Certificate

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| trainingId | Yes | Training FK | -- |
| personId | Yes | Person FK | Unique with trainingId |
| certificateNumber | Yes | Unique identifier | Globally unique |
| pdfUrl | No | Generated PDF URL (S3/MinIO) | Via M15 Storage |
| qrData | Yes | HMAC-signed verification payload | Tamper-proof |
| issuedAt | Yes | Issue timestamp | Auto-set on generation |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Training | TrainingEnrollment, Certificate | -- | Enrollment count <= capacity. One certificate per person per training. No modifications after status=completed. |
| Course | CourseEnrollment, QuizAttempt | -- | Progress 0-100. Quiz attempts tracked per enrollment. |
| AccreditedProvider | -- | -- | Status: active/suspended/expired. Expiration tracked. |

## 8. State Transitions

### Training Status (`training_status`)
```
Draft ──publish──► Published ──complete──► Completed
Draft ──publish──► Published ──cancel──► Cancelled
```
| From | To | Trigger | Actor | Side Effects |
|------|-----|---------|-------|-------------|
| Draft | Published | Officer publishes | Officer | TrainingPublished event -> M07 notification |
| Published | Completed | Officer marks complete | Officer | Unlocks attendance confirmation |
| Published | Cancelled | Officer cancels | Officer (president 2FA) | Refunds via M06, notifications via M07 |

### Enrollment Status (`enrollment_status`)
```
Enrolled ──confirm attendance──► Completed (auto-credit award per BR-13)
Enrolled ──cancel──► Cancelled (member or officer)
Enrolled ──no show──► NoShow (post-training, officer marks)
```
| From | To | Trigger | Actor | Side Effects |
|------|-----|---------|-------|-------------|
| Enrolled | Completed | Attendance confirmed | Officer | CreditAwarded event -> M10. Certificate generated. |
| Enrolled | Cancelled | Member/officer cancels | Member or Officer | Capacity released. Refund if paid. |
| Enrolled | NoShow | Post-training mark | Officer | No credits. No certificate. |

### Accredited Provider Status (`accredited_provider_status`)
```
Active ──suspend──► Suspended ──reactivate──► Active
Active ──expire──► Expired ──renew──► Active
Suspended ──expire──► Expired
```

### Course Status (`course_status`)
```
Draft ──publish──► Published ──archive──► Archived
```

## 9. UI/UX Requirements

### Screen: Training Dashboard (`/org/[id]/officer/training`)
**Purpose:** Training management for officers
**Users:** Society Officer, Officers
**Components:** Training list (status badge, type, date, enrollment count, credit value), create button, analytics summary (completion rate, total credits awarded)
**States:** Loading (skeleton), Empty ("No trainings yet. Create your first one."), Success (populated), PermissionError (non-officer redirect), UnexpectedError (retry)

### Screen: Create/Edit Training (`/org/[id]/officer/training/new`)
**Purpose:** Training creation form
**Users:** Officers
**Components:** Title, type selector (5 types), date/time pickers, location, instructor, credit value input, capacity, fee, accredited provider selector, visibility toggle
**States:** Loading, Draft (editing), Saving, Saved (success toast via sonner), ValidationError (inline)

### Screen: Training Attendance (`/org/[id]/officer/training/[id]/attendance`)
**Purpose:** Mark attendance and award credits
**Users:** Society Officer
**Components:** Enrollment list with attendance checkbox, QR scanner, manual search, bulk "Mark All Attended", credit award confirmation, real-time attendance count
**States:** Loading, Active (marking), Confirming (credit award dialog), Completed (locked), PermissionError

### Screen: My Training (`/my/training`)
**Purpose:** Member's training history and certificates
**Users:** All authenticated members
**Components:** Upcoming/completed tabs, training cards with credit value, certificate download links, total credits summary
**States:** Loading, Empty ("No training history yet."), Success (populated)

### Screen: Certificate View (`/my/certificates/[id]`)
**Purpose:** Certificate preview and download
**Users:** All authenticated members (own certificates)
**Components:** Certificate preview (name, training, date, credits, QR), download PDF button, share verification link
**States:** Loading, Ready (preview + download), Generating (spinner), Error (retry)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/trainings | Create training | Training data | trainingId | 403 not officer |
| PUT /org/:id/trainings/:id | Update training | Training data | updated training | 403, 400 completed |
| PUT /org/:id/trainings/:id/publish | Publish | -- | published training | 400 incomplete |
| PUT /org/:id/trainings/:id/cancel | Cancel | -- | cancelled training | 400 completed |
| PUT /org/:id/trainings/:id/complete | Mark complete | -- | completed training | 400 not published |
| POST /org/:id/trainings/:id/enroll | Enroll member | personId | enrollmentId | 409 full, 402 payment |
| POST /org/:id/trainings/:id/attendance | Mark attendance | personId | creditEntryId | 400 not enrolled |
| GET /org/:id/trainings | List trainings | filters, pagination | Training[] | -- |
| GET /my/training | My training history | -- | Enrollment[] with training details | -- |
| GET /my/certificates/:id/pdf | Download certificate PDF | -- | PDF binary | 404, 500 gen failure |
| GET /verify/certificate/:number | Public certificate verification | -- | Certificate details | 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| TrainingPublished | Training published | trainingId, orgId, trainingType, creditValue | M07 (notification to members) |
| TrainingCompleted | Training marked complete | trainingId, orgId | M10 (credit cycle check) |
| TrainingCancelled | Training cancelled | trainingId, orgId, enrollmentCount | M07 (cancellation notice), M06 (refunds) |
| CreditAwarded | Attendance confirmed | personId, trainingId, creditValue, creditEntryId | M10 (credit aggregation) |
| CertificateGenerated | Certificate created | certificateId, personId, trainingId | -- |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Confirm paid enrollment | Enrollment status -> enrolled |
| RefundCompleted | M06 | Update enrollment | Enrollment status -> cancelled |

## 11. Acceptance Criteria

### AC-M09-001: Auto-Credit Award
**Given** an officer confirms a member's attendance at a training
**When** the attendance is recorded
**Then** a credit entry (AUTO type) is created immediately with the training's credit value, and the credits are reflected in the member's M10 credit summary

### AC-M09-002: Certificate Verification
**Given** a certificate has been generated for a completed training
**When** anyone scans the certificate's QR code
**Then** a public verification page shows training details, member name, date, and credit value

### AC-M09-003: No Duplicate Credits
**Given** a member has already received credits for a training
**When** attendance confirmation is attempted again
**Then** no duplicate credit entry is created (idempotent), and a success response is returned

### AC-M09-004: Training Type Enforcement
**Given** an officer creates a training
**When** selecting the training type
**Then** only the 5 platform-defined types are available (not org-customizable)

### AC-M09-005: Post-Completion Lock
**Given** a training is marked as completed
**When** any attempt is made to enroll or modify enrollments
**Then** the operation is rejected

### AC-M09-006: Network Visibility Default
**Given** a training is created without explicit visibility setting
**When** the training is published
**Then** it is visible to all members across the association (network-wide default)

## 12. Test Expectations

Required test categories:
- **Training CRUD:** create with all 5 types, publish, cancel, complete state machine
- **Enrollment:** capacity enforcement, paid/free enrollment, cancellation releases capacity
- **Attendance & Credit Award:** QR + manual check-in, auto-credit generation (BR-13), duplicate prevention (M9-R7)
- **Certificate:** PDF generation, HMAC-signed QR, public verification URL, unique certificate number
- **Network visibility:** cross-chapter access for published trainings, internal override
- **Accredited providers:** CRUD, status transitions (active/suspended/expired)
- **Course management:** course CRUD, enrollment, progress tracking, quiz attempts
- **Post-completion lock:** reject enrollment and modification after training completed

## 13. Edge Cases

- Training cancelled with 100 enrolled and paid members: all refunded via M06 in batch.
- Member enrolled but attendance not confirmed post-training: officer marks noShow, no credits awarded.
- Training with 0 credits configured: [VERIFY] -- should this be blocked? BR-15 says training = credit-bearing.
- Two officers mark same member attended simultaneously: idempotent, one credit entry created.
- Certificate PDF generation fails: retry available. Certificate record created, pdfUrl null until generated.
- Accredited provider expires between training creation and completion: training still valid, provider status informational.
- Member from different org enrolls in network training: enrollment allowed, credits tracked under their primary org in M10.
- Training with no enrollments completed: valid operation, no credits/certificates generated.

## 14. Dependencies

### Internal Dependencies
- M05 (Membership -- enrollment eligibility)
- M06 (Dues -- training fees, refund processing)
- M07 (Communications -- training published/cancelled notifications)
- M10 (Credit Tracking -- credit entry creation, aggregation. Circular dependency, same implementation wave.)

### External Dependencies
- PDF generation library (certificates)
- QR code generation library (certificate QR + attendance QR)
- HMAC signing (certificate tamper-proof verification)
- S3/MinIO (certificate PDF storage via M15 Storage)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Training full | Block enrollment | "Training is full." |
| Payment required but no gateway | Block enrollment | "Online payment unavailable. Contact treasurer." |
| Certificate generation fails | Retry available, record created | "Could not generate certificate. Try again." |
| Duplicate attendance | Idempotent success | "Attendance already confirmed." |
| Training already completed | Block enrollment | "This training has ended. No further enrollment." |
| Invalid accredited provider | Validation error | "Selected provider is not active." |

## 16. Performance Expectations

- **Data volume:** 20+ trainings per org per year, 200+ enrollments per large training
- **Response times:** Attendance marking < 1s, training list < 500ms, certificate PDF generation < 3s
- **Caching:** Training list cached per org, invalidated on publish/cancel/complete. Certificate PDFs cached in S3.
- **Concurrent attendance:** Multiple officers marking attendance simultaneously; idempotent writes prevent duplicates.

## 17. Observability Hooks

**Log Events:**

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| training.published | INFO | Goes live | trainingId, orgId, type, creditValue | No |
| training.enrollment | INFO | Member enrolls | trainingId, personId | No |
| training.attendance.confirmed | INFO | Check-in recorded | trainingId, personId, method | No |
| training.credit.awarded | INFO | Credit entry created | trainingId, personId, creditValue | No |
| training.certificate.generated | INFO | PDF created | certificateId, personId | No |
| training.certificate.verified | INFO | Public QR scan | certificateNumber | No |
| training.cancelled | WARN | Training cancelled | trainingId, enrollmentCount, refundCount | No |

**Metrics:**

| Metric | Type | Labels | Description |
|---|---|---|---|
| training_enrollments_total | counter | status, trainingType | Enrollment count by status and type |
| training_credits_awarded_total | counter | trainingType | Total credits awarded |
| certificate_generation_seconds | histogram | -- | PDF generation latency |
| training_capacity_utilization | gauge | trainingId | Enrollment/capacity ratio |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| training_online_enrollment | release | true | Online enrollment for trainings | -- |
| training_certificate_qr | release | true | HMAC-signed QR on certificates | -- |
| training_accredited_providers | release | true | Accredited provider management | -- |
| training_courses | release | false | Self-paced online courses (Phase 2) | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M09-S1 | Training CRUD | Create, publish, cancel, complete with 5 types | M04 | P0 |
| M09-S2 | Enrollment | Register with capacity management | M09-S1, M05 | P0 |
| M09-S3 | Attendance & Credit Award | Mark attendance, auto-credit via BR-13 | M09-S2, M10 | P0 |
| M09-S4 | Certificates | PDF generation with HMAC-signed QR | M09-S3, M15 | P0 |
| M09-S5 | Paid Training | Fee collection via M06 | M09-S2, M06 | P1 |
| M09-S6 | Accredited Providers | Provider CRUD + status management | M09-S1 | P1 |
| M09-S7 | Training Analytics | Completion rates, credit distribution, revenue | M09-S3 | P1 |
| M09-S8 | Online Courses | Self-paced courses + quiz attempts | M09-S1 | P2 |

## 20. AI Instructions

When implementing this module:
1. **Schema location:** Training tables in `association:operations/repos/training.schema.ts`. Accredited providers in `training/repos/accredited-provider.schema.ts`. Do not create new schema files.
2. **Spec-first:** Define TypeSpec in `specs/api/src/modules/training.tsp`. Generate routes/validators before handlers.
3. **BR-13 critical path:** Auto-credit award on attendance is the core value proposition. Implement M09-S3 with M10 integration as highest priority after CRUD + enrollment.
4. **BR-15 boundary:** Training is credit-bearing, events are not. Enforce at handler level. Never allow M08 events to trigger credit entries.
5. **Certificate HMAC:** Use org-level HMAC signing key. QR payload: `{certificateNumber, personId, trainingId, creditValue}`. Public verification endpoint: `/verify/certificate/:number`.
6. **Idempotent credits:** Use unique constraint on (trainingId, personId) for credit entries. Return success on duplicate attempt.
7. **Vertical slices:** M09-S1 -> M09-S2 -> M09-S3 -> M09-S4 is the critical path. All depend sequentially.
8. **Module pattern:** Router -> Validators -> Handlers -> Repositories. Follow `services/api-ts/src/handlers/person/createPerson.ts` as reference.
9. **Toasts:** Use `sonner`. Auth route: `/auth/sign-in`. No `/api` prefix in routes.
10. **Test-first:** Follow VERTICAL_TDD.md. Write failing tests for BR-13 (auto-credit) and M9-R7 (idempotent credits) before implementation.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | From DOMAIN_GLOSSARY.md |
| 3. Workflows | COMPLETE | 7 workflows; WF-IDs inferred for 5 (not in WORKFLOW_MAP) |
| 4. Workflow Details | COMPLETE | 4 workflows fully detailed |
| 5. Business Rules | COMPLETE | 12 rules including BR-13/15/17/20 from cross-module |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX.md section 3.3 |
| 7. Data Requirements | COMPLETE | 7 entities from DOMAIN_MODEL.md + schema inspection |
| 7b. Aggregate Boundaries | COMPLETE | 3 aggregate roots |
| 8. State Transitions | COMPLETE | Training + Enrollment + Provider + Course state machines |
| 9. UI/UX Requirements | COMPLETE | 5 screens with all states |
| 10. API Expectations | COMPLETE | 11 endpoints |
| 10b. Domain Events | COMPLETE | 5 published, 2 consumed |
| 11. Acceptance Criteria | COMPLETE | 6 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 8 test categories |
| 13. Edge Cases | COMPLETE | 8 edge cases (preserves v1.0 [VERIFY] on 0-credit training) |
| 14. Dependencies | COMPLETE | Notes M10 circular dependency |
| 15. Error Handling | COMPLETE | 6 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 7 log events, 4 metrics |
| 18. Feature Flags | COMPLETE | 4 flags (courses behind flag) |
| 19. Vertical Slice Plan | COMPLETE | 8 slices |
| 20. AI Instructions | COMPLETE | 10 directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M10 (Credit Tracking):** Primary consumer of `CreditAwarded` events. If M09 fails to emit credits on attendance, member credit summaries are incomplete. Circular dependency -- implement in same wave.
- **M07 (Communications):** Consumes `TrainingPublished` and `TrainingCancelled` for member notifications.
- **M06 (Dues/Payments):** Paid training enrollment depends on M06 payment gateway. Training cancellation triggers bulk refunds.
- **M11 (Documents/Certificates):** Certificate PDFs stored via M15 Storage. Certificate verification is a public endpoint.
- **SDK generation:** Changes to training API endpoints require `specs/api && bun run build` + SDK regeneration.
- **Frontend apps:** `apps/memberry` training pages and `/my/training` in account app depend on training API.
