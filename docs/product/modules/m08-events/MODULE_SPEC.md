# Module Specification: Events (M08)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Manage association events -- creation, registration, attendance tracking, and QR check-in. Covers social, governance, and community activities (non-credit-bearing). Events are internal to an org by default. Distinct from M09 Training which handles credit-bearing professional development.

### Users
- Officers (Secretary, President) -- create, publish, manage events and check-in
- Member -- browse, register, view registrations, present QR for check-in
- System -- waitlist auto-promotion, notification dispatch, refund processing

### Related Modules
- M05 (Membership -- registration eligibility), M06 (Dues -- paid event fees, refunds)
- M07 (Communications -- event notifications), M09 (Training -- credit-bearing activities separate)

### In Scope
- Event CRUD (draft, publish, cancel, complete), 8 event types (GA, ceremony, fellowship, etc.)
- Registration with capacity management, waitlisting, FIFO auto-promotion
- QR check-in (authenticated scanner + valid event), manual check-in fallback
- Visibility: internal (org-only) vs network (association-wide)
- Paid events (fee via M06 payment gateway), free events
- Event analytics (attendance rates, registration counts)

### Out of Scope
- Credit-bearing activities (M09 Training), certificate generation (M11)
- Booking/scheduling system (separate handlers under `booking/`)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Event | Social/governance/community activity with no CPD credits. Types: generalAssembly, inductionCeremony, fellowship, medicalMission, boardMeeting, committeeMeeting, fundraiser, other. |
| Registration | Member's enrollment in an event. Status: confirmed, waitlisted, cancelled, refunded, noShow. |
| Attendance | Confirmation of actual participation via QR or manual check-in. |
| Check-in | QR scan or manual attendance confirmation at event by authenticated officer. |
| Waitlist Entry | Overflow record when event is at capacity. FIFO promotion on cancellation. |
| Event Visibility | internal (org members only) or network (association-wide). Internal is default. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Create & Publish Event | WF-051 | Officer | Draft, configure capacity/fee/visibility, publish | P0 |
| Event Registration | WF-052 | Member | Register, waitlist if full, payment for paid events | P0 |
| QR Check-In | WF-053 | Officer | Authenticated scanner confirms attendance | P0 |
| Event Cancellation | WF-054 | Officer | Cancel event, notify registrants, process refunds | P0 |
| Events Dashboard | WF-055 | Officer | Event list, upcoming/past, attendance stats | P0 |
| My Events | WF-056 | Member | Registered/past events with QR code | P0 |
| Waitlist Auto-Promotion | WF-057 | System | FIFO promotion when spot opens | P0 [INFERRED] |

## 4. Workflow Details

### Workflow: Create & Publish Event (WF-051)

**Actor:** Secretary or Officer
**Preconditions:** Officer authenticated, org exists, officer role verified
**Steps:**
1. Opens `/org/[id]/officer/events/new`.
2. Fills: title, type (8 enum values), date/time, location (venue or online link), description, cover image.
3. Sets capacity limit (optional), fee (optional via M06 gateway), visibility (internal/network).
4. Saves as draft. Previews event page.
5. Publishes. System emits `EventPublished` domain event. Members notified per M07.

**Alternate Flows:**
- Network visibility: event visible to all association members, not just org.
- No capacity limit: unlimited registration.

**Exception Flows:**
- Missing required fields: inline validation errors.
- Fee set but no payment gateway configured: "Online payment unavailable. Configure billing first."

**Postconditions:** Event in `published` status. Notification sent to eligible members.

### Workflow: Event Registration (WF-052)

**Actor:** Member
**Preconditions:** Event published, member authenticated
**Steps:**
1. Opens `/org/[id]/events/[id]` or browses `/my/events/browse`.
2. Views event details: date, location, capacity remaining, fee.
3. Clicks register. If paid, redirected to payment flow (M06).
4. On success: registration status = `confirmed`. QR code generated for check-in.
5. If at capacity: registration status = `waitlisted`. Member notified of position.

