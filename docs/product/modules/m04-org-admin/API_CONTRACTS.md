<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Organization Admin (M04)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org` |
| Auth default | GA + OA (session + officer auth middleware) for mutations; GA for reads; public for public page |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Organization-scoped via `:id` path parameter from session context |

---

## 2. Endpoints

### 2.1 Organization Profile

#### GET `/org/:id`

**Get organization profile and settings**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated org members) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-024 |
| Business rules | — |

**Response** `200 OK`

```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "associationId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PDA NCR Chapter",
    "slug": "pda-ncr",
    "orgType": "chapter",
    "status": "active",
    "description": "National Capital Region chapter of the Philippine Dental Association",
    "logoUrl": "https://storage.example.com/logos/pda-ncr.svg",
    "contactEmail": "info@pdancr.org",
    "meetingSchedule": "Every 2nd Tuesday, 7PM",
    "foundingDate": "2010-03-15",
    "featureFlags": {
      "M08": true,
      "M12": false
    },
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Organization ID |
| associationId | string | NO | uuid | Parent association ID |
| name | string | NO | — | Org name (2-100 chars) |
| slug | string | NO | — | URL-friendly slug |
| orgType | string | NO | enum | `chapter`, `society`, `national`, `clinic` |
| status | string | NO | enum | `trial`, `active`, `suspended`, `cancelled` |
| description | string | YES | — | Org description (max 2000 chars) |
| logoUrl | string | YES | uri | Logo image URL |
| contactEmail | string | YES | email | Contact email |
| meetingSchedule | string | YES | — | Free text schedule |
| foundingDate | string | YES | date | Founding date (not future) |
| featureFlags | object | YES | — | JSONB quick-check flags |
| createdAt | string | NO | date-time | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 403 | Not a member of this organization |
| — | 404 | Organization not found |

---

#### PUT `/org/:id`

**Update organization profile, logo, and branding**

