<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Mock Data: Platform Administration (M03)

> **NON-AUTHORITATIVE.** This data is for UI demonstration only. Field names match MODULE_SPEC section 7 entities and API_CONTRACTS.md response shapes. Do not use for testing or as source of truth.

---

## Entity: Association

3 records: Philippine dental (active), Philippine medical (setup), test.

```json
[
  {
    "id": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "Philippine Dental Association",
    "country": "PH",
    "licenseFormatRegex": "^PRC-\\d{5,6}$",
    "creditCyclePeriod": 2,
    "creditCycleRequired": 40,
    "carryoverEnabled": true,
    "localeSettings": { "dateFormat": "DD/MM/YYYY", "currency": "PHP", "timezone": "Asia/Manila" },
    "createdAt": "2026-01-15T08:00:00Z"
  },
  {
    "id": "assoc-002-ph-medical-aaaa-bbbbcccc0002",
    "name": "Philippine Medical Association",
    "country": "PH",
    "licenseFormatRegex": "^PRC-MD-\\d{6}$",
    "creditCyclePeriod": 3,
    "creditCycleRequired": 60,
    "carryoverEnabled": false,
    "localeSettings": { "dateFormat": "DD/MM/YYYY", "currency": "PHP", "timezone": "Asia/Manila" },
    "createdAt": "2026-04-01T10:00:00Z"
  },
  {
    "id": "assoc-003-test-aaaa-bbbbcccc0003",
    "name": "Demo Healthcare Association",
    "country": "US",
    "licenseFormatRegex": "^[A-Z]{2}-\\d{6}$",
    "creditCyclePeriod": 1,
    "creditCycleRequired": 20,
    "carryoverEnabled": true,
    "localeSettings": { "dateFormat": "MM/DD/YYYY", "currency": "USD", "timezone": "America/New_York" },
    "createdAt": "2026-05-01T12:00:00Z"
  }
]
```

---

## Entity: Organization

5 records across associations: active, trial, suspended states.

```json
[
  {
    "id": "org-ph-dental-chapter-manila-001",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA Manila Chapter",
    "slug": "pda-manila",
    "orgType": "chapter",
    "status": "active",
    "healthScore": 87,
    "trialExpiresAt": null
  },
  {
    "id": "org-ph-dental-chapter-cebu-002",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA Cebu Chapter",
    "slug": "pda-cebu",
    "orgType": "chapter",
    "status": "active",
    "healthScore": 72,
    "trialExpiresAt": null
  },
  {
    "id": "org-ph-dental-society-national-001",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA National Office",
    "slug": "pda-national",
    "orgType": "national",
    "status": "active",
    "healthScore": 95,
    "trialExpiresAt": null
  },
  {
    "id": "org-ph-medical-chapter-manila-001",
    "associationId": "assoc-002-ph-medical-aaaa-bbbbcccc0002",
    "name": "PMA Metro Manila Chapter",
    "slug": "pma-metro-manila",
    "orgType": "chapter",
    "status": "trial",
    "healthScore": null,
    "trialExpiresAt": "2026-06-01T00:00:00Z"
  },
  {
    "id": "org-demo-clinic-001",
    "associationId": "assoc-003-test-aaaa-bbbbcccc0003",
    "name": "Springfield Family Dental",
    "slug": "springfield-dental",
    "orgType": "clinic",
    "status": "suspended",
    "healthScore": 23,
    "trialExpiresAt": null
  }
]
```

---

## Entity: FeatureFlag

5 records: tier-level and org-level flags.

```json
[
  {
    "id": "ff-001-aaaa-bbbb-cccc-ddddeeee0001",
    "moduleName": "M09 (Events)",
    "targetType": "tier",
    "targetId": "premium",
    "enabled": true
  },
  {
    "id": "ff-002-aaaa-bbbb-cccc-ddddeeee0002",
    "moduleName": "M09 (Events)",
    "targetType": "tier",
    "targetId": "standard",
    "enabled": false
  },
  {
    "id": "ff-003-aaaa-bbbb-cccc-ddddeeee0003",
    "moduleName": "M10 (Training)",
    "targetType": "tier",
    "targetId": "premium",
    "enabled": true
  },
  {
    "id": "ff-004-aaaa-bbbb-cccc-ddddeeee0004",
    "moduleName": "M10 (Training)",
    "targetType": "org",
    "targetId": "org-ph-dental-chapter-manila-001",
    "enabled": true
  },
  {
    "id": "ff-005-aaaa-bbbb-cccc-ddddeeee0005",
    "moduleName": "M12 (Elections)",
    "targetType": "tier",
    "targetId": "premium",
    "enabled": false
  }
]
```

