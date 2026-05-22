<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Advertising (M16)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/admin/advertising` (admin), `/ads` (member-facing), `/settings` (opt-out) |
| Auth default | PA for campaign management; GA for member-facing endpoints |
| Rate limit tier | Admin (300 req/min) for admin routes; Authenticated (120 req/min) for member routes |
| Tenant scoping | `associationId` from session; `organizationId` on entities |

---

## 2. Endpoints

### 2.1 Advertisers

#### GET `/admin/advertising/advertisers`

**List registered advertisers**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-092 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| filter[isActive] | boolean | No | Filter by active status |
| search | string | No | Search company name (min 2 chars) |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of advertiser records |
| data[].id | string | No | uuid | Advertiser ID |
| data[].organizationId | string | No | uuid | Association org FK |
| data[].companyName | string | No | — | Company name |
| data[].contactEmail | string | No | email | Contact email |
| data[].contactPersonId | string | Yes | uuid | Optional linked person |
| data[].isActive | boolean | No | — | Active status |
| data[].createdAt | string | No | ISO 8601 | Creation timestamp |
| data[].updatedAt | string | No | ISO 8601 | Last update |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor |
| meta.hasMore | boolean | No | — | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |

---

#### POST `/admin/advertising/advertisers`

**Register a new advertiser**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-092 |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| organizationId | string | Yes | No | uuid | Must be valid org within association | — | `"550e8400-e29b-41d4-a716-446655440000"` |
| companyName | string | Yes | No | — | maxLength: 255, not empty | — | `"PhilDental Supplies Inc."` |
| contactEmail | string | Yes | No | email | Valid email | — | `"ads@phildental.com"` |
| contactPersonId | string | No | Yes | uuid | Optional link to person | `null` | — |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created advertiser (same shape as list item) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `VALIDATION-001` | 400 | Request body validation failed |
| `VALIDATION-003` | 400 | Invalid email format |
| `CONFLICT-002` | 409 | Advertiser with same company name already exists |

---

#### PATCH `/admin/advertising/advertisers/{advertiserId}`

**Update an advertiser**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | — |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| advertiserId | string (uuid) | Yes | Advertiser ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| companyName | string | No | No | — | maxLength: 255 | — | `"Updated Company Name"` |
| contactEmail | string | No | No | email | Valid email | — | `"new@email.com"` |
| contactPersonId | string | No | Yes | uuid | — | — | — |
| isActive | boolean | No | No | — | — | — | `false` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated advertiser |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Advertiser not found |
| `CONFLICT-001` | 412 | ETag mismatch |

---

### 2.2 Campaigns

#### GET `/admin/advertising/campaigns`

**List advertising campaigns**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-096 |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Items per page (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |
| filter[status] | string | No | Comma-separated: `draft`, `pending_review`, `active`, `paused`, `completed`, `rejected` |
| filter[advertiserId] | string (uuid) | No | Filter by advertiser |
| filter[adSlot] | string | No | Filter by slot: `feed_banner`, `sidebar`, `email_footer`, `event_sponsor` |
| sort | string | No | `createdAt`, `-createdAt`, `name`, `-name`. Default: `-createdAt` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | — | Array of campaign objects |
| data[].id | string | No | uuid | Campaign ID |
| data[].organizationId | string | No | uuid | Association org FK |
| data[].advertiserId | string | No | uuid | Advertiser FK |
| data[].advertiserName | string | No | — | Denormalized advertiser company name |
| data[].name | string | No | — | Campaign name |
| data[].status | string | No | enum | `draft`, `pending_review`, `active`, `paused`, `completed`, `rejected` |
| data[].budgetCents | number | No | integer | Total budget in cents |
| data[].spentCents | number | No | integer | Amount spent in cents |
| data[].adSlot | string | No | enum | Placement slot |
| data[].startsAt | string | Yes | ISO 8601 | Campaign start |
| data[].endsAt | string | Yes | ISO 8601 | Campaign end |
| data[].impressions | number | No | integer | Total impressions |
| data[].clicks | number | No | integer | Total clicks |
| data[].ctr | number | No | float | Click-through rate (clicks/impressions) |
| data[].createdAt | string | No | ISO 8601 | Creation timestamp |
| meta | object | No | — | Pagination metadata |
| meta.cursor | string | Yes | — | Opaque cursor |
| meta.hasMore | boolean | No | — | More results exist |
| meta.total | number | Yes | — | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `VALIDATION-007` | 400 | Invalid filter or sort |

---

#### GET `/admin/advertising/campaigns/{campaignId}`

**Get campaign detail with metrics**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-096 |
| Business rules | — |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| campaignId | string (uuid) | Yes | Campaign ID |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Full campaign detail |
| data.id | string | No | uuid | Campaign ID |
| data.organizationId | string | No | uuid | Org FK |
| data.advertiserId | string | No | uuid | Advertiser FK |
| data.advertiserName | string | No | — | Company name |
| data.name | string | No | — | Campaign name |
| data.description | string | Yes | — | Campaign description |
| data.status | string | No | enum | Campaign status |
| data.targetSegmentId | string | Yes | — | Segment identifier |
| data.targetSegmentSize | number | Yes | integer | Audience size (no PII) |
| data.budgetCents | number | No | integer | Total budget |
| data.spentCents | number | No | integer | Amount spent |
| data.adSlot | string | No | enum | Placement slot |
| data.startsAt | string | Yes | ISO 8601 | Start date |
| data.endsAt | string | Yes | ISO 8601 | End date |
| data.impressions | number | No | integer | Total impressions |
| data.clicks | number | No | integer | Total clicks |
| data.ctr | number | No | float | Click-through rate |
| data.creatives | array | No | — | Array of campaign creatives |
| data.creatives[].id | string | No | uuid | Creative ID |
| data.creatives[].title | string | No | — | Ad title |
| data.creatives[].bodyText | string | No | — | Ad body copy |
| data.creatives[].imageUrl | string | Yes | url | Ad image |
| data.creatives[].clickUrl | string | Yes | url | Destination URL |
| data.creatives[].status | string | No | enum | `pending`, `approved`, `rejected` |
| data.creatives[].sponsoredLabel | boolean | No | — | "Sponsored" flag |
| data.creatives[].reviewedBy | string | Yes | uuid | Reviewer person ID |
| data.creatives[].reviewedAt | string | Yes | ISO 8601 | Review timestamp |
| data.creatives[].rejectionReason | string | Yes | — | Rejection reason |
| data.createdAt | string | No | ISO 8601 | Creation timestamp |
| data.updatedAt | string | No | ISO 8601 | Last update |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Campaign not found |

---

#### POST `/admin/advertising/campaigns`

**Create a new advertising campaign**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-092 |
| Business rules | M16-R1, M16-R2, M16-R6, M16-R7 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| advertiserId | string | Yes | No | uuid | Must reference active advertiser | — | `"550e8400-..."` |
| name | string | Yes | No | — | maxLength: 255, not empty | — | `"Q3 Dental Supplies Promo"` |
| description | string | No | Yes | text | — | `null` | `"Quarterly promotion for dental supplies"` |
| targetSegmentId | string | No | Yes | — | Segment identifier (specialty/location/association) | `null` | `"specialty:oral-surgery"` |
| budgetCents | number | Yes | No | integer | > 0 | — | `100000` |
| startsAt | string | No | Yes | ISO 8601 | Must be in the future if provided | `null` | `"2026-06-01T00:00:00.000Z"` |
| endsAt | string | No | Yes | ISO 8601 | Must be after startsAt | `null` | `"2026-06-30T23:59:59.000Z"` |
| adSlot | string | Yes | No | enum | `feed_banner`, `sidebar`, `email_footer`, `event_sponsor` | — | `"feed_banner"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created campaign (status: `draft`) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `VALIDATION-001` | 400 | Request body validation failed |
| `M16-001` | 422 | Budget must be positive |
| `M16-003` | 422 | Ad slot not available for requested dates |
| `M16-005` | 422 | Advertiser billing not configured |
| `M16-006` | 422 | Campaign billing integration deferred |
| `NOT_FOUND-001` | 404 | Advertiser not found |