**Alternate Flows:**
- Free event: immediate confirmation, no payment step.
- Network event: members from other orgs can register.

**Exception Flows:**
- Event full: "Event is full. Join the waitlist?" -> waitlist entry created.
- Payment fails: registration not created. "Payment failed. Try again."
- Event not published: 404.

**Postconditions:** Registration record created. QR code available at `/my/events`.

### Workflow: QR Check-In (WF-053)

**Actor:** Officer with scanner device
**Preconditions:** Event published, officer authenticated with scanner role
**Steps:**
1. Opens `/org/[id]/officer/events/[id]/attendance`.
2. Scans member's QR code (from `/my/events` registration).
3. System validates: authenticated scanner + valid event + registered member (BR-18).
4. Marks attendance. Shows green confirmation with member name.
5. Attendance count updates in real-time on dashboard.

**Alternate Flows:**
- Manual check-in fallback: search member name, mark attended.

**Exception Flows:**
- Member not registered: "Member not registered for this event."
- Duplicate QR scan: "Already checked in." (idempotent, no error)
- Event completed: "Event check-in is closed." (BR M8-R6)

**Postconditions:** CheckIn record created. Attendance count incremented.

### Workflow: Event Cancellation (WF-054)

**Actor:** Officer (president with 2FA)
**Preconditions:** Event published, not yet completed
**Steps:**
1. Officer selects cancel from event management.
2. Confirms cancellation (destructive action warning).
3. System emits `EventCancelled`. All registered members notified via M07.
4. Paid registrations: refunds processed via M06 for each confirmed registration.
5. Waitlist entries cancelled.

**Postconditions:** Event status = `cancelled`. All registrations = `refunded` or `cancelled`. Capacity released.

### Workflow: Waitlist Auto-Promotion (WF-057)

**Actor:** System
**Preconditions:** Event at capacity, waitlist non-empty
**Steps:**
1. Registration cancelled or refunded -> spot opens.
2. System selects oldest waitlist entry (FIFO).
3. Promotes to `confirmed`. Notifies member via M07.
4. If paid event: payment link sent. Confirmation pending payment.

**Postconditions:** Waitlisted member promoted. Capacity count maintained.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-15 | IF activity is event THEN no CPD credits awarded (training = credit, event = no credit) | Events vs Training | Events never generate credit entries |
| BR-16 | IF event visibility not set THEN default to internal | Visibility | Org-only by default |
| BR-17 | IF attendance confirmation THEN only by officer (not self-service) | Check-in | Officers scan or mark manually |
| BR-18 | IF QR check-in THEN require authenticated scanner + valid event + registered member | Check-in | Three-factor validation |
| BR-27 | IF event registration at capacity THEN add to waitlist, auto-promote FIFO | Registration | Capacity enforcement |
| M8-R1 | IF event full THEN add to waitlist; auto-promote FIFO when spot opens | Registration | Waitlist management |
| M8-R2 | IF paid event THEN registration requires payment confirmation before status=confirmed | Paid events | No registration without payment |
| M8-R3 | IF event cancelled THEN notify all registered members and process refunds via M06 | Cancellation | Automated cleanup |
| M8-R4 | IF internal event THEN visible only to org members; network events visible association-wide | Visibility | Access control |
| M8-R5 | IF registration cancelled THEN release capacity and auto-promote first waitlisted | Cancellation | Capacity reclaimed |
| M8-R6 | IF event completed THEN lock registrations and check-ins | Completion | No changes after completion |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create event | president (2FA), officer, admin, super | member, staff | GA+HG |
| Update event | president (2FA), officer, admin, super | member, staff | GA+HG |
| Delete event | president (2FA), officer, admin, super | member, staff | GA+HG |
| Publish event | president (2FA), officer, admin, super | member, staff | GA+HG |
| Cancel event | president (2FA), officer, admin, super | member, staff | GA+HG |
| List/view events | All authenticated | -- | GA |
| Register for event | All authenticated | -- | GA |
| Check-in attendees | president (2FA), officer, admin, super | member, staff | GA+HG |
| Refund registration | president (2FA), officer, admin, super | member, staff | GA+HG |
| Analytics (read) | All officers, admin, super, support | member | GA+OA |

