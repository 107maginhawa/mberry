<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: ARCHITECTURE.md, MODULE_MAP.md, MODULE_SPEC.md (all 19) -->
# Error Taxonomy

Global error classification for the Memberry platform. All per-module API_CONTRACTS.md reference error codes defined here.

---

## 1. Standard Error Response Shape

```json
{
  "error": {
    "code": "MODULE-NNN",
    "status": 400,
    "message": "User-safe message (localizable)",
    "detail": "Developer-facing detail (omitted in production for 500s)",
    "fieldErrors": [],
    "globalErrors": [],
    "requestId": "req_uuid",
    "timestamp": "2026-05-21T15:00:00.000Z"
  }
}
```

See API_CONVENTIONS.md section 2 for field definitions.

---

## 2. Error Categories

| Category | HTTP Status | Code Prefix | Description |
|----------|------------|-------------|-------------|
| Validation | 400 | `VALIDATION` | Input fails Zod schema validation |
| Authentication | 401 | `AUTH` | Session missing, expired, or invalid |
| Authorization | 403 | `AUTHZ` | Authenticated but insufficient role/permission |
| Not Found | 404 | `NOT_FOUND` | Resource does not exist or not visible in tenant scope |
| Conflict | 409 | `CONFLICT` | Duplicate resource, state transition violation, optimistic lock failure |
| Business Rule | 422 | `BR` | Valid syntax but violates business rule (references BR-NNN) |
| Rate Limit | 429 | `RATE_LIMIT` | Too many requests |
| External Service | 502 | `EXT` | Upstream dependency (Stripe, OneSignal, S3) failure |
| Internal | 500 | `INTERNAL` | Unhandled server error |

---

## 3. Global Error Codes (Shared Across All Modules)

### 3.1 Validation Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `VALIDATION-001` | 400 | Invalid request body | Zod schema validation failed |
| `VALIDATION-002` | 400 | Missing required field: {field} | Required field omitted |
| `VALIDATION-003` | 400 | Invalid field format: {field} | Format constraint violated (email, UUID, date) |
| `VALIDATION-004` | 400 | Value out of range: {field} | Min/max constraint violated |
| `VALIDATION-005` | 400 | Invalid enum value: {field} | Value not in allowed set |
| `VALIDATION-006` | 413 | Payload too large | Request body exceeds size limit |
| `VALIDATION-007` | 400 | Invalid query parameter: {param} | Filter/sort/pagination parameter invalid |

### 3.2 Authentication Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `AUTH-001` | 401 | Authentication required | No session cookie or Bearer token |
| `AUTH-002` | 401 | Session expired | Session token past TTL |
| `AUTH-003` | 401 | Invalid credentials | Wrong email/password at sign-in |
| `AUTH-004` | 401 | Account locked | Too many failed attempts |
| `AUTH-005` | 401 | 2FA required | 2FA enabled but not provided |
| `AUTH-006` | 401 | Invalid 2FA code | TOTP code incorrect or expired |
| `AUTH-007` | 401 | Account not verified | Email verification pending |

### 3.3 Authorization Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `AUTHZ-001` | 403 | Insufficient permissions | Role check failed |
| `AUTHZ-002` | 403 | Organization access denied | User not member of target org |
| `AUTHZ-003` | 403 | Resource owned by another user | Attempting to modify another user's resource |
| `AUTHZ-004` | 403 | Admin action requires platform admin role | Non-admin accessing admin routes |
| `AUTHZ-005` | 403 | Impersonation not permitted | Non-admin using X-Impersonate-As |
| `AUTHZ-006` | 403 | Cross-tenant access denied | Querying data outside own association |
| `AUTHZ-007` | 403 | Minimum role not met: {required} | Org role hierarchy check failed |

### 3.4 Not Found Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `NOT_FOUND-001` | 404 | Resource not found | Generic — entity ID doesn't exist |
| `NOT_FOUND-002` | 404 | Route not found | Unregistered endpoint |

### 3.5 Conflict Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `CONFLICT-001` | 412 | Resource modified by another request | ETag mismatch (optimistic concurrency) |
| `CONFLICT-002` | 409 | Duplicate resource | Unique constraint violation |
| `CONFLICT-003` | 409 | Invalid state transition | State machine transition not allowed |

### 3.6 Rate Limit Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `RATE_LIMIT-001` | 429 | Too many requests | Rate limit exceeded |

