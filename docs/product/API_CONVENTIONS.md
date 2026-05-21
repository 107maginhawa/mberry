<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: ARCHITECTURE.md, ROLE_PERMISSION_MATRIX.md -->
# API Conventions

Shared cross-cutting API conventions for the Memberry platform. All per-module API_CONTRACTS.md files reference this document. Decisions here are authoritative — module contracts MUST NOT override unless explicitly noted.

---

## 1. Response Envelope

### Single Resource

```json
{
  "data": { ... }
}
```

### Collection (Paginated)

```json
{
  "data": [ ... ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYzEyMyJ9",
    "hasMore": true,
    "total": 142
  }
}
```

### Empty Success (No Content)

HTTP 204 with empty body. Used for DELETE operations and idempotent actions that return no data.

### Rules

- All successful responses (200, 201) wrap the payload in `data`.
- `meta` is present ONLY on paginated collections.
- `total` is OPTIONAL — included only when the query can compute it cheaply (indexed count). Omit for expensive counts; clients use `hasMore` for infinite scroll.
- 204 responses have no body.

---

## 2. Error Response Standard

**Modified RFC 7807** — adapted to match the existing Hono + Zod validation pattern.

### Shape

```json
{
  "error": {
    "code": "DUES-003",
    "status": 400,
    "message": "Human-readable summary (safe to display to end users)",
    "detail": "Developer-facing detail with context (never shown to users)",
    "fieldErrors": [
      {
        "field": "amount",
        "message": "Must be greater than 0",
        "code": "VALIDATION_MIN"
      }
    ],
    "globalErrors": [
      {
        "message": "Payment amount exceeds remaining balance",
        "code": "DUES-003"
      }
    ],
    "requestId": "req_abc123def456",
    "timestamp": "2026-05-21T15:00:00.000Z"
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | YES | Module-prefixed error code from ERROR_TAXONOMY.md |
| `status` | number | YES | HTTP status code (redundant with response, useful for logging) |
| `message` | string | YES | User-safe message (localizable) |
| `detail` | string | NO | Developer-only context (omitted in production for 500s) |
| `fieldErrors` | array | NO | Per-field validation errors (400 only) |
| `globalErrors` | array | NO | Cross-field or business rule errors |
| `requestId` | string | YES | Correlation ID (see section 17) |
| `timestamp` | string | YES | ISO 8601 UTC |

### Validation Error Convention

Zod validation failures (auto-generated from TypeSpec) produce `fieldErrors` with:
- `field`: dot-notation path (e.g., `address.postalCode`)
- `message`: human-readable validation message
- `code`: Zod error code (e.g., `too_small`, `invalid_type`)

Business rule violations produce `globalErrors` with the ERROR_TAXONOMY code.

---

## 3. Authentication & Authorization

### Auth Strategy

**Better-Auth** session-based authentication. Two token transport mechanisms:

| Transport | Header / Cookie | When Used |
|-----------|----------------|-----------|
| Session cookie | `better-auth.session_token` (httpOnly, secure, sameSite=lax) | Browser clients (default) |
| Bearer token | `Authorization: Bearer <session_token>` | API clients, mobile, CLI |

### Auth Middleware Stack

1. `authMiddleware` — validates session, attaches `user` to context
2. `requireRole(role)` — checks system-wide role (`user`, `client`, `host`, `admin`)
3. `requireOrgRole(orgId, minRole)` — checks organization-scoped role via `ROLE_HIERARCHY`

### Organization-Scoped Roles (ROLE_HIERARCHY)

```
member < secretary < treasurer < officer < president < admin
```

`hasMinimumRole(userRole, requiredRole)` — returns true if user's role is >= required in hierarchy.

### Role Alias Mapping (API_CONTRACTS ↔ ROLE_PERMISSION_MATRIX)

API_CONTRACTS `| Auth |` property rows use shorthand keywords. This table maps them to ROLE_PERMISSION_MATRIX canonical roles for traceability:

| API Auth Keyword | ROLE_PERMISSION_MATRIX Role | Scope | Notes |
|-----------------|---------------------------|-------|-------|
| `super` | Platform Admin | Platform | System-wide admin operations |
| `admin` | Platform Admin | Platform | Alias for super in Auth rows |
| `platform` | Platform Admin | Platform | Explicit platform scope |
| `president` | President | Org | Highest org officer |
| `secretary` | Secretary | Org | Member management, comms |
| `treasurer` | Treasurer | Org | Financial operations |
| `officer` | Officer (any of above) | Org | Generic officer — includes president, secretary, treasurer |
| `member` | Member | Org | Standard authenticated member |
| `user` | Member | System | Better-Auth system role, equivalent to Member |
| `chairperson` | Chairperson | Committee | Committee-scoped leadership role |

**Auth row format:** `GA+HG — role1, role2` where GA = Global Auth (session required), HG = Hierarchy Guard (org role check). Roles listed after `—` are the minimum roles with access.

### Public Routes

Routes NOT requiring authentication are explicitly listed in ROLE_PERMISSION_MATRIX.md section 2. All other routes require at minimum an authenticated session (`user` role).

### Impersonation

Platform admins can impersonate users via `X-Impersonate-As: <personId>` header. Impersonation sessions are logged to audit trail with original admin identity preserved.

---

## 4. API Versioning

**No path-prefix versioning.** Routes are registered without `/v1/` prefix.

| Decision | Value | Rationale |
|----------|-------|-----------|
| Strategy | No versioning (single version) | Greenfield project, single client (SPA), TypeSpec as source of truth |
| Future migration | Accept header (`application/vnd.memberry.v2+json`) | If breaking changes needed, version via content negotiation |
| Deprecation | `Sunset` header + 90-day notice | Per IETF draft-wilde-sunset-header |

**Path pattern:** `/{module}/{resource}` (e.g., `/person/:id`, `/billing/connect`)

**Important:** No `/api` prefix in backend route registration. The Vite dev proxy and production reverse proxy strip `/api` before forwarding.

---

## 5. Content Negotiation

| Media Type | Direction | Default |
|------------|-----------|---------|
| `application/json` | Request & Response | YES |
| `multipart/form-data` | Request (file uploads) | Storage module only |
| `application/pdf` | Response (certificates) | Certificates module only |
| `text/csv` | Response (exports) | Membership bulk export |

All JSON responses include `Content-Type: application/json; charset=utf-8`.

---

## 6. Date & Time Format

| Decision | Value |
|----------|-------|
| Format | ISO 8601 |
| Timezone | **UTC only** in API responses (`2026-05-21T15:00:00.000Z`) |
| Storage | PostgreSQL `timestamptz` (stores UTC) |
| Client display | Frontend converts UTC to local timezone |
| Date-only fields | `YYYY-MM-DD` format (e.g., `dateOfBirth`, `duesExpiryDate`) |

---

## 7. ID Format

| Decision | Value |
|----------|-------|
| Primary keys | **UUID v4** (PostgreSQL `uuid` type) |
| Generation | Database-generated (`gen_random_uuid()`) or application-generated |
| URL format | UUID string in path params (e.g., `/person/550e8400-e29b-41d4-a716-446655440000`) |
| External IDs | Stripe IDs (`cus_xxx`, `pi_xxx`), OneSignal IDs stored as `text` |

---

## 8. Pagination

| Decision | Value |
|----------|-------|
| Strategy | **Cursor-based** (opaque base64-encoded) |
| Cursor encoding | `base64(JSON.stringify({ id, sortValue }))` — opaque to clients |
| Default page size | 20 |
| Max page size | 100 |
| Backward pagination | YES — `before` cursor parameter |
| Total count | Optional — included when query has cheap indexed count |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Items per page (default: 20, max: 100) |
| `after` | string | Cursor for next page (forward pagination) |
| `before` | string | Cursor for previous page (backward pagination) |

### Response Meta

```json
{
  "meta": {
    "cursor": "eyJpZCI6Ijk5OSJ9",
    "hasMore": true,
    "total": 1420
  }
}
```

- `cursor`: opaque string to pass as `after` for next page. `null` when no more pages.
- `hasMore`: boolean — `true` if more results exist beyond this page.
- `total`: integer or omitted — total count when cheaply available.

---

## 9. Filtering & Sorting

### Filtering

Query parameter format: `?filter[field]=value`

| Pattern | Example | Description |
|---------|---------|-------------|
| Exact match | `?filter[status]=active` | Equality |
| Multiple values | `?filter[status]=active,lapsed` | OR (comma-separated) |
| Range | `?filter[createdAt][gte]=2026-01-01&filter[createdAt][lt]=2026-06-01` | Greater/less than |
| Search | `?search=john` | Full-text search (module-specific) |
| Nested | `?filter[organization.id]=uuid` | Dot-notation for relations |

### Sorting

Query parameter: `?sort=-createdAt,lastName`

| Prefix | Meaning |
|--------|---------|
| (none) | Ascending |
| `-` | Descending |

Multiple sort fields separated by commas. Default sort per module defined in API_CONTRACTS.md.

---

## 10. Rate Limiting

### Strategy

Per-endpoint rate limiting with tiered defaults by auth level.

### Default Tiers

| Tier | Rate | Applies To |
|------|------|------------|
| Unauthenticated | 20 req/min | Public routes (sign-in, sign-up) |
| Authenticated | 120 req/min | Standard CRUD |
| Admin | 300 req/min | Platform admin routes |
| Bulk operations | 10 req/min | CSV import, bulk updates |
| File upload | 30 req/min | Storage module |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds to wait (429 responses only) |

---

## 11. Idempotency

| Decision | Value |
|----------|-------|
| Header | `Idempotency-Key` |
| Scope | Required for financial mutations (dues payments, billing). Optional for all POST/PUT/PATCH. |
| Key format | Client-generated UUID v4 |
| TTL | 24 hours |
| Storage | PostgreSQL table `idempotency_key` |
| Behavior | If key exists and previous request succeeded: return cached response (200). If previous request failed: allow retry. |

### Financial Endpoints (Required)

- `POST /dues/payments` — record payment
- `POST /billing/charges` — create charge
- `POST /billing/refunds` — process refund

All other mutation endpoints: Idempotency-Key is accepted but optional.

---

## 12. Conditional Requests (ETags)

| Decision | Value |
|----------|-------|
| ETag generation | Weak ETag from `updatedAt` timestamp: `W/"2026-05-21T15:00:00.000Z"` |
| Read caching | `If-None-Match` → 304 Not Modified |
| Write concurrency | `If-Match` → 412 Precondition Failed if stale |

### Optimistic Concurrency

All UPDATE/PATCH endpoints accept `If-Match` header. If the ETag doesn't match current state, return 412 with error code `CONFLICT-001`.

This prevents lost-update problems when multiple users edit the same resource.

---

## 13. Bulk Operations

| Decision | Value |
|----------|-------|
| Pattern | Array in request body |
| Max batch size | 500 items |
| Error handling | Partial success — return per-item results |
| Response | `{ data: { succeeded: [...], failed: [...] } }` |

### Bulk Response Shape

```json
{
  "data": {
    "succeeded": [
      { "id": "uuid-1", "status": "created" },
      { "id": "uuid-2", "status": "created" }
    ],
    "failed": [
      {
        "index": 2,
        "input": { "email": "invalid" },
        "error": { "code": "VALIDATION-001", "message": "Invalid email format" }
      }
    ],
    "summary": {
      "total": 3,
      "succeeded": 2,
      "failed": 1
    }
  }
}
```

### Bulk Endpoints

- `POST /membership/members/import` — CSV bulk import
- `POST /membership/members/bulk-update` — bulk status/category change
- `POST /communication/announcements/bulk-send` — bulk announcement delivery

---

## 14. HATEOAS

**Not implemented.** SPA clients use the SDK with typed routes — link relations add no value. If public API consumers are added later, consider HAL links.

---

## 15. CORS Policy

| Setting | Development | Production |
|---------|-------------|------------|
| Allowed origins | `http://localhost:3002,3003,3004` | Configured per deployment (`CORS_ORIGINS` env var) |
| Allowed methods | `GET, POST, PUT, PATCH, DELETE, OPTIONS` | Same |
| Allowed headers | `Content-Type, Authorization, Idempotency-Key, If-Match, If-None-Match, X-Request-ID, X-Impersonate-As` | Same |
| Credentials | `true` | `true` |
| Max age | 86400 (24h) | 86400 |

