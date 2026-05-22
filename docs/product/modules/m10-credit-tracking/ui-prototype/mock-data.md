<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M10 Credit Tracking -- Mock Data

> Non-authoritative. For demonstration and UI prototyping only.

---

## Credit Summary Response (GET /credits/my)

```json
{
  "data": {
    "personId": "person-juan-dela-cruz",
    "cycles": [
      {
        "cycleId": "cycle-2026",
        "associationId": "org-pda-national",
        "associationName": "Philippine Dental Association",
        "cycleStart": "2026-03-15T00:00:00.000Z",
        "cycleEnd": "2029-03-14T23:59:59.000Z",
        "requiredCredits": 60,
        "earnedCredits": 38,
        "carryoverCredits": 4,
        "remainingCredits": 18,
        "complianceStatus": "at-risk",
        "entries": [
          {
            "id": "ce-001",
            "activityName": "CPD Seminar on Oral Surgery Advances",
            "activityDate": "2026-06-15T00:00:00.000Z",
            "credits": 8,
            "source": "auto",
            "verificationStatus": "verified",
            "organizationName": "PDA Manila Chapter",
            "trainingId": "t-001-seminar-oral",
            "createdAt": "2026-06-16T10:00:00.000Z"
          },
          {
            "id": "ce-002",
            "activityName": "Infection Control in Dental Practice (Online)",
            "activityDate": "2026-04-30T00:00:00.000Z",
            "credits": 6,
            "source": "auto",
            "verificationStatus": "verified",
            "organizationName": "PDA Manila Chapter",
            "trainingId": "t-004-online-infection",
            "createdAt": "2026-05-01T10:00:00.000Z"
          },
          {
            "id": "ce-003",
            "activityName": "PDA 2026 Annual Convention",
            "activityDate": "2026-09-12T00:00:00.000Z",
            "credits": 24,
            "source": "auto",
            "verificationStatus": "verified",
            "organizationName": "Philippine Dental Association",
            "trainingId": "t-003-convention-annual",
            "createdAt": "2026-09-13T08:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

---

## Credit Entries (Mixed Auto + Manual)

```json
[
  {
    "id": "ce-001",
    "activityName": "CPD Seminar on Oral Surgery Advances",
    "activityDate": "2026-06-15T00:00:00.000Z",
    "credits": 8,
    "source": "auto",
    "verificationStatus": "verified",
    "organizationName": "PDA Manila Chapter",
    "trainingId": "t-001-seminar-oral",
    "createdAt": "2026-06-16T10:00:00.000Z"
  },
  {
    "id": "ce-002",
    "activityName": "Infection Control in Dental Practice (Online)",
    "activityDate": "2026-04-30T00:00:00.000Z",
    "credits": 6,
    "source": "auto",
    "verificationStatus": "verified",
    "organizationName": "PDA Manila Chapter",
    "trainingId": "t-004-online-infection",
    "createdAt": "2026-05-01T10:00:00.000Z"
  },
  {
    "id": "ce-004",
    "activityName": "Hospital Grand Rounds - Maxillofacial Trauma",
    "activityDate": "2026-05-10T00:00:00.000Z",
    "credits": 4,
    "source": "manual",
    "verificationStatus": "pending",
    "organizationName": "PDA Manila Chapter",
    "trainingId": null,
    "createdAt": "2026-05-11T09:00:00.000Z"
  },
  {
    "id": "ce-005",
    "activityName": "Self-Study: Dental Materials Update (Journal Review)",
    "activityDate": "2026-07-20T00:00:00.000Z",
    "credits": 2,
    "source": "manual",
    "verificationStatus": "rejected",
    "organizationName": "PDA Manila Chapter",
    "trainingId": null,
    "createdAt": "2026-07-21T14:00:00.000Z"
  },
  {
    "id": "ce-006",
    "activityName": "Regional Dental Health Outreach Program",
    "activityDate": "2026-08-05T00:00:00.000Z",
    "credits": 3,
    "source": "manual",
    "verificationStatus": "verified",
    "organizationName": "PDA Cebu Chapter",
    "trainingId": null,
    "createdAt": "2026-08-06T11:00:00.000Z"
  }
]
```

---

## Org Credit Compliance Response (GET /orgs/:orgId/credits/compliance)

```json
{
  "data": [
    {
      "personId": "person-juan-dela-cruz",
      "personName": "Dr. Juan Dela Cruz",
      "earnedCredits": 38,
      "requiredCredits": 60,
      "carryoverCredits": 4,
      "complianceStatus": "at-risk",
      "lastActivityDate": "2026-09-12T00:00:00.000Z"
    },
    {
      "personId": "person-ana-villanueva",
      "personName": "Dr. Ana Villanueva",
      "earnedCredits": 62,
      "requiredCredits": 60,
      "carryoverCredits": 0,
      "complianceStatus": "compliant",
      "lastActivityDate": "2026-09-13T00:00:00.000Z"
    },
    {
      "personId": "person-carlos-reyes",
      "personName": "Dr. Carlos Reyes",
      "earnedCredits": 14,
      "requiredCredits": 60,
      "carryoverCredits": 8,
      "complianceStatus": "at-risk",
      "lastActivityDate": "2026-06-15T00:00:00.000Z"
    },
    {
      "personId": "person-elena-cruz",
      "personName": "Dr. Elena Cruz",
      "earnedCredits": 0,
      "requiredCredits": 60,
      "carryoverCredits": 0,
      "complianceStatus": "non-compliant",
      "lastActivityDate": null
    },
    {
      "personId": "person-ramon-santos",
      "personName": "Dr. Ramon Santos",
      "earnedCredits": 58,
      "requiredCredits": 60,
      "carryoverCredits": 2,
      "complianceStatus": "compliant",
      "lastActivityDate": "2026-08-22T00:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6InBlcnNvbi1yYW1vbiJ9",
    "hasMore": true,
    "total": 187
  }
}
```

---

## Credit Adjustment Example

```json
{
  "request": {
    "personId": "person-carlos-reyes",
    "credits": 4,
    "reason": "Retroactive credit for community dental outreach program (August 2026) per officer review and documentation verification."
  },
  "response": {
    "data": {
      "id": "ce-adj-001",
      "personId": "person-carlos-reyes",
      "credits": 4,
      "reason": "Retroactive credit for community dental outreach program (August 2026) per officer review and documentation verification.",
      "adjustedBy": "person-maria-santos",
      "createdAt": "2026-09-15T14:00:00.000Z"
    }
  }
}
```

---

## Compliance Cycle Config (Association-level)

```json
{
  "associationId": "org-pda-national",
  "cyclePeriodYears": 3,
  "requiredCreditsPerCycle": 60,
  "carryoverEnabled": true,
  "maxCarryoverCredits": 10,
  "cycleAnchor": "registrationDate"
}
```
