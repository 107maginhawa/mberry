<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts --- Events (M08)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/events`, `/my/events` |
| Auth default | GA for reads; GA+HG for officer mutations |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | All org endpoints scoped by `organizationId`; event visibility controls cross-org access (BR-16, M8-R4) |

---

## 2. Endpoints

### 2.1 Events

#### GET `/org/:organizationId/events`

**List organization events**

| Property | Value |
|----------|-------|
| Auth | All authenticated |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-051 |
| Business rules | BR-16, M8-R4 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| status | string | NO | Filter by status: `draft`, `published`, `cancelled`, `completed` |
| eventType | string | NO | Filter by event type enum |
| visibility | string | NO | Filter: `internal`, `network` |
| from | string | NO | Events starting after this date (ISO date-time) |
| to | string | NO | Events starting before this date (ISO date-time) |
| sort | string | NO | Sort field: `startDate`, `createdAt`, `title`. Prefix `-` for descending |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "title": "Annual General Assembly 2026",
      "eventType": "generalAssembly",
      "status": "published",
      "visibility": "internal",
      "startDate": "2026-07-15T09:00:00.000Z",
      "endDate": "2026-07-15T17:00:00.000Z",
      "location": "Manila Hotel Grand Ballroom",
      "capacityLimit": 500,
      "feeAmount": "2500",
      "currency": "PHP",
      "registrationCount": 342,
      "waitlistCount": 0
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFhMGU4NDAwIn0",
    "hasMore": true,
    "total": 12
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Event ID |
| organizationId | string | NO | uuid | Organization ID |
| title | string | NO | -- | Event name (max 300 chars) |
| eventType | string | NO | enum | Event type classification |
| status | string | NO | enum | draft / published / cancelled / completed |
| visibility | string | NO | enum | internal / network |
| startDate | string | NO | date-time | Event start |
| endDate | string | NO | date-time | Event end (must be after start) |
| location | string | YES | -- | Venue or online link |
| capacityLimit | integer | YES | -- | Max attendees (null = unlimited) |
| feeAmount | string | YES | -- | Registration fee (null = free) |
| currency | string | YES | -- | Fee currency (default PHP) |
| registrationCount | integer | NO | -- | Current confirmed registrations |
| waitlistCount | integer | NO | -- | Current waitlist size |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-001 | 401 | Not authenticated |

---

#### POST `/org/:organizationId/events`

**Create a new event (draft)**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-051 |
| Business rules | BR-16, M8-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | YES | NO | -- | Max 300 chars | -- | "Annual General Assembly 2026" |
| description | string | NO | YES | -- | Rich text HTML | -- | "<p>Join us for...</p>" |
| eventType | string | YES | NO | enum | generalAssembly / inductionCeremony / fellowship / medicalMission / boardMeeting / committeeMeeting / fundraiser / other | -- | "generalAssembly" |
| visibility | string | NO | NO | enum | internal / network | "internal" | "internal" |
| startDate | string | YES | NO | date-time | Must be in the future | -- | "2026-07-15T09:00:00.000Z" |
| endDate | string | YES | NO | date-time | Must be after startDate | -- | "2026-07-15T17:00:00.000Z" |
| location | string | NO | YES | -- | Max 500 chars | -- | "Manila Hotel Grand Ballroom" |
| coverImage | string | NO | YES | url | Storage URL from M15 | -- | "https://cdn.example.com/img.jpg" |
| capacityLimit | integer | NO | YES | -- | Positive integer; null = unlimited | null | 500 |
| feeAmount | string | NO | YES | decimal | Positive decimal; null = free | "0" | "2500.00" |
| currency | string | NO | NO | ISO 4217 | 3-letter code | "PHP" | "PHP" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Annual General Assembly 2026",
    "eventType": "generalAssembly",
    "status": "draft",
    "visibility": "internal",
    "startDate": "2026-07-15T09:00:00.000Z",
    "endDate": "2026-07-15T17:00:00.000Z",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-003 | 422 | Event date must be in the future |
| AUTH-003 | 403 | Not an officer of this organization |
| VALIDATION-001 | 400 | Invalid input |

---

#### PUT `/org/:organizationId/events/:eventId`

**Update event details**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-051 |
| Business rules | M8-R6, M08-011 |

**Request Body**

Same fields as POST (all optional for partial update).

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | NO | NO | -- | Max 300 chars | -- | "Updated Title" |
| description | string | NO | YES | -- | Rich text HTML | -- | "<p>Updated...</p>" |
| eventType | string | NO | NO | enum | See POST | -- | "fellowship" |
| visibility | string | NO | NO | enum | internal / network | -- | "network" |
| startDate | string | NO | NO | date-time | Must be in the future | -- | "2026-08-01T09:00:00.000Z" |
| endDate | string | NO | NO | date-time | Must be after startDate | -- | "2026-08-01T17:00:00.000Z" |
| location | string | NO | YES | -- | Max 500 chars | -- | "New venue" |
| coverImage | string | NO | YES | url | -- | -- | -- |
| capacityLimit | integer | NO | YES | -- | Positive integer | -- | 600 |
| feeAmount | string | NO | YES | decimal | -- | -- | "3000.00" |
| currency | string | NO | NO | ISO 4217 | -- | -- | "PHP" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "title": "Updated Title",
    "status": "draft",
    "updatedAt": "2026-05-21T11:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-006 | 422 | Invalid event status transition |
| M08-011 | 422 | Cannot modify past event |
| M08-003 | 422 | Event date must be in the future |
| CORE-001 | 404 | Event not found |
| AUTH-003 | 403 | Insufficient permissions |

---

#### PUT `/org/:organizationId/events/:eventId/publish`

**Publish event (make visible to members)**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-051 |
| Business rules | M8-R4 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "status": "published",
    "publishedAt": "2026-05-21T11:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-006 | 422 | Invalid event status transition (must be draft) |
| VALIDATION-001 | 400 | Incomplete required fields (title, dates, type) |
| CORE-001 | 404 | Event not found |
| AUTH-003 | 403 | Insufficient permissions |

---

#### PUT `/org/:organizationId/events/:eventId/cancel`

**Cancel event**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-051 |
| Business rules | M8-R3 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "status": "cancelled",
    "cancelledAt": "2026-05-21T12:00:00.000Z",
    "affectedRegistrations": 342
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| affectedRegistrations | integer | NO | -- | Registrations that will be notified/refunded |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-004 | 422 | Cannot cancel event with confirmed registrations without refund plan |
| M08-006 | 422 | Invalid event status transition (cannot cancel completed) |
| CORE-001 | 404 | Event not found |
| AUTH-003 | 403 | Insufficient permissions |

---

#### PUT `/org/:organizationId/events/:eventId/complete`

**Mark event as completed**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-051 |
| Business rules | M8-R6 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "completedAt": "2026-07-15T18:00:00.000Z",
    "attendeeCount": 320,
    "noShowCount": 22
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| attendeeCount | integer | NO | -- | Members who checked in |
| noShowCount | integer | NO | -- | Confirmed but did not attend |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-006 | 422 | Invalid event status transition (must be published) |
| CORE-001 | 404 | Event not found |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.2 Registration

#### POST `/org/:organizationId/events/:eventId/register`

**Register a member for an event**

| Property | Value |
|----------|-------|
| Auth | All authenticated |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-052 |
| Business rules | BR-27, M8-R1, M8-R2, M8-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Must be self or admin acting on behalf | -- | "770e8400-..." |

**Response** `201 Created`

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "status": "confirmed",
    "registeredAt": "2026-05-21T10:00:00.000Z",
    "waitlistPosition": null
  }
}
```