---

## 16. Outgoing Webhook Conventions

### Payload Signing

| Decision | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 |
| Header | `X-Webhook-Signature` |
| Payload | Raw request body |
| Secret | Per-subscriber secret (`webhook_secret` column) |
| Timestamp | `X-Webhook-Timestamp` (Unix seconds, included in signature to prevent replay) |

### Signature Format

```
X-Webhook-Signature: sha256=<hex(HMAC(secret, timestamp.body))>
```

### Retry Semantics

| Parameter | Value |
|-----------|-------|
| Max retries | 5 |
| Backoff | Exponential with jitter: `min(2^attempt * 1000 + random(0, 1000), 3600000)` ms |
| Timeout per attempt | 10 seconds |
| Success criteria | HTTP 2xx response |
| Failure action | Move to dead letter queue after max retries |

### Event Catalog Format

Each webhook event follows the event envelope from EVENT_CONTRACTS.md.

---

## 17. Correlation ID / Request Tracing

| Transport | Location | Behavior |
|-----------|----------|----------|
| HTTP requests | `X-Request-ID` header | Generate UUID if absent, forward if present |
| Event payloads | `correlationId` field | Propagated from triggering request |
| Log entries | `requestId` field | Included in every structured Pino log entry |
| Saga steps | `correlationId` field | Propagated through all steps for end-to-end tracing |
| HTTP responses | `X-Request-ID` header | Echo back for client-side correlation |

