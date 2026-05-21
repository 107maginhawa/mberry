<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Mock Data: Communications (M07)

> Demonstration data for UI prototyping. Non-authoritative. UUIDs are fake.
> All names and content are fictional.

---

## Entity: Announcement (5 records)

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440001",
    "authorName": "Dr. Juan Cruz",
    "title": "Annual General Assembly Reminder",
    "status": "sent",
    "visibility": "internal",
    "channels": ["in-app", "email", "push"],
    "audienceFilter": { "status": ["active", "gracePeriod"] },
    "priority": "normal",
    "scheduledAt": null,
    "sentAt": "2026-05-20T09:00:00.000Z",
    "createdAt": "2026-05-19T14:00:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440002",
    "authorName": "Dr. Lisa Reyes",
    "title": "Dues Payment Deadline Extension",
    "status": "sent",
    "visibility": "internal",
    "channels": ["in-app", "email"],
    "audienceFilter": { "status": ["lapsed", "gracePeriod"] },
    "priority": "high",
    "scheduledAt": null,
    "sentAt": "2026-05-18T08:00:00.000Z",
    "createdAt": "2026-05-17T16:30:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440001",
    "authorName": "Dr. Juan Cruz",
    "title": "New Member Welcome - June 2026",
    "status": "scheduled",
    "visibility": "internal",
    "channels": ["in-app", "email"],
    "audienceFilter": null,
    "priority": "normal",
    "scheduledAt": "2026-06-01T09:00:00.000Z",
    "sentAt": null,
    "createdAt": "2026-05-21T10:00:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440002",
    "authorName": "Dr. Lisa Reyes",
    "title": "Community Outreach Event Update",
    "status": "draft",
    "visibility": "network",
    "channels": ["in-app"],
    "audienceFilter": null,
    "priority": "normal",
    "scheduledAt": null,
    "sentAt": null,
    "createdAt": "2026-05-21T11:00:00.000Z"
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440001",
    "authorName": "Dr. Juan Cruz",
    "title": "Board Meeting Minutes - April 2026",
    "status": "archived",
    "visibility": "internal",
    "channels": ["in-app", "email"],
    "audienceFilter": null,
    "priority": "normal",
    "scheduledAt": null,
    "sentAt": "2026-04-25T10:00:00.000Z",
    "createdAt": "2026-04-24T15:00:00.000Z"
  }
]
```

---

## Entity: AnnouncementStats (3 records)

```json
[
  {
    "announcementId": "aa0e8400-e29b-41d4-a716-446655440001",
    "sentCount": 340,
    "deliveredCount": 335,
    "openedCount": 210,
    "failedCount": 5,
    "lastUpdated": "2026-05-21T12:00:00.000Z"
  },
  {
    "announcementId": "aa0e8400-e29b-41d4-a716-446655440002",
    "sentCount": 85,
    "deliveredCount": 82,
    "openedCount": 71,
    "failedCount": 3,
    "lastUpdated": "2026-05-20T08:00:00.000Z"
  },
  {
    "announcementId": "aa0e8400-e29b-41d4-a716-446655440005",
    "sentCount": 340,
    "deliveredCount": 338,
    "openedCount": 195,
    "failedCount": 2,
    "lastUpdated": "2026-05-01T10:00:00.000Z"
  }
]
```

---

## Entity: MessageTemplate (4 records)

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Welcome New Member",
    "subject": "Welcome to {{organizationName}}!",
    "bodyHtml": "<p>Dear {{firstName}},</p><p>Welcome to {{organizationName}}! We're excited to have you as a {{tierName}} member.</p><p>Your membership is active through {{duesExpiryDate}}.</p>",
    "bodyText": "Dear {{firstName}}, Welcome to {{organizationName}}!",
    "status": "active",
    "category": "membership",
    "variables": ["firstName", "lastName", "organizationName", "tierName", "duesExpiryDate"],
    "lastUsedAt": "2026-05-20T09:00:00.000Z",
    "createdAt": "2025-12-01T10:00:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Dues Reminder",
    "subject": "Your {{organizationName}} dues are due",
    "bodyHtml": "<p>Hi {{firstName}},</p><p>Your membership dues of {{duesAmount}} are due on {{dueDate}}. <a href='{{paymentLink}}'>Pay now</a></p>",
    "bodyText": "Hi {{firstName}}, Your dues of {{duesAmount}} are due on {{dueDate}}.",
    "status": "active",
    "category": "dues",
    "variables": ["firstName", "organizationName", "duesAmount", "dueDate", "paymentLink"],
    "lastUsedAt": "2026-05-18T08:00:00.000Z",
    "createdAt": "2026-01-10T10:00:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Event Announcement",
    "subject": "Join us: {{eventTitle}}",
    "bodyHtml": "<p>Dear Members,</p><p>We're excited to announce: <strong>{{eventTitle}}</strong></p><p>Date: {{eventDate}}<br>Location: {{eventLocation}}</p><p><a href='{{registrationLink}}'>Register now</a></p>",
    "bodyText": "Join us for {{eventTitle}} on {{eventDate}} at {{eventLocation}}.",
    "status": "active",
    "category": "events",
    "variables": ["eventTitle", "eventDate", "eventLocation", "registrationLink"],
    "lastUsedAt": "2026-05-15T14:00:00.000Z",
    "createdAt": "2026-02-20T10:00:00.000Z"
  },
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Election Notice",
    "subject": "{{organizationName}} Election — Cast Your Vote",
    "bodyHtml": "<p>Dear {{firstName}},</p><p>Voting for the {{electionTitle}} is now open. Cast your vote before {{votingDeadline}}.</p>",
    "bodyText": "Voting for {{electionTitle}} is now open.",
    "status": "draft",
    "category": "governance",
    "variables": ["firstName", "organizationName", "electionTitle", "votingDeadline"],
    "lastUsedAt": null,
    "createdAt": "2026-05-10T10:00:00.000Z"
  }
]
```