| Property | Value |
|----------|-------|
| Auth | GA + HG (super, admin, president with 2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-024 |
| Business rules | M4-R5, M4-R6, BR-29, BR-31 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | NO | NO | — | 2-100 chars | — | `"PDA NCR Chapter"` |
| description | string | NO | YES | — | max 2000 chars | — | `"NCR chapter..."` |
| logoUrl | string | NO | YES | uri | SVG sanitized per BR-31 | — | `"https://..."` |
| contactEmail | string | NO | YES | email | Standard validation | — | `"info@pdancr.org"` |
| meetingSchedule | string | NO | YES | — | Free text | — | `"Every 2nd Tuesday"` |
| foundingDate | string | NO | YES | date | Must not be future | — | `"2010-03-15"` |

**Response** `200 OK`

```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "PDA NCR Chapter",
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Organization ID |
| name | string | NO | — | Updated name |
| updatedAt | string | NO | date-time | Update timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M04-003 | 422 | Invalid organization settings value |
| M04-004 | 422 | Cannot change org type after creation |
| — | 403 | Not authorized (not president/admin) |
| — | 400 | Validation error |

---

### 2.2 Public Page

#### GET `/org/:slug/public`

**Get organization public page data (no auth required)**

| Property | Value |
|----------|-------|
| Auth | Public (no auth required) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-028 |
| Business rules | BR-29 |

**Response** `200 OK`

```json
{
  "data": {
    "name": "PDA NCR Chapter",
    "slug": "pda-ncr",
    "orgType": "chapter",
    "description": "National Capital Region chapter of the Philippine Dental Association",
    "logoUrl": "https://storage.example.com/logos/pda-ncr.svg",
    "contactEmail": "info@pdancr.org",
    "meetingSchedule": "Every 2nd Tuesday, 7PM",
    "foundingDate": "2010-03-15",
    "memberCount": 156,
    "associationName": "Philippine Dental Association"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| name | string | NO | — | Org display name |
| slug | string | NO | — | URL slug |
| orgType | string | NO | enum | Organization type |
| description | string | YES | — | Public description |
| logoUrl | string | YES | uri | Logo URL |
| contactEmail | string | YES | email | Public contact email |
| meetingSchedule | string | YES | — | Schedule text |
| foundingDate | string | YES | date | Founding date |
| memberCount | integer | NO | — | Active member count |
| associationName | string | NO | — | Parent association name |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | Organization not found or public page disabled |

---

### 2.3 Officers

#### POST `/org/:id/officers`

**Assign an officer role to a member**

| Property | Value |
|----------|-------|
| Auth | GA + HG (president with 2FA; super, admin for president reassignment per BR-09e) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-025 |
| Business rules | BR-09, BR-09e, M4-R1, M4-R2, M4-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Must be an active member of this org | — | `"550e8400-..."` |
| positionId | string | YES | NO | uuid | Target position | — | `"bb0e8400-..."` |
| startDate | string | NO | NO | date | Defaults to today | today | `"2026-06-01"` |
| endDate | string | NO | YES | date | Optional term end | — | `"2027-05-31"` |

**Response** `201 Created`

```json
{
  "data": {
    "id": "cc0e8400-e29b-41d4-a716-446655440000",
    "positionId": "bb0e8400-e29b-41d4-a716-446655440000",
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "startDate": "2026-06-01",
    "endDate": "2027-05-31",
    "assignedBy": "dd0e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | OfficerTerm ID |
| positionId | string | NO | uuid | Position ID |
| personId | string | NO | uuid | Assigned person |
| organizationId | string | NO | uuid | Organization |
| status | string | NO | enum | `upcoming`, `active`, `completed`, `resigned`, `removed` |
| startDate | string | NO | date | Term start |
| endDate | string | YES | date | Term end |
| assignedBy | string | NO | uuid | Person who assigned |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M04-001 | 422 | Cannot remove last officer from organization |
| M04-002 | 422 | Officer position already filled (except Board Member per M4-R1) |
| — | 403 | Not president (M4-R2) or not admin for president reassignment (BR-09e) |
| — | 404 | Person or position not found |

---

#### DELETE `/org/:id/officers/:termId`

**Remove an officer from their role**

| Property | Value |
|----------|-------|
| Auth | GA + HG (president with 2FA; super, admin) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-025 |
| Business rules | BR-09, M4-R2, M4-R6 |

**Response** `204 No Content`

No response body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M04-001 | 422 | Cannot remove last officer from organization |
| — | 403 | Not authorized |
| — | 404 | Officer term not found |

---

### 2.4 Officer Transition

#### POST `/org/:id/officers/:termId/transition`

**Start officer handover with role-specific transition checklist**

| Property | Value |
|----------|-------|
| Auth | GA + HG (president with 2FA; super, admin) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-025 |
| Business rules | M4-R3, M4-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| incomingPersonId | string | YES | NO | uuid | Must be active member, not already in this role | — | `"ee0e8400-..."` |

**Response** `201 Created`

```json
{
  "data": {
    "officerTermId": "cc0e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "checklist": {
      "items": [
        {
          "id": "item-1",
          "label": "Transfer financial records",
          "completed": false
        },
        {
          "id": "item-2",
          "label": "Update bank signatories",
          "completed": false
        },
        {
          "id": "item-3",
          "label": "Hand over credentials",
          "completed": false
        }
      ]
    },
    "incomingPerson": {
      "id": "ee0e8400-e29b-41d4-a716-446655440000",
      "firstName": "Juan",
      "lastName": "Cruz"
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| officerTermId | string | NO | uuid | Outgoing officer term |
| status | string | NO | enum | `pending` or `completed` |
| checklist.items | array | NO | — | Role-specific checklist (auto-generated per M4-R3) |
| checklist.items[].id | string | NO | — | Checklist item ID |
| checklist.items[].label | string | NO | — | Checklist item description |
| checklist.items[].completed | boolean | NO | — | Completion status |
| incomingPerson.id | string | NO | uuid | Incoming officer |
| incomingPerson.firstName | string | NO | — | First name |
| incomingPerson.lastName | string | YES | — | Last name |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M04-002 | 422 | Incoming person already holds this position |
| — | 403 | Not authorized |
| — | 404 | Officer term or incoming person not found |

---

### 2.5 Disciplinary Actions

#### POST `/org/:id/discipline`

**Take disciplinary action against a member**

| Property | Value |
|----------|-------|
| Auth | GA + HG (super, admin, president with 2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-026 |
| Business rules | M4-R4, M4-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Member of this org | — | `"550e8400-..."` |
| actionType | string | YES | NO | enum | `warning`, `probation`, `suspension`, `removal` | — | `"suspension"` |
| reason | string | YES | NO | — | Non-empty, immutable after creation (M4-R4) | — | `"Violation of code of ethics"` |
| duration | integer | NO | YES | — | Days (for suspension/probation) | — | `90` |

**Response** `201 Created`

```json
{
  "data": {
    "id": "ff0e8400-e29b-41d4-a716-446655440000",
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "actionType": "suspension",
    "reason": "Violation of code of ethics",
    "duration": 90,
    "issuedBy": "dd0e8400-e29b-41d4-a716-446655440000",
    "issuedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Disciplinary action ID |
| personId | string | NO | uuid | Target member |
| organizationId | string | NO | uuid | Organization |
| actionType | string | NO | enum | Action type |
| reason | string | NO | — | Mandatory reason (immutable) |
| duration | integer | YES | — | Duration in days (if applicable) |
| issuedBy | string | NO | uuid | Officer who issued |
| issuedAt | string | NO | date-time | Issue timestamp |

Action type effects:
- `warning`: No access change, recorded in audit trail
- `probation`: Restricted features for duration
- `suspension`: Lose org features for duration
- `removal`: Terminate membership permanently

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M04-005 | 422 | Organization billing not configured |
| M04-003 | 404 | Member not found in organization |
| — | 400 | Empty reason (M4-R4) |
| — | 403 | Not authorized (not president/admin) |

---

### 2.6 Dashboard

#### GET `/org/:id/dashboard`

**Get organization dashboard metrics and smart action cards**

| Property | Value |
|----------|-------|
| Auth | GA + OA (officers and above) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-027 |
| Business rules | — |

**Response** `200 OK`

```json
{
  "data": {
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "organizationName": "PDA NCR Chapter",
    "activeMemberCount": 156,
    "pendingApplications": 3,
    "duesCollectionRate": 0.85,
    "upcomingEvents": 2,
    "expiringMemberships": 12,
    "officers": [
      {
        "positionName": "President",
        "personName": "Dr. Maria Santos",
        "termEnd": "2027-05-31"
      }
    ],
    "actionCards": [
      {
        "type": "dues_reminder",
        "title": "12 memberships expiring this month",
        "priority": "high",
        "actionUrl": "/org/660e8400.../members?filter[status]=expiring"
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| organizationId | string | NO | uuid | Org ID |
| organizationName | string | NO | — | Org name |
| activeMemberCount | integer | NO | — | Active members |
| pendingApplications | integer | NO | — | Pending membership applications |
| duesCollectionRate | number | NO | decimal | Percentage (0-1) |
| upcomingEvents | integer | NO | — | Events in next 30 days |
| expiringMemberships | integer | NO | — | Memberships expiring in 30 days |
| officers | array | NO | — | Current officer roster |
| officers[].positionName | string | NO | — | Position title |
| officers[].personName | string | NO | — | Officer display name |
| officers[].termEnd | string | YES | date | Term end date |
| actionCards | array | NO | — | Smart action suggestions |
| actionCards[].type | string | NO | — | Card type identifier |
| actionCards[].title | string | NO | — | Human-readable title |
| actionCards[].priority | string | NO | enum | `high`, `medium`, `low` |
| actionCards[].actionUrl | string | NO | — | Deep link to relevant page |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 403 | Not an officer of this organization |
| — | 404 | Organization not found |

---

## 3. Domain Events

### Published Events

| Event Name | Trigger Endpoint | Payload |
|------------|-----------------|---------|
| OfficerAssigned | `POST /org/:id/officers` | `{ orgId, personId, positionId }` |
| OfficerRemoved | `DELETE /org/:id/officers/:termId` | `{ orgId, personId, positionId }` |
| OfficerTransitioned | `POST /org/:id/officers/:termId/transition` (on completion) | `{ orgId, positionId, outgoingPersonId, incomingPersonId }` |
| MemberSuspended | `POST /org/:id/discipline` (actionType=suspension) | `{ orgId, personId, reason }` |
| MemberRemoved | `POST /org/:id/discipline` (actionType=removal) | `{ orgId, personId, reason }` |

### Consumed Events

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| ElectionPublished | M12 | Trigger officer transition from election results |
| OrganizationCreated | M03 | Initialize org dashboard, create default positions |

---

## 4. Entity Summary

| Entity | Primary Key | Unique Constraints | Notes |
|--------|------------|-------------------|-------|
| Organization | `id` (uuid) | `slug` (global), `(associationId, name)` | Shared with M03 (M03 creates, M04 manages) |
| Position | `id` (uuid) | `(organizationId, name)` | Default positions auto-created |
| OfficerTerm | `id` (uuid) | `(positionId, status=active)` for non-board roles | One active per position (except Board Member) |
| TransitionChecklist | `officerTermId` (FK) | — | Role-specific auto-generated items |
| DisciplinaryAction | `id` (uuid) | — | Immutable after creation |