Format: `req_<uuid-v4>` (e.g., `req_550e8400-e29b-41d4-a716-446655440000`)

---

## 18. Request Timeout Policy

| Endpoint Type | Default Timeout | Configurable? |
|---------------|----------------|---------------|
| Standard CRUD | 30s | Yes, per-endpoint |
| Search/filter | 60s | Yes |
| File upload | 300s | Yes |
| Webhook delivery | 10s | No (hard limit) |
| Background job trigger | 5s (async response) | No |
| Bulk operations | 120s | Yes |
| Report generation | 60s | Yes |

### Performance SLA Tiers

p95 latency targets by endpoint category:

| Endpoint Category | p95 Target | Examples |
|-------------------|-----------|----------|
| Read endpoints | < 200ms | GET /person/:id, GET /my/payments, list endpoints |
| Write endpoints | < 500ms | POST /org/:id/payments/manual, PUT /org/:id/config/dues |
| PDF generation | < 3s | Certificate generation, ID card rendering, receipt PDFs |
| Reports/analytics | < 5s | Financial reports, national dashboard rollups, aging reports |

> **Note:** Async audit logging recommended for read paths to meet p95 budget. Financial audit writes remain synchronous.

If processing exceeds timeout, return `202 Accepted` with a polling endpoint:

```json
{
  "data": {
    "jobId": "job_uuid",
    "status": "processing",
    "pollUrl": "/jobs/job_uuid/status"
  }
}
```

