# Module Specification: Events (M08)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Manage association events — creation, registration, attendance tracking, and QR check-in. Covers social, governance, and community activities (non-credit-bearing). Events are internal to an org by default.

### Users
- Officers (Secretary, President), Member, System

### Related Modules
- M05 (Membership — registration eligibility), M06 (Dues — activity fees)
- M07 (Communications — event notifications), M09 (Training — credit-bearing activities separate)

### In Scope
- Event CRUD (draft, publish, cancel, complete), event types (GA, ceremony, fellowship, etc.)
- Registration with capacity management, waitlisting
- QR check-in (authenticated scanner + valid event), manual check-in
- Visibility: internal (org-only) vs network (association-wide)
- Paid events (fee via M06 gateway), free events
- Event analytics (attendance, completion rates)

### Out of Scope
- Credit-bearing activities (M09 Training), certificate generation (M11)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Event | Social/governance/community activity with no CPD credits. Internal by default. |
| Registration | Member's enrollment in an event. |
| Attendance | Confirmation of actual participation via check-in. |
| Check-in | QR or manual attendance confirmation at event. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Create & Publish Event | Officer | Event creation with capacity, fees, visibility | P0 |
| Check In Attendees | Officer | QR scanner or manual check-in | P0 |
| Browse & Register | Member | Find events, register, manage registrations | P0 |
| View My Events | Member | Registration list with check-in QR | P0 |

## 4. Workflow Details

### Workflow: Create & Publish Event (CS-3)

Actor: Secretary or Officer
Steps:
1. Opens /org/[id]/officer/events/new.
2. Fills: title, type, date/time, location (venue or online link), description, cover image.
3. Sets capacity limit (optional), fee (optional via M06), visibility (internal/network).
4. Saves as draft. Previews.
5. Publishes. Members notified per M07.

### Workflow: QR Check-In (CS-4)

Actor: Officer with scanner
Steps:
1. Opens /org/[id]/officer/events/[id]/attendance.
2. Scans member's QR code (from /my/events registration).
3. System validates: authenticated scanner + valid event + registered member.
4. Marks attendance. Shows green confirmation with member name.
5. Manual check-in fallback: search member name, mark attended.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-18 | IF QR check-in THEN require authenticated scanner + valid event | Check-in | Prevent unauthorized scans |
| M8-R1 | IF event full THEN add to waitlist | Registration | Auto-promote when spot opens |
| M8-R2 | IF paid event THEN registration requires payment confirmation | Paid events | No registration without payment |
| M8-R3 | IF event cancelled THEN notify all registered, process refunds | Cancellation | Automated cleanup |
| M8-R4 | IF internal event THEN visible only to org members | Visibility | Network events visible association-wide |
| M8-R5 | IF registration cancelled THEN release capacity | Cancellation | Waitlist auto-promote |
| M8-R6 | IF event completed THEN lock registrations and check-ins | Completion | No changes after completion |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create/update event | president (2FA), officer | member | GA+HG |
| Delete event | president (2FA), officer | member | GA+HG |
| List/view events | All authenticated | — | GA |
| Register for event | All authenticated | — | GA |
| Check-in | president (2FA), officer | member | GA+HG |

## 7. Data Requirements

### Entity: Event

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| title | Yes | Event name | — |
| eventType | Yes | generalAssembly/inductionCeremony/fellowship/etc. | Enum |
| status | Yes | draft/published/cancelled/completed | Enum |
| startDate | Yes | Event start | — |
| endDate | Yes | Event end | Must be after start |
| visibility | Yes | internal/network | Enum |
| capacityLimit | No | Max attendees | Nullable, integer |
| feeAmount | No | Registration fee | Nullable, decimal |

### Entity: EventRegistration

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| eventId | Yes | Event FK | — |
| personId | Yes | Person FK | — |
| status | Yes | confirmed/waitlisted/cancelled/refunded/noShow | Enum |
| paymentId | No | Payment FK | Required for paid events |

### Entity: CheckIn

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| eventId | Yes | Event FK | — |
| personId | Yes | Person FK | — |
| method | Yes | qr/manual | Enum |
| checkedInBy | Yes | Officer who scanned/recorded | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Event | EventRegistration, CheckIn, WaitlistEntry | — | Registration count <= capacity. Check-in requires prior registration. |

## 8. State Transitions

