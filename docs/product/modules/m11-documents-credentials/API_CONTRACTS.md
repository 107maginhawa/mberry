<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Documents & Credentials (M11)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/my` (member credentials), `/orgs/:organizationId/documents` (org docs), `/verify` (public) |
| Auth default | GA (member reads own); GA+HG (officer doc management); Public (verification) |
| Rate limit tier | Authenticated (120 req/min); Unauthenticated (20 req/min) for verification |
| Tenant scoping | Implicit `associationId` from session; `organizationId` as path param for org documents |

---

## 2. Endpoints

### 2.1 Member ID Card

#### GET `/my/id-card`

**Download member ID card PDF with HMAC-signed QR**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member (own card only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-071: Download Member ID Card |
| Business rules | BR-18 (HMAC-signed QR), BR-19 (auto-regenerate on profile/status change) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | NO | Specific org card. If omitted and member has one org, returns that. If multi-org, returns 400. |

**Response** `200 OK`

Content-Type: `application/pdf`

Binary PDF file — credit card size landscape — containing member photo, name, license number, organization, membership status, expiry date, and HMAC-signed QR code.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `NOT_FOUND-001` | 404 | No active membership found |
| `VALIDATION-007` | 400 | Multi-org member must specify organizationId |
| `EXT-003` | 502 | Storage service unavailable (S3/MinIO) |
| `INTERNAL-001` | 500 | PDF generation failure |

---

### 2.2 Certificates

#### GET `/my/certificates`

**List available training certificates**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member (own certificates) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-074: Certificate Download |
| Business rules | M11-R1 (training completed + attended), BR-20 (certificate available post-attendance) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "certificateNumber": "CERT-2026-001234",
      "trainingId": "uuid",
      "trainingTitle": "CPD Seminar on Oral Surgery",
      "trainingDate": "2026-06-15",
      "creditsEarned": 8,
      "fileUrl": "https://s3.../cert.pdf",
      "qrPayload": "signed-payload-string",
      "createdAt": "2026-06-15T18:00:00.000Z"
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
| id | string | NO | uuid | Certificate ID |
| certificateNumber | string | NO | — | Unique certificate identifier |
| trainingId | string | NO | uuid | Source training |
| trainingTitle | string | NO | — | Training name |
| trainingDate | string | NO | YYYY-MM-DD | Training date |
| creditsEarned | number | NO | integer | Credits on certificate |
| fileUrl | string | YES | url | PDF URL (null if not yet generated) |
| qrPayload | string | NO | — | HMAC-signed QR payload |
| createdAt | string | NO | ISO 8601 | Issue date |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |

---

#### GET `/my/certificates/:certificateId/download`

**Download a specific certificate PDF**

| Property | Value |
|----------|-------|
| Auth | GA — own certificates only |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-074: Certificate Download |
| Business rules | BR-20, M11-R1 |

**Response** `200 OK`

Content-Type: `application/pdf`

Binary PDF with member name, training title, date, credits earned, org branding, HMAC-signed QR code.

**Side Effects**
- Emits `CredentialGenerated` event (on first download / generation)
- DocumentAccessLog entry created

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-003` | 403 | Not the certificate owner |
| `NOT_FOUND-001` | 404 | Certificate not found |
| `M11-004` | 422 | Certificate template rendering failed |
| `EXT-003` | 502 | Storage service unavailable |

---

### 2.3 Public Verification

#### GET `/verify/:token`

**Public credential verification via QR code or URL**

| Property | Value |
|----------|-------|
| Auth | None (public endpoint) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-072: Public Verification |
| Business rules | BR-18 (HMAC validation) |

**Response** `200 OK`

