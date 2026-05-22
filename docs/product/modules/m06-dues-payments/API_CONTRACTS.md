<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts --- Dues & Payments (M06)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/payments`, `/org/:organizationId/config/dues` |
| Auth default | GA+HG (session + elevated role for mutations) |
| Rate limit tier | Authenticated (120 req/min); financial mutations require Idempotency-Key |
| Tenant scoping | All endpoints scoped by `organizationId` path param; gateway credentials isolated per org (BR-30) |

---

## 2. Endpoints

### 2.1 Payments

#### POST `/org/:organizationId/payments/manual`

**Record a manual (offline) payment**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required |
| Workflow | WF-044 |
| Business rules | BR-05, BR-06, BR-07, M6-R1, M6-R4, M6-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Must be org member | -- | "770e8400-..." |
| amount | string | YES | NO | decimal | Positive, > 0 | -- | "5000.00" |
| currency | string | NO | NO | ISO 4217 | 3-letter code | Org default | "PHP" |
| paymentMethod | string | YES | NO | enum | cash / check / bankTransfer / gcash / other | -- | "cash" |
| reference | string | YES | NO | -- | External reference number (BR-06, M06-011) | -- | "OR-2026-0042" |
| paidAt | string | NO | NO | date-time | Payment date; defaults to now | Now | "2026-05-21T10:00:00.000Z" |
| notes | string | NO | YES | -- | Max 500 chars | -- | "Paid at chapter meeting" |

**Request Headers**

| Header | Required | Description |
|--------|----------|-------------|
| Idempotency-Key | YES | Client-generated UUID v4. 24h TTL. |

**Response** `201 Created`

```json
{
  "data": {
    "id": "ff0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440000",
    "amount": "5000.00",
    "currency": "PHP",
    "status": "completed",
    "paymentMethod": "cash",
    "receiptNumber": "PDA-2026-0042",
    "recordedBy": "cc0e8400-e29b-41d4-a716-446655440000",
    "paidAt": "2026-05-21T10:00:00.000Z",
    "fundAllocations": [
      {
        "fundId": "aa0e8400-...",
        "fundName": "Chapter Operating",
        "amount": "3000.00"
      },
      {
        "fundId": "bb0e8400-...",
        "fundName": "National",
        "amount": "2000.00"
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Payment ID |
| receiptNumber | string | NO | -- | Unique: ORG_CODE-YEAR-SEQ (M6-R6) |
| recordedBy | string | NO | uuid | Officer who recorded |
| fundAllocations | array | NO | -- | Fund split per BR-05 |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-001 | 422 | Payment amount must be positive |
| M06-002 | 422 | Payment exceeds invoice balance |
| M06-003 | 422 | Invoice already fully paid |
| M06-004 | 422 | Dues period not configured for this organization |
| M06-011 | 422 | Manual payment requires receipt reference |
| M06-014 | 422 | Duplicate idempotency key with different payload |
| AUTH-003 | 403 | Insufficient permissions |

---

#### POST `/org/:organizationId/payments/checkout`

**Initiate online payment gateway checkout**

| Property | Value |
|----------|-------|
| Auth | All authenticated org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required |
| Workflow | WF-038 |
| Business rules | BR-07, BR-30 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | YES | NO | uuid | Must be self or admin acting on behalf | -- | "770e8400-..." |

**Request Headers**

| Header | Required | Description |
|--------|----------|-------------|
| Idempotency-Key | YES | Client-generated UUID v4 |

**Response** `200 OK`

```json
{
  "data": {
    "checkoutUrl": "https://checkout.paymongo.com/cs_live_abc123",
    "sessionId": "cs_live_abc123",
    "expiresAt": "2026-05-21T11:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| checkoutUrl | string | NO | url | Redirect URL for payment gateway |
| sessionId | string | NO | -- | Gateway session identifier |
| expiresAt | string | NO | date-time | Session expiration |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-004 | 422 | Dues period not configured for this organization |
| M06-006 | 422 | Life member --- no dues required |
| M06-013 | 502 | Stripe/PayMongo payment processing failed |
| AUTH-001 | 401 | Not authenticated |

---

#### POST `/webhooks/:provider`

**Process payment gateway webhook**

| Property | Value |
|----------|-------|
| Auth | Webhook signature verification (not session-based) |
| Rate limit | N/A (server-to-server) |
| Idempotency | Built-in via gatewayTransactionId (M6-R8) |
| Workflow | WF-038 |
| Business rules | BR-07, M6-R8 |

**Request Body**

Raw webhook payload from gateway provider. Signature verified via provider-specific headers.

**Response** `200 OK`

Always returns 200 to acknowledge receipt, even on processing errors (to prevent gateway retries).

```json
{}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| EXT-001 | 502 | Payment provider unavailable |

Note: 200 is always returned to the gateway to prevent retries. `EXT-001` applies to outbound calls made during webhook processing (e.g., refund confirmation callbacks). Processing failures are logged internally and queued for retry via WebhookRetryLog.

---

#### POST `/org/:organizationId/payments/:paymentId/refund`

**Process full or partial refund**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required |
| Workflow | WF-041 |
| Business rules | BR-08 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| amount | string | YES | NO | decimal | Positive, <= original payment | -- | "5000.00" |
| reason | string | YES | NO | -- | Max 500 chars | -- | "Duplicate payment" |

**Request Headers**

| Header | Required | Description |
|--------|----------|-------------|
| Idempotency-Key | YES | Client-generated UUID v4 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "110e8400-e29b-41d4-a716-446655440000",
    "paymentId": "ff0e8400-e29b-41d4-a716-446655440000",
    "amount": "5000.00",
    "reason": "Duplicate payment",
    "status": "completed",
    "reversedExpiryDate": "2026-06-30",
    "processedAt": "2026-05-21T12:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| reversedExpiryDate | string | YES | date | New expiry date after reversal (BR-08) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-005 | 422 | Refund exceeds original payment amount |
| M06-007 | 422 | Cannot modify payment after settlement |
| M06-013 | 502 | Stripe payment processing failed |
| AUTH-003 | 403 | Insufficient permissions |
| CORE-001 | 404 | Payment not found |

---

#### GET `/org/:organizationId/payments/:paymentId/receipt`

**Download payment receipt PDF**

| Property | Value |
|----------|-------|
| Auth | super, admin, president, treasurer, member (own payment) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-045 |
| Business rules | M6-R6 |

**Response** `200 OK`

Content-Type: `application/pdf`

Binary PDF file download.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| CORE-001 | 404 | Payment not found |
| AUTH-003 | 403 | Not authorized to view this receipt |

---

#### GET `/my/payments`

**View own payment history**

| Property | Value |
|----------|-------|
| Auth | All authenticated (except user without membership) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-038 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| organizationId | string | NO | Filter by organization |
| status | string | NO | Filter by payment status |
| from | string | NO | Filter by date range start (ISO date) |
| to | string | NO | Filter by date range end (ISO date) |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "ff0e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "organizationName": "PDA Manila Chapter",
      "amount": "5000.00",
      "currency": "PHP",
      "status": "completed",
      "paymentMethod": "cash",
      "receiptNumber": "PDA-2026-0042",
      "paidAt": "2026-05-21T10:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImZmMGU4NDAwIn0",
    "hasMore": false
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-001 | 401 | Not authenticated |

---

#### GET `/pay/:token`

**Token-based payment page (email link)**

| Property | Value |
|----------|-------|
| Auth | Public (token-based) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-038 |
| Business rules | -- |

**Response** `200 OK`

```json
{
  "data": {
    "organizationName": "PDA Manila Chapter",
    "memberName": "Maria Santos",
    "duesAmount": "5000.00",
    "currency": "PHP",
    "dueDate": "2026-06-30",
    "checkoutUrl": "https://checkout.paymongo.com/cs_live_abc123"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| CORE-002 | 400 | Token expired or invalid |

---

### 2.2 Financial Reports

#### GET `/org/:organizationId/reports/financial`

**Generate financial report (collection/fund/aging/status)**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-043 |
| Business rules | BR-32 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | YES | Report type: `collection`, `fund`, `aging`, `status` |
| from | string | YES | Start date (ISO date) |
| to | string | YES | End date (ISO date) |
| tierId | string | NO | Filter by membership tier |
| status | string | NO | Filter by payment status |

**Response** `200 OK`

```json
{
  "data": {
    "type": "collection",
    "period": {
      "from": "2026-01-01",
      "to": "2026-05-21"
    },
    "summary": {
      "totalCollected": "250000.00",
      "totalMembers": 50,
      "collectionRate": 0.72
    },
    "rows": [
      {
        "personId": "770e8400-...",
        "memberName": "Maria Santos",
        "amount": "5000.00",
        "paidAt": "2026-02-15T10:00:00.000Z",
        "status": "completed"
      }
    ]
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-012 | 422 | Aging report requires at least one overdue invoice |
| AUTH-003 | 403 | Insufficient permissions |
| VALIDATION-001 | 400 | Invalid date range |

---

### 2.3 Dues Configuration

#### PUT `/org/:organizationId/config/dues`

**Update dues configuration for the organization**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-040 |
| Business rules | BR-04, M6-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| duesAmount | string | YES | NO | decimal | Positive decimal | -- | "5000.00" |
| billingFrequency | string | YES | NO | enum | annual / semi-annual / quarterly | -- | "annual" |
| gracePeriodDays | integer | YES | NO | -- | 0-90 | 30 | 30 |
| categoryOverrides | array | NO | NO | -- | Per-category amount overrides | [] | See below |

**categoryOverrides item**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| categoryId | string | YES | NO | uuid | Must be active category | -- | "880e8400-..." |
| amount | string | YES | NO | decimal | Positive decimal | -- | "3000.00" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "220e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "duesAmount": "5000.00",
    "billingFrequency": "annual",
    "gracePeriodDays": 30,
    "categoryOverrides": [
      {
        "categoryId": "880e8400-...",
        "categoryName": "Life Member",
        "amount": "0.00"
      }
    ]
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-009 | 422 | Cannot delete dues config with active invoices |
| AUTH-003 | 403 | Insufficient permissions |
| VALIDATION-001 | 400 | Invalid input |

---

#### PUT `/org/:organizationId/config/funds`

**Update fund allocation configuration**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-039 |
| Business rules | BR-05, M6-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| funds | array | YES | NO | -- | At least 1 fund; percentages must sum to 100 | -- | See below |

**funds item**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| id | string | NO | NO | uuid | Existing fund ID (omit for new) | -- | "aa0e8400-..." |
| name | string | YES | NO | -- | Max 100 chars | -- | "Chapter Operating" |
| percentage | string | YES | NO | decimal | 0.01-100.00 | -- | "60.00" |
| sortOrder | integer | YES | NO | -- | Positive integer; last absorbs rounding | -- | 1 |

**Response** `200 OK`

```json
{
  "data": {
    "funds": [
      {
        "id": "aa0e8400-...",
        "name": "Chapter Operating",
        "percentage": "60.00",
        "sortOrder": 1
      },
      {
        "id": "bb0e8400-...",
        "name": "National",
        "percentage": "40.00",
        "sortOrder": 2
      }
    ]
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-010 | 422 | Fund allocation percentages must sum to 100 |
| AUTH-003 | 403 | Insufficient permissions |

---

#### POST `/org/:organizationId/config/gateway`

**Setup or update payment gateway configuration**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-040 |
| Business rules | BR-30 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| provider | string | YES | NO | enum | paymongo / stripe | -- | "paymongo" |
| publicKey | string | YES | NO | -- | Provider public key | -- | "pk_live_..." |
| secretKey | string | YES | NO | -- | Provider secret key (encrypted at rest) | -- | "sk_live_..." |

**Response** `201 Created`

```json
{
  "data": {
    "id": "330e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "provider": "paymongo",
    "isActive": true,
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Gateway config ID |
| isActive | boolean | NO | -- | Active gateway flag |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| VALIDATION-001 | 400 | Invalid credentials format |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.4 Dues Reminder Configuration

#### GET `/org/:organizationId/config/reminder-schedule`

**Get reminder/dunning schedule**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-042 |
| Business rules | M6-R5 |

**Response** `200 OK`

```json
{
  "data": {
    "reminders": [
      { "daysBefore": 60, "channel": "email" },
      { "daysBefore": 30, "channel": "email" },
      { "daysBefore": 7, "channel": "email" },
      { "daysAfter": 7, "channel": "email" },
      { "daysAfter": 30, "channel": "email" }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| daysBefore | integer | YES | -- | Days before expiry (null if post-expiry) |
| daysAfter | integer | YES | -- | Days after expiry (null if pre-expiry) |
| channel | string | NO | enum | email / sms / letter |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Insufficient permissions |

---

#### PUT `/org/:organizationId/config/reminder-schedule`

**Update reminder/dunning schedule**

| Property | Value |
|----------|-------|
| Auth | super, admin, president (2FA), treasurer (2FA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-042 |
| Business rules | M6-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reminders | array | YES | NO | -- | Array of reminder schedule entries | -- | See below |

**reminders item**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| daysBefore | integer | NO | YES | -- | Positive integer; mutually exclusive with daysAfter | -- | 60 |
| daysAfter | integer | NO | YES | -- | Positive integer; mutually exclusive with daysBefore | -- | 7 |
| channel | string | YES | NO | enum | email / sms / letter | -- | "email" |

**Response** `200 OK`

Same shape as GET response.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M06-008 | 422 | Dunning schedule conflicts with existing reminder entries |
| VALIDATION-001 | 400 | Invalid schedule configuration |
| AUTH-003 | 403 | Insufficient permissions |

---

## 3. Domain Events Published

| Event Name | Trigger | Payload Fields |
|------------|---------|----------------|
| PaymentRecorded | Payment completed (webhook or manual) | orgId, personId, amount, newExpiryDate |
| PaymentRefunded | Refund completed | orgId, personId, amount, reversedExpiryDate |
| InvoiceGenerated | Dues invoice created | orgId, personId, amount, dueDate |
| dunning.escalation | Dunning threshold exceeded | organizationId, personId, membershipId, stage, daysOverdue, templateName |

## 4. Domain Events Consumed

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| MembershipApproved | M05 | Generate first dues invoice; activate reminder schedule |
| MembershipStatusChanged | M05 | Adjust reminder schedule; suppress for Suspended/Removed/Life |

## 5. Shared Types

### DuesPaymentStatus (enum)

Values: `pending`, `completed`, `failed`, `refunded`, `partiallyRefunded`, `expired`, `submitted`, `underReview`, `confirmed`, `rejected`

### DuesPaymentMethod (enum)

Values: `online`, `cash`, `check`, `bankTransfer`, `gcash`, `other`

### BillingFrequency (enum)

Values: `annual`, `semi-annual`, `quarterly`

### DunningChannel (enum)

Values: `email`, `sms`, `letter`