---

#### PATCH `/admin/advertising/campaigns/{campaignId}`

**Update campaign configuration or change status**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-092, WF-094 |
| Business rules | M16-R6 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| campaignId | string (uuid) | Yes | Campaign ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | No | No | — | maxLength: 255 | — | `"Updated name"` |
| description | string | No | Yes | text | — | — | — |
| targetSegmentId | string | No | Yes | — | — | — | — |
| budgetCents | number | No | No | integer | > 0 | — | `200000` |
| startsAt | string | No | Yes | ISO 8601 | — | — | — |
| endsAt | string | No | Yes | ISO 8601 | After startsAt | — | — |
| adSlot | string | No | No | enum | Valid ad slot | — | — |
| status | string | No | No | enum | Must follow state machine (see section 8 of MODULE_SPEC) | — | `"active"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated campaign |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Campaign not found |
| `M16-001` | 422 | Budget must be positive |
| `M16-003` | 422 | Ad slot not available |
| `M16-004` | 422 | Campaign cannot be resumed after completion |
| `CONFLICT-001` | 412 | ETag mismatch |
| `CONFLICT-003` | 409 | Invalid state transition |

---

### 2.3 Creatives

#### POST `/admin/advertising/campaigns/{campaignId}/creatives`

**Add a creative to a campaign**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-092 |
| Business rules | M16-R1, M16-R3 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| campaignId | string (uuid) | Yes | Campaign ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | Yes | No | — | maxLength: 255, not empty | — | `"50% Off Dental Instruments"` |
| bodyText | string | Yes | No | text | maxLength: 500 | — | `"Premium dental instruments at half price..."` |
| imageUrl | string | No | Yes | url | Valid URL | `null` | `"https://cdn.example.com/ad-img.jpg"` |
| clickUrl | string | No | Yes | url | Valid URL | `null` | `"https://phildental.com/promo"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Created creative (status: `pending`) |
| data.id | string | No | uuid | Creative ID |
| data.organizationId | string | No | uuid | Org FK |
| data.campaignId | string | No | uuid | Campaign FK |
| data.title | string | No | — | Ad title |
| data.bodyText | string | No | — | Ad body |
| data.imageUrl | string | Yes | url | Image URL |
| data.clickUrl | string | Yes | url | Destination URL |
| data.status | string | No | enum | `pending` |
| data.sponsoredLabel | boolean | No | — | Always `true` |
| data.reviewedBy | string | Yes | uuid | Null until reviewed |
| data.reviewedAt | string | Yes | ISO 8601 | Null until reviewed |
| data.rejectionReason | string | Yes | — | Null |
| data.createdAt | string | No | ISO 8601 | Timestamp |
| data.updatedAt | string | No | ISO 8601 | Timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Campaign not found |
| `VALIDATION-001` | 400 | Request body validation failed |