### 3.7 External Service Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `EXT-001` | 502 | Payment provider unavailable | Stripe API error |
| `EXT-002` | 502 | Notification service unavailable | OneSignal API error |
| `EXT-003` | 502 | Storage service unavailable | S3/MinIO error |
| `EXT-004` | 502 | Email service unavailable | Email provider error |

### 3.8 Internal Errors

| Code | Status | Message Template | When |
|------|--------|-----------------|------|
| `INTERNAL-001` | 500 | Internal server error | Unhandled exception |
| `INTERNAL-002` | 503 | Service temporarily unavailable | Database connection failure, maintenance |

---

## 4. Per-Module Error Code Ranges

Each module owns an exclusive error code range. No overlaps.

| Module | ID | Code Prefix | Range | Max Codes |
|--------|----|-------------|-------|-----------|
| Auth & Onboarding | M01 | `M01` | M01-001 to M01-050 | 50 |
| Member Profile | M02 | `M02` | M02-001 to M02-050 | 50 |
| Platform Admin | M03 | `M03` | M03-001 to M03-050 | 50 |
| Org Admin | M04 | `M04` | M04-001 to M04-050 | 50 |
| Membership | M05 | `M05` | M05-001 to M05-050 | 50 |
| Dues & Payments | M06 | `M06` | M06-001 to M06-075 | 75 |
| Communications | M07 | `M07` | M07-001 to M07-050 | 50 |
| Events | M08 | `M08` | M08-001 to M08-075 | 75 |
| Training | M09 | `M09` | M09-001 to M09-075 | 75 |
| Credit Tracking | M10 | `M10` | M10-001 to M10-050 | 50 |
| Documents & Credentials | M11 | `M11` | M11-001 to M11-050 | 50 |
| Elections & Governance | M12 | `M12` | M12-001 to M12-075 | 75 |
| Professional Feed | M13 | `M13` | M13-001 to M13-030 | 30 |
| National Dashboard | M14 | `M14` | M14-001 to M14-030 | 30 |
| Job Board | M15 | `M15` | M15-001 to M15-050 | 50 |
| Advertising | M16 | `M16` | M16-001 to M16-050 | 50 |
| Marketplace | M17 | `M17` | M17-001 to M17-030 | 30 |
| Surveys & Polls | M18 | `M18` | M18-001 to M18-030 | 30 |
| Committee Management | M19 | `M19` | M19-001 to M19-050 | 50 |

**Range rationale:** Complex modules with many state transitions (M06, M08, M09, M12) get 75 codes. Wave 4 modules with simpler CRUD (M13, M14, M17, M18) get 30. All others get 50.

---

## 5. Per-Module Error Codes

### 5.1 M01 — Auth & Onboarding

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M01-001` | 409 | Email already registered | BR-01 |
| `M01-002` | 422 | Invitation token expired | BR-02 |
| `M01-003` | 422 | Invitation token already claimed | — |
| `M01-004` | 422 | Onboarding step out of order | — |
| `M01-005` | 422 | Password does not meet requirements | — |
| `M01-006` | 422 | Email domain not allowed for this organization | — |
| `M01-007` | 400 | Invalid magic link token | — |
| `M01-008` | 422 | Organization invite required for private org | — |

### 5.2 M02 — Member Profile

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M02-001` | 422 | Cannot update another member's profile | — |
| `M02-002` | 422 | Avatar file exceeds size limit | — |
| `M02-003` | 422 | Invalid professional license format | — |
| `M02-004` | 422 | Profile field not editable after verification | — |
| `M02-005` | 422 | Deletion grace period has not expired | — |
| `M02-006` | 422 | Account deletion already scheduled | — |

### 5.3 M03 — Platform Admin

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M03-001` | 422 | Cannot demote last super admin | — |
| `M03-002` | 422 | Feature flag not found | — |
| `M03-003` | 422 | Organization already exists with this slug | — |
| `M03-004` | 422 | Impersonation session limit exceeded | — |
| `M03-005` | 422 | Cannot delete organization with active members | — |

### 5.4 M04 — Org Admin

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M04-001` | 422 | Cannot remove last officer from organization | BR-04 |
| `M04-002` | 422 | Officer position already filled | — |
| `M04-003` | 422 | Invalid organization settings value | — |
| `M04-004` | 422 | Cannot change org type after creation | — |
| `M04-005` | 422 | Organization billing not configured | — |