## 7. Data Requirements

### Entity: Event (13 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | -- |
| title | Yes | Event name | Max 300 chars |
| description | No | Event description | Rich text |
| eventType | Yes | generalAssembly/inductionCeremony/fellowship/medicalMission/boardMeeting/committeeMeeting/fundraiser/other | Enum (`event_type`) |
| status | Yes | draft/published/cancelled/completed | Enum (`event_status`) |
| visibility | Yes | internal/network | Enum (`event_visibility`), default: internal |
| startDate | Yes | Event start datetime | -- |
| endDate | Yes | Event end datetime | Must be after startDate |
| location | No | Venue or online link | -- |
| coverImage | No | Cover image URL | Via M15 Storage |
| capacityLimit | No | Max attendees | Nullable, positive integer |
| feeAmount | No | Registration fee | Nullable, bigint, default 0 |
| currency | No | Fee currency | Default 'PHP' |

### Entity: EventRegistration (6 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| eventId | Yes | Event FK | -- |
| personId | Yes | Person FK | Unique with eventId |
| status | Yes | confirmed/waitlisted/cancelled/refunded/noShow | Enum |
| paymentId | No | Payment FK (M06) | Required for paid events |
| registeredAt | Yes | Registration timestamp | Auto-set |
| cancelledAt | No | Cancellation timestamp | Set on cancel |

### Entity: CheckIn (5 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| eventId | Yes | Event FK | -- |
| personId | Yes | Person FK | Unique with eventId (idempotent) |
| method | Yes | qr/manual | Enum |
| checkedInBy | Yes | Officer Person FK | Must be authenticated officer |
| checkedInAt | Yes | Check-in timestamp | Auto-set |

### Entity: WaitlistEntry (4+ columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| eventId | Yes | Event FK | -- |
| personId | Yes | Person FK | Unique with eventId |
| position | Yes | FIFO order | Auto-incremented per event |
| promotedAt | No | When promoted to confirmed | Null until promoted |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Event | EventRegistration, CheckIn, WaitlistEntry | -- | Registration count <= capacityLimit. Check-in requires prior registration. No modifications after status=completed. |

## 8. State Transitions

### Event Status (`event_status`)
```
Draft ──publish──► Published ──complete──► Completed
Draft ──publish──► Published ──cancel──► Cancelled
```
| From | To | Trigger | Actor | Guards |
|------|-----|---------|-------|--------|
| Draft | Published | Officer publishes | Officer | All required fields filled |
| Published | Completed | Officer marks complete | Officer | Event end date passed [INFERRED] |
| Published | Cancelled | Officer cancels | Officer (president 2FA) | Triggers refunds + notifications |

### Registration Status
```
Confirmed ──cancel──► Cancelled (member action)
Confirmed ──refund──► Refunded (event cancelled)
Confirmed ──noshow──► NoShow (post-event, officer marks)
Waitlisted ──promote──► Confirmed (spot opens, FIFO)
Waitlisted ──cancel──► Cancelled (member or event cancelled)
```

## 9. UI/UX Requirements

### Screen: Events Dashboard (`/org/[id]/officer/events`)
**Purpose:** Event management for officers
**Users:** Officers
**Components:** Event list with status badge/type/date/registration count, upcoming/past tabs, create button, attendance stats summary
**States:** Loading (skeleton), Empty ("No events yet. Create your first one."), Success (populated), PermissionError (non-officer redirect), UnexpectedError (retry)

