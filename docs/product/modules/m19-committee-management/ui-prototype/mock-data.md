<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M19 Committee Management -- Mock Data

> Non-authoritative. For UI prototyping only. Does not define business rules.

---

## Committees (4 records)

```json
[
  {
    "id": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "name": "Ethics Committee",
    "type": "standing",
    "purpose": "Review and adjudicate ethics complaints, maintain code of conduct, provide ethics guidance to members.",
    "chairperson": {
      "id": "p-001-aaaa-bbbb-cccc-ddddeeee0020",
      "name": "Dr. Elena Villanueva"
    },
    "status": "active",
    "termStart": "2026-01-01T00:00:00.000Z",
    "termEnd": null,
    "memberCount": 5,
    "openTaskCount": 3,
    "nextMeetingAt": "2026-06-01T14:00:00.000Z",
    "createdAt": "2025-12-15T10:00:00.000Z"
  },
  {
    "id": "comm-001-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "name": "Annual Conference Planning Committee",
    "type": "ad_hoc",
    "purpose": "Plan and execute the 2026 National Dental Association Annual Conference.",
    "chairperson": {
      "id": "p-001-aaaa-bbbb-cccc-ddddeeee0021",
      "name": "Dr. Marco Dela Cruz"
    },
    "status": "active",
    "termStart": "2026-03-01T00:00:00.000Z",
    "termEnd": "2026-12-31T23:59:59.000Z",
    "memberCount": 8,
    "openTaskCount": 12,
    "nextMeetingAt": "2026-05-25T10:00:00.000Z",
    "createdAt": "2026-02-20T08:00:00.000Z"
  },
  {
    "id": "comm-001-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "name": "CPD Accreditation Review Board",
    "type": "standing",
    "purpose": "Review and accredit continuing professional development programs and providers.",
    "chairperson": null,
    "status": "active",
    "termStart": "2026-01-01T00:00:00.000Z",
    "termEnd": null,
    "memberCount": 3,
    "openTaskCount": 0,
    "nextMeetingAt": null,
    "createdAt": "2025-12-15T10:00:00.000Z",
    "_note": "Leaderless: previous chairperson was removed from org. All mutations blocked."
  },
  {
    "id": "comm-001-aaaa-bbbb-cccc-ddddeeee0004",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "name": "2025 Election Committee",
    "type": "ad_hoc",
    "purpose": "Oversee the 2025 officer election process.",
    "chairperson": {
      "id": "p-001-aaaa-bbbb-cccc-ddddeeee0022",
      "name": "Dr. Sofia Reyes"
    },
    "status": "dissolved",
    "termStart": "2025-06-01T00:00:00.000Z",
    "termEnd": "2025-12-31T23:59:59.000Z",
    "dissolvedAt": "2025-12-20T16:00:00.000Z",
    "dissolvedBy": "p-001-aaaa-bbbb-cccc-ddddeeee0022",
    "dissolutionReason": "Election completed successfully. All results certified.",
    "memberCount": 4,
    "openTaskCount": 0,
    "nextMeetingAt": null,
    "createdAt": "2025-05-15T08:00:00.000Z"
  }
]
```

## Committee Members (for Ethics Committee)

```json
[
  {
    "id": "cm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0020",
    "personName": "Dr. Elena Villanueva",
    "role": "chairperson",
    "joinedAt": "2025-12-15T10:00:00.000Z",
    "leftAt": null
  },
  {
    "id": "cm-001-aaaa-bbbb-cccc-ddddeeee0002",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0023",
    "personName": "Dr. Antonio Bautista",
    "role": "vice_chair",
    "joinedAt": "2025-12-15T10:00:00.000Z",
    "leftAt": null
  },
  {
    "id": "cm-001-aaaa-bbbb-cccc-ddddeeee0003",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0024",
    "personName": "Dr. Isabella Torres",
    "role": "secretary",
    "joinedAt": "2026-01-10T08:00:00.000Z",
    "leftAt": null
  },
  {
    "id": "cm-001-aaaa-bbbb-cccc-ddddeeee0004",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0010",
    "personName": "Dr. Maria Santos",
    "role": "member",
    "joinedAt": "2026-02-01T09:00:00.000Z",
    "leftAt": null
  },
  {
    "id": "cm-001-aaaa-bbbb-cccc-ddddeeee0005",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0011",
    "personName": "Dr. Juan Reyes",
    "role": "member",
    "joinedAt": "2026-03-01T10:00:00.000Z",
    "leftAt": null
  }
]
```

## Committee Tasks (for Ethics Committee)

