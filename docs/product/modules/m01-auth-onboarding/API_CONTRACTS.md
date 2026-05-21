<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Auth & Onboarding (M01)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/auth`, `/register`, `/onboarding`, `/invitations` |
| Auth default | Public (unauthenticated) for auth flows; GA (session) for onboarding |
| Rate limit tier | Unauthenticated: 20 req/min; Bulk operations: 10 req/min |
| Tenant scoping | Organization-scoped for onboarding/invitations; global for auth |

---

## 2. Endpoints

### 2.1 Registration

#### POST `/register`

**Create a new user account with email + OTP verification**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | Optional |
| Workflow | WF-001 |
| Business rules | M1-R1, M1-R8, BR-22, BR-23 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| firstName | string | YES | NO | — | 1-50 chars | — | `"Maria"` |
| lastName | string | NO | NO | — | 1-50 chars | — | `"Santos"` |
| email | string | YES | NO | email | max 255, unique globally | — | `"maria@example.com"` |
| password | string | YES | NO | — | min 8 chars, 1 upper, 1 number | — | `"SecureP4ss"` |
| licenseNumber | string | YES | NO | — | Validated against association regex (BR-23) | — | `"PRC-12345"` |

**Response** `201 Created`

```json
{
  "data": {
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "otpSent": true,
    "message": "Verification code sent to email"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| personId | string | NO | uuid | Created person ID |
| otpSent | boolean | NO | — | Whether OTP was dispatched |
| message | string | NO | — | Human-readable status |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M01-001 | 409 | Email already registered |
| M01-005 | 422 | Password does not meet requirements |

---

### 2.2 OTP Verification

#### POST `/verify-otp`

**Verify the OTP code sent during registration, claim, or password reset**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-001, WF-002, WF-004 |
| Business rules | M1-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"maria@example.com"` |
| code | string | YES | NO | — | Exactly 6 digits | — | `"482901"` |

**Response** `200 OK`

```json
{
  "data": {
    "verified": true,
    "sessionToken": "eyJhbGciOi..."
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| verified | boolean | NO | — | Always true on success |
| sessionToken | string | NO | — | Session token for authenticated access |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid or expired OTP code (6-digit, 15 min TTL, max 5 attempts per M1-R1) |
| — | 429 | Too many verification attempts |

---

### 2.3 Authentication

#### POST `/auth/sign-in`

**Authenticate with email + password**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-003 |
| Business rules | M1-R4, M1-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"maria@example.com"` |
| password | string | YES | NO | — | — | — | `"SecureP4ss"` |

**Response** `200 OK`

```json
{
  "data": {
    "sessionToken": "eyJhbGciOi...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "maria@example.com",
      "firstName": "Maria",
      "mfaEnabled": false
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| sessionToken | string | NO | — | Bearer token / session cookie |
| user.id | string | NO | uuid | Person ID |
| user.email | string | NO | email | Verified email |
| user.firstName | string | NO | — | First name |
| user.mfaEnabled | boolean | NO | — | Whether MFA is active |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 401 | Invalid email or password |
| — | 423 | Account locked (5 consecutive failures per M1-R4, 15 min lockout) |

---

#### POST `/magic-link`

**Send a magic link for passwordless authentication**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-003 |
| Business rules | M1-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"maria@example.com"` |

**Response** `200 OK`

```json
{
  "data": {
    "sent": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| sent | boolean | NO | — | Always true (no email enumeration) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M01-007 | 400 | Invalid magic link token (on click-through validation) |
| — | 429 | Rate limited |

---

### 2.4 Password Reset

#### POST `/forgot-password`

**Initiate password reset flow (sends OTP to email)**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-004 |
| Business rules | M1-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"maria@example.com"` |

**Response** `200 OK`

```json
{
  "data": {
    "sent": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| sent | boolean | NO | — | Always true (no email enumeration) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 429 | Rate limited |

---

#### POST `/reset-password`

**Complete password reset with OTP verification**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | N/A |
| Workflow | WF-004 |
| Business rules | M1-R1, M1-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| email | string | YES | NO | email | max 255 | — | `"maria@example.com"` |
| otpCode | string | YES | NO | — | 6 digits | — | `"384921"` |
| newPassword | string | YES | NO | — | min 8 chars, 1 upper, 1 number | — | `"NewSecure7"` |

**Response** `200 OK`

```json
{
  "data": {
    "sessionToken": "eyJhbGciOi..."
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| sessionToken | string | NO | — | New authenticated session |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid OTP |
| M01-005 | 422 | Password does not meet requirements |

---

### 2.5 Account Claim (Imported Members)

#### POST `/accept-invite`

**Claim a pre-populated account created via bulk import or individual invite**

| Property | Value |
|----------|-------|
| Auth | Public (unauthenticated) |
| Rate limit | Unauthenticated (20 req/min) |
| Idempotency | Optional |
| Workflow | WF-002 |
| Business rules | M1-R2, M1-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| token | string | YES | NO | — | Invitation token from email link | — | `"abc123def456"` |
| password | string | YES | NO | — | min 8 chars, 1 upper, 1 number | — | `"SecureP4ss"` |
| otpCode | string | YES | NO | — | 6 digits | — | `"192837"` |

**Response** `200 OK`

```json
{
  "data": {
    "personId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionToken": "eyJhbGciOi..."
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| personId | string | NO | uuid | Claimed person ID |
| sessionToken | string | NO | — | Authenticated session |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M01-002 | 422 | Invitation token expired (> 7 days per M1-R2) |
| M01-003 | 422 | Invitation token already claimed |
| M01-005 | 422 | Password does not meet requirements |

---

### 2.6 Onboarding Wizard

#### GET `/onboarding/state`

**Get current onboarding wizard progress for an organization**

| Property | Value |
|----------|-------|
| Auth | GA (session required) + officer org access |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-005 |
| Business rules | M1-R6 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| orgId | string | YES | Organization UUID |

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "currentStep": 3,
    "stepsCompleted": [1, 2],
    "completedAt": null
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Onboarding state ID |
| organizationId | string | NO | uuid | Organization ID |
| currentStep | integer | NO | — | Current step (1-5) |
| stepsCompleted | array | NO | integer[] | Completed step numbers |
| completedAt | string | YES | date-time | Null until wizard complete |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 404 | No onboarding state for this org |

---

#### PUT `/onboarding/step`

**Save wizard step data and advance progress**

| Property | Value |
|----------|-------|
| Auth | GA (session required) + officer org access |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-005 |
| Business rules | M1-R6, M1-R9 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| orgId | string | YES | NO | uuid | Valid organization ID | — | `"660e8400-e29b-41d4-a716-446655440000"` |
| step | integer | YES | NO | — | 1-5 | — | `3` |
| data | object | YES | NO | — | Step-specific payload (varies by step) | — | `{"duesCycle": "annual"}` |

**Response** `200 OK`

```json
{
  "data": {
    "saved": true,
    "currentStep": 4,
    "stepsCompleted": [1, 2, 3]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| saved | boolean | NO | — | Always true on success |
| currentStep | integer | NO | — | Next step |
| stepsCompleted | array | NO | integer[] | Updated completed steps |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M01-004 | 422 | Onboarding step out of order |
| — | 400 | Step data validation failure |

---

### 2.7 Invitations

#### POST `/invitations`

**Send an individual email invitation to join the organization**

| Property | Value |
|----------|-------|
| Auth | GA + HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-008 |
| Business rules | M1-R8 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| orgId | string | YES | NO | uuid | Valid organization ID | — | `"660e8400-e29b-41d4-a716-446655440000"` |
| email | string | YES | NO | email | max 255 | — | `"newmember@example.com"` |
| firstName | string | NO | NO | — | 1-50 chars | — | `"Juan"` |
| lastName | string | NO | NO | — | 1-50 chars | — | `"Cruz"` |

**Response** `201 Created`

```json
{
  "data": {
    "invitationId": "550e8400-e29b-41d4-a716-446655440000",
    "sent": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| invitationId | string | NO | uuid | Created invitation token ID |
| sent | boolean | NO | — | Email dispatched |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M01-001 | 409 | Email already registered in this org |
| M01-006 | 422 | Email domain not allowed for this organization |
| M01-008 | 422 | Organization invite required for private org |

---

### 2.8 Bulk Import

#### POST `/invitations/bulk-import`

**Upload CSV file for bulk member import with preview and validation**

| Property | Value |
|----------|-------|
| Auth | GA + HG (president 2FA, secretary 2FA, super, admin) |
| Rate limit | Bulk operations (10 req/min) |
| Idempotency | Required |
| Workflow | WF-009 |
| Business rules | M1-R10, M1-R11, BR-22, BR-25 |

**Request Body** (`multipart/form-data`)

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| orgId | string | YES | NO | uuid | Valid organization ID | — | `"660e8400-..."` |
| file | binary | YES | NO | text/csv | Max 5MB, CSV format | — | — |
| mode | string | NO | NO | — | `preview` or `import` | `preview` | `"preview"` |

**Response** `200 OK` (preview mode)

```json
{
  "data": {
    "totalRows": 150,
    "validRows": 142,
    "invalidRows": 8,
    "duplicateRows": 3,
    "preview": [
      {
        "row": 1,
        "email": "member1@example.com",
        "firstName": "Ana",
        "status": "valid"
      }
    ],
    "errors": [
      {
        "row": 5,
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

**Response** `201 Created` (import mode)

```json
{
  "data": {
    "importId": "550e8400-e29b-41d4-a716-446655440000",
    "imported": 142,
    "skipped": 11,
    "invitationsSent": 142
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| totalRows | integer | NO | — | Total CSV rows |
| validRows | integer | NO | — | Rows passing validation |
| invalidRows | integer | NO | — | Rows with errors |
| duplicateRows | integer | NO | — | Already-linked members (M1-R11) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid CSV format or empty file |
| — | 413 | File exceeds 5MB limit |

---

### 2.9 MFA Enrollment

#### POST `/auth/mfa/enroll`

**Begin TOTP MFA enrollment, returns QR code setup data**

| Property | Value |
|----------|-------|
| Auth | GA (session required) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-007 |
| Business rules | M1-R7 |

**Response** `200 OK`

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUri": "otpauth://totp/Memberry:maria@example.com?secret=JBSWY3DPEHPK3PXP",
    "backupCodes": ["abc12345", "def67890"]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| secret | string | NO | — | TOTP shared secret |
| qrCodeUri | string | NO | uri | OTPAuth URI for QR generation |
| backupCodes | array | NO | string[] | 10 single-use backup codes (M1-R7) |

---

#### POST `/auth/mfa/verify`

**Verify TOTP code to complete MFA enrollment or authenticate**

| Property | Value |
|----------|-------|
| Auth | GA (session required) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-007 |
| Business rules | M1-R7 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| code | string | YES | NO | — | 6 digits (TOTP) or backup code | — | `"482901"` |

**Response** `200 OK`

```json
{
  "data": {
    "verified": true,
    "mfaEnabled": true
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| verified | boolean | NO | — | Verification result |
| mfaEnabled | boolean | NO | — | MFA enrollment status |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| — | 400 | Invalid TOTP code |
| — | 422 | All backup codes exhausted (M1-R7) |

---

## 3. Domain Events

### Published Events

| Event Name | Trigger Endpoint | Payload |
|------------|-----------------|---------|
| PersonCreated | `POST /register`, `POST /accept-invite` | `{ personId, email, licenseNumber }` |
| SessionCreated | `POST /auth/sign-in`, `POST /verify-otp` | `{ personId, deviceInfo, sessionId }` |
| InvitationClaimed | `POST /accept-invite` | `{ tokenId, personId, orgId }` |
| OnboardingCompleted | `PUT /onboarding/step` (final step) | `{ orgId, officerId }` |

### Consumed Events

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| MembershipApproved | M05 | Grant org access, update dashboard |
| OrganizationCreated | M03 | Initialize onboarding state for wizard |

---

## 4. Entity Summary

| Entity | Primary Key | Unique Constraints | Notes |
|--------|------------|-------------------|-------|
| Person | `id` (uuid) | `email` (globally unique) | Central PII hub |
| Session | `id` (uuid) | — | 24h TTL (BR-26) |
| InvitationToken | `id` (uuid) | `tokenHash` | 7-day TTL, single-use |
| OnboardingState | `id` (uuid) | `organizationId` (one per org) | Resumable wizard |
