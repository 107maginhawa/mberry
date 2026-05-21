<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Mock Data: Auth & Onboarding (M01)

> **NON-AUTHORITATIVE.** This data is for UI demonstration only. Field names match MODULE_SPEC section 7 entities and API_CONTRACTS.md response shapes. Do not use for testing or as source of truth.

---

## Entity: Person

3 records covering registration, claim, and full profile states.

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria.santos@example.com",
    "licenseNumber": "PRC-045821",
    "mfaEnabled": false,
    "emailVerifiedAt": "2026-05-20T08:30:00Z"
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "firstName": "Carlo",
    "lastName": "Reyes",
    "email": "carlo.reyes@example.com",
    "licenseNumber": "PRC-032156",
    "mfaEnabled": true,
    "emailVerifiedAt": "2026-04-15T14:22:00Z"
  },
  {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "firstName": "Ana",
    "lastName": null,
    "email": "ana.delacru@example.com",
    "licenseNumber": "PRC-058432",
    "mfaEnabled": false,
    "emailVerifiedAt": null
  }
]
```

---

## Entity: Session

3 records: active, expired, revoked.

```json
[
  {
    "id": "s1a2b3c4-d5e6-7890-abcd-session00001",
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tokenHash": "sha256:abc123...truncated",
    "deviceInfo": "Chrome 126 / macOS 15.3",
    "expiresAt": "2026-05-22T08:30:00Z",
    "revokedAt": null
  },
  {
    "id": "s2b3c4d5-e6f7-8901-bcde-session00002",
    "personId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "tokenHash": "sha256:def456...truncated",
    "deviceInfo": "Safari / iOS 19",
    "expiresAt": "2026-05-19T14:22:00Z",
    "revokedAt": null
  },
  {
    "id": "s3c4d5e6-f7a8-9012-cdef-session00003",
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tokenHash": "sha256:ghi789...truncated",
    "deviceInfo": "Firefox 130 / Windows 11",
    "expiresAt": "2026-05-21T10:00:00Z",
    "revokedAt": "2026-05-20T16:45:00Z"
  }
]
```

---

## Entity: InvitationToken

4 records: pending, claimed, expired, bulk-imported.

```json
[
  {
    "id": "inv-001-aaaa-bbbb-cccc-ddddeeee0001",
    "email": "juan.cruz@example.com",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "pending",
    "expiresAt": "2026-06-20T00:00:00Z",
    "createdAt": "2026-05-20T10:00:00Z",
    "claimedAt": null
  },
  {
    "id": "inv-002-aaaa-bbbb-cccc-ddddeeee0002",
    "email": "rosa.garcia@example.com",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "claimed",
    "expiresAt": "2026-06-15T00:00:00Z",
    "createdAt": "2026-05-10T09:00:00Z",
    "claimedAt": "2026-05-12T14:30:00Z"
  },
  {
    "id": "inv-003-aaaa-bbbb-cccc-ddddeeee0003",
    "email": "pedro.lim@example.com",
    "organizationId": "org-ph-dental-chapter-cebu-002",
    "status": "expired",
    "expiresAt": "2026-04-01T00:00:00Z",
    "createdAt": "2026-03-01T08:00:00Z",
    "claimedAt": null
  },
  {
    "id": "inv-004-aaaa-bbbb-cccc-ddddeeee0004",
    "email": "elena.tan@example.com",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "pending",
    "expiresAt": "2026-06-20T00:00:00Z",
    "createdAt": "2026-05-20T10:00:00Z",
    "claimedAt": null
  }
]
```

---

## Entity: OnboardingState

3 records: started, in-progress, completed.

```json
[
  {
    "id": "onb-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "currentStep": 1,
    "stepsCompleted": [],
    "completedAt": null
  },
  {
    "id": "onb-002-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-ph-dental-chapter-cebu-002",
    "currentStep": 3,
    "stepsCompleted": [1, 2],
    "completedAt": null
  },
  {
    "id": "onb-003-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-ph-dental-society-national-001",
    "currentStep": 5,
    "stepsCompleted": [1, 2, 3, 4, 5],
    "completedAt": "2026-05-18T16:00:00Z"
  }
]
```

---

## API Response Shapes

### POST /register — Success (201)

```json
{
  "data": {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "maria.santos@example.com",
    "otpSent": true
  }
}
```

### POST /verify-otp — Success (200)

```json
{
  "data": {
    "verified": true,
    "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwZXJzb25JZCI6ImExYjJjM2Q0LWU1ZjYtNzg5MC1hYmNkLWVmMTIzNDU2Nzg5MCJ9.mock"
  }
}
```

### POST /auth/sign-in — Success (200)

```json
{
  "data": {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "sessionToken": "eyJhbGciOi...mock-session-token",
    "mfaRequired": false
  }
}
```

### POST /auth/sign-in — MFA Required (200)

```json
{
  "data": {
    "personId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "mfaRequired": true,
    "mfaMethod": "totp"
  }
}
```

### GET /onboarding/state — In Progress (200)

```json
{
  "data": {
    "organizationId": "org-ph-dental-chapter-cebu-002",
    "currentStep": 3,
    "stepsCompleted": [1, 2],
    "completedAt": null
  }
}
```

### POST /invitations/bulk-import — Partial Success (200)

```json
{
  "data": {
    "total": 50,
    "imported": 47,
    "errors": [
      { "row": 12, "field": "email", "message": "Invalid email format" },
      { "row": 23, "field": "licenseNumber", "message": "Duplicate license number" },
      { "row": 41, "field": "email", "message": "Email already registered" }
    ]
  }
}
```
