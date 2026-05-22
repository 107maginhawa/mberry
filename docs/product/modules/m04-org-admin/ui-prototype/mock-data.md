<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint — Mock Data: Organization Admin (M04)

> **NON-AUTHORITATIVE.** This data is for UI demonstration only. Field names match MODULE_SPEC section 7 entities and API_CONTRACTS.md response shapes. Do not use for testing or as source of truth.

---

## Entity: Organization

3 records: active chapter, active national, trial chapter.

```json
[
  {
    "id": "org-ph-dental-chapter-manila-001",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA Manila Chapter",
    "slug": "pda-manila",
    "orgType": "chapter",
    "description": "The largest chapter of the Philippine Dental Association serving Metro Manila practitioners.",
    "logoUrl": "https://storage.example.com/logos/pda-manila.svg",
    "contactEmail": "manila@pda.example.com",
    "meetingSchedule": "Every 2nd Tuesday, 7:00 PM at Manila Hotel Conference Room",
    "foundingDate": "1985-03-15",
    "featureFlags": { "events": true, "training": true, "elections": false }
  },
  {
    "id": "org-ph-dental-society-national-001",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA National Office",
    "slug": "pda-national",
    "orgType": "national",
    "description": "The national governing body of the Philippine Dental Association.",
    "logoUrl": "https://storage.example.com/logos/pda-national.svg",
    "contactEmail": "national@pda.example.com",
    "meetingSchedule": "Quarterly board meetings",
    "foundingDate": "1968-06-12",
    "featureFlags": { "events": true, "training": true, "elections": true }
  },
  {
    "id": "org-ph-dental-chapter-cebu-002",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA Cebu Chapter",
    "slug": "pda-cebu",
    "orgType": "chapter",
    "description": "Serving dental professionals in the Cebu region.",
    "logoUrl": null,
    "contactEmail": "cebu@pda.example.com",
    "meetingSchedule": "Every 1st Friday, 6:30 PM",
    "foundingDate": "1992-08-20",
    "featureFlags": { "events": true, "training": false, "elections": false }
  }
]
```

---

## Entity: Position

5 records for PDA Manila Chapter.

```json
[
  {
    "id": "pos-001-president-manila",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "title": "president",
    "isElected": true
  },
  {
    "id": "pos-002-vp-manila",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "title": "vice-president",
    "isElected": true
  },
  {
    "id": "pos-003-secretary-manila",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "title": "secretary",
    "isElected": true
  },
  {
    "id": "pos-004-treasurer-manila",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "title": "treasurer",
    "isElected": true
  },
  {
    "id": "pos-005-board-manila",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "title": "board-member",
    "isElected": false
  }
]
```

---

## Entity: OfficerTerm

5 records: active, upcoming, completed, resigned, removed.

```json
[
  {
    "id": "term-001-president-active",
    "positionId": "pos-001-president-manila",
    "personId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "active",
    "startDate": "2026-01-01",
    "endDate": "2027-12-31",
    "assignedBy": "admin-super-001"
  },
  {
    "id": "term-002-secretary-active",
    "positionId": "pos-003-secretary-manila",
    "personId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "active",
    "startDate": "2026-01-01",
    "endDate": "2027-12-31",
    "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  {
    "id": "term-003-treasurer-upcoming",
    "positionId": "pos-004-treasurer-manila",
    "personId": "d4e5f6a7-b8c9-0123-efab-456789012345",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "upcoming",
    "startDate": "2027-01-01",
    "endDate": "2028-12-31",
    "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  {
    "id": "term-004-vp-completed",
    "positionId": "pos-002-vp-manila",
    "personId": "e5f6a7b8-c9d0-1234-abef-567890123456",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "completed",
    "startDate": "2024-01-01",
    "endDate": "2025-12-31",
    "assignedBy": "admin-super-001"
  },
  {
    "id": "term-005-board-resigned",
    "positionId": "pos-005-board-manila",
    "personId": "f6a7b8c9-d0e1-2345-bcef-678901234567",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "resigned",
    "startDate": "2026-01-01",
    "endDate": "2026-04-15",
    "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
]
```

---

## Entity: DisciplinaryAction

3 records: warning, suspension, removal.