### 5.5 M05 — Membership

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M05-001` | 409 | Person already has membership in this organization | BR-05 |
| `M05-002` | 422 | Invalid membership status transition | BR-03 |
| `M05-003` | 422 | Membership application requires approval | — |
| `M05-004` | 422 | Membership category not found or inactive | — |
| `M05-005` | 422 | Bulk import exceeds 500 row limit | — |
| `M05-006` | 422 | CSV format invalid or missing required columns | — |
| `M05-007` | 422 | Transfer target organization not found | — |
| `M05-008` | 422 | Transfer requires approval from both organizations | — |
| `M05-009` | 422 | Cannot reinstate — dues payment required | BR-03 |
| `M05-010` | 422 | Member directory listing requires consent | BR-06 |

### 5.6 M06 — Dues & Payments

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M06-001` | 422 | Payment amount must be positive | — |
| `M06-002` | 422 | Payment exceeds invoice balance | — |
| `M06-003` | 422 | Invoice already fully paid | — |
| `M06-004` | 422 | Dues period not configured for this organization | BR-07 |
| `M06-005` | 422 | Refund exceeds original payment amount | — |
| `M06-006` | 422 | Payment method declined | — |
| `M06-007` | 422 | Cannot modify payment after settlement | — |
| `M06-008` | 422 | Dunning template not found | — |
| `M06-009` | 422 | Cannot delete dues config with active invoices | — |
| `M06-010` | 422 | Fund allocation percentages must sum to 100 | BR-08 |
| `M06-011` | 422 | Manual payment requires receipt reference | — |
| `M06-012` | 422 | Aging bucket not found | — |
| `M06-013` | 502 | Stripe payment processing failed | — |
| `M06-014` | 422 | Duplicate idempotency key with different payload | — |

### 5.7 M07 — Communications

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M07-001` | 422 | Message template not found | — |
| `M07-002` | 422 | Template variable missing: {variable} | — |
| `M07-003` | 422 | Announcement requires at least one target audience | — |
| `M07-004` | 422 | Scheduled send time must be in the future | — |
| `M07-005` | 422 | Cannot edit published announcement | — |
| `M07-006` | 422 | Recipient list exceeds maximum (10,000) | — |
| `M07-007` | 422 | Unsubscribe token invalid | — |

### 5.8 M08 — Events

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M08-001` | 422 | Event at full capacity | BR-14 |
| `M08-002` | 422 | Registration deadline passed | — |
| `M08-003` | 422 | Event date must be in the future | — |
| `M08-004` | 422 | Cannot cancel event with confirmed registrations without refund plan | — |
| `M08-005` | 422 | Already registered for this event | — |
| `M08-006` | 422 | Invalid event status transition | — |
| `M08-007` | 422 | Check-in code invalid or expired | — |
| `M08-008` | 422 | Waitlist position not available | — |
| `M08-009` | 422 | Time slot conflicts with existing booking | BR-15 |
| `M08-010` | 422 | Booking confirmation deadline exceeded — auto-rejected | BR-16 |
| `M08-011` | 422 | Cannot modify past event | — |

### 5.9 M09 — Training

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M09-001` | 422 | Training session at full capacity | — |
| `M09-002` | 422 | Enrollment deadline passed | — |
| `M09-003` | 422 | Already enrolled in this training | — |
| `M09-004` | 422 | Invalid training status transition | — |
| `M09-005` | 422 | Credit hours must be non-negative | BR-18 |
| `M09-006` | 422 | Accredited provider not found or inactive | — |
| `M09-007` | 422 | Quiz attempt limit exceeded | — |
| `M09-008` | 422 | Training requires paid registration | — |
| `M09-009` | 422 | Non-credit-bearing training: isNonCreditBearing must be true when creditValue is 0 | — |
| `M09-010` | 422 | Certificate template not found | — |

### 5.10 M10 — Credit Tracking

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M10-001` | 422 | Negative credit deduction not allowed | BR-20 |
| `M10-002` | 422 | Credit type not recognized | — |
| `M10-003` | 422 | Compliance cycle not found | — |
| `M10-004` | 422 | Cannot modify credits in closed compliance cycle | BR-21 |
| `M10-005` | 422 | Duplicate credit entry for same training | — |
| `M10-006` | 422 | Manual credit entry requires supporting document | — |
| `M10-007` | 422 | Retroactive cycle recomputation not supported | Spec-review decision |

