<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts --- Membership (M05)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/members` |
| Auth default | GA (session cookie or Bearer token) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | All endpoints scoped by `organizationId` path param; session must have org membership |

---

## 2. Endpoints

### 2.1 Members

#### GET `/org/:organizationId/members`

**List members with computed status**

| Property | Value |
|----------|-------|
| Auth | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (R) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-030 |
| Business rules | BR-01, BR-02, BR-21 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Opaque cursor for pagination |
| limit | integer | NO | Page size (1-100, default 25) |
| status | string | NO | Filter by computed status: `active`, `gracePeriod`, `lapsed`, `suspended`, `removed`, `pendingPayment` |
| tierId | string | NO | Filter by membership tier UUID |
| search | string | NO | Full-text search on name, email, license number |
| sort | string | NO | Sort field: `joinedAt`, `name`, `duesExpiryDate`. Prefix `-` for descending |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "personId": "770e8400-e29b-41d4-a716-446655440000",
      "tierId": "880e8400-e29b-41d4-a716-446655440000",
      "tierName": "Regular",
      "duesExpiryDate": "2027-06-30",
      "computedStatus": "active",
      "joinedAt": "2025-01-15T08:00:00.000Z",
      "person": {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "firstName": "Maria",
        "lastName": "Santos",
        "email": "maria@example.com"
      }
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6IjU1MGU4NDAwIn0",
    "hasMore": true,
    "total": 342
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Membership ID |
| organizationId | string | NO | uuid | Organization ID |
| personId | string | NO | uuid | Person ID |
| tierId | string | NO | uuid | Membership tier ID |
| tierName | string | NO | -- | Tier display name |
| duesExpiryDate | string | NO | date | Dues expiry (YYYY-MM-DD) |
| computedStatus | string | NO | enum | Computed at query time per BR-01 |
| joinedAt | string | NO | date-time | ISO 8601 join timestamp |
| person | object | NO | -- | Embedded person summary |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-001 | 401 | Not authenticated |
| AUTH-003 | 403 | Not a member of this organization |

---

#### GET `/org/:organizationId/members/:memberId`

**Get member detail with full profile**

| Property | Value |
|----------|-------|
| Auth | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (own) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-030 |
| Business rules | BR-01, BR-02 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "tierId": "880e8400-e29b-41d4-a716-446655440000",
    "tierName": "Regular",
    "duesExpiryDate": "2027-06-30",
    "computedStatus": "active",
    "suspendedAt": null,
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2025-01-15T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "firstName": "Maria",
      "lastName": "Santos",
      "email": "maria@example.com",
      "licenseNumber": "0012345"
    },
    "statusHistory": [
      {
        "previousStatus": "pendingPayment",
        "newStatus": "active",
        "changedAt": "2025-01-20T10:00:00.000Z",
        "reason": "Payment confirmed"
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| suspendedAt | string | YES | date-time | Suspension timestamp |
| removedAt | string | YES | date-time | Removal timestamp (irreversible) |
| isPendingPayment | boolean | NO | -- | Awaiting initial payment |
| statusHistory | array | NO | -- | Status change audit trail |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Insufficient permissions |
| CORE-001 | 404 | Membership not found |

---

#### POST `/org/:organizationId/members`

**Manually add a member (officer action)**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-030 |
| Business rules | BR-22, BR-23, M5-R2, M5-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | NO | NO | uuid | Existing person ID (if known) | -- | "770e8400-..." |
| email | string | YES | NO | email | Max 255 chars | -- | "maria@example.com" |
| firstName | string | YES | NO | -- | Max 100 chars | -- | "Maria" |
| lastName | string | YES | NO | -- | Max 100 chars | -- | "Santos" |
| licenseNumber | string | YES | NO | -- | PRC format regex (BR-23) | -- | "0012345" |
| tierId | string | YES | NO | uuid | Must be active tier | -- | "880e8400-..." |
| joinedAt | string | NO | NO | date | ISO date | Today | "2025-01-15" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "tierId": "880e8400-e29b-41d4-a716-446655440000",
    "computedStatus": "pendingPayment",
    "joinedAt": "2025-01-15T00:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-001 | 409 | Person already has membership in this organization |
| M05-004 | 422 | Membership category not found or inactive |
| AUTH-003 | 403 | Insufficient permissions |
| VALIDATION-001 | 400 | Invalid license number format |

---

#### POST `/org/:organizationId/members/:memberId/transfer`

**Initiate inter-organization transfer**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-036 |
| Business rules | M5-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| targetOrganizationId | string | YES | NO | uuid | Must be different org in same association | -- | "990e8400-..." |
| reason | string | NO | YES | -- | Max 500 chars | -- | "Relocating to Manila chapter" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "membershipId": "550e8400-e29b-41d4-a716-446655440000",
    "sourceOrganizationId": "660e8400-e29b-41d4-a716-446655440000",
    "targetOrganizationId": "990e8400-e29b-41d4-a716-446655440000",
    "status": "pendingSourceApproval",
    "reason": "Relocating to Manila chapter",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Transfer ID |
| status | string | NO | enum | pendingSourceApproval / pendingTargetApproval / completed / rejected |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-007 | 422 | Transfer target organization not found |
| M05-008 | 422 | Transfer requires approval from both organizations |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.2 Applications

#### POST `/org/:organizationId/applications`

**Submit membership application (self-service)**

| Property | Value |
|----------|-------|
| Auth | user (any authenticated user) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-029 |
| Business rules | BR-22, BR-23, M5-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| applicantEmail | string | YES | NO | email | Max 255 chars | -- | "maria@example.com" |
| applicantLicenseNumber | string | YES | NO | -- | PRC format (BR-23) | -- | "0012345" |
| tierId | string | YES | NO | uuid | Must be active tier | -- | "880e8400-..." |
| firstName | string | YES | NO | -- | Max 100 chars | -- | "Maria" |
| lastName | string | YES | NO | -- | Max 100 chars | -- | "Santos" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "submitted",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-001 | 409 | Person already has membership in this organization |
| M05-003 | 422 | Membership application requires approval |
| M05-004 | 422 | Membership category not found or inactive |
| VALIDATION-001 | 400 | Invalid license number format |

---

#### PUT `/org/:organizationId/applications/:applicationId`

**Review application (approve/reject/request info)**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-029 |
| Business rules | BR-03, M5-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| status | string | YES | NO | enum | One of: `approved`, `denied`, `underReview` | -- | "approved" |
| reason | string | NO | YES | -- | Max 500 chars; required if denied | -- | "Welcome aboard" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "reviewedAt": "2026-05-21T11:00:00.000Z",
    "reviewedBy": "cc0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-002 | 422 | Invalid membership status transition |
| CORE-001 | 404 | Application not found |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.3 Bulk Import

#### POST `/org/:organizationId/members/import`

**Upload CSV for validation and preview**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Bulk operations (10 req/min) |
| Idempotency | Optional |
| Workflow | WF-031 |
| Business rules | BR-22, M5-R2, M5-R3, M5-R8 |

**Request Body** `multipart/form-data`

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| file | file | YES | NO | text/csv | Max 500 rows (M05-005), required columns: email, firstName, lastName, licenseNumber | -- | roster.csv |
| tierId | string | YES | NO | uuid | Default tier for imported members | -- | "880e8400-..." |

**Response** `200 OK`

```json
{
  "data": {
    "importJobId": "dd0e8400-e29b-41d4-a716-446655440000",
    "preview": {
      "totalRows": 150,
      "newMembers": 120,
      "linkedToExisting": 25,
      "invalidRows": 5,
      "errors": [
        {
          "row": 23,
          "field": "licenseNumber",
          "message": "Invalid PRC format"
        }
      ]
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| importJobId | string | NO | uuid | Job ID for confirmation step |
| preview.totalRows | integer | NO | -- | Total CSV rows parsed |
| preview.newMembers | integer | NO | -- | New members to create |
| preview.linkedToExisting | integer | NO | -- | Matched to existing persons |
| preview.invalidRows | integer | NO | -- | Rows with validation errors |
| preview.errors | array | NO | -- | Per-row error details |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-005 | 422 | Bulk import exceeds 500 row limit |
| M05-006 | 422 | CSV format invalid or missing required columns |
| AUTH-003 | 403 | Insufficient permissions |

---

#### POST `/org/:organizationId/members/import/confirm`

**Confirm and execute a validated import job**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Bulk operations (10 req/min) |
| Idempotency | Required |
| Workflow | WF-031 |
| Business rules | M5-R3, M5-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| importJobId | string | YES | NO | uuid | Must be a valid preview job | -- | "dd0e8400-..." |

**Response** `200 OK`

```json
{
  "data": {
    "succeeded": [
      { "id": "ee0e8400-...", "status": "created" }
    ],
    "failed": [
      {
        "index": 23,
        "input": { "email": "invalid@" },
        "error": { "code": "VALIDATION-001", "message": "Invalid email format" }
      }
    ],
    "summary": {
      "total": 150,
      "succeeded": 145,
      "failed": 5
    }
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| CORE-001 | 404 | Import job not found or expired |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.4 Member Directory

#### GET `/org/:organizationId/directory`

**Privacy-filtered searchable member directory**

| Property | Value |
|----------|-------|
| Auth | All org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-034 |
| Business rules | BR-06, M05-010 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| search | string | NO | Search by name |

**Response** `200 OK`

```json
{
  "data": [
    {
      "personId": "770e8400-e29b-41d4-a716-446655440000",
      "firstName": "Maria",
      "lastName": "Santos",
      "tierName": "Regular",
      "computedStatus": "active"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6IjU1MGU4NDAwIn0",
    "hasMore": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| personId | string | NO | uuid | Person ID |
| firstName | string | NO | -- | First name |
| lastName | string | NO | -- | Last name |
| tierName | string | NO | -- | Membership tier name |
| computedStatus | string | NO | enum | Computed membership status |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-010 | 422 | Member directory listing requires consent |
| AUTH-003 | 403 | Not a member of this organization |

---

### 2.5 Membership Categories

#### GET `/org/:organizationId/membership-categories`

**List membership tiers/categories for the organization**

| Property | Value |
|----------|-------|
| Auth | All org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-033 |
| Business rules | BR-04 |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Regular",
      "duesAmount": "5000.00",
      "billingCycle": "annual",
      "status": "active"
    }
  ]
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Category/tier ID |
| name | string | NO | -- | Category name |
| duesAmount | string | NO | decimal | Dues amount for this tier |
| billingCycle | string | NO | enum | annual / semi-annual / quarterly |
| status | string | NO | enum | active / retired |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Not a member of this organization |

---

#### POST `/org/:organizationId/membership-categories`

**Create a membership tier/category**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-033 |
| Business rules | BR-04 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | -- | Max 100 chars | -- | "Life Member" |
| duesAmount | string | YES | NO | decimal | Positive decimal | -- | "10000.00" |
| billingCycle | string | YES | NO | enum | annual / semi-annual / quarterly | -- | "annual" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Life Member",
    "duesAmount": "10000.00",
    "billingCycle": "annual",
    "status": "active"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| VALIDATION-001 | 400 | Invalid input |
| AUTH-003 | 403 | Insufficient permissions |

---

#### PATCH `/org/:organizationId/membership-categories/:categoryId`

**Update a membership tier/category**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), secretary (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-033 |
| Business rules | BR-04 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | NO | NO | -- | Max 100 chars | -- | "Senior Regular" |
| duesAmount | string | NO | NO | decimal | Positive decimal | -- | "6000.00" |
| billingCycle | string | NO | NO | enum | annual / semi-annual / quarterly | -- | "annual" |
| status | string | NO | NO | enum | active / retired | -- | "retired" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "name": "Senior Regular",
    "duesAmount": "6000.00",
    "billingCycle": "annual",
    "status": "active"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M05-004 | 422 | Cannot retire category with assigned active members |
| CORE-001 | 404 | Category not found |
| AUTH-003 | 403 | Insufficient permissions |

---

## 3. Domain Events Published

| Event Name | Trigger | Payload Fields |
|------------|---------|----------------|
| MembershipApproved | Application approved | orgId, personId, tierId |
| MembershipSuspended | Officer suspension | orgId, personId |
| MembershipStatusChanged | Status recomputed | orgId, personId, oldStatus, newStatus |
| MembershipResigned | Voluntary resignation | orgId, personId |
| MembershipDeceased | Deceased marking | orgId, personId |
| MemberImported | Bulk import completed | orgId, importedCount, linkedCount, skippedCount |

## 4. Domain Events Consumed

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| PaymentRecorded | M06 | Update dues_expiry_date; status recomputes to Active |
| PaymentRefunded | M06 | Reverse dues_expiry_date extension; status may revert |
| MemberSuspended | M04 | Set suspendedAt timestamp; access revoked |
| MemberRemoved | M04 | Set removedAt timestamp; org membership terminated |

## 5. Shared Types

### ComputedMembershipStatus (enum)

Values: `active`, `gracePeriod`, `lapsed`, `suspended`, `removed`, `pendingPayment`, `deceased`, `resigned`

Priority (highest wins per BR-01): removed > deceased > suspended > resigned > pendingPayment > active > gracePeriod > lapsed

### ApplicationStatus (enum)

Values: `submitted`, `underReview`, `approved`, `denied`, `waitlisted`

### TransferStatus (enum)

Values: `pendingSourceApproval`, `pendingTargetApproval`, `completed`, `rejected`
