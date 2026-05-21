<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Platform Administration (M03)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/admin` |
| Auth default | PA (platform admin middleware) — all endpoints require platform admin role |
| Rate limit tier | Admin (300 req/min) |
| Tenant scoping | Global (cross-association); org-scoped via path param where applicable |

---

## 2. Endpoints

### 2.1 Associations

#### GET `/admin/associations`

**List all associations with filtering and pagination**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin, support) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-019 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | integer | NO | Items per page (default: 20, max: 100) |
| after | string | NO | Cursor for forward pagination |
| before | string | NO | Cursor for backward pagination |
| filter[countryCode] | string | NO | Filter by ISO 3166-1 alpha-2 country |
| search | string | NO | Full-text search on name |
| sort | string | NO | Sort field (default: `-createdAt`) |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Philippine Dental Association",
      "countryCode": "PH",
      "currency": "PHP",
      "licenseFormatRegex": "^PRC-\\d{5}$",
      "creditCyclePeriod": 3,
      "creditCycleRequired": 60,
      "carryoverEnabled": false,
      "orgCount": 42,
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYzEyMyJ9",
    "hasMore": true,
    "total": 5
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Association ID |
| name | string | NO | — | Association name |
| countryCode | string | NO | — | ISO 3166-1 alpha-2 |
| currency | string | NO | — | ISO 4217 currency |
| licenseFormatRegex | string | NO | — | License validation pattern |
| creditCyclePeriod | integer | NO | — | 1, 2, or 3 years |
| creditCycleRequired | integer | NO | — | Credits required per cycle |
| carryoverEnabled | boolean | NO | — | Excess credit carryover |
| orgCount | integer | NO | — | Number of organizations |
| createdAt | string | NO | date-time | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 403 | Insufficient permissions |

---

#### POST `/admin/associations`

**Create a new association (country-level entity)**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-019 |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | — | Unique globally | — | `"Philippine Dental Association"` |
| countryCode | string | YES | NO | — | ISO 3166-1 alpha-2 | — | `"PH"` |
| currency | string | YES | NO | — | ISO 4217 | — | `"PHP"` |
| licenseFormatRegex | string | YES | NO | — | Valid regex | — | `"^PRC-\\d{5}$"` |
| creditCyclePeriod | integer | YES | NO | — | 1, 2, or 3 | — | `3` |
| creditCycleRequired | integer | YES | NO | — | > 0 | — | `60` |
| carryoverEnabled | boolean | NO | NO | — | — | `false` | `false` |
| localeSettings | object | NO | YES | — | JSONB locale config | — | `{"dateFormat": "MM/DD/YYYY"}` |

**Response** `201 Created`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Philippine Dental Association",
    "countryCode": "PH",
    "currency": "PHP",
    "createdAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Created association ID |
| name | string | NO | — | Association name |
| countryCode | string | NO | — | Country code |
| currency | string | NO | — | Currency |
| createdAt | string | NO | date-time | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 409 | Association name already exists |
| — | 400 | Invalid regex or validation error |

---

#### PUT `/admin/associations/:id`

**Update an existing association's configuration**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-019 |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | NO | NO | — | Unique globally | — | `"PH Dental Assoc"` |
| licenseFormatRegex | string | NO | NO | — | Valid regex, tested on save | — | `"^PRC-\\d{5,6}$"` |
| creditCyclePeriod | integer | NO | NO | — | 1, 2, or 3 | — | `2` |
| creditCycleRequired | integer | NO | NO | — | > 0 | — | `40` |
| carryoverEnabled | boolean | NO | NO | — | — | — | `true` |
| localeSettings | object | NO | YES | — | JSONB | — | `{"dateFormat": "DD/MM/YYYY"}` |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PH Dental Assoc",
    "updatedAt": "2026-05-21T11:00:00Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid regex or validation error |
| — | 404 | Association not found |
| — | 409 | Name conflict |

---

#### DELETE `/admin/associations/:id`

**Delete an association (only if no active organizations)**

| Property | Value |
|----------|-------|
| Auth | PA (super only) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-019 |
| Business rules | — |

**Response** `204 No Content`

No response body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 409 | Association has active organizations |
| — | 404 | Association not found |

---

### 2.2 Organizations

#### POST `/admin/associations/:id/orgs`

**Provision a new organization under an association**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-020 |
| Business rules | M3-R10 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | — | 2-100 chars, unique within association | — | `"PDA NCR Chapter"` |
| slug | string | YES | NO | — | Unique globally, URL-friendly | — | `"pda-ncr"` |
| orgType | string | YES | NO | enum | `chapter`, `society`, `national`, `clinic` | — | `"chapter"` |
| officerEmail | string | YES | NO | email | First officer's email (gets invite) | — | `"president@pdancr.org"` |

**Response** `201 Created`

```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "associationId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "PDA NCR Chapter",
    "slug": "pda-ncr",
    "orgType": "chapter",
    "status": "trial",
    "trialExpiresAt": "2026-06-20T10:00:00Z",
    "createdAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Organization ID |