### 5.11 M11 — Documents & Credentials

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M11-001` | 422 | Document version conflict | — |
| `M11-002` | 422 | File type not allowed | — |
| `M11-003` | 422 | Credential already issued for this training | — |
| `M11-004` | 422 | Certificate template rendering failed | — |
| `M11-005` | 422 | QR verification code invalid or expired | — |
| `M11-006` | 422 | Document tag limit exceeded (max 20) | — |
| `M11-007` | 422 | Cannot archive document with active references | — |

### 5.12 M12 — Elections & Governance

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M12-001` | 422 | Election is not in nomination phase | BR-25 |
| `M12-002` | 422 | Already nominated for this position | — |
| `M12-003` | 422 | Voting period not open | BR-26 |
| `M12-004` | 422 | Already voted in this election | BR-27 |
| `M12-005` | 422 | Nominee does not meet eligibility criteria | — |
| `M12-006` | 422 | Cannot modify published election results | — |
| `M12-007` | 422 | Tie detected — runoff election required | Spec-review decision |
| `M12-008` | 422 | Candidate withdrawal after voting started — runner-up advances | Spec-review decision |
| `M12-009` | 422 | Invalid election status transition | — |
| `M12-010` | 422 | Hybrid election requires witness attestation | Spec-review decision |
| `M12-011` | 422 | Only active members can vote | BR-28 |

### 5.13 M13 — Professional Feed

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M13-001` | 422 | Post content exceeds character limit | — |
| `M13-002` | 422 | Cannot edit post after 24 hours | — |
| `M13-003` | 422 | Post not found or removed | — |
| `M13-004` | 422 | Already reported this post | — |
| `M13-005` | 422 | Muted user cannot be muted again | — |

### 5.14 M14 — National Dashboard

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M14-001` | 403 | Dashboard access requires national-level role | — |
| `M14-002` | 422 | Report period invalid | — |
| `M14-003` | 422 | Aggregation query timed out | — |

### 5.15 M15 — Job Board

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M15-001` | 422 | Job listing expired | — |
| `M15-002` | 422 | External employer not verified | — |
| `M15-003` | 422 | Job alert limit exceeded (max 10) | — |
| `M15-004` | 422 | Cannot edit expired listing — create new | — |
| `M15-005` | 422 | Listing pending review — cannot publish | — |

### 5.16 M16 — Advertising

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M16-001` | 422 | Campaign budget must be positive | — |
| `M16-002` | 422 | Creative content rejected by review | — |
| `M16-003` | 422 | Ad slot not available for requested dates | — |
| `M16-004` | 422 | Campaign cannot be resumed after completion | — |
| `M16-005` | 422 | Advertiser billing not configured | — |
| `M16-006` | 422 | Campaign billing integration deferred (P2) | Spec-review decision |

### 5.17 M17 — Marketplace

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M17-001` | 422 | Vendor not verified | — |
| `M17-002` | 422 | Product listing inactive | — |
| `M17-003` | 422 | Vendor suspended — cannot create listings | — |

### 5.18 M18 — Surveys & Polls

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M18-001` | 422 | Survey is closed | — |
| `M18-002` | 422 | Already responded to this survey | — |
| `M18-003` | 422 | Survey deadline passed | — |
| `M18-004` | 422 | Anonymous survey responses cannot be modified | — |

### 5.19 M19 — Committee Management

| Code | Status | Message | Business Rule |
|------|--------|---------|---------------|
| `M19-001` | 422 | Committee requires a chairperson | BR-39 |
| `M19-002` | 422 | Committee member already assigned | — |
| `M19-003` | 422 | Cannot dissolve committee with open tasks | — |
| `M19-004` | 422 | Task assignment requires active committee membership | — |
| `M19-005` | 422 | Committee expired — renewal required | — |
| `M19-006` | 422 | Chairperson removal blocked — leaderless state | Spec-review decision |
| `M19-007` | 422 | Cannot add members to dissolved committee | — |

---

## 6. Error Code Governance

### Adding New Codes

1. Assign next sequential number within module range
2. Add to this document under the module section
3. Reference in the endpoint's `Error Codes` in API_CONTRACTS.md
4. Implement error factory: `throw new AppError('M06-010', 'Fund allocation percentages must sum to 100', 422)`

### User-Safe Messages

- Messages in the `message` field MUST be safe to display to end users
- No stack traces, internal paths, or SQL in user-facing messages
- Use `detail` field for developer-facing context
- Messages should be localizable (English templates with variable substitution)

### Message Variables

Use `{variable}` syntax for dynamic content:
- `{field}` — field name that caused the error
- `{value}` — the invalid value (sanitized)
- `{limit}` — constraint limit
- `{required}` — required role or permission