---

#### PATCH `/admin/advertising/creatives/{creativeId}`

**Approve or reject a creative**

| Property | Value |
|----------|-------|
| Auth | PA — platform admin only |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-093 |
| Business rules | M16-R1 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creativeId | string (uuid) | Yes | Creative ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| status | string | Yes | No | enum | `approved` or `rejected` | — | `"approved"` |
| rejectionReason | string | No | Yes | — | Required when status=`rejected`; maxLength: 500 | `null` | `"Content violates advertising policy"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Updated creative with review info |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Not a platform admin |
| `NOT_FOUND-001` | 404 | Creative not found |
| `M16-002` | 422 | Creative content rejected by review (already rejected) |
| `CONFLICT-003` | 409 | Creative already reviewed (not in `pending` status) |
| `VALIDATION-002` | 400 | Missing rejectionReason when status=`rejected` |

---

### 2.4 Impression and Click Tracking

#### POST `/ads/{creativeId}/impression`

**Record an ad impression**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-094 |
| Business rules | M16-R6 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creativeId | string (uuid) | Yes | Creative ID |

**Response** `204 No Content`

Empty body. Impression recorded asynchronously.

**Error Codes**

No client-facing errors. Invalid creativeId silently ignored for performance.

---

#### POST `/ads/{creativeId}/click`

**Record an ad click**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-094 |
| Business rules | M16-R6 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creativeId | string (uuid) | Yes | Creative ID |

**Response** `204 No Content`

Empty body. Click recorded asynchronously.

**Error Codes**

No client-facing errors. Invalid creativeId silently ignored for performance.

---

### 2.5 Member Reporting

#### POST `/ads/{creativeId}/report`

**Report an inappropriate ad**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-095 |
| Business rules | M16-R5 |

**Path Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creativeId | string (uuid) | Yes | Creative ID |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | Yes | No | — | maxLength: 500, not empty | — | `"Misleading health claims"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Report record |
| data.id | string | No | uuid | Report ID |
| data.creativeId | string | No | uuid | Reported creative |
| data.reporterPersonId | string | No | uuid | Reporter ID |
| data.reason | string | No | — | Report reason |
| data.createdAt | string | No | ISO 8601 | Timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `NOT_FOUND-001` | 404 | Creative not found |
| `CONFLICT-002` | 409 | Already reported this ad |

