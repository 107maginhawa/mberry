<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts -- Marketplace (M17)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/marketplace` (member), `/admin/marketplace` (platform admin) |
| Auth default | Authenticated session (GA); platform admin routes require PA |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session; `organizationId` from path param |

---

## 2. Endpoints

### 2.1 Vendors (Platform Admin)

#### POST `/admin/marketplace/vendors`

**Register a new vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | M17-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| organizationId | string | Yes | No | uuid | Valid org UUID | -- | `"550e8400-e29b-41d4-a716-446655440000"` |
| companyName | string | Yes | No | -- | 1-300 chars | -- | `"DentalSupply Co."` |
| category | string | Yes | No | enum | `emr`, `supplies`, `insurance`, `telehealth`, `other` | -- | `"supplies"` |
| description | string | Yes | No | -- | 1-5000 chars | -- | `"Premium dental supplies provider"` |
| contactEmail | string | Yes | No | email | Valid email | -- | `"contact@dentalsupply.com"` |
| websiteUrl | string | No | Yes | uri | Valid URL | `null` | `"https://dentalsupply.com"` |
| contactPersonId | string | No | Yes | uuid | Valid person UUID | `null` | `"660e8400-e29b-41d4-a716-446655440000"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.organizationId | string | No | uuid | Organization ID |
| data.companyName | string | No | -- | Company name |
| data.category | string | No | enum | Vendor category |
| data.description | string | No | -- | Description |
| data.contactEmail | string | No | email | Contact email |
| data.websiteUrl | string | Yes | uri | Website URL |
| data.verificationStatus | string | No | enum | Always `pending` on creation |
| data.createdAt | string | No | date-time | ISO 8601 UTC |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `CONFLICT-002` | 409 | Vendor with this contactEmail already exists in org |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

#### GET `/admin/marketplace/vendors`

**List all vendors with filtering**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-097 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[verificationStatus] | string | No | Filter by status: `pending`, `verified`, `suspended`, `rejected` |
| filter[category] | string | No | Filter by category |
| filter[organizationId] | string | No | Filter by org |
| search | string | No | Search by company name |
| sort | string | No | Sort field (default: `-createdAt`) |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of vendor objects |
| data[].id | string | No | uuid | Vendor ID |
| data[].companyName | string | No | -- | Company name |
| data[].category | string | No | enum | Vendor category |
| data[].verificationStatus | string | No | enum | Current status |
| data[].contactEmail | string | No | email | Contact email |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor for next page |
| meta.hasMore | boolean | No | -- | More results exist |
| meta.total | number | Yes | -- | Total count (when cheap) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |
| `VALIDATION-007` | 400 | Invalid query parameter |

---

#### PUT `/admin/marketplace/vendors/:vendorId/verify`

**Approve a pending vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | M17-R4 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.verificationStatus | string | No | enum | `verified` |
| data.verifiedAt | string | No | date-time | Verification timestamp |
| data.verifiedBy | string | No | uuid | Admin person ID |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found |
| `CONFLICT-003` | 409 | Vendor not in `pending` status |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

#### PUT `/admin/marketplace/vendors/:vendorId/reject`

**Reject a pending vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | No | Yes | -- | Max 2000 chars | `null` | `"Insufficient documentation"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.verificationStatus | string | No | enum | `rejected` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found |
| `CONFLICT-003` | 409 | Vendor not in `pending` status |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

#### PUT `/admin/marketplace/vendors/:vendorId/suspend`

**Suspend a verified vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-099 |
| Business rules | M17-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | Yes | No | -- | 1-2000 chars | -- | `"Violation of marketplace terms"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.verificationStatus | string | No | enum | `suspended` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found |
| `CONFLICT-003` | 409 | Vendor not in `verified` status |
| `M17-003` | 422 | Vendor already suspended |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

#### PUT `/admin/marketplace/vendors/:vendorId/reinstate`

**Reinstate a suspended vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | Optional |
| Workflow | WF-099 |
| Business rules | -- |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.verificationStatus | string | No | enum | `verified` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found |
| `CONFLICT-003` | 409 | Vendor not in `suspended` status |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

### 2.2 Vendor Listings (Vendor Management)

#### GET `/admin/marketplace/vendors/:vendorId/listings`