```json
{
  "data": {
    "valid": true,
    "type": "certificate",
    "memberName": "Juan Dela Cruz",
    "licenseNumber": "PRC-0012345",
    "organizationName": "Philippine Dental Association - Manila Chapter",
    "status": "active",
    "generatedAt": "2026-06-15T18:00:00.000Z",
    "details": {
      "trainingTitle": "CPD Seminar on Oral Surgery",
      "trainingDate": "2026-06-15",
      "creditsEarned": 8,
      "certificateNumber": "CERT-2026-001234"
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| valid | boolean | NO | — | Whether HMAC signature validates |
| type | string | NO | enum | `certificate` or `idCard` |
| memberName | string | NO | — | Name on credential |
| licenseNumber | string | YES | — | Professional license number |
| organizationName | string | NO | — | Issuing organization |
| status | string | NO | — | Membership status at generation time |
| generatedAt | string | NO | ISO 8601 | When credential was generated |
| details | object | YES | — | Type-specific fields (certificate: training info; idCard: membership info) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `M11-005` | 422 | QR verification code invalid or expired |
| `NOT_FOUND-001` | 404 | Token not found or HMAC mismatch |

**Side Effects**
- Emits `VerificationRequested` event
- VerificationRequest record created

---

### 2.4 Organization Documents

#### GET `/orgs/:organizationId/documents`

**List organization documents**

| Property | Value |
|----------|-------|
| Auth | GA — all authenticated org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-073: Document Management |
| Business rules | M11-R5 (access logging) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | `draft`, `published`, `archived` |
| `filter[tag]` | string | NO | Filter by tag value |
| `search` | string | NO | Full-text search on title |
| `sort` | string | NO | Default: `-createdAt`. Allowed: `title`, `createdAt` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "title": "2026 Bylaws",
      "status": "published",
      "fileUrl": "https://s3.../bylaws-2026.pdf",
      "mimeType": "application/pdf",
      "fileSize": 245760,
      "uploadedBy": "uuid",
      "tags": ["bylaws", "governance"],
      "currentVersion": 3,
      "createdAt": "2026-01-15T00:00:00.000Z",
      "updatedAt": "2026-03-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": false,
    "total": 12
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Document ID |
| organizationId | string | NO | uuid | Owning organization |
| title | string | NO | — | Document name |
| status | string | NO | enum | `draft`, `published`, `archived` |
| fileUrl | string | NO | url | S3/MinIO storage URL |
| mimeType | string | NO | — | File MIME type |
| fileSize | number | NO | integer | File size in bytes |
| uploadedBy | string | NO | uuid | Uploader person ID |
| tags | array | NO | string[] | Document tags |
| currentVersion | number | NO | integer | Latest version number |
| createdAt | string | NO | ISO 8601 | Upload timestamp |
| updatedAt | string | NO | ISO 8601 | Last modified |

**Side Effects**
- DocumentAccessLog entry created (action: `view`)

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-002` | 403 | Not a member of target org |

---

#### POST `/orgs/:organizationId/documents`

**Upload a new document**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president, VP, secretary, officer, staff, admin, super |
| Rate limit | File upload (30 req/min) |
| Idempotency | Optional |
| Workflow | WF-073: Document Management |
| Business rules | M11-R2 (SVG sanitization), M11-R4 (version history) |

