<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Professional Feed (M13)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/orgs/{organizationId}/feed` |
| Auth default | GA (session required) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session; `organizationId` as path param |

---

## 2. Endpoints

### 2.1 Feed Posts

#### GET `/orgs/{organizationId}/feed`

**List feed posts for an organization (infinite scroll)**

| Property | Value |
|----------|-------|
| Auth | GA — any active member of the org |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-080 |
| Business rules | M13-R1, M13-R2, M13-R3 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization to fetch feed for |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| before | string | No | Cursor for backward pagination |
| filter[postType] | string | No | Filter by post type. Comma-separated: `announcement`, `event_highlight`, `training_opportunity`, `achievement`, `clinical_update` |
| filter[status] | string | No | Filter by status (officers only; default: `published`) |
| filter[visibility] | string | No | Filter by visibility: `org`, `network` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of post objects |
| data[].id | string | No | uuid | Post ID |
| data[].organizationId | string | No | uuid | Source organization |
| data[].authorId | string | No | uuid | Author person ID |
| data[].authorName | string | No | — | Denormalized author display name |
| data[].postType | string | No | enum | `announcement`, `event_highlight`, `training_opportunity`, `achievement`, `clinical_update` |
| data[].body | string | No | — | Post text content |
| data[].imageUrls | array | Yes | url[] | Up to 4 image URLs |
| data[].visibility | string | No | enum | `org`, `network` |
| data[].status | string | No | enum | `draft`, `published`, `hidden`, `removed` |
| data[].createdAt | string | No | ISO 8601 | Creation timestamp |
| data[].updatedAt | string | No | ISO 8601 | Last update timestamp |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor for next page |
| meta.hasMore | boolean | No | — | Whether more results exist |
| meta.total | number | Yes | — | Total count (when cheap) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | User not member of organization |
| `VALIDATION-007` | 400 | Invalid filter or pagination parameter |
| `NOT_FOUND-001` | 404 | Organization not found |

---

#### GET `/orgs/{organizationId}/feed/{postId}`

**Get a single feed post by ID**

| Property | Value |
|----------|-------|
| Auth | GA — any active member of the org |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-080 |
| Business rules | M13-R1 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| postId | string (uuid) | Yes | Post ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Post object |
| data.id | string | No | uuid | Post ID |
| data.organizationId | string | No | uuid | Source organization |
| data.authorId | string | No | uuid | Author person ID |
| data.authorName | string | No | — | Denormalized author display name |
| data.postType | string | No | enum | Post type |
| data.body | string | No | — | Post text content |
| data.imageUrls | array | Yes | url[] | Image URLs |
| data.visibility | string | No | enum | `org`, `network` |
| data.status | string | No | enum | Post status |
| data.createdAt | string | No | ISO 8601 | Creation timestamp |
| data.updatedAt | string | No | ISO 8601 | Last update timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | User not member of organization |
| `NOT_FOUND-001` | 404 | Post not found |
| `M13-003` | 422 | Post removed |

---

#### POST `/orgs/{organizationId}/feed`

**Create a new feed post**

| Property | Value |
|----------|-------|
| Auth | GA+HG — Officers (Secretary, President) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-081 |
| Business rules | M13-R4, M13-R5 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization to post in |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| postType | string | Yes | No | enum | `announcement`, `event_highlight`, `training_opportunity`, `achievement`, `clinical_update` | — | `"announcement"` |
| body | string | Yes | No | — | maxLength: 2000 | — | `"Important update for all members..."` |
| imageUrls | array | No | Yes | url[] | maxItems: 4, each must be valid URL | `[]` | `["https://cdn.example.com/img1.jpg"]` |
| visibility | string | No | No | enum | `org`, `network` | `"org"` | `"org"` |
| status | string | No | No | enum | `draft`, `published` | `"published"` | `"published"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created post object (same shape as GET) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer (Secretary/President) |
| `VALIDATION-001` | 400 | Request body validation failed |
| `M13-001` | 422 | Post content exceeds 2000 character limit |
| `NOT_FOUND-001` | 404 | Organization not found |

---

#### PATCH `/orgs/{organizationId}/feed/{postId}`

**Update a feed post (edit content or moderate)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — Officers (Secretary, President) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-081, WF-082 |
| Business rules | M13-R4, M13-R5, M13-R2 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| postId | string (uuid) | Yes | Post ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| body | string | No | No | — | maxLength: 2000 | — | `"Updated content..."` |
| imageUrls | array | No | Yes | url[] | maxItems: 4 | — | `[]` |
| visibility | string | No | No | enum | `org`, `network` | — | `"network"` |
| status | string | No | No | enum | Must follow state machine: published->hidden, hidden->published, published->removed, hidden->removed | — | `"hidden"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated post object |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer |
| `NOT_FOUND-001` | 404 | Post not found |
| `M13-001` | 422 | Content exceeds character limit |
| `M13-002` | 422 | Cannot edit post after 24 hours |
| `CONFLICT-001` | 412 | ETag mismatch (If-Match) |
| `CONFLICT-003` | 409 | Invalid state transition |

---

#### DELETE `/orgs/{organizationId}/feed/{postId}`

**Remove a feed post (permanent)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — Officers (Secretary, President) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-082 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| postId | string (uuid) | Yes | Post ID |

**Response** `204 No Content`

Empty body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer |
| `NOT_FOUND-001` | 404 | Post not found |
| `M13-003` | 422 | Post already removed |

---

### 2.2 Mute Preferences

#### POST `/orgs/{organizationId}/feed/mute`

**Mute an author (hide their posts from your feed)**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-083 |
| Business rules | M13-R3 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization scope |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| mutedPersonId | string | Yes | No | uuid | Must be a valid person ID | — | `"550e8400-e29b-41d4-a716-446655440000"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Mute preference record |
| data.id | string | No | uuid | Mute preference ID |
| data.personId | string | No | uuid | Member who muted |
| data.mutedPersonId | string | No | uuid | Author who is muted |
| data.organizationId | string | No | uuid | Organization scope |
| data.createdAt | string | No | ISO 8601 | Timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-002` | 403 | Not a member of the org |
| `NOT_FOUND-001` | 404 | Muted person not found |
| `M13-005` | 422 | Already muted this author |

---

#### DELETE `/orgs/{organizationId}/feed/mute/{mutedPersonId}`

**Unmute an author**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-083 |
| Business rules | M13-R3 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization scope |
| mutedPersonId | string (uuid) | Yes | Person to unmute |

**Response** `204 No Content`

Empty body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `NOT_FOUND-001` | 404 | Mute preference not found |

---

### 2.3 Post Reporting

#### POST `/orgs/{organizationId}/feed/{postId}/report`

**Report a post for moderation review**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-082 |
| Business rules | BR-35 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string (uuid) | Yes | Organization ID |
| postId | string (uuid) | Yes | Post ID to report |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | Yes | No | — | maxLength: 500 | — | `"Inappropriate content"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Report confirmation |
| data.id | string | No | uuid | Report ID |
| data.postId | string | No | uuid | Reported post |
| data.reporterId | string | No | uuid | Reporter person ID |
| data.reason | string | No | — | Report reason |
| data.createdAt | string | No | ISO 8601 | Timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `NOT_FOUND-001` | 404 | Post not found |
| `M13-004` | 422 | Already reported this post |
| `M13-003` | 422 | Post already removed |
