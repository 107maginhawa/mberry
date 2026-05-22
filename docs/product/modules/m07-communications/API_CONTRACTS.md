<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts --- Communications (M07)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/announcements`, `/org/:organizationId/templates`, `/my/notifications` |
| Auth default | GA+OA for officer reads; GA+HG for mutations |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Announcements and templates scoped by `organizationId`; preferences scoped to authenticated person |

---

## 2. Endpoints

### 2.1 Announcements

#### GET `/org/:organizationId/announcements`

**List announcements for the organization**

| Property | Value |
|----------|-------|
| Auth | All officers + staff |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-046 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| cursor | string | NO | Pagination cursor |
| limit | integer | NO | Page size (1-100, default 25) |
| status | string | NO | Filter by status: `draft`, `scheduled`, `sent`, `archived` |
| visibility | string | NO | Filter by visibility: `internal`, `network` |
| sort | string | NO | Sort field: `createdAt`, `scheduledAt`, `sentAt`. Prefix `-` for descending |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "authorId": "cc0e8400-e29b-41d4-a716-446655440000",
      "authorName": "Dr. Juan Cruz",
      "title": "Annual General Assembly Reminder",
      "status": "sent",
      "visibility": "internal",
      "channels": ["in-app", "email", "push"],
      "scheduledAt": null,
      "sentAt": "2026-05-20T09:00:00.000Z",
      "priority": "normal",
      "createdAt": "2026-05-19T14:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFhMGU4NDAwIn0",
    "hasMore": true,
    "total": 47
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Announcement ID |
| authorId | string | NO | uuid | Creator person ID |
| authorName | string | NO | -- | Creator display name |
| title | string | NO | -- | Announcement title (max 300 chars) |
| status | string | NO | enum | draft / scheduled / sent / archived |
| visibility | string | NO | enum | internal / network |
| channels | array | NO | -- | Delivery channels (in-app always included) |
| scheduledAt | string | YES | date-time | Scheduled delivery time |
| sentAt | string | YES | date-time | Actual delivery time |
| priority | string | NO | enum | normal / high |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Not an officer of this organization |

---

#### POST `/org/:organizationId/announcements`

**Create a new announcement (draft)**

| Property | Value |
|----------|-------|
| Auth | president, VP, secretary, officer (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-046 |
| Business rules | M7-R1, BR-26 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | YES | NO | -- | Max 300 chars | -- | "Annual GA Reminder" |
| body | string | YES | NO | -- | HTML with Handlebars; max 50,000 chars | -- | "<p>Dear {{firstName}}...</p>" |
| visibility | string | NO | NO | enum | internal / network | "internal" | "internal" |
| channels | array | YES | NO | -- | Array of: `in-app`, `email`, `push`. in-app always included (M7-R1) | -- | ["in-app", "email"] |
| audienceFilter | object | NO | YES | -- | JSON filter: status, tierId, categoryId | null | {"status": "active"} |
| priority | string | NO | NO | enum | normal / high | "normal" | "normal" |

**Response** `201 Created`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "authorId": "cc0e8400-e29b-41d4-a716-446655440000",
    "title": "Annual GA Reminder",
    "status": "draft",
    "visibility": "internal",
    "channels": ["in-app", "email"],
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-003 | 422 | Announcement requires at least one target audience |
| AUTH-003 | 403 | Insufficient permissions |
| VALIDATION-001 | 400 | Invalid input |

---

#### POST `/org/:organizationId/announcements/:announcementId/publish`

**Publish and immediately send an announcement**

| Property | Value |
|----------|-------|
| Auth | president, secretary (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-046 |
| Business rules | M7-R1, M7-R2, M7-R5, M7-R6, BR-26 |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "status": "sent",
    "sentAt": "2026-05-21T10:05:00.000Z",
    "deliveryStats": {
      "sentCount": 340,
      "deliveredCount": 335,
      "failedCount": 5
    }
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| deliveryStats | object | NO | -- | Initial delivery statistics |
| deliveryStats.sentCount | integer | NO | -- | Total recipients targeted |
| deliveryStats.deliveredCount | integer | NO | -- | Successfully delivered |
| deliveryStats.failedCount | integer | NO | -- | Failed deliveries |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-003 | 422 | Announcement requires at least one target audience |
| M07-005 | 422 | Cannot edit published announcement |
| M07-006 | 422 | Recipient list exceeds maximum (10,000) |
| AUTH-003 | 403 | Insufficient permissions |
| CORE-001 | 404 | Announcement not found |

---

#### POST `/org/:organizationId/announcements/:announcementId/schedule`

**Schedule announcement for future delivery**

| Property | Value |
|----------|-------|
| Auth | president, secretary (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-046 |
| Business rules | M7-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| scheduledAt | string | YES | NO | date-time | Must be in the future | -- | "2026-06-01T09:00:00.000Z" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "status": "scheduled",
    "scheduledAt": "2026-06-01T09:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-004 | 422 | Scheduled send time must be in the future |
| M07-005 | 422 | Cannot edit published announcement |
| CORE-001 | 404 | Announcement not found |
| AUTH-003 | 403 | Insufficient permissions |

---

#### GET `/org/:organizationId/announcements/:announcementId/stats`

**Get delivery statistics for an announcement**

| Property | Value |
|----------|-------|
| Auth | All officers (GA+OA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-046 |
| Business rules | -- |

**Response** `200 OK`

```json
{
  "data": {
    "announcementId": "aa0e8400-e29b-41d4-a716-446655440000",
    "sentCount": 340,
    "deliveredCount": 335,
    "openedCount": 210,
    "failedCount": 5,
    "lastUpdated": "2026-05-21T12:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| announcementId | string | NO | uuid | Announcement ID |
| sentCount | integer | NO | -- | Total sent |
| deliveredCount | integer | NO | -- | Confirmed delivered |
| openedCount | integer | NO | -- | Opened/read count |
| failedCount | integer | NO | -- | Failed deliveries |
| lastUpdated | string | NO | date-time | Last stats refresh |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| CORE-001 | 404 | Announcement not found |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.2 Message Templates

#### GET `/org/:organizationId/templates`

**List message templates for the organization**

| Property | Value |
|----------|-------|
| Auth | All officers + staff (GA+OA) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-047 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | NO | Filter by status: `draft`, `active`, `archived` |
| category | string | NO | Filter by template category |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Welcome New Member",
      "subject": "Welcome to {{organizationName}}!",
      "status": "active",
      "category": "membership",
      "variables": ["firstName", "lastName", "organizationName", "tierName"],
      "lastUsedAt": "2026-05-20T09:00:00.000Z",
      "createdAt": "2025-12-01T10:00:00.000Z"
    }
  ]
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Template ID |
| name | string | NO | -- | Template name (unique per org) |
| subject | string | NO | -- | Email subject line (max 200 chars) |
| status | string | NO | enum | draft / active / archived |
| category | string | YES | -- | Template category for filtering |
| variables | array | YES | -- | List of expected Handlebars variables |
| lastUsedAt | string | YES | date-time | Last time template was used |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Not an officer of this organization |

