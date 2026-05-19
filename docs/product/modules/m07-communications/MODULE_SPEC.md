# Module Specification: Communications (M07)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Enable officers to communicate with members through announcements, templated messages, email broadcasts, and push notifications. Covers async broadcast communications (not real-time chat, which is a separate subsystem).

### Users
- Officers (Secretary, President), Member, System

### Related Modules
- M01 (Auth), M04 (Org Admin), M05 (Membership — audience targeting)
- M08 (Events — event notifications), M09 (Training — training notifications)
- M12 (Elections — election announcements), M16 (Advertising — sponsored delivery)
- M18 (Surveys — survey distribution)

### In Scope
- Announcements (create, publish, archive, schedule)
- Message templates (create, preview, search)
- Scheduled messages, email queue processing
- Push notifications, subscription topics
- Member notification preferences, delivery tracking
- Real-time comms (chat rooms, video calls via WebSocket)

### Out of Scope
- Payment reminders (M06), event-specific notifications (M08)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Announcement | Officer-authored one-to-many broadcast with optional push/email delivery. |
| Message Template | Reusable template with Handlebars variables for personalized content. |
| Subscription Topic | Opt-in/opt-out category for message delivery. |
| Chat Room | Real-time WebSocket-based messaging between members. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Send Announcement | Officer | Compose and publish to members | P0 |
| Schedule Announcement | Officer | Set future delivery date/time | P0 |
| View Notifications | Member | Notification center with read/unread | P0 |
| Update Preferences | Member | Configure delivery channels per category | P0 |
| Manage Templates | Officer | Create/edit reusable message templates | P0 |

## 4. Workflow Details

### Workflow: Send Announcement (CS-6)

Actor: Secretary or President
Preconditions: Officer authenticated, org exists
Steps:
1. Opens /org/[id]/officer/communications/new.
2. Selects announcement type and audience (all members, category filter, status filter).
3. Composes content (rich text with variables).
4. Selects delivery channels: in-app (always), push (optional), email (optional).
5. Previews rendered message.
6. Publishes immediately or schedules for later.
7. Delivery stats tracked: sent, delivered, opened.

Exception Flows:
- No members match audience filter: "No recipients match your selection."
- Email opted-out members: in-app only.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M7-R1 | IF announcement published THEN in-app delivery mandatory | Announcements | Cannot disable in-app channel |
| M7-R2 | IF member opted out of email THEN skip email delivery | Email | Respect preferences |
| M7-R3 | IF scheduled message THEN process at scheduled time | Scheduling | Cron job picks up |
| M7-R4 | IF template variable missing THEN show placeholder, don't fail | Templates | Graceful fallback |
| M7-R5 | IF deceased/suppressed member THEN skip delivery | All channels | Check suppression list |
| M7-R6 | IF high-priority notification THEN push regardless of preference | Security, dues overdue | Override member prefs |
| BR-26 | IF notification sent THEN respect member channel preferences | All | Per-category toggles |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List templates | All officers + staff | member | GA+OA |
| Create template | president, VP, secretary, officer | member, staff | GA+HG |
| Send broadcast | president, secretary | All others | GA+HG |
| View own messages | All authenticated | — | GA |

## 7. Data Requirements

### Entity: Announcement

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| authorId | Yes | Person FK | Officer who created |
| organizationId | Yes | Org FK | — |
| title | Yes | Announcement title | — |
| body | Yes | Rich text content | — |
| visibility | Yes | internal/network | Enum |
| status | Yes | draft/scheduled/sent/archived | Enum |
| scheduledAt | No | Future delivery time | — |
| sentAt | No | Actual delivery time | — |

### Entity: MessageTemplate

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| name | Yes | Template name | — |
| subject | Yes | Email subject | — |
| bodyHtml | Yes | HTML body with Handlebars | — |
| status | Yes | draft/active/archived | Enum |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Announcement | AnnouncementStats | — | Author must be officer. In-app always on. |
| MessageTemplate | — | — | Variables must be valid Handlebars syntax. |
| ChatRoom | ChatMessage | — | Participants tracked. Messages immutable. |

## 8. State Transitions

### Announcement
```txt
Draft → Scheduled → Sent → Archived
Draft → Sent → Archived
Scheduled → Cancelled
```

### Message
```txt
Draft → Scheduled → Sending → Sent
Draft → Sending → Sent
Sending → Failed
Scheduled → Cancelled
```

