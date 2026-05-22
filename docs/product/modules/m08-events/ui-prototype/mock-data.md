<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Mock Data: Events (M08)

> Demonstration data for UI prototyping. Non-authoritative. UUIDs are fake.
> All names, locations, and amounts are fictional.

---

## Entity: Event (5 records)

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Annual General Assembly 2026",
    "description": "<p>Join us for the annual general assembly. Agenda: board elections, financial report, committee updates.</p>",
    "eventType": "generalAssembly",
    "status": "published",
    "visibility": "internal",
    "startDate": "2026-07-15T09:00:00.000Z",
    "endDate": "2026-07-15T17:00:00.000Z",
    "location": "Manila Hotel Grand Ballroom",
    "coverImage": "https://cdn.example.com/events/aga-2026.jpg",
    "capacityLimit": 500,
    "feeAmount": "2500",
    "currency": "PHP",
    "registrationCount": 342,
    "waitlistCount": 0
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Induction Ceremony - New Members 2026",
    "description": "<p>Welcome ceremony for all new members inducted in 2026.</p>",
    "eventType": "inductionCeremony",
    "status": "published",
    "visibility": "internal",
    "startDate": "2026-06-20T18:00:00.000Z",
    "endDate": "2026-06-20T21:00:00.000Z",
    "location": "Shangri-La The Fort, Function Room A",
    "coverImage": null,
    "capacityLimit": 100,
    "feeAmount": "0",
    "currency": "PHP",
    "registrationCount": 98,
    "waitlistCount": 5
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Community Dental Mission - Tondo",
    "description": "<p>Free dental services for Tondo community. Volunteers needed for extraction, cleaning, and oral health education.</p>",
    "eventType": "medicalMission",
    "status": "published",
    "visibility": "network",
    "startDate": "2026-08-10T07:00:00.000Z",
    "endDate": "2026-08-10T16:00:00.000Z",
    "location": "Tondo Barangay Hall, Manila",
    "coverImage": "https://cdn.example.com/events/dental-mission-2026.jpg",
    "capacityLimit": null,
    "feeAmount": null,
    "currency": "PHP",
    "registrationCount": 45,
    "waitlistCount": 0
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Board Meeting - Q2 Review",
    "description": "<p>Quarterly review of chapter finances and membership growth.</p>",
    "eventType": "boardMeeting",
    "status": "completed",
    "visibility": "internal",
    "startDate": "2026-04-28T14:00:00.000Z",
    "endDate": "2026-04-28T16:00:00.000Z",
    "location": "Online - Zoom",
    "coverImage": null,
    "capacityLimit": 15,
    "feeAmount": null,
    "currency": "PHP",
    "registrationCount": 12,
    "waitlistCount": 0
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Fellowship Night - Christmas 2025",
    "description": "<p>Annual Christmas fellowship dinner and gift exchange.</p>",
    "eventType": "fellowship",
    "status": "cancelled",
    "visibility": "internal",
    "startDate": "2025-12-15T18:00:00.000Z",
    "endDate": "2025-12-15T22:00:00.000Z",
    "location": "Makati Shangri-La, Rizal Ballroom",
    "coverImage": null,
    "capacityLimit": 200,
    "feeAmount": "3500",
    "currency": "PHP",
    "registrationCount": 150,
    "waitlistCount": 0
  }
]
```

---

## Entity: EventRegistration (5 records)

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440001",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "status": "confirmed",
    "paymentId": "ff0e8400-e29b-41d4-a716-446655440010",
    "registeredAt": "2026-05-10T10:00:00.000Z",
    "cancelledAt": null
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440002",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440001",
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "status": "confirmed",
    "paymentId": "ff0e8400-e29b-41d4-a716-446655440011",
    "registeredAt": "2026-05-12T14:30:00.000Z",
    "cancelledAt": null
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440003",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "status": "waitlisted",
    "paymentId": null,
    "registeredAt": "2026-06-01T09:00:00.000Z",
    "cancelledAt": null
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440004",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440005",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "status": "refunded",
    "paymentId": "ff0e8400-e29b-41d4-a716-446655440012",
    "registeredAt": "2025-11-20T10:00:00.000Z",
    "cancelledAt": "2025-12-10T08:00:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440005",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440004",
    "personId": "770e8400-e29b-41d4-a716-446655440002",
    "status": "confirmed",
    "paymentId": null,
    "registeredAt": "2026-04-20T11:00:00.000Z",
    "cancelledAt": null
  }
]
```