---

#### POST `/org/:organizationId/templates`

**Create a new message template**

| Property | Value |
|----------|-------|
| Auth | president, VP, secretary, officer (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-047 |
| Business rules | M7-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | -- | Max 100 chars; unique per org | -- | "Welcome New Member" |
| subject | string | YES | NO | -- | Max 200 chars; Handlebars allowed | -- | "Welcome to {{organizationName}}!" |
| bodyHtml | string | YES | NO | -- | Valid Handlebars HTML | -- | "<p>Dear {{firstName}}...</p>" |
| bodyText | string | NO | YES | -- | Plain text fallback | -- | "Dear {{firstName}}..." |
| category | string | NO | YES | -- | Template category | -- | "membership" |
| variables | array | NO | YES | -- | Expected variable names (documentation) | -- | ["firstName", "organizationName"] |

**Response** `201 Created`

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Welcome New Member",
    "subject": "Welcome to {{organizationName}}!",
    "status": "draft",
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-001 | 422 | Template name already exists for this organization |
| M07-002 | 422 | Template variable missing: {variable} |
| VALIDATION-001 | 400 | Invalid Handlebars syntax |
| AUTH-003 | 403 | Insufficient permissions |

---

#### PATCH `/org/:organizationId/templates/:templateId`

**Update an existing message template**

| Property | Value |
|----------|-------|
| Auth | president, VP, secretary, officer (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-047 |
| Business rules | M7-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | NO | NO | -- | Max 100 chars; unique per org | -- | "Welcome V2" |
| subject | string | NO | NO | -- | Max 200 chars | -- | "Updated subject" |
| bodyHtml | string | NO | NO | -- | Valid Handlebars HTML | -- | "<p>Updated...</p>" |
| bodyText | string | NO | YES | -- | Plain text fallback | -- | "Updated..." |
| category | string | NO | YES | -- | Template category | -- | "membership" |
| status | string | NO | NO | enum | draft / active / archived | -- | "active" |

**Response** `200 OK`

```json
{
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "name": "Welcome V2",
    "subject": "Updated subject",
    "status": "active",
    "updatedAt": "2026-05-21T11:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-002 | 422 | Template variable missing: {variable} |
| CORE-001 | 404 | Template not found |
| AUTH-003 | 403 | Insufficient permissions |

---

### 2.3 Notification Preferences

#### GET `/my/notifications/preferences`

**Get notification preferences for the authenticated user**

| Property | Value |
|----------|-------|
| Auth | All authenticated |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-049 |
| Business rules | BR-26, M7-R6 |

**Response** `200 OK`

```json
{
  "data": {
    "subscriptions": [
      {
        "topicId": "cc0e8400-e29b-41d4-a716-446655440000",
        "topicName": "Dues Reminders",
        "channels": {
          "email": true,
          "push": true,
          "inApp": true
        }
      },
      {
        "topicId": "dd0e8400-e29b-41d4-a716-446655440000",
        "topicName": "Event Announcements",
        "channels": {
          "email": false,
          "push": true,
          "inApp": true
        }
      }
    ]
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| subscriptions | array | NO | -- | Per-topic preference list |
| topicId | string | NO | uuid | Subscription topic ID |
| topicName | string | NO | -- | Human-readable topic name |
| channels.email | boolean | NO | -- | Email delivery enabled |
| channels.push | boolean | NO | -- | Push notification enabled |
| channels.inApp | boolean | NO | -- | In-app notification (cannot be disabled for announcements, M7-R1) |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-001 | 401 | Not authenticated |

---

#### PUT `/my/notifications/preferences`

**Update notification preferences**

| Property | Value |
|----------|-------|
| Auth | All authenticated |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-049 |
| Business rules | BR-26, M7-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| subscriptions | array | YES | NO | -- | Array of preference updates | -- | See below |

**subscriptions item**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| topicId | string | YES | NO | uuid | Must be valid topic | -- | "cc0e8400-..." |
| channels | object | YES | NO | -- | Channel toggles | -- | {"email": false, "push": true} |
| channels.email | boolean | NO | NO | -- | -- | -- | false |
| channels.push | boolean | NO | NO | -- | -- | -- | true |
| channels.inApp | boolean | NO | NO | -- | Cannot set to false for announcement topics (M7-R1) | -- | true |

**Response** `200 OK`

Same shape as GET response.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| M07-007 | 422 | Unsubscribe token invalid |
| VALIDATION-001 | 400 | Invalid topic or channel configuration |
| AUTH-001 | 401 | Not authenticated |

---

### 2.4 Subscription Topics (Admin)

#### GET `/org/:organizationId/subscription-topics`

**List subscription topics for the organization**

| Property | Value |
|----------|-------|
| Auth | president (2FA), admin (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-048 |
| Business rules | -- |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "organizationId": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Dues Reminders",
      "description": "Payment due date reminders and overdue notices",
      "defaultEnabled": true,
      "channels": ["email", "push", "in-app"]
    }
  ]
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Topic ID |
| name | string | NO | -- | Topic name |
| description | string | YES | -- | Topic description |
| defaultEnabled | boolean | NO | -- | Enabled by default for new members |
| channels | array | NO | -- | Available delivery channels |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| AUTH-003 | 403 | Insufficient permissions |

---

#### POST `/org/:organizationId/subscription-topics`

**Create a subscription topic**

| Property | Value |
|----------|-------|
| Auth | president (2FA), admin (GA+HG) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-048 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | YES | NO | -- | Max 100 chars | -- | "Event Updates" |
| description | string | NO | YES | -- | Max 500 chars | -- | "Notifications about upcoming events" |
| defaultEnabled | boolean | NO | NO | -- | -- | true | true |
| channels | array | YES | NO | -- | At least one of: email, push, in-app | -- | ["email", "push", "in-app"] |

**Response** `201 Created`

```json
{
  "data": {
    "id": "ee0e8400-e29b-41d4-a716-446655440000",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Event Updates",
    "defaultEnabled": true,
    "channels": ["email", "push", "in-app"],
    "createdAt": "2026-05-21T10:00:00.000Z"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| VALIDATION-001 | 400 | Invalid input |
| AUTH-003 | 403 | Insufficient permissions |

---

## 3. Domain Events Published

| Event Name | Trigger | Payload Fields |
|------------|---------|----------------|
| AnnouncementSent | Announcement published/delivered | orgId, announcementId, recipientCount, channels |
| TemplateSent | Template used for delivery | orgId, templateId, recipientId, channel |
| DeliveryFailed | Delivery attempt failed | orgId, announcementId, recipientId, channel, reason |

## 4. Domain Events Consumed

| Event Name | Source | Side Effect |
|------------|--------|-------------|
| MembershipApproved | M05 | Send welcome message via org template |
| EventPublished | M08 | Send event notification announcement to org members |
| TrainingPublished | M09 | Send training notification to association members |
| ElectionOpened | M12 | Announce election to eligible members |

## 5. Shared Types

### AnnouncementStatus (enum)

Values: `draft`, `scheduled`, `sent`, `archived`

### AnnouncementVisibility (enum)

Values: `internal`, `network`

### AnnouncementPriority (enum)

Values: `normal`, `high`

High priority overrides member preferences (M7-R6) for security and financial alerts.

### TemplateStatus (enum)

Values: `draft`, `active`, `archived`

### DeliveryChannel (enum)

Values: `email`, `push`, `in-app`

In-app is mandatory for all announcements (M7-R1).