---

## Entity: Subscription

3 records: active, trial, past due.

```json
[
  {
    "id": "sub-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "tier": "premium",
    "status": "active",
    "currentPeriodEnd": "2026-06-15T00:00:00Z",
    "externalId": "sub_1aBcDeFgHiJkLmN"
  },
  {
    "id": "sub-002-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-ph-medical-chapter-manila-001",
    "tier": "standard",
    "status": "trial",
    "currentPeriodEnd": "2026-06-01T00:00:00Z",
    "externalId": null
  },
  {
    "id": "sub-003-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-demo-clinic-001",
    "tier": "free",
    "status": "pastDue",
    "currentPeriodEnd": "2026-05-01T00:00:00Z",
    "externalId": "sub_2xYzAbCdEfGhIjK"
  }
]
```

---

## Entity: ImpersonationSession [INFERRED]

3 records: active, completed, expired.

```json
[
  {
    "id": "imp-001-aaaa-bbbb-cccc-ddddeeee0001",
    "adminId": "admin-super-001",
    "targetPersonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "reason": "Investigating reported login issue for member",
    "startedAt": "2026-05-21T09:00:00Z",
    "expiresAt": "2026-05-21T10:00:00Z",
    "endedAt": null,
    "status": "active"
  },
  {
    "id": "imp-002-aaaa-bbbb-cccc-ddddeeee0002",
    "adminId": "admin-super-001",
    "targetPersonId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "reason": "Verifying profile display issue",
    "startedAt": "2026-05-20T14:00:00Z",
    "expiresAt": "2026-05-20T15:00:00Z",
    "endedAt": "2026-05-20T14:35:00Z",
    "status": "completed"
  },
  {
    "id": "imp-003-aaaa-bbbb-cccc-ddddeeee0003",
    "adminId": "admin-regular-001",
    "targetPersonId": "d4e5f6a7-b8c9-0123-efab-456789012345",
    "reason": "Testing notification preferences flow",
    "startedAt": "2026-05-19T11:00:00Z",
    "expiresAt": "2026-05-19T12:00:00Z",
    "endedAt": "2026-05-19T12:00:00Z",
    "status": "expired"
  }
]
```

---

## API Response Shapes

### GET /admin/associations — List (200)

```json
{
  "data": [
    {
      "id": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
      "name": "Philippine Dental Association",
      "country": "PH",
      "licenseFormatRegex": "^PRC-\\d{5,6}$",
      "creditCyclePeriod": 2,
      "creditCycleRequired": 40,
      "carryoverEnabled": true,
      "localeSettings": { "dateFormat": "DD/MM/YYYY", "currency": "PHP" },
      "orgCount": 3,
      "memberCount": 1247,
      "createdAt": "2026-01-15T08:00:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 3 }
}
```

### GET /admin/analytics/revenue — Revenue (200)

```json
{
  "data": {
    "mrr": 42500,
    "arr": 510000,
    "currency": "PHP",
    "churnRate": 2.3,
    "trialConversionRate": 68.5,
    "revenueByTier": [
      { "tier": "premium", "mrr": 35000, "orgCount": 7 },
      { "tier": "standard", "mrr": 7500, "orgCount": 5 },
      { "tier": "free", "mrr": 0, "orgCount": 3 }
    ]
  }
}
```

### GET /admin/analytics/health — Health (200)

```json
{
  "data": {
    "totalAssociations": 3,
    "totalOrgs": 15,
    "totalMembers": 2847,
    "organizations": [
      { "id": "org-ph-dental-chapter-manila-001", "name": "PDA Manila Chapter", "healthScore": 87, "activeMemberCount": 456, "duescollectionRate": 92.1 },
      { "id": "org-ph-dental-chapter-cebu-002", "name": "PDA Cebu Chapter", "healthScore": 72, "activeMemberCount": 312, "duescollectionRate": 78.4 },
      { "id": "org-ph-dental-society-national-001", "name": "PDA National Office", "healthScore": 95, "activeMemberCount": 0, "duescollectionRate": null }
    ]
  }
}
```

### POST /admin/impersonate — Start (200)

```json
{
  "data": {
    "sessionId": "imp-001-aaaa-bbbb-cccc-ddddeeee0001",
    "targetPerson": { "id": "a1b2c3d4-...", "name": "Maria Santos", "email": "maria.santos@example.com" },
    "expiresAt": "2026-05-21T10:00:00Z"
  }
}
```