```json
[
  {
    "id": "ct-001-aaaa-bbbb-cccc-ddddeeee0001",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Draft updated ethics guidelines document",
    "description": "Create initial draft incorporating new PRC regulations and international best practices for dental ethics.",
    "assigneeId": "p-001-aaaa-bbbb-cccc-ddddeeee0024",
    "assigneeName": "Dr. Isabella Torres",
    "dueDate": "2026-06-15T00:00:00.000Z",
    "priority": "high",
    "status": "in_progress",
    "isOverdue": false,
    "createdAt": "2026-04-01T10:00:00.000Z"
  },
  {
    "id": "ct-001-aaaa-bbbb-cccc-ddddeeee0002",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Review Case #2026-003 complaint",
    "description": "Review ethics complaint filed against member regarding advertising practices.",
    "assigneeId": "p-001-aaaa-bbbb-cccc-ddddeeee0020",
    "assigneeName": "Dr. Elena Villanueva",
    "dueDate": "2026-05-30T00:00:00.000Z",
    "priority": "high",
    "status": "pending",
    "isOverdue": false,
    "createdAt": "2026-05-10T14:00:00.000Z"
  },
  {
    "id": "ct-001-aaaa-bbbb-cccc-ddddeeee0003",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Prepare quarterly ethics report",
    "description": null,
    "assigneeId": "p-001-aaaa-bbbb-cccc-ddddeeee0023",
    "assigneeName": "Dr. Antonio Bautista",
    "dueDate": "2026-05-15T00:00:00.000Z",
    "priority": "medium",
    "status": "pending",
    "isOverdue": true,
    "createdAt": "2026-04-20T08:00:00.000Z"
  },
  {
    "id": "ct-001-aaaa-bbbb-cccc-ddddeeee0004",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Update member ethics handbook",
    "description": "Incorporate 2025 case outcomes into the member-facing ethics handbook.",
    "assigneeId": null,
    "assigneeName": null,
    "dueDate": null,
    "priority": "low",
    "status": "pending",
    "isOverdue": false,
    "createdAt": "2026-05-01T11:00:00.000Z"
  },
  {
    "id": "ct-001-aaaa-bbbb-cccc-ddddeeee0005",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Organize ethics awareness webinar",
    "description": "Plan and schedule a 1-hour ethics awareness webinar for all members. Coordinate with communications committee.",
    "assigneeId": "p-001-aaaa-bbbb-cccc-ddddeeee0010",
    "assigneeName": "Dr. Maria Santos",
    "dueDate": "2026-04-30T00:00:00.000Z",
    "priority": "medium",
    "status": "completed",
    "isOverdue": false,
    "createdAt": "2026-03-15T09:00:00.000Z"
  }
]
```

## Committee Meetings (for Ethics Committee)

```json
[
  {
    "id": "cmtg-001-aaaa-bbbb-cccc-ddddeeee0001",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "scheduledAt": "2026-06-01T14:00:00.000Z",
    "agenda": "1. Review Case #2026-003\n2. Ethics guidelines draft review\n3. Webinar debrief\n4. Open items",
    "minutes": null,
    "createdAt": "2026-05-15T10:00:00.000Z"
  },
  {
    "id": "cmtg-001-aaaa-bbbb-cccc-ddddeeee0002",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "scheduledAt": "2026-05-01T14:00:00.000Z",
    "agenda": "1. Q1 report review\n2. Case #2026-002 disposition\n3. Guidelines update timeline",
    "minutes": "Present: Villanueva, Bautista, Torres, Santos, Reyes.\n\nQ1 report reviewed and approved. Case #2026-002 dismissed — insufficient evidence. Guidelines update timeline set for June 15. Webinar scheduled for April 30.\n\nAction items:\n- Torres: Complete guidelines draft by June 15.\n- Santos: Coordinate webinar logistics.\n- Bautista: Prepare Q2 report template.",
    "createdAt": "2026-04-20T08:00:00.000Z"
  },
  {
    "id": "cmtg-001-aaaa-bbbb-cccc-ddddeeee0003",
    "committeeId": "comm-001-aaaa-bbbb-cccc-ddddeeee0001",
    "scheduledAt": "2026-04-01T14:00:00.000Z",
    "agenda": "1. Welcome new members\n2. 2026 priorities\n3. Case backlog review",
    "minutes": "Present: Villanueva, Bautista, Torres, Santos.\n\nNew member Santos welcomed. 2026 priorities: update guidelines, clear case backlog, ethics awareness program. Two pending cases reviewed — Case #2026-001 resolved, Case #2026-002 deferred to May.",
    "createdAt": "2026-03-20T09:00:00.000Z"
  }
]
```