If at capacity (waitlisted):

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "status": "waitlisted",
    "registeredAt": "2026-05-21T10:00:00.000Z",
    "waitlistPosition": 3
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Registration ID |
| eventId | string | NO | uuid | Event ID |
| personId | string | NO | uuid | Person ID |
| status | string | NO | enum | confirmed / waitlisted |
| registeredAt | string | NO | date-time | Registration timestamp |
| waitlistPosition | integer | YES | -- | Position in waitlist (null if confirmed) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-001 | 422 | Event at full capacity (when waitlist disabled) |
| M08-002 | 422 | Registration deadline passed |
| M08-005 | 422 | Already registered for this event |
| M08-006 | 422 | Event not in published status |
| CORE-001 | 404 | Event not found |
| AUTH-001 | 401 | Not authenticated |

---

#### DELETE `/org/:organizationId/events/:eventId/register/:registrationId`

**Cancel a registration**

| Property | Value |
|----------|-------|
| Auth | Self (own registration) or officer |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-052 |
| Business rules | M8-R5, M8-R6 |

**Response** `204 No Content`

No response body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-006 | 422 | Event already completed --- registrations locked (M8-R6) |
| CORE-001 | 404 | Registration not found |
| AUTH-003 | 403 | Not authorized to cancel this registration |

---

#### GET `/my/events`

**List authenticated user's event registrations**

| Property | Value |
|----------|-------|
| Auth | All authenticated |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-052 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| status | string | NO | Filter by registration status |
| upcoming | boolean | NO | Only future events (default true) |

**Response** `200 OK`

