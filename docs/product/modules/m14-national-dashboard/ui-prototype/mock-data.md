<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Mock Data: National Dashboard (M14)

> Mock data is for UI demonstration only. It must not be treated as final schema, API contract, lifecycle state, or business rule.

---

## Mock Entity: NationalDashboardSnapshot (Summary)

```json
{
  "data": {
    "associationId": "assoc-pda-uuid",
    "associationName": "Philippine Dental Association",
    "snapshotDate": "2026-05-21T00:00:00Z",
    "totalMembers": 4823,
    "activePercent": 78.4,
    "collectionRate": 82.1,
    "compliancePercent": 71.6,
    "chapterCount": 42,
    "trends": {
      "period": "monthly",
      "data": [
        { "date": "2026-01-01", "totalMembers": 4512, "activePercent": 75.2, "collectionRate": 68.3, "compliancePercent": 65.4 },
        { "date": "2026-02-01", "totalMembers": 4589, "activePercent": 76.1, "collectionRate": 71.7, "compliancePercent": 67.8 },
        { "date": "2026-03-01", "totalMembers": 4651, "activePercent": 76.8, "collectionRate": 74.2, "compliancePercent": 69.1 },
        { "date": "2026-04-01", "totalMembers": 4748, "activePercent": 77.5, "collectionRate": 78.6, "compliancePercent": 70.3 },
        { "date": "2026-05-01", "totalMembers": 4823, "activePercent": 78.4, "collectionRate": 82.1, "compliancePercent": 71.6 }
      ]
    }
  }
}
```

---

## Mock Entity: Chapter Comparison (List)

```json
{
  "data": [
    {
      "organizationId": "org-cebu-dental-uuid",
      "organizationName": "Cebu Dental Chapter",
      "memberCount": 312,
      "activePercent": 84.6,
      "collectionRate": 91.2,
      "compliancePercent": 79.5
    },
    {
      "organizationId": "org-manila-dental-uuid",
      "organizationName": "Manila Dental Chapter",
      "memberCount": 587,
      "activePercent": 81.2,
      "collectionRate": 85.4,
      "compliancePercent": 74.2
    },
    {
      "organizationId": "org-davao-dental-uuid",
      "organizationName": "Davao Dental Chapter",
      "memberCount": 198,
      "activePercent": 72.3,
      "collectionRate": 67.8,
      "compliancePercent": 62.1
    },
    {
      "organizationId": "org-iloilo-dental-uuid",
      "organizationName": "Iloilo Dental Chapter",
      "memberCount": 145,
      "activePercent": 89.7,
      "collectionRate": 93.1,
      "compliancePercent": 85.4
    },
    {
      "organizationId": "org-zamboanga-dental-uuid",
      "organizationName": "Zamboanga Dental Chapter",
      "memberCount": 87,
      "activePercent": 65.5,
      "collectionRate": 58.2,
      "compliancePercent": 54.3
    }
  ],
  "meta": {
    "totalChapters": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

---

## Mock Entity: Chapter Drill-Down Detail

```json
{
  "data": {
    "organizationId": "org-cebu-dental-uuid",
    "organizationName": "Cebu Dental Chapter",
    "memberCount": 312,
    "activeMembers": 264,
    "activePercent": 84.6,
    "collectionRate": 91.2,
    "creditCompliance": 79.5,
    "statusBreakdown": {
      "active": 264,
      "grace": 22,
      "lapsed": 18,
      "suspended": 8
    },
    "recentEvents": [
      { "name": "Annual Convention 2026", "date": "2026-05-18", "attendees": 203 },
      { "name": "Advanced Endodontics Workshop", "date": "2026-04-22", "attendees": 28 },
      { "name": "Monthly General Meeting", "date": "2026-05-05", "attendees": 112 }
    ],
    "officers": [
      { "role": "president", "name": "Dr. Maria Reyes" },
      { "role": "secretary", "name": "Dr. Carlos Santos" },
      { "role": "treasurer", "name": "Dr. Ana Garcia" }
    ]
  }
}
```

---

## Mock Entity: Platform-Wide Summary (Platform Admin view)

```json
{
  "data": {
    "totalAssociations": 3,
    "totalMembers": 12847,
    "totalChapters": 98,
    "associations": [
      { "associationId": "assoc-pda-uuid", "name": "Philippine Dental Association", "members": 4823, "chapters": 42 },
      { "associationId": "assoc-pma-uuid", "name": "Philippine Medical Association", "members": 6412, "chapters": 38 },
      { "associationId": "assoc-pna-uuid", "name": "Philippine Nursing Association", "members": 1612, "chapters": 18 }
    ]
  }
}
```

---

## Mock Export Response (Async Large Dataset)

```json
{
  "data": {
    "jobId": "export-job-001-uuid",
    "status": "processing",
    "pollUrl": "/admin/national/export/jobs/export-job-001-uuid"
  }
}
```

---

### Prototype-Only Assumptions
- NationalDashboardSnapshot is a computed view, not a persistent entity; mock shows the API response shape
- Trend data granularity (monthly vs. quarterly) depends on selected date range; mock shows monthly
- Color thresholds for chapter comparison (green/yellow/red) are UI-level decisions, not business rules
- Platform-wide summary is only visible to platform admins (super/admin roles)
- Export job polling interval and timeout are implementation details, not specified here