### Screen: Create/Edit Event (`/org/[id]/officer/events/new`)
**Purpose:** Event creation form
**Users:** Officers
**Components:** Title, type selector, date/time pickers, location input, description editor, cover image upload, capacity input, fee input, visibility toggle
**States:** Loading, Draft (editing), Saving (spinner), Saved (success toast), ValidationError (inline errors)

### Screen: Event Check-in (`/org/[id]/officer/events/[id]/attendance`)
**Purpose:** QR scanner + manual check-in
**Users:** Officers
**Components:** QR scanner view (camera), manual search input, attendance list with real-time count, check-in confirmation (green flash with member name), attendance percentage
**States:** Loading, Scanner active, Check-in success (green), Check-in error (red + message), Event completed (locked)

### Screen: Event Detail (`/org/[id]/events/[id]`)
**Purpose:** Public event page for members
**Users:** All authenticated
**Components:** Event details (title, date, location, description, cover), registration button/status, capacity indicator, fee display
**States:** Loading, Published (register available), Full (waitlist option), Registered (show QR), Completed (read-only), Cancelled (notice)

### Screen: My Events (`/my/events`)
**Purpose:** Member's registrations across all orgs
**Users:** All authenticated members
**Components:** Upcoming/past tabs, registration cards with event details + QR code for check-in, status badge
**States:** Loading, Empty ("No events yet."), Success (populated)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/events | Create event | Event data | eventId | 403 not officer |
| PUT /org/:id/events/:id | Update event | Event data | updated event | 403, 400 completed |
| PUT /org/:id/events/:id/publish | Publish event | -- | published event | 400 incomplete fields |
| PUT /org/:id/events/:id/cancel | Cancel event | -- | cancelled event | 400 already completed |
| PUT /org/:id/events/:id/complete | Mark complete | -- | completed event | 400 not published |
| POST /org/:id/events/:id/register | Register member | personId | registrationId | 409 full (waitlist), 402 payment required |
| DELETE /org/:id/events/:id/register/:regId | Cancel registration | -- | -- | 400 event completed |
| POST /org/:id/events/:id/checkin | Check in | personId, method | checkInId | 400 not registered, 409 already checked in |
| GET /org/:id/events | List org events | filters, pagination | Event[] | -- |
| GET /my/events | My registrations | -- | Registration[] with event details | -- |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| EventPublished | Event published | eventId, orgId, visibility, eventType | M07 (announcement to members) |
| EventCancelled | Event cancelled | eventId, orgId, registrationCount | M07 (cancellation notice), M06 (bulk refunds) |
| EventCompleted | Event marked complete | eventId, orgId, attendanceCount | -- |
| AttendanceConfirmed | Check-in recorded | eventId, personId, method | -- |
| WaitlistPromoted | Waitlist member promoted | eventId, personId | M07 (promotion notice) |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Confirm paid registration | Registration status -> confirmed |
| RefundCompleted | M06 | Update registration | Registration status -> refunded |

## 11. Acceptance Criteria

### AC-M08-001: QR Check-In Security
**Given** an officer attempts QR check-in
**When** scanning a member's QR code
**Then** system validates authenticated scanner AND valid published event AND registered member before recording attendance

### AC-M08-002: Capacity Management
**Given** an event with a capacity limit
**When** registrations reach the limit
**Then** new registrations are added to waitlist; cancellation of a confirmed registration auto-promotes the oldest waitlisted member (FIFO)

### AC-M08-003: Paid Event Registration
**Given** a paid event with a registration fee
**When** a member registers
**Then** registration status remains pending until PaymentRecorded event confirms payment

### AC-M08-004: Event Cancellation Cascade
**Given** an officer cancels a published event with registrations
**When** cancellation is confirmed
**Then** all registered members are notified via M07 and refunds are initiated via M06 for paid registrations