| associationId | string | NO | uuid | Parent association |
| name | string | NO | — | Org name |
| slug | string | NO | — | URL-friendly slug |
| orgType | string | NO | enum | Organization type |
| status | string | NO | enum | Initial status: `trial` |
| trialExpiresAt | string | YES | date-time | Trial end date |
| createdAt | string | NO | date-time | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M03-003 | 422 | Organization already exists with this slug |
| — | 409 | Name conflict within association |

---

#### PUT `/admin/orgs/:id/status`

**Transition organization lifecycle status**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-020 |
| Business rules | M3-R10 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| newStatus | string | YES | NO | enum | `trial`, `active`, `suspended`, `cancelled` | — | `"active"` |
| reason | string | NO | NO | — | Required for suspension/cancellation | — | `"Non-payment"` |

Valid state transitions (M3-R10):
- `trial` -> `active`, `cancelled`
- `active` -> `suspended`, `cancelled`
- `suspended` -> `active`, `cancelled`

**Response** `200 OK`

```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "previousStatus": "trial",
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Organization ID |
| status | string | NO | enum | New status |
| previousStatus | string | NO | enum | Status before transition |
| updatedAt | string | NO | date-time | Transition timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid state transition (M3-R10) |
| M03-005 | 422 | Cannot delete organization with active members |

---

### 2.3 Feature Flags

#### GET `/admin/feature-flags`

**Get the complete feature flag matrix**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin, support) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-021 |
| Business rules | M3-R9 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[moduleName] | string | NO | Filter by module (e.g., `M01`) |
| filter[targetType] | string | NO | Filter by `tier` or `org` |
| filter[targetId] | string | NO | Filter by specific target ID |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "moduleName": "M08",
      "targetType": "org",
      "targetId": "660e8400-e29b-41d4-a716-446655440000",
      "enabled": true
    }
  ]
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Flag ID |
| moduleName | string | NO | — | Module identifier |
| targetType | string | NO | enum | `tier` or `org` |
| targetId | string | NO | uuid | Target entity ID |
| enabled | boolean | NO | — | Toggle state |

---

#### PUT `/admin/feature-flags`

**Toggle a feature flag for a module/target combination**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-021 |
| Business rules | M3-R9 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| moduleName | string | YES | NO | — | Valid module ID | — | `"M08"` |
| targetType | string | YES | NO | enum | `tier` or `org` | — | `"org"` |
| targetId | string | YES | NO | uuid | Target entity ID | — | `"660e8400-..."` |
| enabled | boolean | YES | NO | — | — | — | `true` |

**Response** `200 OK`

```json
{
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "moduleName": "M08",
    "targetType": "org",
    "targetId": "660e8400-e29b-41d4-a716-446655440000",
    "enabled": true,
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M03-002 | 422 | Feature flag not found |
| — | 400 | M01 (auth) cannot be disabled |

---

### 2.4 Impersonation

#### POST `/admin/impersonate`

**Start an impersonation session (read-only) for support purposes**

| Property | Value |
|----------|-------|
| Auth | PA (super, support-limited) + MFA required |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-023 |
| Business rules | M3-R1, M3-R2, M3-R3, M3-R4, M3-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| targetPersonId | string | YES | NO | uuid | Cannot be another admin (M3-R5) | — | `"550e8400-..."` |

**Response** `200 OK`

```json
{
  "data": {
    "sessionId": "880e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "eyJhbGciOi...",
    "expiresAt": "2026-05-21T10:30:00Z",
    "targetPerson": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "Maria",
      "email": "maria@example.com"
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| sessionId | string | NO | uuid | Impersonation session ID |
| sessionToken | string | NO | — | Session token scoped to target user (read-only) |
| expiresAt | string | NO | date-time | Auto-terminate at startedAt + 30 min (M3-R3) |
| targetPerson.id | string | NO | uuid | Target person ID |
| targetPerson.firstName | string | NO | — | Target first name |
| targetPerson.email | string | NO | email | Target email |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M03-004 | 422 | Impersonation session limit exceeded |
| — | 403 | Target is another admin (M3-R5) |
| — | 404 | Target person not found |

---

#### DELETE `/admin/impersonate`

**End the current impersonation session**

| Property | Value |
|----------|-------|
| Auth | PA (super, support) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-023 |
| Business rules | M3-R2 |

**Response** `200 OK`

```json
{
  "data": {
    "ended": true,
    "duration": 845,
    "pagesVisited": 12
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| ended | boolean | NO | — | Always true |
| duration | integer | NO | — | Session duration in seconds |
| pagesVisited | integer | NO | — | Number of pages navigated |

---

### 2.5 Admin Team

#### POST `/admin/team/invite`

**Invite a new platform admin**

| Property | Value |
|----------|-------|
| Auth | PA (super only) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-022 |
| Business rules | M3-R7 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"admin@memberry.com"` |
| role | string | YES | NO | enum | `super`, `admin`, `support` | — | `"admin"` |

**Response** `201 Created`

```json
{
  "data": {
    "adminId": "990e8400-e29b-41d4-a716-446655440000",
    "email": "admin@memberry.com",
    "role": "admin",
    "invitedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| adminId | string | NO | uuid | New admin ID |
| email | string | NO | email | Admin email |
| role | string | NO | enum | Assigned role |
| invitedAt | string | NO | date-time | Invitation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 409 | Email already has admin role |

---

#### PUT `/admin/team/:id/role`

**Change a platform admin's role**

| Property | Value |
|----------|-------|
| Auth | PA (super only) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-022 |
| Business rules | M3-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| newRole | string | YES | NO | enum | `super`, `admin`, `support` | — | `"support"` |

**Response** `200 OK`

```json
{
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440000",
    "role": "support",
    "previousRole": "admin",
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Admin ID |
| role | string | NO | enum | New role |
| previousRole | string | NO | enum | Role before change |
| updatedAt | string | NO | date-time | Update timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M03-001 | 422 | Cannot demote last super admin (M3-R6) |

---

#### DELETE `/admin/team/:id`

**Remove a platform admin**

| Property | Value |
|----------|-------|
| Auth | PA (super only) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-022 |
| Business rules | M3-R6 |

**Response** `204 No Content`

No response body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M03-001 | 422 | Cannot remove last super admin (M3-R6) |
| — | 404 | Admin not found |

---

### 2.6 Analytics

#### GET `/admin/analytics/revenue`

**Revenue dashboard data (MRR, ARR, churn)**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin, support) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-023 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[dateRange][gte] | string | NO | Start date (ISO 8601) |
| filter[dateRange][lt] | string | NO | End date (ISO 8601) |
| filter[associationId] | string | NO | Filter by association |
| filter[orgType] | string | NO | Filter by org type |

**Response** `200 OK`

```json
{
  "data": {
    "mrr": 125000.00,
    "arr": 1500000.00,
    "churnRate": 2.3,
    "activeOrgs": 42,
    "trialOrgs": 8,
    "currency": "PHP",
    "periodStart": "2026-05-01T00:00:00Z",
    "periodEnd": "2026-05-31T23:59:59Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| mrr | number | NO | decimal | Monthly recurring revenue |
| arr | number | NO | decimal | Annual recurring revenue |
| churnRate | number | NO | decimal | Churn percentage for period |
| activeOrgs | integer | NO | — | Active organization count |
| trialOrgs | integer | NO | — | Trial organization count |
| currency | string | NO | — | ISO 4217 |
| periodStart | string | NO | date-time | Period start |
| periodEnd | string | NO | date-time | Period end |

---

#### GET `/admin/analytics/health`

**Organization health scores**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin, support) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-023 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | integer | NO | Items per page (default: 20, max: 100) |
| after | string | NO | Cursor for pagination |
| filter[associationId] | string | NO | Filter by association |
| filter[healthScore][lte] | integer | NO | Filter by score threshold |
| sort | string | NO | Sort field (default: `healthScore`) |

**Response** `200 OK`

```json
{
  "data": [
    {
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "organizationName": "PDA NCR Chapter",
      "healthScore": 78,
      "activeMemberCount": 156,
      "duesCollectionRate": 0.85,
      "lastEventDate": "2026-05-15T14:00:00Z",
      "updatedAt": "2026-05-21T08:00:00Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYzEyMyJ9",
    "hasMore": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| organizationId | string | NO | uuid | Org ID |
| organizationName | string | NO | — | Org display name |
| healthScore | integer | NO | — | 0-100, computed hourly |
| activeMemberCount | integer | NO | — | Active members |
| duesCollectionRate | number | NO | decimal | Dues collection percentage |
| lastEventDate | string | YES | date-time | Most recent event |
| updatedAt | string | NO | date-time | Score computation time |

---

### 2.7 Pricing

#### PUT `/admin/pricing`

**Update subscription pricing (applies to new subscriptions only)**

| Property | Value |
|----------|-------|
| Auth | PA (super only) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-021 |
| Business rules | M3-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| tierId | string | YES | NO | uuid | Existing pricing tier | — | `"aa0e8400-..."` |
| monthlyPrice | number | NO | NO | decimal | >= 0 | — | `500.00` |
| annualPrice | number | NO | NO | decimal | >= 0 | — | `5000.00` |
| currency | string | NO | NO | — | ISO 4217 | — | `"PHP"` |

**Response** `200 OK`

```json
{
  "data": {
    "tierId": "aa0e8400-e29b-41d4-a716-446655440000",
    "monthlyPrice": 500.00,
    "annualPrice": 5000.00,
    "currency": "PHP",
    "effectiveFor": "new_subscriptions_only",
    "updatedAt": "2026-05-21T10:00:00Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| tierId | string | NO | uuid | Pricing tier ID |
| monthlyPrice | number | NO | decimal | Monthly price |
| annualPrice | number | NO | decimal | Annual price |
| currency | string | NO | — | ISO 4217 |
| effectiveFor | string | NO | — | Always `new_subscriptions_only` (M3-R8) |
| updatedAt | string | NO | date-time | Update timestamp |

---

## 3. Domain Events

### Published Events

| Event Name | Trigger Endpoint | Payload |
|------------|-----------------|---------|
| AssociationCreated | `POST /admin/associations` | `{ associationId, country, licenseFormatRegex }` |
| OrganizationCreated | `POST /admin/associations/:id/orgs` | `{ orgId, associationId, orgType }` |
| OrgStatusTransitioned | `PUT /admin/orgs/:id/status` | `{ orgId, oldStatus, newStatus }` |
| FeatureFlagChanged | `PUT /admin/feature-flags` | `{ moduleName, targetType, targetId, enabled }` |
| ImpersonationStarted | `POST /admin/impersonate` | `{ adminId, targetPersonId, expiresAt }` |
| ImpersonationEnded | `DELETE /admin/impersonate` | `{ adminId, targetPersonId, duration, reason }` |
| AdminInvited | `POST /admin/team/invite` | `{ adminId, role, invitedBy }` |

### Consumed Events

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| PaymentRecorded | M06 | Update subscription status (trial -> active if applicable) |
| PersonAnonymized | M02 | Cleanup references, remove from support assignments |

---

## 4. Entity Summary

| Entity | Primary Key | Unique Constraints | Notes |
|--------|------------|-------------------|-------|
| Association | `id` (uuid) | `name` (globally unique) | Country-level entity |
| Organization | `id` (uuid) | `slug` (globally unique), `(associationId, name)` | Org lifecycle state machine |
| FeatureFlag | `id` (uuid) | `(moduleName, targetType, targetId)` | Module toggle |
| ImpersonationSession | `id` (uuid) | — | 30-min TTL, read-only |
| PlatformAdmin | `id` (uuid) | `email` | Roles: super, admin, support |
