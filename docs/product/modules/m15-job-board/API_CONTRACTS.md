<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Job Board (M15)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/orgs/{organizationId}/jobs` |
| Auth default | GA (session required) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session; `organizationId` as path param |

---

## 2. Endpoints

### 2.1 Job Postings

#### GET `/orgs/{organizationId}/jobs`

**List active job postings with filters and search**

| Property | Value |
|----------|-------|
| Auth | GA — any active member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-087 |
| Business rules | M15-R1 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization to browse jobs in |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| before | string | No | Cursor for backward pagination |
| search | string | No | Full-text search on title + description (min 2 chars) |
| filter[type] | string | No | Comma-separated: `full_time`, `part_time`, `contract`, `fellowship`, `internship` |
| filter[specialty] | string | No | Medical specialty filter |
| filter[location] | string | No | Location filter |
| filter[status] | string | No | Status filter (officers/admin only; default: `active`) |
| sort | string | No | Sort field: `postedAt`, `-postedAt`, `title`, `-title`. Default: `-postedAt` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of job posting summaries |
| data[].id | string | No | uuid | Posting ID |
| data[].organizationId | string | No | uuid | Posting organization |
| data[].title | string | No | — | Job title |
| data[].organizationName | string | No | — | Company/org name |
| data[].type | string | No | enum | `full_time`, `part_time`, `contract`, `fellowship`, `internship` |
| data[].location | string | No | — | Job location |
| data[].salary | string | Yes | — | Salary range |
| data[].specialty | string | Yes | — | Medical specialty |
| data[].status | string | No | enum | `draft`, `active`, `pending_review`, `filled`, `expired`, `closed` |
| data[].postedAt | string | Yes | ISO 8601 | Publication timestamp |
| data[].expiresAt | string | No | ISO 8601 | Auto-expiry date |
| data[].createdAt | string | No | ISO 8601 | Creation timestamp |
| data[].isBookmarked | boolean | No | — | Whether current user has bookmarked this listing |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor |
| meta.hasMore | boolean | No | — | Whether more results exist |
| meta.total | number | Yes | — | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | User not member of organization |
| `VALIDATION-007` | 400 | Invalid filter or sort parameter |

---

#### GET `/orgs/{organizationId}/jobs/{jobId}`

**Get full job posting detail**

| Property | Value |
|----------|-------|
| Auth | GA — any active member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-087 |
| Business rules | M15-R1 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Job posting ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Full job posting |
| data.id | string | No | uuid | Posting ID |
| data.organizationId | string | No | uuid | Posting organization |
| data.title | string | No | — | Job title |
| data.organizationName | string | No | — | Company/org name |
| data.description | string | No | — | Full job description |
| data.type | string | No | enum | Job type |
| data.location | string | No | — | Location |
| data.salary | string | Yes | — | Salary range |
| data.specialty | string | Yes | — | Medical specialty |
| data.requirements | array | Yes | string[] | Job requirements list |
| data.applicationUrl | string | Yes | url | External application link |
| data.applicationEmail | string | Yes | email | Email for applications |
| data.status | string | No | enum | Posting status |
| data.expiresAt | string | No | ISO 8601 | Auto-expiry date |
| data.postedAt | string | Yes | ISO 8601 | Publication timestamp |
| data.postedBy | string | No | uuid | Person who posted |
| data.isBookmarked | boolean | No | — | Whether current user bookmarked |
| data.hasApplied | boolean | No | — | Whether current user has applied |
| data.createdAt | string | No | ISO 8601 | Creation timestamp |
| data.updatedAt | string | No | ISO 8601 | Last update timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not a member |
| `NOT_FOUND-001` | 404 | Job posting not found |
| `M15-001` | 422 | Job listing expired |

---

#### POST `/orgs/{organizationId}/jobs`

**Create a new job posting**

| Property | Value |
|----------|-------|
| Auth | GA+HG — Officers (Secretary, President) or verified external employer |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-088 |
| Business rules | M15-R2 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization to post in |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | Yes | No | — | maxLength: 255 | — | `"Dental Surgeon - Full Time"` |
| organizationName | string | Yes | No | — | maxLength: 255 | — | `"Metro Dental Clinic"` |
| description | string | Yes | No | text | — | — | `"Looking for an experienced dental surgeon..."` |
| type | string | Yes | No | enum | `full_time`, `part_time`, `contract`, `fellowship`, `internship` | — | `"full_time"` |
| location | string | Yes | No | — | maxLength: 500 | — | `"Manila, Philippines"` |
| salary | string | No | Yes | — | maxLength: 255 | `null` | `"PHP 80,000 - 120,000/month"` |
| specialty | string | No | Yes | — | maxLength: 255 | `null` | `"Oral Surgery"` |
| requirements | array | No | Yes | string[] | maxItems: 20 | `[]` | `["5 years experience", "PRC license"]` |
| applicationUrl | string | No | Yes | url | Valid URL | `null` | `"https://apply.example.com/123"` |
| applicationEmail | string | No | Yes | email | Valid email | `null` | `"hr@example.com"` |
| status | string | No | No | enum | `draft` or `active` (officers only; external employers always enter `pending_review`) | `"active"` | `"draft"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created job posting (same shape as GET detail) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer or approved employer |
| `VALIDATION-001` | 400 | Request body validation failed |
| `VALIDATION-002` | 400 | Missing required field |
| `M15-002` | 422 | External employer not verified |
| `M15-005` | 422 | Listing pending review, cannot publish |