---

## Entity: SubscriptionTopic (3 records)

```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Dues Reminders",
    "description": "Payment due date reminders and overdue notices",
    "defaultEnabled": true,
    "channels": ["email", "push", "in-app"]
  },
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Event Announcements",
    "description": "Notifications about upcoming organization events",
    "defaultEnabled": true,
    "channels": ["email", "push", "in-app"]
  },
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "General Updates",
    "description": "Organization news and updates from officers",
    "defaultEnabled": true,
    "channels": ["email", "push", "in-app"]
  }
]
```

---

## Entity: PersonSubscription (notification preferences, 3 records)

```json
{
  "subscriptions": [
    {
      "topicId": "cc0e8400-e29b-41d4-a716-446655440001",
      "topicName": "Dues Reminders",
      "channels": {
        "email": true,
        "push": true,
        "inApp": true
      }
    },
    {
      "topicId": "cc0e8400-e29b-41d4-a716-446655440002",
      "topicName": "Event Announcements",
      "channels": {
        "email": false,
        "push": true,
        "inApp": true
      }
    },
    {
      "topicId": "cc0e8400-e29b-41d4-a716-446655440003",
      "topicName": "General Updates",
      "channels": {
        "email": true,
        "push": false,
        "inApp": true
      }
    }
  ]
}
```

---

## Sample Template Variables (for preview rendering)

```json
{
  "firstName": "Maria",
  "lastName": "Santos",
  "organizationName": "PDA Manila Chapter",
  "tierName": "Regular",
  "duesExpiryDate": "2027-06-30",
  "duesAmount": "PHP 5,000.00",
  "dueDate": "June 30, 2026",
  "paymentLink": "https://memberry.app/pay/abc123",
  "eventTitle": "Annual General Assembly 2026",
  "eventDate": "July 15, 2026",
  "eventLocation": "Manila Hotel Grand Ballroom",
  "registrationLink": "https://memberry.app/org/123/events/456",
  "electionTitle": "2026-2027 Board of Directors",
  "votingDeadline": "June 15, 2026"
}
```