---

## Entity: CheckIn (3 records)

```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440001",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440004",
    "personId": "770e8400-e29b-41d4-a716-446655440002",
    "method": "manual",
    "checkedInBy": "cc0e8400-e29b-41d4-a716-446655440001",
    "checkedInAt": "2026-04-28T14:05:00.000Z"
  },
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440002",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440004",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "method": "qr",
    "checkedInBy": "cc0e8400-e29b-41d4-a716-446655440001",
    "checkedInAt": "2026-04-28T14:02:00.000Z"
  },
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440003",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440004",
    "personId": "770e8400-e29b-41d4-a716-446655440005",
    "method": "qr",
    "checkedInBy": "cc0e8400-e29b-41d4-a716-446655440002",
    "checkedInAt": "2026-04-28T14:10:00.000Z"
  }
]
```

---

## Entity: WaitlistEntry (3 records)

```json
[
  {
    "id": "dd0e8400-e29b-41d4-a716-446655440001",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "position": 1,
    "promotedAt": null
  },
  {
    "id": "dd0e8400-e29b-41d4-a716-446655440002",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440006",
    "position": 2,
    "promotedAt": null
  },
  {
    "id": "dd0e8400-e29b-41d4-a716-446655440003",
    "eventId": "aa0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440007",
    "position": 3,
    "promotedAt": null
  }
]
```

---

## Attendee List (Check-In Screen, 5 records)

```json
[
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440001",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "personName": "Maria Santos",
    "registrationStatus": "confirmed",
    "checkedIn": true,
    "checkInMethod": "qr",
    "checkedInAt": "2026-07-15T09:15:00.000Z"
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440002",
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "personName": "Ana Cruz",
    "registrationStatus": "confirmed",
    "checkedIn": true,
    "checkInMethod": "manual",
    "checkedInAt": "2026-07-15T09:20:00.000Z"
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440006",
    "personId": "770e8400-e29b-41d4-a716-446655440002",
    "personName": "Jose Reyes",
    "registrationStatus": "confirmed",
    "checkedIn": false,
    "checkInMethod": null,
    "checkedInAt": null
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440007",
    "personId": "770e8400-e29b-41d4-a716-446655440005",
    "personName": "Lucia Fernandez",
    "registrationStatus": "confirmed",
    "checkedIn": false,
    "checkInMethod": null,
    "checkedInAt": null
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440008",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "personName": "Carlos Mendoza",
    "registrationStatus": "cancelled",
    "checkedIn": false,
    "checkInMethod": null,
    "checkedInAt": null
  }
]
```

---

## My Events (Member View, 3 records)

```json
[
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440001",
    "status": "confirmed",
    "registeredAt": "2026-05-10T10:00:00.000Z",
    "event": {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "title": "Annual General Assembly 2026",
      "eventType": "generalAssembly",
      "startDate": "2026-07-15T09:00:00.000Z",
      "endDate": "2026-07-15T17:00:00.000Z",
      "location": "Manila Hotel Grand Ballroom",
      "organizationName": "PDA Manila Chapter"
    }
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440009",
    "status": "confirmed",
    "registeredAt": "2026-05-18T08:00:00.000Z",
    "event": {
      "id": "aa0e8400-e29b-41d4-a716-446655440003",
      "title": "Community Dental Mission - Tondo",
      "eventType": "medicalMission",
      "startDate": "2026-08-10T07:00:00.000Z",
      "endDate": "2026-08-10T16:00:00.000Z",
      "location": "Tondo Barangay Hall, Manila",
      "organizationName": "PDA Manila Chapter"
    }
  },
  {
    "registrationId": "bb0e8400-e29b-41d4-a716-446655440004",
    "status": "refunded",
    "registeredAt": "2025-11-20T10:00:00.000Z",
    "event": {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "title": "Fellowship Night - Christmas 2025",
      "eventType": "fellowship",
      "startDate": "2025-12-15T18:00:00.000Z",
      "endDate": "2025-12-15T22:00:00.000Z",
      "location": "Makati Shangri-La, Rizal Ballroom",
      "organizationName": "PDA Manila Chapter"
    }
  }
]
```
