<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Training (M09)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/trainings` |
| Auth default | GA + HG (officer-gated mutations; GA for member reads) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Implicit `associationId` from session; `organizationId` as path param |

---

## 2. Endpoints

### 2.1 Trainings

#### GET `/org/:organizationId/trainings`

**List trainings for an organization**

| Property | Value |
|----------|-------|
| Auth | GA — all authenticated users |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-058: Create & Publish Training |
| Business rules | M9-R6 (network-wide visibility default) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | Comma-separated: `draft,published,cancelled,completed` |
| `filter[trainingType]` | string | NO | Comma-separated: `seminar,workshop,convention,onlineCourse,skillsTraining` |
| `filter[startDate][gte]` | string | NO | ISO 8601 date — trainings starting on or after |
| `filter[startDate][lt]` | string | NO | ISO 8601 date — trainings starting before |
| `search` | string | NO | Full-text search on title, description, instructorName |
| `sort` | string | NO | Default: `-startDate`. Allowed: `startDate`, `title`, `createdAt` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "title": "CPD Seminar on Oral Surgery",
      "description": "Advanced techniques...",
      "trainingType": "seminar",
      "status": "published",
      "instructorName": "Dr. Maria Santos",
      "instructorId": "uuid",
      "location": "PDA Conference Hall, Manila",
      "startDate": "2026-06-15T09:00:00.000Z",
      "endDate": "2026-06-15T17:00:00.000Z",
      "capacity": 100,
      "enrollmentCount": 45,
      "registrationFee": 250000,
      "currency": "PHP",
      "creditBearing": true,
      "creditAmount": 8,
      "accreditedProviderId": "uuid",
      "createdAt": "2026-05-21T10:00:00.000Z",
      "updatedAt": "2026-05-21T10:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": true,
    "total": 42
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Training ID |
| organizationId | string | NO | uuid | Owning organization |
| title | string | NO | — | Training name (max 300) |
| description | string | YES | — | Rich text description |
| trainingType | string | NO | enum | `seminar`, `workshop`, `convention`, `onlineCourse`, `skillsTraining` |
| status | string | NO | enum | `draft`, `published`, `cancelled`, `completed` |
| instructorName | string | YES | — | Instructor display name |
| instructorId | string | YES | uuid | Instructor person FK |
| location | string | YES | — | Venue or online link |
| startDate | string | NO | ISO 8601 | Training start datetime |
| endDate | string | NO | ISO 8601 | Training end datetime |
| capacity | number | YES | integer | Max enrollments (null = unlimited) |
| enrollmentCount | number | NO | integer | Current enrollment count |
| registrationFee | number | NO | bigint | Fee in smallest currency unit (default 0) |
| currency | string | NO | — | Currency code (default `PHP`) |
| creditBearing | boolean | NO | — | Whether training awards credits |
| creditAmount | number | NO | integer | CPD credits awarded (0 if non-credit-bearing) |
| accreditedProviderId | string | YES | uuid | Accredited provider FK |
| createdAt | string | NO | ISO 8601 | Creation timestamp |
| updatedAt | string | NO | ISO 8601 | Last modified timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |

---

#### POST `/org/:organizationId/trainings`

**Create a new training**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-058: Create & Publish Training |
| Business rules | M9-R1 (5 platform types), BR-15 (credit-bearing enforcement) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | YES | NO | — | max 300 chars | — | "CPD Seminar on Oral Surgery" |
| trainingType | string | YES | NO | enum | `seminar`, `workshop`, `convention`, `onlineCourse`, `skillsTraining` | — | "seminar" |
| description | string | NO | YES | — | rich text | — | "Advanced techniques..." |
| instructorName | string | NO | YES | — | max 200 chars | — | "Dr. Maria Santos" |
| instructorId | string | NO | YES | uuid | valid person UUID | — | "550e8400-..." |
| location | string | NO | YES | — | max 500 chars | — | "PDA Conference Hall" |
| startDate | string | YES | NO | ISO 8601 | must be in the future | — | "2026-06-15T09:00:00.000Z" |
| endDate | string | YES | NO | ISO 8601 | must be after startDate | — | "2026-06-15T17:00:00.000Z" |
| capacity | number | NO | YES | integer | positive integer | null | 100 |
| registrationFee | number | NO | NO | bigint | >= 0 | 0 | 250000 |
| currency | string | NO | NO | — | ISO 4217 | "PHP" | "PHP" |
| creditBearing | boolean | NO | NO | — | — | false | true |
| creditAmount | number | NO | NO | integer | >= 0; must be > 0 if creditBearing=true | 0 | 8 |
| accreditedProviderId | string | NO | YES | uuid | valid provider UUID | — | "550e8400-..." |
| isNonCreditBearing | boolean | NO | NO | — | if true, creditAmount=0 allowed | false | false |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "status": "draft",
    "...": "full training object"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `AUTHZ-007` | 403 | Minimum org role not met |
| `VALIDATION-001` | 400 | Invalid request body |
| `M09-005` | 422 | Credit hours must be non-negative (BR-18) |
| `M09-009` | 422 | Non-credit-bearing flag mismatch with creditAmount |
| `M09-006` | 422 | Accredited provider not found or inactive |

---

#### PUT `/org/:organizationId/trainings/:trainingId`

**Update training details**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-058: Create & Publish Training |
| Business rules | M9-R3 (post-completion lock) |

**Request Body**

Same fields as POST (all optional for partial update). Only `draft` and `published` trainings may be updated.

**Response** `200 OK`

```json
{
  "data": { "...": "full training object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Training not found |
| `M09-004` | 422 | Invalid training status transition (training completed/cancelled) |
| `CONFLICT-001` | 412 | ETag mismatch |

---

#### PUT `/org/:organizationId/trainings/:trainingId/publish`

**Publish a draft training**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-058: Create & Publish Training |
| Business rules | — |

**Request Body** — None

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "published", "...": "full training object" }
}
```

**Side Effects**
- Emits `TrainingPublished` event
- Triggers M07 notification to eligible members

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Training not found |
| `M09-004` | 422 | Invalid status transition (not in draft) |

---

#### PUT `/org/:organizationId/trainings/:trainingId/cancel`

**Cancel a published training**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-058: Create & Publish Training |
| Business rules | M9-R5 (refund all enrolled) |

**Request Body** — None

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "cancelled", "...": "full training object" }
}
```