**List all listings for a vendor (admin view)**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | WF-097 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter by status: `draft`, `active`, `archived` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of listing objects |
| data[].id | string | No | uuid | Listing ID |
| data[].vendorId | string | No | uuid | Vendor ID |
| data[].title | string | No | -- | Listing title |
| data[].description | string | No | -- | Listing description |
| data[].price | number | Yes | decimal | Listed price |
| data[].currency | string | Yes | -- | Price currency |
| data[].status | string | No | enum | Listing status |
| data[].categoryTags | array | Yes | -- | Category tags |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

#### POST `/admin/marketplace/vendors/:vendorId/listings`

**Create a listing for a vendor**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) or verified vendor (own listings) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | M17-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | Yes | No | -- | 1-300 chars | -- | `"Dental X-Ray Machine Model DX-500"` |
| description | string | Yes | No | -- | 1-10000 chars | -- | `"High-resolution dental imaging..."` |
| price | number | No | Yes | decimal | >= 0, max 99999999.99 | `null` | `2500.00` |
| currency | string | No | No | -- | ISO 4217, 3 chars | `"USD"` | `"USD"` |
| status | string | No | No | enum | `draft`, `active` | `"draft"` | `"draft"` |
| categoryTags | array | No | Yes | string[] | Max 10 tags, each max 50 chars | `null` | `["equipment", "imaging"]` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Listing ID |
| data.vendorId | string | No | uuid | Vendor ID |
| data.title | string | No | -- | Listing title |
| data.status | string | No | enum | Listing status |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `M17-001` | 422 | Vendor not verified |
| `M17-003` | 422 | Vendor suspended -- cannot create listings |
| `NOT_FOUND-001` | 404 | Vendor not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Insufficient permissions |

---

#### PUT `/admin/marketplace/vendors/:vendorId/listings/:listingId`

**Update a listing**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) or verified vendor (own listings) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | M17-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | No | No | -- | 1-300 chars | -- | `"Updated Title"` |
| description | string | No | No | -- | 1-10000 chars | -- | `"Updated description"` |
| price | number | No | Yes | decimal | >= 0 | -- | `3000.00` |
| currency | string | No | No | -- | ISO 4217 | -- | `"USD"` |
| status | string | No | No | enum | `draft`, `active`, `archived` | -- | `"active"` |
| categoryTags | array | No | Yes | string[] | Max 10 tags | -- | `["equipment"]` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Listing ID |
| data.title | string | No | -- | Updated title |
| data.status | string | No | enum | Updated status |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Listing not found |
| `M17-001` | 422 | Vendor not verified |
| `M17-003` | 422 | Vendor suspended |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Insufficient permissions |

---

### 2.3 Marketplace Browse (Member)

#### GET `/org/:organizationId/marketplace/listings`

**Browse marketplace listings**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-098 |
| Business rules | M17-R1, M17-R4 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[category] | string | No | Filter by vendor category: `emr`, `supplies`, `insurance`, `telehealth`, `other` |
| filter[categoryTags] | string | No | Comma-separated tag filter |
| search | string | No | Keyword search (min 2 chars) |
| filter[priceMin] | number | No | Minimum price |
| filter[priceMax] | number | No | Maximum price |
| sort | string | No | Sort field (default: `-createdAt`). Options: `title`, `-title`, `price`, `-price`, `createdAt`, `-createdAt` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of listing objects (only active listings from verified vendors) |
| data[].id | string | No | uuid | Listing ID |
| data[].vendorId | string | No | uuid | Vendor ID |
| data[].vendorName | string | No | -- | Vendor company name |
| data[].vendorVerified | boolean | No | -- | Always `true` (only verified shown) |
| data[].title | string | No | -- | Listing title |
| data[].description | string | No | -- | Listing description |
| data[].price | number | Yes | decimal | Listed price |
| data[].currency | string | Yes | -- | Currency code |
| data[].categoryTags | array | Yes | -- | Category tags |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |
| meta.total | number | Yes | -- | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member (M17-R1) |
| `VALIDATION-007` | 400 | Invalid query parameter |

---

#### GET `/org/:organizationId/marketplace/vendors/:vendorId`