### Event Status
```txt
Draft → Published → Completed
Draft → Published → Cancelled
```

### Registration Status
```txt
Confirmed → Cancelled (member action)
Confirmed → Refunded (event cancelled)
Confirmed → NoShow (post-event)
Waitlisted → Confirmed (spot opens)
Waitlisted → Cancelled
```

## 9. UI / UX Requirements

### Screen: Events Dashboard (/org/[id]/officer/events)
Purpose: Event management for officers
Components: Event list with status, upcoming/past tabs, create button, attendance stats

### Screen: Event Check-in (/org/[id]/officer/events/[id]/attendance)
Purpose: QR scanner + manual check-in
Components: QR scanner view, manual search, attendance list with real-time count, check-in confirmation

### Screen: My Events (/my/events)
Purpose: Member's registrations across all orgs
Components: Upcoming/past tabs, registration cards with QR code for check-in

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/events | Create event | Event data | eventId | 403 |
| PUT /org/:id/events/:id/publish | Publish event | — | Published event | 400 incomplete |
| POST /org/:id/events/:id/register | Register | personId | registrationId | 409 full, 402 payment |
| POST /org/:id/events/:id/checkin | Check in | personId, method | checkInId | 400 not registered |
| GET /my/events | My registrations | — | Registration list | — |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| EventPublished | Event published | eventId, orgId, visibility | M07 (notification) |
| EventCancelled | Event cancelled | eventId, orgId | M07 (notification), M06 (refunds) |
| EventCompleted | Event marked complete | eventId, orgId | — |
| AttendanceConfirmed | Check-in recorded | eventId, personId | — |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Confirm paid registration | Registration status→confirmed |

## 11. Acceptance Criteria

### AC-M08-001: QR Check-In Security
QR check-in requires authenticated scanner AND valid event AND registered member.

### AC-M08-002: Capacity Management
When event reaches capacity, new registrations go to waitlist. Cancellation auto-promotes waitlisted.

### AC-M08-003: Paid Event Registration
Registration for paid event requires payment confirmation before status=confirmed.

## 12. Test Expectations

Required tests:
- Event CRUD: create, publish, cancel, complete state machine
- Registration: capacity enforcement, waitlisting, auto-promotion
- QR check-in: valid scan, invalid scan, duplicate scan, manual fallback
- Paid events: payment required, refund on cancellation
- Visibility: internal vs network access control

## 13. Edge Cases

- Event cancelled with 200 registered members: all notified, refunds processed.
- QR scan for member not registered: "Member not registered for this event."
- Duplicate QR scan: "Already checked in" (idempotent).
- Waitlisted member's spot opens but event is tomorrow: immediate notification.

## 14. Dependencies

### Internal Dependencies
- M05 (Membership — eligibility), M06 (Dues — fees/refunds), M07 (Communications — notifications)

### External Dependencies
- QR code generation library, camera API (for scanner)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Event full | Offer waitlist | "Event is full. Join the waitlist?" |
| QR scan invalid | Show error | "Invalid QR code." |
| Payment required but no gateway | Block registration | "Online payment unavailable. Contact treasurer." |

## 16. Performance Expectations

- Expected data volume: 50+ events per org per year, 200+ attendees per event
- Acceptable response times: Check-in < 1s, event list < 500ms
- Caching requirements: Event list cached, invalidated on publish/cancel

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| event.published | INFO | Event goes live | eventId, orgId, type | No |
| event.registration | INFO | Member registers | eventId, personId | No |
| event.checkin | INFO | Attendance recorded | eventId, personId, method | No |
| event.cancelled | WARN | Event cancelled | eventId, registrationCount | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| event_registrations_total | counter | status | Registration count |
| event_checkin_duration_seconds | histogram | method | Check-in speed |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| events_waitlist_enabled | release | true | Waitlist when full | — |
| events_qr_checkin | release | true | QR code check-in | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M08-S1 | Event CRUD | Create, edit, publish events | M04 | P0 |
| M08-S2 | Registration | Register + capacity management | M08-S1, M05 | P0 |
| M08-S3 | QR Check-In | Scanner + manual check-in | M08-S2 | P0 |
| M08-S4 | Paid Events | Fee collection via M06 | M08-S2, M06 | P1 |
| M08-S5 | Waitlisting | Auto-promote on cancellation | M08-S2 | P1 |
| M08-S6 | Event Analytics | Attendance stats | M08-S3 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