## 9. UI / UX Requirements

### Screen: Communications Dashboard (/org/[id]/officer/communications)
Purpose: Announcement list + compose + delivery stats
Components: Announcement list (status badge, date, audience), compose button, delivery metrics
States: Empty ("No announcements yet"), Loading, Populated

### Screen: Compose Announcement (/org/[id]/officer/communications/new)
Purpose: Create and send/schedule announcement
Components: Audience selector, rich text editor with variable insertion, channel toggles, schedule picker, preview
States: Draft, Sending (spinner), Sent (success), Validation error

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/announcements | Create announcement | title, body, audience, channels | announcementId | 403 |
| POST /org/:id/announcements/:id/publish | Publish | — | deliveryStats | 400 no audience |
| GET /org/:id/announcements | List announcements | filters | Announcement list | — |
| GET /org/:id/templates | List templates | — | Template list | — |
| POST /org/:id/templates | Create template | name, subject, body | templateId | 400 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| AnnouncementPublished | Announcement sent | orgId, announcementId, audience | M02 (notifications) |
| ChatRoomCreated | New chat room | roomId, participants | — |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipApproved | M05 | Send welcome message | Template-based welcome |
| EventPublished | M08 | Send event notification | Announcement to registrants |
| ElectionOpened | M12 | Send voting notification | Announce election to members |

## 11. Acceptance Criteria

### AC-M07-001: In-App Always On
Announcements always deliver in-app regardless of member preferences.

### AC-M07-002: Email Opt-Out Respected
Members who opted out of email do not receive email delivery.

### AC-M07-003: Scheduled Delivery
Scheduled announcements deliver within 5 minutes of scheduled time.

### AC-M07-004: Delivery Stats
After sending, officer sees sent count, delivered count, opened count.

## 12. Test Expectations

Required tests:
- Announcement: create, publish, schedule, archive, audience targeting
- Template: variable rendering, missing variable fallback
- Channel delivery: in-app always, push/email per preference
- Suppression: deceased/unsubscribed members skipped
- High-priority override: security notifications bypass preferences
- Email queue: processing, retry, cleanup

## 13. Edge Cases

- Announcement to org with 0 active members: "No recipients."
- Scheduled announcement for past time: send immediately.
- Template with invalid Handlebars: validation error on save.
- Member unsubscribes between schedule and send: skipped at delivery time.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth), M04 (Org Admin), M05 (Membership — audience data)

### External Dependencies
- Email service (Postmark, SMTP, OneSignal)
- Push notification service
- pg-boss (email processor, scheduled message processing)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Email service down | Queue for retry | "Some emails may be delayed." |
| Push delivery fails | Log, skip | (Silent — in-app still delivered) |
| Template render fails | Use fallback text | "Some messages used default text." |

## 16. Performance Expectations

- Expected data volume: 1000+ announcements per org per year
- Expected concurrent users: 200+ members receiving simultaneously
- Acceptable response times: Publish < 2s, email processing every 30s
- Caching requirements: Template cache per-org

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| comms.announcement.published | INFO | Sent | orgId, announcementId, recipientCount | No |
| comms.email.sent | INFO | Email delivered | messageId, status | No |
| comms.email.failed | WARN | Delivery failure | messageId, error | No |
| comms.push.sent | INFO | Push delivered | personId, type | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| announcements_published_total | counter | visibility | Published count |
| email_queue_depth | gauge | — | Pending emails |
| email_delivery_duration_seconds | histogram | provider | Delivery time |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| comms_scheduled_messages | release | true | Schedule future delivery | — |
| comms_video_calls | release | false | WebSocket video calls | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M07-S1 | Announcements | Create, publish, archive | M04, M05 | P0 |
| M07-S2 | Message Templates | CRUD templates with variables | M07-S1 | P0 |
| M07-S3 | Email Queue | Async email processing | M07-S1 | P0 |
| M07-S4 | Push Notifications | Push delivery with preferences | M07-S1 | P0 |
| M07-S5 | Scheduled Messages | Future delivery scheduling | M07-S1 | P0 |
| M07-S6 | Delivery Tracking | Stats: sent, delivered, opened | M07-S1 | P1 |
| M07-S7 | Chat Rooms | Real-time WebSocket messaging | M01 | P1 |
| M07-S8 | Video Calls | WebRTC video via WebSocket | M07-S7 | P2 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
