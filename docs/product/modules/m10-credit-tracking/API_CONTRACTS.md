<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Credit Tracking (M10)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/credits` (member), `/orgs/:organizationId/credits` (officer) |
| Auth default | GA (member reads own); GA+HG (officer adjustments/compliance) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Implicit `associationId` from session; credits aggregated cross-org within association |

---

## 2. Endpoints

### 2.1 Member Credit Summary

#### GET `/credits/my`

**View current member's credit summary with cycle computation**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated user (own data only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-065: View Credit Summary |
| Business rules | BR-11 (cycle from registration date), BR-12 (excess carryover), BR-14 (cross-org aggregation) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cycleId | string | NO | Specific cycle identifier. If omitted, returns current cycle. |
| `filter[organizationId]` | string | NO | Filter entries to a specific org (UUID) |
| `filter[type]` | string | NO | `AUTO`, `MANUAL`, `ADJUSTED` |
| `limit` | number | NO | Page size for entries (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination of entries |

**Response** `200 OK`

```json
{
  "data": {
    "cycle": {
      "cycleStart": "2025-03-15T00:00:00.000Z",
      "cycleEnd": "2028-03-14T23:59:59.000Z",
      "requiredCredits": 60,
      "earnedCredits": 32,
      "carryoverCredits": 5,
      "remainingCredits": 23,
      "completionPercentage": 61.67
    },
    "entries": [
      {
        "id": "uuid",
        "type": "AUTO",
        "creditValue": 8,
        "activityName": "CPD Seminar on Oral Surgery",
        "activityDate": "2026-06-15",
        "provider": "PRC Accredited Training Center",
        "organizationId": "uuid",
        "organizationName": "PDA Manila Chapter",
        "trainingId": "uuid",
        "supportingDocumentUrl": null,
        "cpdCategory": null,
        "createdAt": "2026-06-15T18:00:00.000Z",
        "createdBy": "uuid"
      }
    ]
  },
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| cycle.cycleStart | string | NO | ISO 8601 | Cycle start (from registration date) |
| cycle.cycleEnd | string | NO | ISO 8601 | Cycle end (start + association period) |
| cycle.requiredCredits | number | NO | integer | Credits required for compliance |
| cycle.earnedCredits | number | NO | decimal | Total credits earned in cycle (cross-org) |
| cycle.carryoverCredits | number | NO | decimal | Excess from previous cycle (BR-12) |
| cycle.remainingCredits | number | NO | decimal | requiredCredits - earnedCredits - carryoverCredits (min 0) |
| cycle.completionPercentage | number | NO | decimal | (earned + carryover) / required * 100 |
| entries[].id | string | NO | uuid | Credit entry ID |
| entries[].type | string | NO | enum | `AUTO`, `MANUAL`, `ADJUSTED` |
| entries[].creditValue | number | NO | decimal | Credit amount (negative for deductions) |
| entries[].activityName | string | NO | — | Activity description |
| entries[].activityDate | string | NO | YYYY-MM-DD | When activity occurred |
| entries[].provider | string | YES | — | Provider name |
| entries[].organizationId | string | NO | uuid | Source organization |
| entries[].organizationName | string | NO | — | Source org display name |
| entries[].trainingId | string | YES | uuid | Training FK (AUTO entries only) |
| entries[].supportingDocumentUrl | string | YES | url | Uploaded supporting document |
| entries[].cpdCategory | string | YES | enum | `General`, `Major`, `SelfDirected` (if enabled) |
| entries[].createdAt | string | NO | ISO 8601 | Entry creation timestamp |
| entries[].createdBy | string | NO | uuid | Person who created the entry |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `M10-003` | 422 | Compliance cycle not found (bad cycleId) |

---

### 2.2 Manual Credit Entry

#### POST `/credits/manual`

**Add a manual credit entry**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member (own credits only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-066: Add Manual Credit |
| Business rules | M10-R5 (supporting doc: PDF/image, max 5MB) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| activityName | string | YES | NO | — | non-empty, max 300 chars | — | "External CPD Seminar" |
| activityDate | string | YES | NO | YYYY-MM-DD | must not be in future (reject if activityDate > current date) | — | "2026-05-15" |
| creditValue | number | YES | NO | decimal | > 0 | — | 4.0 |
| provider | string | NO | YES | — | max 200 chars | null | "University of the Philippines" |
| organizationId | string | YES | NO | uuid | org with credit tracking enabled | — | "550e8400-..." |
| supportingDocumentUrl | string | NO | YES | url | PDF or image, max 5MB | null | "https://s3.../doc.pdf" |
| cpdCategory | string | NO | YES | enum | `General`, `Major`, `SelfDirected` (if flag enabled) | null | "General" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "type": "MANUAL",
    "creditValue": 4.0,
    "activityName": "External CPD Seminar",
    "activityDate": "2026-05-15",
    "provider": "University of the Philippines",
    "organizationId": "uuid",
    "supportingDocumentUrl": "https://s3.../doc.pdf",
    "createdAt": "2026-05-21T15:00:00.000Z",
    "createdBy": "uuid"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `VALIDATION-001` | 400 | Invalid request body |
| `VALIDATION-004` | 400 | Credit value out of range |
| `M10-001` | 422 | Negative credit value not allowed (BR-20) |
| `M10-004` | 422 | Cannot modify credits in closed compliance cycle (BR-21) |
| `M10-006` | 422 | Manual credit entry requires supporting document (if org requires it) |

---

### 2.3 Officer Credit Adjustment

#### POST `/credits/adjust`

**Officer adjusts a member's credits (award or deduct)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-067: Officer Credit Adjustment |
| Business rules | M10-R3 (immutable audit log), M10-R4 (mandatory reason) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | valid person in org | — | "550e8400-..." |
| organizationId | string | YES | NO | uuid | org with credit tracking enabled | — | "550e8400-..." |
| creditValue | number | YES | NO | decimal | non-zero (positive=award, negative=deduct) | — | -2.0 |
| reason | string | YES | NO | — | non-empty, max 500 chars | — | "Correction: duplicate entry removed" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "type": "ADJUSTED",
    "personId": "uuid",
    "creditValue": -2.0,
    "reason": "Correction: duplicate entry removed",
    "organizationId": "uuid",
    "createdAt": "2026-05-21T15:00:00.000Z",
    "createdBy": "uuid"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Credit entry ID |
| type | string | NO | enum | Always `ADJUSTED` |
| personId | string | NO | uuid | Adjusted member |
| creditValue | number | NO | decimal | Adjustment amount (signed) |
| reason | string | NO | — | Mandatory reason |
| organizationId | string | NO | uuid | Organization |
| createdAt | string | NO | ISO 8601 | Timestamp |
| createdBy | string | NO | uuid | Officer who adjusted |

**Side Effects**
- Emits `CreditAdjusted` event
- Immutable audit log entry created

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not an officer/admin |
| `AUTHZ-007` | 403 | Minimum org role not met |
| `VALIDATION-001` | 400 | Invalid request body (missing reason) |
| `M10-001` | 422 | Deduction would bring balance below 0 |
| `M10-004` | 422 | Cannot modify credits in closed compliance cycle |
| `NOT_FOUND-001` | 404 | Person not found in org |

---

### 2.4 Org Credit Compliance

#### GET `/orgs/:organizationId/credits/compliance`

**View org-level member compliance report**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-068: Org Credit Compliance |
| Business rules | M10-R1 (toggle independence) |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[complianceStatus]` | string | NO | `compliant`, `nonCompliant`, `inProgress` |
| `search` | string | NO | Full-text search on member name |
| `sort` | string | NO | Default: `lastName`. Allowed: `remainingCredits`, `earnedCredits`, `-remainingCredits` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "personId": "uuid",
      "personName": "Juan Dela Cruz",
      "cycleStart": "2025-03-15T00:00:00.000Z",
      "cycleEnd": "2028-03-14T23:59:59.000Z",
      "requiredCredits": 60,
      "earnedCredits": 32,
      "carryoverCredits": 5,
      "remainingCredits": 23,
      "complianceStatus": "inProgress"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": true,
    "total": 245
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| personId | string | NO | uuid | Member ID |
| personName | string | NO | — | Member display name |
| cycleStart | string | NO | ISO 8601 | Cycle start date |
| cycleEnd | string | NO | ISO 8601 | Cycle end date |
| requiredCredits | number | NO | integer | Required credits for cycle |
| earnedCredits | number | NO | decimal | Total credits earned |
| carryoverCredits | number | NO | decimal | Carried over from previous cycle |
| remainingCredits | number | NO | decimal | Credits still needed |
| complianceStatus | string | NO | enum | `compliant`, `nonCompliant`, `inProgress` |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not an officer/admin |
| `AUTHZ-002` | 403 | Not a member of target org |

---

### 2.5 Credit Transcript Export

#### GET `/credits/transcript`

**Download credit transcript as PDF or CSV**

| Property | Value |
|----------|-------|
| Auth | GA — own transcript; admin/super can specify personId |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-070: Credit Transcript Export |
| Business rules | Feature flag: `credit_transcript_export` |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | YES | `pdf` or `csv` |
| cycleId | string | NO | Specific cycle. Default: current cycle. |
| personId | string | NO | Admin/super only — export for another member |

**Response** `200 OK`

Content-Type: `application/pdf` or `text/csv`

Binary file containing all credit entries for the specified cycle, including activity name, date, source, credits, and totals.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-003` | 403 | Attempting to export another member's transcript without admin role |
| `M10-003` | 422 | Compliance cycle not found |
| `VALIDATION-005` | 400 | Invalid format value |

---

## 3. Domain Events (API Triggers)

| Endpoint | Event Emitted | Payload |
|----------|--------------|---------|
| POST /credits/manual | `CreditAwarded` | `{ personId, creditValue, source: "MANUAL", organizationId }` |
| POST /credits/adjust | `CreditAdjusted` | `{ personId, adjustedBy, value, reason }` |

---

## 4. Consumed Events

| Event | Source | Effect |
|-------|--------|--------|
| `TrainingCompleted` | M09 | Generate AUTO credit entries for attendees |
| `MembershipStatusChanged` | M05 | Check if credit tracking still applies |
| `AccountDeletionProcessed` | M02 | Retain anonymized credit records (PII stripped) |
