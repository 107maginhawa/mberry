<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Mock Data: Member Profile & Settings (M02)

> **NON-AUTHORITATIVE.** This data is for UI demonstration only. Field names match MODULE_SPEC section 7 entities and API_CONTRACTS.md response shapes. Do not use for testing or as source of truth.

---

## Entity: Person (extended fields)

3 records: active member with specialization, new member minimal profile, multi-org member.

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria.santos@example.com",
    "licenseNumber": "PRC-045821",
    "specialization": "Orthodontics",
    "subSpecialization": "Pediatric Orthodontics",
    "yearsOfPractice": 12,
    "affiliation": "Manila Dental Clinic",
    "photoUrl": "https://storage.example.com/photos/a1b2c3d4.jpg",
    "deletionRequestedAt": null,
    "deletionScheduledAt": null
  },
  {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "firstName": "Carlo",
    "lastName": "Reyes",
    "email": "carlo.reyes@example.com",
    "licenseNumber": "PRC-032156",
    "specialization": null,
    "subSpecialization": null,
    "yearsOfPractice": null,
    "affiliation": null,
    "photoUrl": null,
    "deletionRequestedAt": null,
    "deletionScheduledAt": null
  },
  {
    "id": "d4e5f6a7-b8c9-0123-efab-456789012345",
    "firstName": "Isabella",
    "lastName": "Cruz",
    "email": "isabella.cruz@example.com",
    "licenseNumber": "PRC-067234",
    "specialization": "Endodontics",
    "subSpecialization": null,
    "yearsOfPractice": 8,
    "affiliation": "Cebu Dental Hospital",
    "photoUrl": "https://storage.example.com/photos/d4e5f6a7.jpg",
    "deletionRequestedAt": "2026-05-10T09:00:00Z",
    "deletionScheduledAt": "2026-06-09T09:00:00Z"
  }
]
```

---

## Entity: NotificationPreference

5 records per org: one per category for Maria's Manila chapter.

```json
[
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "category": "dues",
    "pushEnabled": true,
    "emailEnabled": true
  },
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "category": "events",
    "pushEnabled": true,
    "emailEnabled": false
  },
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "category": "trainings",
    "pushEnabled": true,
    "emailEnabled": true
  },
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "category": "announcements",
    "pushEnabled": false,
    "emailEnabled": false
  },
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "category": "credits",
    "pushEnabled": true,
    "emailEnabled": true
  }
]
```

---

## Entity: PersonPrivacySetting

3 records: two orgs for Maria, one for Carlo.

```json
[
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "emailVisible": false,
    "phoneVisible": false,
    "photoVisible": true,
    "addressVisible": false
  },
  {
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-cebu-002",
    "emailVisible": true,
    "phoneVisible": false,
    "photoVisible": true,
    "addressVisible": true
  },
  {
    "personId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "emailVisible": false,
    "phoneVisible": false,
    "photoVisible": true,
    "addressVisible": false
  }
]
```

---

## Entity: DataExport

3 records: requested, ready, expired.

```json
[
  {
    "id": "exp-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "requested",
    "requestedAt": "2026-05-21T08:00:00Z",
    "completedAt": null,
    "downloadUrl": null,
    "expiresAt": null
  },
  {
    "id": "exp-002-aaaa-bbbb-cccc-ddddeeee0002",
    "personId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "status": "ready",
    "requestedAt": "2026-05-19T10:00:00Z",
    "completedAt": "2026-05-19T10:05:00Z",
    "downloadUrl": "https://storage.example.com/exports/exp-002.zip",
    "expiresAt": "2026-05-26T10:05:00Z"
  },
  {
    "id": "exp-003-aaaa-bbbb-cccc-ddddeeee0003",
    "personId": "d4e5f6a7-b8c9-0123-efab-456789012345",
    "status": "expired",
    "requestedAt": "2026-05-01T12:00:00Z",
    "completedAt": "2026-05-01T12:03:00Z",
    "downloadUrl": null,
    "expiresAt": "2026-05-08T12:03:00Z"
  }
]
```

---

## API Response Shapes

### GET /my/profile — Full Profile (200)

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "firstName": "Maria",
    "lastName": "Santos",
    "email": "maria.santos@example.com",
    "licenseNumber": "PRC-045821",
    "specialization": "Orthodontics",
    "subSpecialization": "Pediatric Orthodontics",
    "yearsOfPractice": 12,
    "affiliation": "Manila Dental Clinic",
    "photoUrl": "https://storage.example.com/photos/a1b2c3d4.jpg",
    "mfaEnabled": false,
    "memberships": [
      {
        "organizationId": "org-ph-dental-chapter-manila-001",
        "orgName": "PDA Manila Chapter",
        "orgLogoUrl": "https://storage.example.com/logos/manila.png",
        "status": "active",
        "category": "Regular",
        "duesExpiryDate": "2027-01-01T00:00:00Z"
      },
      {
        "organizationId": "org-ph-dental-chapter-cebu-002",
        "orgName": "PDA Cebu Chapter",
        "orgLogoUrl": null,
        "status": "grace",
        "category": "Regular",
        "duesExpiryDate": "2026-05-01T00:00:00Z"
      }
    ]
  }
}
```

### GET /my/id-card/:orgId — Digital ID Card (200)

```json
{
  "data": {
    "fullName": "Maria Santos",
    "licenseNumber": "PRC-045821",
    "orgName": "PDA Manila Chapter",
    "orgLogoUrl": "https://storage.example.com/logos/manila.png",
    "membershipStatus": "active",
    "membershipCategory": "Regular",
    "duesExpiryDate": "2027-01-01T00:00:00Z",
    "photoUrl": "https://storage.example.com/photos/a1b2c3d4.jpg",
    "qrCodeUrl": "https://api.example.com/verify/qr/a1b2c3d4?sig=hmac_abc123",
    "verificationUrl": "https://app.example.com/verify/a1b2c3d4?org=org-ph-dental-chapter-manila-001"
  }
}
```

### PUT /my/privacy — Save Privacy (200)

```json
{
  "data": {
    "updated": true,
    "settings": [
      {
        "organizationId": "org-ph-dental-chapter-manila-001",
        "emailVisible": true,
        "phoneVisible": false,
        "photoVisible": true,
        "addressVisible": false
      }
    ]
  }
}
```

### POST /my/delete-account — Deletion Requested (200)

```json
{
  "data": {
    "scheduledDate": "2026-06-20T10:00:00Z",
    "message": "Your account is scheduled for deletion on June 20, 2026. You can cancel at any time before then."
  }
}
```