---

## 19. Multi-Tenancy

### Tenant Model

Two-level tenant hierarchy:

| Level | Scope | Header/Param |
|-------|-------|-------------|
| Association | Top-level tenant | Derived from authenticated user's `associationId` |
| Organization | Sub-tenant (chapter) | Path param or query: `organizationId` |

### Isolation Rules

- **Implicit tenant scoping**: All queries automatically filter by `associationId` from the authenticated session. No header required.
- **Organization scoping**: Endpoints that operate within an org accept `organizationId` as path parameter.
- **Cross-tenant queries**: FORBIDDEN except for platform admin routes (M03).
- **National dashboard (M14)**: Reads across all orgs within the same association (cross-org, same-tenant).

### Implementation

```typescript
// Middleware injects tenant context
const tenantId = c.get('user').associationId;
// All repo queries include: .where(eq(table.associationId, tenantId))
```

---

## 20. Search Convention

| Decision | Value |
|----------|-------|
| Parameter | `?search=<query>` |
| Target | Module-specific searchable fields (defined in API_CONTRACTS.md) |
| Performance | <200ms response (NFR target) |
| Implementation | PostgreSQL `tsvector` + `GIN` index |
| Min query length | 2 characters |
| Max results | Respects pagination `limit` |

---

## 21. Field Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| JSON request/response | camelCase | `firstName`, `duesExpiryDate` |
| URL path segments | kebab-case | `/credit-tracking/credits` |
| Query parameters | camelCase | `?filter[organizationId]=uuid` |
| Database columns | snake_case | `first_name`, `dues_expiry_date` |
| Enum values | snake_case | `active`, `pending_review` |
| Boolean fields | `is`/`has` prefix | `isActive`, `hasConsentedToDirectory` |