### AC-M08-005: Visibility Enforcement
**Given** an internal event
**When** a non-org member attempts to view or register
**Then** event is not visible and registration returns 403

### AC-M08-006: Post-Completion Lock
**Given** a completed event
**When** any attempt is made to register or check-in
**Then** the operation is rejected with appropriate error message

## 12. Test Expectations

Required test categories:
- **Event CRUD:** create, publish, cancel, complete state machine; all event types
- **Registration:** capacity enforcement, waitlisting, FIFO auto-promotion, cancellation releases capacity
- **QR check-in:** valid scan, invalid scan (not registered), duplicate scan (idempotent), manual fallback
- **Paid events:** payment required before confirmation, refund on cancellation
- **Visibility:** internal vs network access control; non-org member blocked from internal events
- **Waitlist:** FIFO ordering, promotion notification, paid event promotion with payment link
- **Post-completion lock:** reject registration and check-in after event completed

## 13. Edge Cases

- Event cancelled with 200 registered members: all notified via M07, refunds processed in batch via M06.
- QR scan for member not registered: "Member not registered for this event." (not a check-in error, informational).
- Duplicate QR scan: "Already checked in." (idempotent, no duplicate check-in records).
- Waitlisted member's spot opens but event is tomorrow: immediate notification with urgency indicator.
- Event with 0 capacity limit: unlimited registration (null = no limit).
- Two officers check-in same member simultaneously: idempotent, one CheckIn record.
- Member cancels paid registration after event starts: refund policy per org config [VERIFY].
- Network event: members from multiple orgs register; attendance tracked per-org for analytics.

## 14. Dependencies

### Internal Dependencies
- M05 (Membership -- eligibility check for internal events)
- M06 (Dues -- paid event fees, refund processing)
- M07 (Communications -- event published/cancelled notifications)

### External Dependencies
- QR code generation library (for registration QR codes)
- Camera API (for QR scanner on check-in screen)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Event full | Offer waitlist | "Event is full. Join the waitlist?" |
| QR scan invalid/corrupt | Show error | "Invalid QR code. Try manual check-in." |
| QR scan not registered | Informational | "Member not registered for this event." |
| Payment required but no gateway | Block registration | "Online payment unavailable. Contact treasurer." |
| Event already completed | Block action | "This event has ended. No further changes allowed." |
| Duplicate registration | Block | "You are already registered for this event." |

## 16. Performance Expectations

- **Data volume:** 50+ events per org per year, 200+ attendees per large event
- **Response times:** Check-in < 1s (critical for QR flow), event list < 500ms, registration < 2s
- **Caching:** Event list cached per org, invalidated on publish/cancel/complete. Public event detail cached.
- **Concurrent check-in:** Multiple officers scanning simultaneously; idempotent writes prevent duplicates.

## 17. Observability Hooks

**Log Events:**

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| event.published | INFO | Event goes live | eventId, orgId, type, visibility | No |
| event.registration | INFO | Member registers | eventId, personId, status | No |
| event.registration.waitlisted | INFO | Added to waitlist | eventId, personId, position | No |
| event.checkin | INFO | Attendance recorded | eventId, personId, method | No |
| event.cancelled | WARN | Event cancelled | eventId, registrationCount, refundCount | No |
| event.completed | INFO | Event completed | eventId, attendanceCount, registrationCount | No |
| event.waitlist.promoted | INFO | Waitlist promotion | eventId, personId | No |

**Metrics:**

