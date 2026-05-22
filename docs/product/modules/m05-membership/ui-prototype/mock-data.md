<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Mock Data: Membership (M05)

> Demonstration data for UI prototyping. Non-authoritative. UUIDs are fake.
> All names, emails, and license numbers are fictional.

---

## Entity: Membership (5 records)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "tierId": "880e8400-e29b-41d4-a716-446655440001",
    "tierName": "Regular",
    "duesExpiryDate": "2027-06-30",
    "computedStatus": "active",
    "suspendedAt": null,
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2024-03-15T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "firstName": "Maria",
      "lastName": "Santos",
      "email": "maria.santos@example.com",
      "licenseNumber": "0012345"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440002",
    "tierId": "880e8400-e29b-41d4-a716-446655440002",
    "tierName": "Life Member",
    "duesExpiryDate": "2099-12-31",
    "computedStatus": "active",
    "suspendedAt": null,
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2018-06-01T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "firstName": "Jose",
      "lastName": "Reyes",
      "email": "jose.reyes@example.com",
      "licenseNumber": "0009876"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "tierId": "880e8400-e29b-41d4-a716-446655440001",
    "tierName": "Regular",
    "duesExpiryDate": "2026-04-15",
    "computedStatus": "gracePeriod",
    "suspendedAt": null,
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2022-01-10T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440003",
      "firstName": "Ana",
      "lastName": "Cruz",
      "email": "ana.cruz@example.com",
      "licenseNumber": "0034567"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "tierId": "880e8400-e29b-41d4-a716-446655440003",
    "tierName": "Associate",
    "duesExpiryDate": "2026-01-01",
    "computedStatus": "lapsed",
    "suspendedAt": null,
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2023-07-20T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440004",
      "firstName": "Carlos",
      "lastName": "Mendoza",
      "email": "carlos.mendoza@example.com",
      "licenseNumber": "0045678"
    }
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440005",
    "tierId": "880e8400-e29b-41d4-a716-446655440001",
    "tierName": "Regular",
    "duesExpiryDate": "2026-05-20",
    "computedStatus": "suspended",
    "suspendedAt": "2026-04-01T10:00:00.000Z",
    "removedAt": null,
    "isPendingPayment": false,
    "joinedAt": "2021-09-05T08:00:00.000Z",
    "person": {
      "id": "770e8400-e29b-41d4-a716-446655440005",
      "firstName": "Lucia",
      "lastName": "Fernandez",
      "email": "lucia.fernandez@example.com",
      "licenseNumber": "0056789"
    }
  }
]
```

---

## Entity: MembershipApplication (4 records)

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": null,
    "applicantEmail": "new.applicant@example.com",
    "applicantLicenseNumber": "0067890",
    "firstName": "Elena",
    "lastName": "Garcia",
    "tierId": "880e8400-e29b-41d4-a716-446655440001",
    "tierName": "Regular",
    "status": "submitted",
    "createdAt": "2026-05-18T14:00:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440010",
    "applicantEmail": "pedro.lim@example.com",
    "applicantLicenseNumber": "0078901",
    "firstName": "Pedro",
    "lastName": "Lim",
    "tierId": "880e8400-e29b-41d4-a716-446655440003",
    "tierName": "Associate",
    "status": "underReview",
    "createdAt": "2026-05-15T09:30:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": null,
    "applicantEmail": "rosa.tan@example.com",
    "applicantLicenseNumber": "0089012",
    "firstName": "Rosa",
    "lastName": "Tan",
    "tierId": "880e8400-e29b-41d4-a716-446655440004",
    "tierName": "Student",
    "status": "submitted",
    "createdAt": "2026-05-20T16:45:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "applicantEmail": "maria.santos@example.com",
    "applicantLicenseNumber": "0012345",
    "firstName": "Maria",
    "lastName": "Santos",
    "tierId": "880e8400-e29b-41d4-a716-446655440001",
    "tierName": "Regular",
    "status": "denied",
    "createdAt": "2026-05-10T11:00:00.000Z"
  }
]
```