---

### 2.6 Member Opt-Out

#### POST `/settings/ad-opt-out`

**Opt out of targeted ads**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | — |
| Business rules | M16-R4 |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Opt-out record |
| data.id | string | No | uuid | Opt-out ID |
| data.personId | string | No | uuid | Member ID |
| data.organizationId | string | No | uuid | Org FK |
| data.optedOutAt | string | No | ISO 8601 | Opt-out timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `CONFLICT-002` | 409 | Already opted out |

---

#### DELETE `/settings/ad-opt-out`

**Re-enable targeted ads (remove opt-out)**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | — |
| Business rules | M16-R4 |

**Response** `204 No Content`

Empty body.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `NOT_FOUND-001` | 404 | No opt-out record found (already opted in) |

---

#### GET `/settings/ad-opt-out`

**Check current opt-out status**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | — |
| Business rules | M16-R4 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | object | No | — | Opt-out status |
| data.isOptedOut | boolean | No | — | Current opt-out state |
| data.optedOutAt | string | Yes | ISO 8601 | When opted out (null if not) |

---

### 2.8 Ad Serving Integration (consumed by M13, M15, M17)

These endpoints are consumed by other modules' frontends to display contextual ads. They respect member opt-out (BR-48) and return only approved creatives (BR-45).

#### GET `/ads/placements/{slot}`

**Fetch ad creative for a specific placement slot**

| Property | Value |
|----------|-------|
| Auth | GA — any authenticated member |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-094: Ad Display |
| Business rules | BR-45 (admin-approved only), BR-46 (segment targeting), BR-47 (sponsored label), BR-48 (opt-out respected), BR-49 (budget check) |

**Path Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| slot | string | Placement slot: `feed_inline`, `job_board_sidebar`, `marketplace_banner`, `marketplace_featured` |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| context | string | NO | Context module: `feed`, `jobs`, `marketplace` |
| orgId | string | NO | Organization context for segment targeting |

**Response** `200 OK`

```json
{
  "data": {
    "creativeId": "uuid",
    "advertiserId": "uuid",
    "type": "banner",
    "imageUrl": "https://cdn.example.com/ad-banner.png",
    "targetUrl": "https://advertiser.example.com/offer",
    "sponsoredLabel": true,
    "impressionToken": "opaque-tracking-token"
  }
}
```

**Response** `204 No Content` — Member opted out or no eligible ads for this slot.

**Integration contracts:**

| Consumer Module | Slot | Context | Description |
|----------------|------|---------|-------------|
| M13 (Professional Feed) | `feed_inline` | `feed` | Inline sponsored post between feed items |
| M15 (Job Board) | `job_board_sidebar` | `jobs` | Sidebar ad on job listing pages |
| M17 (Marketplace) | `marketplace_banner` | `marketplace` | Banner ad on marketplace browse page |
| M17 (Marketplace) | `marketplace_featured` | `marketplace` | Featured/promoted vendor listing |