```json
[
  {
    "id": "disc-001-warning-aaaa",
    "personId": "f6a7b8c9-d0e1-2345-bcef-678901234567",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "actionType": "warning",
    "reason": "Failure to attend 3 consecutive mandatory meetings without prior notice.",
    "duration": null,
    "issuedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "issuedAt": "2026-03-10T14:00:00Z"
  },
  {
    "id": "disc-002-suspension-bbbb",
    "personId": "g7b8c9d0-e1f2-3456-cdef-789012345678",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "actionType": "suspension",
    "reason": "Violation of code of ethics during annual convention.",
    "duration": 90,
    "issuedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "issuedAt": "2026-04-22T09:30:00Z"
  },
  {
    "id": "disc-003-removal-cccc",
    "personId": "h8c9d0e1-f2a3-4567-defa-890123456789",
    "organizationId": "org-ph-dental-chapter-cebu-002",
    "actionType": "removal",
    "reason": "Fraudulent use of association credentials. Investigation confirmed by ethics committee.",
    "duration": null,
    "issuedBy": "i9d0e1f2-a3b4-5678-efab-901234567890",
    "issuedAt": "2026-02-14T11:00:00Z"
  }
]
```

---

## Entity: TransitionChecklist

1 record: secretary transition in progress.

```json
[
  {
    "id": "trans-001-secretary-manila",
    "officerTermId": "term-002-secretary-active",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "items": [
      { "id": "item-001", "label": "Pending membership applications reviewed", "completed": true, "notes": "3 applications forwarded to new secretary" },
      { "id": "item-002", "label": "Meeting minutes archive transferred", "completed": true, "notes": "Google Drive folder shared" },
      { "id": "item-003", "label": "Communication templates reviewed", "completed": false, "notes": null },
      { "id": "item-004", "label": "Upcoming events calendar handoff", "completed": false, "notes": null }
    ],
    "incomingPersonId": "j0e1f2a3-b4c5-6789-fabc-012345678901",
    "createdAt": "2026-05-15T08:00:00Z",
    "completedAt": null
  }
]
```

---

## API Response Shapes

### GET /org/:id — Full Org (200)

```json
{
  "data": {
    "id": "org-ph-dental-chapter-manila-001",
    "associationId": "assoc-001-ph-dental-aaaa-bbbbcccc0001",
    "name": "PDA Manila Chapter",
    "slug": "pda-manila",
    "orgType": "chapter",
    "description": "The largest chapter of the Philippine Dental Association serving Metro Manila practitioners.",
    "logoUrl": "https://storage.example.com/logos/pda-manila.svg",
    "contactEmail": "manila@pda.example.com",
    "meetingSchedule": "Every 2nd Tuesday, 7:00 PM at Manila Hotel Conference Room",
    "foundingDate": "1985-03-15",
    "featureFlags": { "events": true, "training": true, "elections": false }
  }
}
```

### GET /org/:slug/public — Public Page (200)

```json
{
  "data": {
    "name": "PDA Manila Chapter",
    "slug": "pda-manila",
    "orgType": "chapter",
    "description": "The largest chapter of the Philippine Dental Association serving Metro Manila practitioners.",
    "logoUrl": "https://storage.example.com/logos/pda-manila.svg",
    "contactEmail": "manila@pda.example.com",
    "meetingSchedule": "Every 2nd Tuesday, 7:00 PM",
    "foundingDate": "1985-03-15",
    "activeMemberCount": 456
  }
}
```

### GET /org/:id/dashboard — Dashboard (200)

```json
{
  "data": {
    "orgName": "PDA Manila Chapter",
    "activeMemberCount": 456,
    "duescollectionRate": 92.1,
    "upcomingActivities": 3,
    "smartActions": [
      {
        "type": "unpaid_dues",
        "count": 12,
        "label": "12 members with unpaid dues",
        "href": "/org/org-ph-dental-chapter-manila-001/officer/dues",
        "urgency": "warning"
      },
      {
        "type": "pending_applications",
        "count": 5,
        "label": "5 pending membership applications",
        "href": "/org/org-ph-dental-chapter-manila-001/officer/applications",
        "urgency": "info"
      },
      {
        "type": "expiring_terms",
        "count": 2,
        "label": "2 officer terms expiring within 30 days",
        "href": "/org/org-ph-dental-chapter-manila-001/officer/officers",
        "urgency": "warning"
      }
    ]
  }
}
```

### POST /org/:id/officers — Assign Officer (201)

```json
{
  "data": {
    "id": "term-006-new-assignment",
    "positionId": "pos-002-vp-manila",
    "personId": "j0e1f2a3-b4c5-6789-fabc-012345678901",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "status": "active",
    "startDate": "2026-06-01",
    "endDate": "2027-12-31",
    "assignedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### POST /org/:id/discipline — Disciplinary Action (201)

```json
{
  "data": {
    "id": "disc-004-new-action",
    "personId": "f6a7b8c9-d0e1-2345-bcef-678901234567",
    "organizationId": "org-ph-dental-chapter-manila-001",
    "actionType": "suspension",
    "reason": "Violation of code of ethics",
    "duration": 90,
    "issuedBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "issuedAt": "2026-05-21T10:00:00Z"
  }
}
```