```json
{
  "data": [
    {
      "registrationId": "bb0e8400-e29b-41d4-a716-446655440000",
      "status": "confirmed",
      "registeredAt": "2026-05-21T10:00:00.000Z",
      "event": {
        "id": "aa0e8400-e29b-41d4-a716-446655440000",
        "title": "Annual General Assembly 2026",
        "eventType": "generalAssembly",
        "startDate": "2026-07-15T09:00:00.000Z",
        "endDate": "2026-07-15T17:00:00.000Z",
        "location": "Manila Hotel Grand Ballroom",
        "organizationName": "PDA Manila Chapter"
      }
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImJiMGU4NDAwIn0",
    "hasMore": false
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-001 | 401 | Not authenticated |

---

### 2.3 Check-In

#### POST `/org/:organizationId/events/:eventId/checkin`

**Check in an attendee (officer action)**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional (idempotent by personId+eventId) |
| Workflow | WF-053 |
| Business rules | BR-17, BR-18, M8-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Must be registered for event | -- | "770e8400-..." |
| method | string | YES | NO | enum | qr / manual | -- | "qr" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "cc0e8400-e29b-41d4-a716-446655440000",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "method": "qr",
    "checkedInBy": "dd0e8400-e29b-41d4-a716-446655440000",
    "checkedInAt": "2026-07-15T09:15:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Check-in ID |
| method | string | NO | enum | qr / manual |
| checkedInBy | string | NO | uuid | Officer who performed check-in |
| checkedInAt | string | NO | date-time | Check-in timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M08-007 | 422 | Check-in code invalid or expired |
| M08-005 | 422 | Person not registered for this event |
| M08-006 | 422 | Event completed --- check-ins locked (M8-R6) |
| AUTH-003 | 403 | Not an officer (BR-17) |
| CORE-001 | 404 | Event not found |

---

#### GET `/org/:organizationId/events/:eventId/attendees`

**List attendees with check-in status**

| Property | Value |
|----------|-------|
| Auth | president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-053 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| checkedIn | boolean | NO | Filter: true = checked in, false = not checked in |
| status | string | NO | Filter by registration status |

**Response** `200 OK`

```json
{
  "data": [
    {
      "registrationId": "bb0e8400-e29b-41d4-a716-446655440000",
      "personId": "770e8400-e29b-41d4-a716-446655440000",
      "personName": "Maria Santos",
      "registrationStatus": "confirmed",
      "checkedIn": true,
      "checkInMethod": "qr",
      "checkedInAt": "2026-07-15T09:15:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImJiMGU4NDAwIn0",
    "hasMore": true,
    "total": 342
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| registrationId | string | NO | uuid | Registration ID |
| personId | string | NO | uuid | Person ID |
| personName | string | NO | -- | Attendee name |
| registrationStatus | string | NO | enum | confirmed / waitlisted / cancelled / noShow |
| checkedIn | boolean | NO | -- | Whether attendee checked in |
| checkInMethod | string | YES | enum | qr / manual (null if not checked in) |
| checkedInAt | string | YES | date-time | Check-in time (null if not checked in) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| CORE-001 | 404 | Event not found |
| AUTH-003 | 403 | Insufficient permissions |

---

## 3. Domain Events Published

| Event Name | Trigger | Payload Fields |
|------------|---------|----------------|
| EventPublished | Event status changed to published | orgId, eventId, title, startDate, visibility |
| EventCancelled | Event cancelled | orgId, eventId, title, affectedRegistrations |
| EventCompleted | Event marked completed | orgId, eventId, attendeeCount |
| RegistrationConfirmed | Registration confirmed (direct or waitlist promotion) | orgId, eventId, personId |
| AttendanceConfirmed | Check-in recorded | orgId, eventId, personId, method |

## 4. Domain Events Consumed

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| PaymentRecorded | M06 | Confirm paid registration (status -> confirmed) |
| RefundCompleted | M06 | Update registration (status -> refunded) |

## 5. Shared Types

### EventType (enum)

Values: `generalAssembly`, `inductionCeremony`, `fellowship`, `medicalMission`, `boardMeeting`, `committeeMeeting`, `fundraiser`, `other`

### EventStatus (enum)

Values: `draft`, `published`, `cancelled`, `completed`

State machine:
- draft -> published
- published -> cancelled
- published -> completed
- No other transitions allowed (M08-006)

### EventVisibility (enum)

Values: `internal`, `network`

Default: `internal` (BR-16). Internal = org members only. Network = association-wide.

### RegistrationStatus (enum)

Values: `confirmed`, `waitlisted`, `cancelled`, `refunded`, `noShow`

### CheckInMethod (enum)

Values: `qr`, `manual`

QR check-in requires authenticated scanner + valid event + registered member (BR-18).
