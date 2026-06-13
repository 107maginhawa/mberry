<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Member Profile & Settings (M02)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/persons/me` |
| Auth default | GA (session required) — all endpoints require authentication |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Person-scoped (from session); org-scoped where orgId is a path param |

---

## 2. Endpoints

> **Route corrections (FIX-014).** The endpoint headings in this section were
> generated against an early `/my/*` plan. The **actual** implemented routes use
> the `/persons/me` prefix (and PATCH, not PUT). This table is authoritative; the
> per-endpoint sub-sections below retain their request/response schemas but their
> heading paths/verbs are superseded by this mapping.
>
> | Documented (stale) | Actual route | Handler |
> |---|---|---|
> | `GET /my/profile` | `GET /persons/me` | `getMyProfile` |
> | `PUT /my/profile` | `PATCH /persons/me` | `updateMyProfile` |
> | `PUT /my/privacy` | `PATCH /persons/me/privacy` | `updateMyPrivacySettings` |
> | `PUT /my/notifications` | `PATCH /persons/me/notification-preferences` | `updateMyNotificationPreferences` |
> | `POST /my/data-export` | `POST /persons/me/data-export` | `requestDataExport` — handler exists; **not in the generated route registry**, verify wiring |
> | `GET /my/data-export/:id` | _not implemented_ | the only export route is `GET /persons/me/export` (`exportMyData`, sync JSON envelope per the `MyDataExport` model) |
> | `POST /my/delete-account` | `POST /persons/me/delete` | `requestMyAccountDeletion` |
> | `DELETE /my/delete-account` | `POST /persons/me/cancel-delete` | `cancelMyAccountDeletion` |
> | `GET /my/id-card/:orgId` | _not implemented_ | no id-card route exists in the generated registry |
> | `GET /my/id-card/:orgId/pdf` | _not implemented_ | no id-card PDF route exists in the generated registry |
>
> Real `/persons/me` routes the doc omits: `GET /persons/me/export`,
> `GET /persons/me/memberships`, `GET /persons/me/credits`,
> `GET /persons/me/credit-entries` (+ `POST`), `GET /persons/me/credit-summary`,
> `GET /persons/me/officer-role/:organizationId`.

### 2.1 Profile

#### GET `/my/profile`

**Fetch the authenticated user's profile with org memberships**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-010 |
| Business rules | BR-21, M2-R14 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria@example.com",
    "licenseNumber": "PRC-12345",
    "specialization": "Orthodontics",
    "subSpecialization": "Pediatric",
    "yearsOfPractice": 12,
    "affiliation": "Manila Dental Clinic",
    "mfaEnabled": true,
    "emailVerifiedAt": "2026-01-15T08:30:00Z",
    "photoUrl": "https://storage.example.com/photos/abc.jpg",
    "memberships": [
      {
        "organizationId": "660e8400-e29b-41d4-a716-446655440000",
        "organizationName": "Philippine Dental Association - NCR",
        "status": "active",
        "role": "member"
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Person ID |
| firstName | string | NO | — | First name |
| lastName | string | YES | — | Last name |
| email | string | NO | email | Verified email |
| licenseNumber | string | NO | — | Professional license |
| specialization | string | YES | — | Professional specialty |
| subSpecialization | string | YES | — | Sub-specialty |
| yearsOfPractice | integer | YES | — | Years in practice |
| affiliation | string | YES | — | Clinic/hospital name |
| mfaEnabled | boolean | NO | — | MFA status |
| emailVerifiedAt | string | YES | date-time | Email verification timestamp |
| photoUrl | string | YES | uri | Profile photo URL |
| memberships | array | NO | — | Org memberships with independent statuses (BR-21) |
| memberships[].organizationId | string | NO | uuid | Org ID |
| memberships[].organizationName | string | NO | — | Org display name |
| memberships[].status | string | NO | — | Computed from dues_expiry_date (BR-01) |
| memberships[].role | string | NO | — | Role in org |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 401 | Not authenticated |

---

#### PUT `/my/profile`

**Update the authenticated user's profile fields**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-010 |
| Business rules | M2-R1, M2-R9, M2-R10, BR-31 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| firstName | string | NO | NO | — | 1-50 chars | — | `"Maria"` |
| lastName | string | NO | YES | — | 1-50 chars | — | `"Santos"` |
| email | string | NO | NO | email | max 255; triggers OTP on new email (M2-R1) | — | `"new@example.com"` |
| specialization | string | NO | YES | — | Free text | — | `"Orthodontics"` |
| subSpecialization | string | NO | YES | — | Free text | — | `"Pediatric"` |
| yearsOfPractice | integer | NO | YES | — | >= 0 | — | `12` |
| affiliation | string | NO | YES | — | Free text | — | `"Manila Dental Clinic"` |
| photo | binary | NO | NO | image | JPEG/PNG/WebP, max 5MB (M2-R9) | — | — |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria@example.com",
    "specialization": "Orthodontics",
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Person ID |
| updatedAt | string | NO | date-time | Last update timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M02-001 | 422 | Cannot update another member's profile |
| M02-002 | 422 | Avatar file exceeds size limit |
| M02-003 | 422 | Invalid professional license format |
| M02-004 | 422 | Profile field not editable after verification |
| — | 400 | Validation error (generic) |

---

### 2.2 Privacy Settings

#### PUT `/my/privacy`

**Update directory visibility toggles per organization**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-010 |
| Business rules | M2-R14 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| organizationId | string | YES | NO | uuid | Must be a current membership org | — | `"660e8400-..."` |
| emailVisible | boolean | NO | NO | — | — | `false` | `true` |
| phoneVisible | boolean | NO | NO | — | — | `false` | `false` |
| photoVisible | boolean | NO | NO | — | — | `true` | `true` |
| addressVisible | boolean | NO | NO | — | — | `false` | `false` |

**Response** `200 OK`

```json
{
  "data": {
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "emailVisible": true,
    "phoneVisible": false,
    "photoVisible": true,
    "addressVisible": false
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| organizationId | string | NO | uuid | Org these settings apply to |
| emailVisible | boolean | NO | — | Email shown in directory |
| phoneVisible | boolean | NO | — | Phone shown in directory |
| photoVisible | boolean | NO | — | Photo shown in directory |
| addressVisible | boolean | NO | — | Address shown in directory |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Validation error |
| — | 404 | Not a member of this organization |

---

### 2.3 Notification Preferences

#### PUT `/my/notifications`

**Update notification preferences per organization and category**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-013 |
| Business rules | M2-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| organizationId | string | YES | NO | uuid | Must be a current membership org | — | `"660e8400-..."` |
| preferences | array | YES | NO | — | Array of category settings | — | See below |
| preferences[].category | string | YES | NO | enum | `dues`, `events`, `trainings`, `announcements`, `credits` | — | `"dues"` |
| preferences[].pushEnabled | boolean | NO | NO | — | — | `true` | `true` |
| preferences[].emailEnabled | boolean | NO | NO | — | — | `false` | `true` |

**Response** `200 OK`

```json
{
  "data": {
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "preferences": [
      {
        "category": "dues",
        "pushEnabled": true,
        "emailEnabled": true
      },
      {
        "category": "events",
        "pushEnabled": true,
        "emailEnabled": false
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| organizationId | string | NO | uuid | Org these prefs apply to |
| preferences | array | NO | — | Per-category notification settings |
| preferences[].category | string | NO | enum | Notification category |
| preferences[].pushEnabled | boolean | NO | — | Push notification toggle |
| preferences[].emailEnabled | boolean | NO | — | Email notification toggle |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid category or validation error |
| — | 422 | Cannot disable in-app notifications (M2-R8) |

---

### 2.4 Data Export

#### POST `/my/data-export`

**Request a GDPR-style personal data export**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min); 1 active export at a time (M2-R4) |
| Idempotency | Optional |
| Workflow | WF-014 |
| Business rules | M2-R4 |

**Response** `201 Created`

```json
{
  "data": {
    "exportId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "requested"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| exportId | string | NO | uuid | Export request ID |
| status | string | NO | enum | `requested` |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 429 | Export already in progress or rate limited |

---

#### GET `/my/data-export/:id`

**Check data export status and retrieve download URL**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-014 |
| Business rules | M2-R4 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "ready",
    "downloadUrl": "https://storage.example.com/exports/abc.zip?sig=xyz",
    "expiresAt": "2026-05-28T10:00:00Z",
    "requestedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Export ID |
| status | string | NO | enum | `requested`, `processing`, `ready`, `failed`, `expired` |
| downloadUrl | string | YES | uri | Signed URL (only when status=ready) |
| expiresAt | string | YES | date-time | Download link expiry (7 days from ready) |
| requestedAt | string | NO | date-time | Original request time |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | Export not found or belongs to another user |

---

### 2.5 Account Deletion

#### POST `/my/delete-account`

**Request account deletion with 30-day grace period**

| Property | Value |
|----------|-------|
| Auth | GA (account owner only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-011 |
| Business rules | M2-R5, M2-R6, BR-32 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| confirmation | string | YES | NO | — | Must be exactly `"DELETE"` | — | `"DELETE"` |

**Response** `200 OK`

```json
{
  "data": {
    "scheduledDate": "2026-06-20T10:00:00Z",
    "message": "Account scheduled for deletion. You have 30 days to cancel."
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| scheduledDate | string | NO | date-time | Deletion date (requestedAt + 30 days) |
| message | string | NO | — | Confirmation message |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M02-005 | 422 | Deletion grace period has not expired |
| M02-006 | 422 | Account deletion already scheduled |
| — | 409 | Account has outstanding payments or is an active officer (M2-R5) |

---

#### DELETE `/my/delete-account`

**Cancel a pending account deletion request**

| Property | Value |
|----------|-------|
| Auth | GA (account owner only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-011 |
| Business rules | — |

**Response** `200 OK`

```json
{
  "data": {
    "cancelled": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| cancelled | boolean | NO | — | Always true on success |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | No active deletion request |

---

### 2.6 Digital ID Card

#### GET `/my/id-card/:orgId`

**Get digital ID card data with QR verification payload**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-012 |
| Business rules | M2-R7, BR-01, BR-18 |

**Response** `200 OK`

```json
{
  "data": {
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Maria",
    "lastName": "Santos",
    "licenseNumber": "PRC-12345",
    "organizationName": "Philippine Dental Association - NCR",
    "membershipStatus": "active",
    "photoUrl": "https://storage.example.com/photos/abc.jpg",
    "qrPayload": "eyJwZXJzb25JZCI6...",
    "qrSignature": "hmac-sha256:abc123",
    "validUntil": "2027-01-15T00:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| personId | string | NO | uuid | Person ID |
| firstName | string | NO | — | First name |
| lastName | string | YES | — | Last name |
| licenseNumber | string | NO | — | Professional license |
| organizationName | string | NO | — | Org display name |
| membershipStatus | string | NO | — | Computed from dues_expiry_date (BR-01) |
| photoUrl | string | YES | uri | Profile photo |
| qrPayload | string | NO | base64 | QR code data |
| qrSignature | string | NO | — | HMAC signature for tamper-proof verification (BR-18) |
| validUntil | string | NO | date-time | Card validity date |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | No membership in this organization |

---

#### GET `/my/id-card/:orgId/pdf`

**Download PDF version of the digital ID card**

| Property | Value |
|----------|-------|
| Auth | GA (all authenticated users) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-012 |
| Business rules | M2-R7 |

**Response** `200 OK` (`application/pdf`)

Binary PDF file download.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | No membership in this organization |
| — | 500 | PDF generation failure |

---

## 3. Domain Events

### Published Events

| Event Name | Trigger Endpoint | Payload |
|------------|-----------------|---------|
| PersonUpdated (`person.updated`) | `PATCH /persons/me` | `{ personId, updatedBy, updatedFields }` |
| ~~PersonAnonymized~~ | _(removed — FIX-007)_ | **Not implemented** — never emitted; registry entry removed. Anonymization is audited inline in `jobs/deletionProcessor.ts`; cascade runs off `person.deleted`. |
| DataExportReady (`data-export.ready`) | System (async generation complete) → notifies the requester (FIX-007) | `{ personId, exportId, downloadUrl }` |
| DeletionRequested (`person.deletion.requested`) | `POST /persons/me/delete` → notifies the member's org officers (FIX-007) | `{ personId, scheduledDate }` |
| DeletionCancelled (`person.deletion.cancelled`) | `POST /persons/me/cancel-delete` → notifies the member's org officers (FIX-007) | `{ personId }` |

### Consumed Events

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| MembershipStatusChanged | M05 | Regenerate ID card QR payload (M2-R7) |
| PaymentRecorded | M06 | Update dues display on profile |

---

## 4. Entity Summary

| Entity | Primary Key | Unique Constraints | Notes |
|--------|------------|-------------------|-------|
| Person (extended) | `id` (uuid) | `email` | Additional profile fields on M01 base |
| PersonPrivacySetting | `(personId, organizationId)` | — | Per-org visibility toggles |
| NotificationPreference | `(personId, organizationId, category)` | — | Per-org per-category prefs |
| DataExport | `id` (uuid) | — | 7-day download window |