**Request Body** — `multipart/form-data`

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| file | binary | YES | NO | multipart | max file size per API gateway config | — | (file upload) |
| title | string | YES | NO | — | non-empty, max 300 chars | — | "2026 Bylaws" |
| tags | string | NO | YES | — | comma-separated, max 20 tags | — | "bylaws,governance" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "title": "2026 Bylaws",
    "status": "draft",
    "fileUrl": "https://s3.../bylaws-2026.pdf",
    "mimeType": "application/pdf",
    "fileSize": 245760,
    "uploadedBy": "uuid",
    "tags": ["bylaws", "governance"],
    "currentVersion": 1,
    "createdAt": "2026-05-21T15:00:00.000Z"
  }
}
```

**Side Effects**
- Emits `DocumentUploaded` event
- DocumentVersion record created (version 1)
- File stored in S3/MinIO

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized to upload |
| `VALIDATION-001` | 400 | Invalid request |
| `VALIDATION-006` | 413 | File too large |
| `M11-002` | 422 | File type not allowed |
| `M11-006` | 422 | Document tag limit exceeded (max 20) |
| `EXT-003` | 502 | Storage service unavailable |

---

#### PATCH `/orgs/:organizationId/documents/:documentId/status`

**Update document status (publish or archive)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president, VP, secretary, officer, staff, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-073: Document Management |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| status | string | YES | NO | enum | `published`, `archived` | — | "published" |

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "published", "...": "full document object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized |
| `NOT_FOUND-001` | 404 | Document not found |
| `CONFLICT-003` | 409 | Invalid state transition (e.g., archived -> published) |
| `M11-001` | 422 | Document version conflict |

---

#### DELETE `/orgs/:organizationId/documents/:documentId`

**Delete a document**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-073: Document Management |
| Business rules | — |

**Response** `204 No Content`

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized (only president/admin/super) |
| `NOT_FOUND-001` | 404 | Document not found |
| `M11-007` | 422 | Cannot archive document with active references |

---

### 2.5 Document Versions

#### POST `/orgs/:organizationId/documents/:documentId/versions`

**Upload a new version of an existing document**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president, VP, secretary, officer, staff, admin, super |
| Rate limit | File upload (30 req/min) |
| Idempotency | Optional |
| Workflow | WF-073: Document Management |
| Business rules | M11-R4 (version history maintained, immutable) |

**Request Body** — `multipart/form-data`

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| file | binary | YES | NO | multipart | max file size per API gateway config | — | (file upload) |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "documentId": "uuid",
    "versionNumber": 3,
    "fileUrl": "https://s3.../bylaws-v3.pdf",
    "uploadedBy": "uuid",
    "createdAt": "2026-05-21T15:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Version ID |
| documentId | string | NO | uuid | Parent document |
| versionNumber | number | NO | integer | Sequential version number |
| fileUrl | string | NO | url | S3/MinIO storage URL |
| uploadedBy | string | NO | uuid | Uploader person ID |
| createdAt | string | NO | ISO 8601 | Version timestamp |

**Side Effects**
- Emits `DocumentUploaded` event
- Previous version preserved (immutable)
- Document `fileUrl` updated to latest version

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized to upload |
| `NOT_FOUND-001` | 404 | Document not found |
| `VALIDATION-006` | 413 | File too large |
| `M11-002` | 422 | File type not allowed |
| `EXT-003` | 502 | Storage service unavailable |

---

### 2.6 Document Access Log

#### GET `/orgs/:organizationId/documents/:documentId/access-log`

**View document access log**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-073: Document Management |
| Business rules | M11-R5 (all access logged) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[action]` | string | NO | `view`, `download` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "personId": "uuid",
      "personName": "Juan Dela Cruz",
      "action": "download",
      "accessedAt": "2026-05-21T15:00:00.000Z"
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
| id | string | NO | uuid | Access log entry ID |
| documentId | string | NO | uuid | Document accessed |
| personId | string | NO | uuid | Person who accessed |
| personName | string | NO | — | Accessor display name |
| action | string | NO | enum | `view` or `download` |
| accessedAt | string | NO | ISO 8601 | Access timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized (president/admin/super only) |
| `NOT_FOUND-001` | 404 | Document not found |

---

## 3. Domain Events (API Triggers)

| Endpoint | Event Emitted | Payload |
|----------|--------------|---------|
| GET /my/id-card | `CredentialGenerated` | `{ personId, type: "card", documentId }` |
| GET /my/certificates/:id/download | `CredentialGenerated` | `{ personId, type: "certificate", documentId }` |
| GET /verify/:token | `VerificationRequested` | `{ token, valid, timestamp }` |
| POST /orgs/:id/documents | `DocumentUploaded` | `{ documentId, orgId, uploadedBy }` |
| POST .../versions | `DocumentUploaded` | `{ documentId, orgId, uploadedBy }` |

---

## 4. Consumed Events

| Event | Source | Effect |
|-------|--------|--------|
| `PersonUpdated` | M02 | Regenerate member ID card with new data |
| `MembershipStatusChanged` | M05 | Regenerate member ID card with updated status |
| `TrainingCompleted` | M09 | Make certificate available for download |
| `AccountDeletionProcessed` | M02 | Revoke active credentials (cards and certificates invalidated) |