---

#### PATCH `/orgs/{organizationId}/jobs/{jobId}`

**Update a job posting**

| Property | Value |
|----------|-------|
| Auth | GA+HG — Officers or posting author |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-088, WF-090 |
| Business rules | M15-R3, M15-R4 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Posting ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | No | No | — | maxLength: 255 | — | `"Updated Title"` |
| description | string | No | No | text | — | — | `"Updated description..."` |
| type | string | No | No | enum | Valid job type | — | `"part_time"` |
| location | string | No | No | — | maxLength: 500 | — | `"Cebu, Philippines"` |
| salary | string | No | Yes | — | maxLength: 255 | — | `"PHP 60,000/month"` |
| specialty | string | No | Yes | — | maxLength: 255 | — | `"General Dentistry"` |
| requirements | array | No | Yes | string[] | maxItems: 20 | — | `["3 years experience"]` |
| applicationUrl | string | No | Yes | url | — | — | — |
| applicationEmail | string | No | Yes | email | — | — | — |
| status | string | No | No | enum | Must follow state machine (see M15 spec section 8) | — | `"closed"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated job posting |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not authorized to edit |
| `NOT_FOUND-001` | 404 | Posting not found |
| `M15-004` | 422 | Cannot edit expired listing |
| `CONFLICT-001` | 412 | ETag mismatch |
| `CONFLICT-003` | 409 | Invalid state transition |

---

### 2.2 Job Applications

#### POST `/orgs/{organizationId}/jobs/{jobId}/apply`

**Apply to a job posting**

| Property | Value |
|----------|-------|
| Auth | GA — active members only |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-087 |
| Business rules | M15-R1, M15-R5 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Job posting ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| resumeRef | string | No | Yes | — | File reference from Storage module | `null` | `"storage://uploads/resume-abc123.pdf"` |
| coverLetter | string | No | Yes | text | maxLength: 5000 | `null` | `"Dear hiring manager..."` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Application record |
| data.id | string | No | uuid | Application ID |
| data.postingId | string | No | uuid | Job posting ID |
| data.personId | string | No | uuid | Applicant person ID |
| data.resumeRef | string | Yes | — | Resume file reference |
| data.coverLetter | string | Yes | — | Cover letter text |
| data.status | string | No | enum | `applied` |
| data.appliedAt | string | No | ISO 8601 | Application timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not an active member (grace/lapsed denied) |
| `NOT_FOUND-001` | 404 | Job posting not found |
| `M15-001` | 422 | Job listing expired |
| `CONFLICT-002` | 409 | Already applied to this listing |

---

### 2.3 Bookmarks

#### POST `/orgs/{organizationId}/jobs/{jobId}/bookmark`

**Bookmark a job listing**

| Property | Value |
|----------|-------|
| Auth | GA — active members only |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-087 |
| Business rules | M15-R1 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Job posting ID |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Bookmark record |
| data.id | string | No | uuid | Bookmark ID |
| data.personId | string | No | uuid | Member ID |
| data.jobPostingId | string | No | uuid | Job posting ID |
| data.createdAt | string | No | ISO 8601 | Timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not an active member |
| `NOT_FOUND-001` | 404 | Job posting not found |
| `CONFLICT-002` | 409 | Already bookmarked |

---

#### DELETE `/orgs/{organizationId}/jobs/{jobId}/bookmark`

**Remove a job bookmark**

| Property | Value |
|----------|-------|
| Auth | GA — active members only |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-087 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Job posting ID |

**Response** `204 No Content`

Empty body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `NOT_FOUND-001` | 404 | Bookmark not found |

---

### 2.4 Job Alerts

#### GET `/orgs/{organizationId}/jobs/alerts`

**List member's job alerts**

| Property | Value |
|----------|-------|
| Auth | GA — active members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-091 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of job alerts |
| data[].id | string | No | uuid | Alert ID |
| data[].personId | string | No | uuid | Member ID |
| data[].keywords | string | Yes | — | Search terms |
| data[].specialty | string | Yes | — | Specialty filter |
| data[].location | string | Yes | — | Location filter |
| data[].createdAt | string | No | ISO 8601 | Creation timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not a member |

---

#### POST `/orgs/{organizationId}/jobs/alerts`

**Create a job alert**

| Property | Value |
|----------|-------|
| Auth | GA — active members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-091 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| keywords | string | No | Yes | — | maxLength: 255; at least one of keywords/specialty/location required | `null` | `"dental surgeon"` |
| specialty | string | No | Yes | — | maxLength: 255 | `null` | `"Oral Surgery"` |
| location | string | No | Yes | — | maxLength: 255 | `null` | `"Manila"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created alert (same shape as list item) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not an active member |
| `VALIDATION-001` | 400 | No filter criteria provided |
| `M15-003` | 422 | Job alert limit exceeded (max 10 per member) |