**View vendor detail with listings**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-098 |
| Business rules | M17-R1, M17-R4, BR-38 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.companyName | string | No | -- | Company name |
| data.category | string | No | enum | Vendor category |
| data.description | string | No | -- | Vendor description |
| data.websiteUrl | string | Yes | uri | External website |
| data.verificationStatus | string | No | enum | `verified` |
| data.hasReferralArrangement | boolean | No | -- | Whether BR-38 disclosure applies |
| data.referralDisclosure | string | Yes | -- | Referral disclosure text (if applicable) |
| data.listings | array | No | -- | Active listings for this vendor |
| data.listings[].id | string | No | uuid | Listing ID |
| data.listings[].title | string | No | -- | Listing title |
| data.listings[].price | number | Yes | decimal | Price |
| data.listings[].currency | string | Yes | -- | Currency |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Vendor not found or not verified |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member |

---

### 2.4 Orders (Member)

#### POST `/org/:organizationId/marketplace/orders`

**Place an order**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-098 |
| Business rules | M17-R1, M17-R4, M17-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| listingId | string | Yes | No | uuid | Must reference active listing | -- | `"770e8400-e29b-41d4-a716-446655440000"` |
| quantity | number | No | No | integer | >= 1 | `1` | `2` |
| notes | string | No | Yes | -- | Max 2000 chars | `null` | `"Please ship to clinic address"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Order ID |
| data.listingId | string | No | uuid | Listing ID |
| data.vendorId | string | No | uuid | Vendor ID |
| data.buyerPersonId | string | No | uuid | Buyer person ID |
| data.quantity | number | No | integer | Quantity |
| data.totalPrice | number | No | decimal | Computed total |
| data.status | string | No | enum | `pending` |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Listing not found |
| `M17-002` | 422 | Listing inactive |
| `M17-003` | 422 | Vendor suspended |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member |

---

#### GET `/org/:organizationId/marketplace/orders`

**List own orders**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | -- |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter by status: `pending`, `confirmed`, `fulfilled`, `cancelled`, `refunded` |
| sort | string | No | Sort field (default: `-createdAt`) |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of order objects (own orders only) |
| data[].id | string | No | uuid | Order ID |
| data[].listingId | string | No | uuid | Listing ID |
| data[].listingTitle | string | No | -- | Listing title (denormalized) |
| data[].vendorName | string | No | -- | Vendor company name |
| data[].quantity | number | No | integer | Quantity |
| data[].totalPrice | number | No | decimal | Total price |
| data[].status | string | No | enum | Order status |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| data[].fulfilledAt | string | Yes | date-time | Fulfillment timestamp |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member |

---

### 2.5 Categories (Platform Admin)

#### GET `/admin/marketplace/categories`

**List marketplace categories**

| Property | Value |
|----------|-------|
| Auth | PA (super, admin) |
| Rate limit | Admin (300 req/min) |
| Idempotency | N/A |
| Workflow | -- |
| Business rules | -- |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of category objects |
| data[].id | string | No | uuid | Category ID |
| data[].name | string | No | -- | Category name |
| data[].slug | string | No | -- | URL-safe slug |
| data[].description | string | Yes | -- | Category description |
| data[].isActive | boolean | No | -- | Whether category is active |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-004` | 403 | Non-platform-admin |

---

## 3. Vendor Registration (Public/Self-Service)

#### POST `/marketplace/vendors/register`

**Vendor self-registration**

| Property | Value |
|----------|-------|
| Auth | GA (any authenticated user) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-097 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| organizationId | string | Yes | No | uuid | Valid org UUID | -- | `"550e8400-e29b-41d4-a716-446655440000"` |
| companyName | string | Yes | No | -- | 1-300 chars | -- | `"HealthTech Solutions"` |
| category | string | Yes | No | enum | `emr`, `supplies`, `insurance`, `telehealth`, `other` | -- | `"emr"` |
| description | string | Yes | No | -- | 1-5000 chars | -- | `"EMR solutions for dental clinics"` |
| contactEmail | string | Yes | No | email | Valid email | -- | `"info@healthtech.com"` |
| websiteUrl | string | No | Yes | uri | Valid URL | `null` | `"https://healthtech.com"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Vendor ID |
| data.verificationStatus | string | No | enum | `pending` |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `CONFLICT-002` | 409 | Vendor with this email already exists |
| `AUTH-001` | 401 | No session |