---

## Entity: MembershipCategory / MembershipTier (4 records)

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Regular",
    "duesAmount": "5000.00",
    "billingCycle": "annual",
    "status": "active"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Life Member",
    "duesAmount": "50000.00",
    "billingCycle": "annual",
    "status": "active"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Associate",
    "duesAmount": "3000.00",
    "billingCycle": "annual",
    "status": "active"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Student",
    "duesAmount": "1000.00",
    "billingCycle": "annual",
    "status": "active"
  }
]
```

---

## Entity: MembershipStatusHistory (3 records)

```json
[
  {
    "membershipId": "550e8400-e29b-41d4-a716-446655440001",
    "previousStatus": "pendingPayment",
    "newStatus": "active",
    "changedAt": "2024-03-20T10:00:00.000Z",
    "changedBy": "cc0e8400-e29b-41d4-a716-446655440001",
    "reason": "Payment confirmed"
  },
  {
    "membershipId": "550e8400-e29b-41d4-a716-446655440005",
    "previousStatus": "active",
    "newStatus": "suspended",
    "changedAt": "2026-04-01T10:00:00.000Z",
    "changedBy": "cc0e8400-e29b-41d4-a716-446655440002",
    "reason": "Non-compliance with code of conduct"
  },
  {
    "membershipId": "550e8400-e29b-41d4-a716-446655440004",
    "previousStatus": "active",
    "newStatus": "lapsed",
    "changedAt": "2026-02-01T00:00:00.000Z",
    "changedBy": null,
    "reason": null
  }
]
```

---

## Entity: AffiliationTransfer (3 records)

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "sourceOrgId": "660e8400-e29b-41d4-a716-446655440000",
    "targetOrgId": "660e8400-e29b-41d4-a716-446655440099",
    "status": "pendingTargetApproval",
    "reason": "Relocating to Cebu chapter",
    "createdAt": "2026-05-15T08:00:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "sourceOrgId": "660e8400-e29b-41d4-a716-446655440000",
    "targetOrgId": "660e8400-e29b-41d4-a716-446655440098",
    "status": "completed",
    "reason": "Practice relocation to Davao",
    "createdAt": "2026-03-01T08:00:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440003",
    "personId": "770e8400-e29b-41d4-a716-446655440005",
    "sourceOrgId": "660e8400-e29b-41d4-a716-446655440000",
    "targetOrgId": "660e8400-e29b-41d4-a716-446655440097",
    "status": "denied",
    "reason": "Transfer to different association blocked",
    "createdAt": "2026-04-10T08:00:00.000Z"
  }
]
```

---

## Import Preview (CSV Import Step 2)

```json
{
  "importJobId": "dd0e8400-e29b-41d4-a716-446655440001",
  "preview": {
    "totalRows": 150,
    "newMembers": 120,
    "linkedToExisting": 25,
    "invalidRows": 5,
    "errors": [
      { "row": 23, "field": "licenseNumber", "message": "Invalid PRC format" },
      { "row": 47, "field": "email", "message": "Invalid email format" },
      { "row": 89, "field": "email", "message": "Duplicate email within file" },
      { "row": 102, "field": "licenseNumber", "message": "Missing required field" },
      { "row": 131, "field": "email", "message": "Ambiguous match: email maps to Person A, license maps to Person B" }
    ]
  }
}
```

---

## Directory Entry (privacy-filtered, 3 records)

```json
[
  {
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "firstName": "Maria",
    "lastName": "Santos",
    "tierName": "Regular",
    "computedStatus": "active",
    "specialization": "Orthodontics"
  },
  {
    "personId": "770e8400-e29b-41d4-a716-446655440002",
    "firstName": "Jose",
    "lastName": "Reyes",
    "tierName": "Life Member",
    "computedStatus": "active"
  },
  {
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "firstName": "Ana",
    "lastName": "Cruz",
    "tierName": "Regular",
    "computedStatus": "gracePeriod",
    "specialization": "Periodontics"
  }
]
```