---

## 22. Soft Delete Convention

| Decision | Value |
|----------|-------|
| Strategy | `deletedAt` timestamp column (null = active) |
| Default query | Exclude soft-deleted records |
| Admin access | Platform admin can query deleted records via `?includeDeleted=true` |
| Hard delete | Only via `person.deletionProcessor` (30-day grace period, then PII anonymization) |
| Cascade | Soft delete does NOT cascade — each module handles its own cleanup |

---

## 23. Data Protection & PII Handling

PII fields (`email`, `licenseNumber`, `phone`, `firstName`, `lastName`) encrypted at rest via PostgreSQL Transparent Data Encryption.

| Encryption Strategy | Fields | Rationale |
|---------------------|--------|-----------|
| Deterministic encryption | `email`, `licenseNumber` | Searchable PII — deterministic encryption preserves index compatibility for lookups and uniqueness constraints |
| Randomized encryption | `phone`, `address` (JSONB), `firstName`, `lastName` | Non-searchable PII — randomized encryption provides stronger confidentiality; these fields are only accessed by primary key lookup |

Application logs must never contain raw PII — use `personId` references only. See AUDIT_CONTRACTS.md section 1.2 for PII access audit requirements.

---

## 24. Consistency Model

| Data Category | Consistency Guarantee | Mechanism |
|---------------|----------------------|-----------|
| Operational data | Strong consistency | Single PostgreSQL instance. All reads reflect latest writes. |
| Cross-module events | Eventual consistency (< 5 min window) | At-most-once delivery via pg-boss job queue. |
| Membership status | Strong consistency | Computed at query time from `duesExpiryDate` — no caching. |
| Audit logs | Strong consistency | Append-only, synchronous writes. No eventual consistency — audit writes complete before request returns. |
| Financial data | Strong consistency (ACID) | All payment recording, fund allocation, and refunds execute within database transactions. No eventual consistency for financial mutations. |

---

## Appendix A: HTTP Status Code Usage

| Status | When Used |
|--------|-----------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE, or action with no response body |
| 400 | Validation error (Zod), malformed request |
| 401 | Missing or invalid session |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found or not accessible in tenant scope |
| 409 | Conflict (duplicate, state transition violation, optimistic lock) |
| 412 | Precondition Failed (ETag mismatch) |
| 413 | Payload too large (file upload) |
| 422 | Business rule violation (valid syntax, invalid semantics) |
| 429 | Rate limit exceeded |
| 500 | Unhandled server error |
| 502 | External service failure (Stripe, OneSignal, S3) |
| 503 | Service temporarily unavailable |