**Side Effects**
- Emits `TrainingCancelled` event
- Triggers M06 refund for all enrolled members
- Triggers M07 cancellation notification

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Training not found |
| `M09-004` | 422 | Invalid status transition (already completed/cancelled) |

---

#### PUT `/org/:organizationId/trainings/:trainingId/complete`

**Mark a published training as completed**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-060: Confirm Attendance & Award Credits |
| Business rules | M9-R3 (locks enrollments) |

**Request Body** — None

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "completed", "...": "full training object" }
}
```

**Side Effects**
- Emits `TrainingCompleted` event
- Unlocks attendance confirmation

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Training not found |
| `M09-004` | 422 | Invalid status transition (not in published) |

---

### 2.2 Enrollments

#### POST `/org/:organizationId/trainings/:trainingId/enroll`

**Enroll a member in a training**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-059: Training Enrollment |
| Business rules | M9-R2 (paid requires payment), M9-R3 (post-completion lock) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | valid person UUID | — | "550e8400-..." |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "trainingId": "uuid",
    "personId": "uuid",
    "status": "enrolled",
    "enrolledAt": "2026-05-21T15:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Enrollment ID |
| trainingId | string | NO | uuid | Training FK |
| personId | string | NO | uuid | Person FK |
| status | string | NO | enum | `enrolled`, `completed`, `cancelled`, `noShow` |
| enrolledAt | string | NO | ISO 8601 | Enrollment timestamp |
| completedAt | string | YES | ISO 8601 | Completion timestamp (null until attended) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `NOT_FOUND-001` | 404 | Training not found |
| `M09-001` | 422 | Training at full capacity |
| `M09-002` | 422 | Enrollment deadline passed |
| `M09-003` | 422 | Already enrolled in this training |
| `M09-004` | 422 | Training completed — no further enrollment |
| `M09-008` | 422 | Training requires paid registration (redirect to M06) |

---

### 2.3 Attendance

#### POST `/org/:organizationId/trainings/:trainingId/attendance`

**Mark a member's attendance and auto-award credits**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required (idempotent per M9-R7) |
| Workflow | WF-060: Confirm Attendance & Award Credits |
| Business rules | BR-13 (auto-credit award), BR-17 (officer-only), M9-R7 (no duplicate credits) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | must be enrolled in training | — | "550e8400-..." |

**Response** `200 OK`

```json
{
  "data": {
    "enrollmentId": "uuid",
    "enrollmentStatus": "completed",
    "creditEntryId": "uuid",
    "creditValue": 8,
    "certificateAvailable": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| enrollmentId | string | NO | uuid | Updated enrollment |
| enrollmentStatus | string | NO | enum | Always `completed` |
| creditEntryId | string | YES | uuid | AUTO credit entry (null if non-credit-bearing) |
| creditValue | number | NO | integer | Credits awarded (0 if non-credit-bearing) |
| certificateAvailable | boolean | NO | — | Whether certificate is ready for download |

**Side Effects**
- Enrollment status set to `completed`
- AUTO credit entry created in M10 (if credit-bearing)
- Emits `CreditAwarded` event
- Certificate record created; `CertificateGenerated` event emitted

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Training or enrollment not found |
| `M09-004` | 422 | Training not yet completed |
| `M09-003` | 422 | Duplicate — already attended (returns success, no duplicate credit) |

---

### 2.4 My Training

#### GET `/my/training`

**List current member's training history**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated user |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-059: Training Enrollment (history view) |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | Comma-separated enrollment statuses |
| `sort` | string | NO | Default: `-enrolledAt` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "enrollmentId": "uuid",
      "status": "completed",
      "enrolledAt": "2026-05-21T10:00:00.000Z",
      "completedAt": "2026-06-15T17:00:00.000Z",
      "training": {
        "id": "uuid",
        "title": "CPD Seminar on Oral Surgery",
        "trainingType": "seminar",
        "startDate": "2026-06-15T09:00:00.000Z",
        "creditAmount": 8,
        "organizationId": "uuid"
      },
      "certificateId": "uuid"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": false
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |

---

### 2.5 Certificates

#### GET `/my/certificates/:certificateId/pdf`

**Download a training certificate PDF**

| Property | Value |
|----------|-------|
| Auth | GA — own certificates only |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-061: Certificate Generation |
| Business rules | BR-20 (HMAC-signed QR), M9-R4 (tamper-proof verification) |

**Response** `200 OK`

Content-Type: `application/pdf`

Binary PDF file with member name, training title, date, credits earned, HMAC-signed QR code.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-003` | 403 | Not the certificate owner |
| `NOT_FOUND-001` | 404 | Certificate not found |
| `M09-010` | 422 | Certificate template not found |
| `INTERNAL-001` | 500 | PDF generation failure |

---

#### GET `/verify/certificate/:certificateNumber`

**Public certificate verification**

| Property | Value |
|----------|-------|
| Auth | None (public endpoint) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-061: Certificate Generation (verification) |
| Business rules | BR-20, M9-R4 (HMAC verification) |

**Response** `200 OK`

```json
{
  "data": {
    "valid": true,
    "certificateNumber": "CERT-2026-001234",
    "memberName": "Juan Dela Cruz",
    "trainingTitle": "CPD Seminar on Oral Surgery",
    "trainingDate": "2026-06-15",
    "creditsEarned": 8,
    "issuedAt": "2026-06-15T18:00:00.000Z",
    "organizationName": "Philippine Dental Association - Manila Chapter"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| valid | boolean | NO | — | Whether HMAC signature is valid |
| certificateNumber | string | NO | — | Unique certificate identifier |
| memberName | string | NO | — | Certificate holder name |
| trainingTitle | string | NO | — | Training activity name |
| trainingDate | string | NO | YYYY-MM-DD | Training date |
| creditsEarned | number | NO | integer | Credits on certificate |
| issuedAt | string | NO | ISO 8601 | Certificate issue date |
| organizationName | string | NO | — | Issuing organization |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Certificate number not found or HMAC invalid |

---

### 2.6 Accredited Providers

#### GET `/org/:organizationId/training/providers`

**List accredited providers**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-064: Manage Accredited Providers |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | `active`, `suspended`, `expired` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "PRC Accredited Training Center",
      "accreditationNumber": "PRC-ACC-2026-0001",
      "status": "active",
      "expiresAt": "2027-12-31T23:59:59.000Z",
      "organizationId": "uuid",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": false
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Provider ID |
| name | string | NO | — | Provider name |
| accreditationNumber | string | NO | — | PRC accreditation reference (unique) |
| status | string | NO | enum | `active`, `suspended`, `expired` |
| expiresAt | string | YES | ISO 8601 | Accreditation expiry date |
| organizationId | string | NO | uuid | Managing organization |
| createdAt | string | NO | ISO 8601 | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |

---

#### POST `/org/:organizationId/training/providers`

**Create an accredited provider**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-064: Manage Accredited Providers |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | — | non-empty | — | "PRC Accredited Training Center" |
| accreditationNumber | string | YES | NO | — | unique | — | "PRC-ACC-2026-0001" |
| status | string | NO | NO | enum | `active`, `suspended`, `expired` | "active" | "active" |
| expiresAt | string | NO | YES | ISO 8601 | — | null | "2027-12-31T23:59:59.000Z" |

**Response** `201 Created`

```json
{
  "data": { "id": "uuid", "...": "full provider object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `CONFLICT-002` | 409 | Duplicate accreditation number |
| `VALIDATION-001` | 400 | Invalid request body |

---

#### PUT `/org/:organizationId/training/providers/:providerId`

**Update an accredited provider**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-064: Manage Accredited Providers |
| Business rules | — |

**Request Body** — Same fields as POST (all optional).

**Response** `200 OK`

```json
{
  "data": { "...": "full provider object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Provider not found |
| `M09-006` | 422 | Invalid provider status transition |

---

#### DELETE `/org/:organizationId/training/providers/:providerId`

**Delete an accredited provider**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-064: Manage Accredited Providers |
| Business rules | — |

**Response** `204 No Content`

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `NOT_FOUND-001` | 404 | Provider not found |

---

### 2.7 Courses

#### GET `/org/:organizationId/courses`

**List self-paced online courses**

| Property | Value |
|----------|-------|
| Auth | GA — all authenticated users |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | — |
| Business rules | Feature flag: `training_courses` |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | `draft`, `published`, `archived` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "title": "Infection Control Best Practices",
      "description": "Self-paced online module...",
      "status": "published",
      "creditValue": 4,
      "createdAt": "2026-05-01T00:00:00.000Z"
    }
  ],
  "meta": { "cursor": null, "hasMore": false }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |

---

#### POST `/org/:organizationId/courses`

**Create a self-paced course**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | — |
| Business rules | Feature flag: `training_courses` |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | YES | NO | — | non-empty | — | "Infection Control Best Practices" |
| description | string | NO | YES | — | — | — | "Self-paced module..." |
| creditValue | number | NO | NO | integer | >= 0 | 0 | 4 |

**Response** `201 Created`

```json
{
  "data": { "id": "uuid", "status": "draft", "...": "full course object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTHZ-001` | 403 | Not an officer/admin |
| `VALIDATION-001` | 400 | Invalid request body |

---

## 3. Domain Events (API Triggers)

| Endpoint | Event Emitted | Payload |
|----------|--------------|---------|
| PUT .../publish | `TrainingPublished` | `{ trainingId, orgId, trainingType, creditValue }` |
| PUT .../complete | `TrainingCompleted` | `{ trainingId, orgId }` |
| PUT .../cancel | `TrainingCancelled` | `{ trainingId, orgId, enrollmentCount }` |
| POST .../attendance | `CreditAwarded` | `{ personId, trainingId, creditValue, creditEntryId }` |
| POST .../attendance | `CertificateGenerated` | `{ certificateId, personId, trainingId }` |

---

## 4. Consumed Events

| Event | Source | Effect |
|-------|--------|--------|
| `PaymentRecorded` | M06 | Confirm paid enrollment (status -> enrolled) |
| `RefundCompleted` | M06 | Update enrollment (status -> cancelled) |