| Metric | Type | Labels | Description |
|---|---|---|---|
| event_registrations_total | counter | status, eventType | Registration count by status |
| event_checkin_duration_seconds | histogram | method | Check-in latency (QR vs manual) |
| event_waitlist_depth | gauge | eventId | Current waitlist size per event |
| event_capacity_utilization | gauge | eventId | Registration/capacity ratio |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| events_waitlist_enabled | release | true | Waitlist when at capacity | -- |
| events_qr_checkin | release | true | QR code check-in functionality | -- |
| events_network_visibility | release | true | Allow network-wide event visibility | -- |
| events_paid_registration | release | true | Paid event registration via M06 | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M08-S1 | Event CRUD | Create, edit, publish, cancel, complete | M04 | P0 |
| M08-S2 | Registration | Register + capacity management + cancellation | M08-S1, M05 | P0 |
| M08-S3 | QR Check-In | Scanner + manual check-in | M08-S2 | P0 |
| M08-S4 | Waitlisting | FIFO waitlist + auto-promotion on cancel | M08-S2 | P0 |
| M08-S5 | Paid Events | Fee collection + refund via M06 | M08-S2, M06 | P1 |
| M08-S6 | My Events | Member registration list + QR display | M08-S2 | P1 |
| M08-S7 | Event Analytics | Attendance rates, registration stats | M08-S3 | P1 |

## 20. AI Instructions

When implementing this module:
1. **Schema location:** Event tables in `association:operations/repos/events.schema.ts`. Do not create separate schema files.
2. **Spec-first:** Define TypeSpec in `specs/api/src/modules/events.tsp`. Generate routes/validators before handlers.
3. **BR-15 boundary:** Events never award CPD credits. That is M09 Training only. Enforce at handler level.
4. **Check-in idempotency:** Use unique constraint on (eventId, personId) in CheckIn table. Return success on duplicate, do not error.
5. **Waitlist FIFO:** Use `position` column with auto-increment per event. Promote lowest position first.
6. **Capacity check:** Use optimistic locking or SELECT FOR UPDATE to prevent race conditions on registration.
7. **Vertical slices:** Implement M08-S1 (Event CRUD) first, then M08-S2 (Registration) -- all other slices depend on these.
8. **Module pattern:** Router -> Validators -> Handlers -> Repositories.
9. **Toasts:** Use `sonner`. Auth route: `/auth/sign-in`. No `/api` prefix in routes.
10. **Test-first:** Follow VERTICAL_TDD.md. Write failing tests for each state transition before implementation.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | From DOMAIN_GLOSSARY.md + DOMAIN_MODEL.md enums |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP.md WF-051 to WF-057 |
| 4. Workflow Details | COMPLETE | 5 workflows fully detailed |
| 5. Business Rules | COMPLETE | 11 rules including BR-15/16/17/18/27 from cross-module |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX.md section 3.3 |
| 7. Data Requirements | COMPLETE | 4 entities from DOMAIN_MODEL.md |
| 7b. Aggregate Boundaries | COMPLETE | Single aggregate root: Event |
| 8. State Transitions | COMPLETE | Event + Registration state machines |
| 9. UI/UX Requirements | COMPLETE | 5 screens with all states |
| 10. API Expectations | COMPLETE | 10 endpoints |
| 10b. Domain Events | COMPLETE | 5 published, 2 consumed |
| 11. Acceptance Criteria | COMPLETE | 6 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 7 test categories |
| 13. Edge Cases | COMPLETE | 8 edge cases |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | 6 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 7 log events, 4 metrics |
| 18. Feature Flags | COMPLETE | 4 flags |
| 19. Vertical Slice Plan | COMPLETE | 7 slices |
| 20. AI Instructions | COMPLETE | 10 directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M07 (Communications):** Consumes `EventPublished` and `EventCancelled` to send member notifications. If events module doesn't emit these events, members won't be notified.
- **M06 (Dues/Payments):** Paid event registration depends on M06 payment gateway. Event cancellation triggers bulk refunds via M06.
- **M09 (Training):** BR-15 boundary -- events and training are separate. If this boundary leaks (events awarding credits), M10 credit tracking is corrupted.
- **SDK generation:** Changes to events API endpoints require `specs/api && bun run build` + SDK regeneration.
- **Frontend apps:** `apps/memberry` event pages depend on event API responses. Schema changes require frontend updates.