---

#### DELETE `/orgs/{organizationId}/jobs/alerts/{alertId}`

**Delete a job alert**

| Property | Value |
|----------|-------|
| Auth | GA — alert owner |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-091 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| alertId | string (uuid) | Yes | Alert ID |

**Response** `204 No Content`

Empty body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-003` | 403 | Alert owned by another user |
| `NOT_FOUND-001` | 404 | Alert not found |

---

### 2.5 External Employer Management

#### GET `/admin/jobs/employers`

**List external employers (platform admin)**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-089 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| filter[status] | string | No | `pending`, `approved`, `rejected` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of employer records |
| data[].id | string | No | uuid | Employer ID |
| data[].companyName | string | No | — | Company name |
| data[].contactEmail | string | No | email | Contact email |
| data[].contactName | string | No | — | Contact person name |
| data[].description | string | Yes | — | Company description |
| data[].status | string | No | enum | `pending`, `approved`, `rejected` |
| data[].createdAt | string | No | ISO 8601 | Registration timestamp |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor |
| meta.hasMore | boolean | No | — | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |

---

#### POST `/admin/jobs/employers/{employerId}/approve`

**Approve an external employer**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-089 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employerId | string (uuid) | Yes | Employer ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated employer record |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Employer not found |
| `CONFLICT-003` | 409 | Employer already approved or rejected |

---

#### POST `/admin/jobs/employers/{employerId}/reject`

**Reject an external employer**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-089 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employerId | string (uuid) | Yes | Employer ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | Yes | No | — | maxLength: 500 | — | `"Insufficient company information"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated employer record |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Employer not found |
| `CONFLICT-003` | 409 | Employer already approved or rejected |

---

### 2.6 Listing Extension

#### POST `/orgs/{organizationId}/jobs/{jobId}/extend`

**Extend an expired job listing (resets 30-day counter)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — original poster or org officer |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-090 |
| Business rules | BR-37, M15-R4 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| jobId | string (uuid) | Yes | Job posting ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated posting with new expiresAt |
| data.id | string | No | uuid | Posting ID |
| data.status | string | No | enum | `active` |
| data.expiresAt | string | No | ISO 8601 | New expiry date (now + 30 days) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not the poster or an officer |
| `NOT_FOUND-001` | 404 | Posting not found |
| `CONFLICT-003` | 409 | Posting is not in expired status (only expired listings can be extended) |
