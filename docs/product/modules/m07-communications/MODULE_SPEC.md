# Module Specification: Communications (M07)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Enable officers to communicate with members through announcements, templated messages, email broadcasts, and push notifications. Two separate handler subsystems by design: `handlers/communication/` (async broadcast — templates, announcements, 28 handlers) and `handlers/comms/` (real-time WebSocket — chat rooms, video calls, 11 handlers). No functional overlap.

### Users
- Officers (Secretary, President) — compose and send announcements, manage templates
- Member — receive notifications, manage preferences, participate in chat
- System — scheduled delivery, email queue processing, push dispatch

### Related Modules
- M01 (Auth), M04 (Org Admin), M05 (Membership — audience targeting)
- M08 (Events — event notifications), M09 (Training — training notifications)
- M12 (Elections — election announcements), M16 (Advertising — sponsored delivery)
- M18 (Surveys — survey distribution)

### In Scope
- Announcements (create, publish, archive, schedule)
- Message templates (create, preview, search) with Handlebars variables
- Scheduled messages, email queue processing (pg-boss)
- Push notifications via OneSignal (app-agnostic single App ID pattern)
- Member notification preferences, subscription topics, delivery tracking
- Real-time comms (chat rooms, video calls via WebSocket)

### Out of Scope
- Payment reminders (M06), event-specific notification content (M08)
- Certificate delivery (M11), election ballot notifications (M12 triggers only)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Announcement | Officer-authored one-to-many broadcast with optional push/email delivery. |
| Message Template | Reusable template with Handlebars variables for personalized content. |
| Scheduled Message | Message set for future delivery; processed by cron job at scheduled time. |
| Subscription Topic | Opt-in/opt-out category for message delivery. |
| Chat Room | Real-time WebSocket-based messaging between members. |
| Video Call | WebRTC video session initiated via WebSocket signaling. |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Send Announcement | WF-046 | Officer | Compose, target audience, schedule/send immediately | P0 |
| Message Templates | WF-047 | Officer | Create/edit reusable templates with variables | P0 |
| Delivery Stats | WF-048 | Officer | Open/delivery rates per announcement | P0 |
| Communication Dashboard | WF-049 | Officer | Announcement list, drafts, scheduled | P0 |
| Email Opt-Out Management | WF-050 | Member | Respect member preferences per channel | P0 |

## 4. Workflow Details

### Workflow: Send Announcement (WF-046)

**Actor:** Secretary or President
**Preconditions:** Officer authenticated, org exists, officer role verified via Better-Auth
**Steps:**
1. Opens `/org/[id]/officer/communications/new`.
2. Selects announcement type and audience (all members, category filter, status filter).
3. Composes content (rich text with Handlebars variable insertion).
4. Selects delivery channels: in-app (always on), push (optional), email (optional).
5. Previews rendered message with sample member data.
6. Publishes immediately or schedules for later.
7. System queues delivery per channel. Delivery stats tracked: sent, delivered, opened.

**Alternate Flows:**
- Schedule for later: saves as `scheduled`, cron picks up at scheduled time.
- Use existing template: officer selects template, variables auto-populated.

**Exception Flows:**
- No members match audience filter: "No recipients match your selection."
- Email opted-out members: in-app delivery only, email skipped.
- Deceased/suppressed members: skipped entirely (all channels).

**Postconditions:** Announcement created with delivery stats record. Recipients notified per channel preferences.

### Workflow: Message Templates (WF-047)

**Actor:** Officer (president, VP, secretary)
**Preconditions:** Officer authenticated
**Steps:**
1. Opens `/org/[id]/officer/communications/templates`.
2. Creates new template with name, subject, HTML body with Handlebars variables.
3. Previews with sample data. Saves as draft or active.
4. Template available for future announcements.

**Exception Flows:**
- Invalid Handlebars syntax: validation error on save.
- Missing variable at render time: placeholder shown, delivery not blocked (BR M7-R4).

**Postconditions:** Template saved, available for selection in announcement compose.

### Workflow: Email Opt-Out Management (WF-050)

**Actor:** Member
**Steps:**
1. Opens `/my/settings/notifications`.
2. Views subscription topics with per-channel toggles (email, push, in-app).
3. Toggles channels per category. In-app cannot be disabled for announcements (M7-R1).
4. Preferences saved immediately.

**Postconditions:** Future deliveries respect updated preferences.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M7-R1 | IF announcement published THEN in-app delivery is mandatory | Announcements | Cannot disable in-app channel |
| M7-R2 | IF member opted out of email THEN skip email delivery for that member | Email | Respect per-channel preferences |
| M7-R3 | IF scheduled message THEN process at scheduled time (within 5 min) | Scheduling | pg-boss cron picks up |
| M7-R4 | IF template variable missing at render THEN show placeholder, do not fail delivery | Templates | Graceful fallback |
| M7-R5 | IF recipient is deceased or suppressed THEN skip all delivery channels | All channels | Check suppression list before dispatch |
| M7-R6 | IF high-priority notification (security, dues overdue) THEN push regardless of preference | Security alerts | Override member prefs |
| BR-26 | IF notification sent THEN respect member channel preferences per category | All | Per-category toggles honored |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List templates | All officers + staff | member | GA+OA |
| Create template | president, VP, secretary, officer | member, staff | GA+HG |
| Send broadcast | president, secretary | All others | GA+HG |
| View own messages | All authenticated | -- | GA |
| Manage subscription topics | president (2FA), admin | All others | GA+HG |
| View delivery stats | All officers | member | GA+OA |

## 7. Data Requirements

### Entity: Announcement (11 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| authorId | Yes | Person FK | Officer who created |
| organizationId | Yes | Org FK | -- |
| title | Yes | Announcement title | Max 300 chars |
| body | Yes | Rich text content | HTML with Handlebars |
| visibility | Yes | internal/network | Enum |
| status | Yes | draft/scheduled/sent/archived | Enum |
| channels | Yes | Delivery channels array | in-app always included |
| audienceFilter | No | JSON filter criteria | Members/status/category |
| scheduledAt | No | Future delivery time | Must be future |
| sentAt | No | Actual delivery time | Set by system |
| priority | No | normal/high | High overrides prefs |

### Entity: AnnouncementStats (6 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| announcementId | Yes | Announcement FK | -- |
| sentCount | Yes | Total sent | Integer |
| deliveredCount | Yes | Confirmed delivered | Integer |
| openedCount | Yes | Opened/read | Integer |
| failedCount | Yes | Failed delivery | Integer |
| lastUpdated | Yes | Stats refresh time | Timestamp |

### Entity: MessageTemplate (9 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | -- |
| name | Yes | Template name | Unique per org |
| subject | Yes | Email subject line | Max 200 chars |
| bodyHtml | Yes | HTML body with Handlebars | Valid Handlebars syntax |
| bodyText | No | Plain text fallback | -- |
| status | Yes | draft/active/archived | Enum |
| category | No | Template category | For filtering |
| variables | No | JSON list of expected variables | Documentation |
| lastUsedAt | No | Last time template was used | Timestamp |

### Entity: SubscriptionTopic (5 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | -- |
| name | Yes | Topic name | -- |
| description | No | Topic description | -- |
| defaultEnabled | Yes | Enabled by default | Boolean |
| channels | Yes | Available channels | Array: email, push, in-app |

### Entity: PersonSubscription (3 columns excl. base)

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| personId | Yes | Person FK | -- |
| topicId | Yes | SubscriptionTopic FK | Unique with personId |
| channels | Yes | Enabled channels | Subset of topic channels |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Announcement | AnnouncementStats | AudienceFilter | Author must be officer. In-app always on. Status transitions enforced. |
| MessageTemplate | -- | VariableList | Variables must be valid Handlebars syntax. Unique name per org. |
| SubscriptionTopic | PersonSubscription | -- | In-app cannot be disabled for announcements. |
| ChatRoom | ChatMessage | -- | Participants tracked. Messages immutable after send. |

## 8. State Transitions

### Announcement Status
```
Draft ──publish──► Sent ──archive──► Archived
Draft ──schedule──► Scheduled ──process──► Sent ──archive──► Archived
Draft ──cancel──► Cancelled
Scheduled ──cancel──► Cancelled
```

### Message Status (`messageStatusEnum`)
```
draft ──schedule──► scheduled ──process──► sending ──complete──► sent
draft ──send──► sending ──complete──► sent
sending ──fail──► failed
draft ──cancel──► cancelled
scheduled ──cancel──► cancelled
```

**Delivery Status** (per-recipient): `pending` -> `sent` -> `delivered` / `failed` / `bounced`

## 9. UI/UX Requirements

### Screen: Communications Dashboard (`/org/[id]/officer/communications`)
**Purpose:** Announcement list + compose + delivery stats
**Users:** Officers
**Components:** Announcement list (status badge, date, audience), compose button, delivery metrics summary, template quick-access
**States:** Loading (skeleton), Empty ("No announcements yet. Send your first one."), Success (populated list), PermissionError (non-officer redirect), UnexpectedError (retry prompt)

### Screen: Compose Announcement (`/org/[id]/officer/communications/new`)
**Purpose:** Create and send/schedule announcement
**Users:** Secretary, President
**Components:** Audience selector (member status/category filter), rich text editor with variable insertion, channel toggles (in-app locked on), schedule picker, preview panel
**States:** Loading, Draft (editing), Sending (spinner), Sent (success toast via sonner), ValidationError (inline field errors), PermissionError

### Screen: Notification Preferences (`/my/settings/notifications`)
**Purpose:** Member controls delivery channels per category
**Users:** All authenticated members
**Components:** Topic list with per-channel toggles, save confirmation
**States:** Loading, Success, ValidationError (in-app cannot be disabled)

## 10. API Expectations

**TypeSpec Coverage:** PARTIAL. `comms.tsp` covers real-time WebSocket handlers (11 handlers). `communication.tsp` defines enums only — 28 async broadcast handlers (announcements, templates, messages, segments, subscriptions) remain hand-wired with no TypeSpec operation definitions. Full TypeSpec migration deferred (EM-M07-no-typespec).

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/announcements | Create announcement | title, body, audience, channels | announcementId | 403 not officer |
| POST /org/:id/announcements/:id/publish | Publish/send | -- | deliveryStats | 400 no audience |
| POST /org/:id/announcements/:id/schedule | Schedule future delivery | scheduledAt | announcement | 400 past time |
| GET /org/:id/announcements | List announcements | filters, pagination | Announcement[] | -- |
| GET /org/:id/announcements/:id/stats | Delivery stats | -- | AnnouncementStats | 404 |
| GET /org/:id/templates | List templates | -- | Template[] | -- |
| POST /org/:id/templates | Create template | name, subject, body | templateId | 400 invalid syntax |
| GET /my/notifications/preferences | Get preferences | -- | Subscription[] | -- |
| PUT /my/notifications/preferences | Update preferences | topicId, channels | updated prefs | 400 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| AnnouncementPublished | Announcement sent | orgId, announcementId, audience, channels | Email queue, Push service |
| ChatRoomCreated | New chat room | roomId, participants | -- |
| MessageScheduled | Message scheduled | messageId, scheduledAt | pg-boss scheduler |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MembershipApproved | M05 | Send welcome message | Template-based welcome via org template |
| EventPublished | M08 | Send event notification | Announcement to org members |
| TrainingPublished | M09 | Send training notification | Announcement to association members |
| ElectionOpened | M12 | Send voting notification | Announce election to eligible members |

## 11. Acceptance Criteria

### AC-M07-001: In-App Always On
**Given** an officer publishes an announcement
**When** delivery channels are configured
**Then** in-app delivery is always included regardless of channel selection

### AC-M07-002: Email Opt-Out Respected
**Given** a member has opted out of email for a subscription topic
**When** an announcement is sent to that topic
**Then** the member receives in-app but not email delivery

### AC-M07-003: Scheduled Delivery
**Given** an officer schedules an announcement for a future time
**When** the scheduled time arrives
**Then** the announcement is delivered within 5 minutes of the scheduled time

### AC-M07-004: Delivery Stats
**Given** an announcement has been sent
**When** the officer views the announcement
**Then** sent count, delivered count, and opened count are displayed

### AC-M07-005: Suppressed Members Skipped
**Given** a member is deceased or suppressed
**When** an announcement targets their audience segment
**Then** no delivery is attempted on any channel

### AC-M07-006: High-Priority Override
**Given** a high-priority notification (security alert, dues overdue)
**When** a member has opted out of push
**Then** push is delivered regardless of preference

## 12. Test Expectations

Required test categories:
- **Announcement CRUD:** create, publish, schedule, archive, cancel state transitions
- **Template management:** create, render with variables, missing variable fallback, invalid syntax rejection
- **Channel delivery:** in-app always, push/email per preference, high-priority override
- **Suppression:** deceased/unsubscribed members skipped across all channels
- **Email queue:** processing cycle, retry on failure, dead-letter after max retries
- **Subscription preferences:** toggle channels, in-app cannot be disabled for announcements
- **Audience targeting:** filter by member status, category, org membership
- **Scheduled messages:** future delivery, past-time rejection, cancellation before delivery

## 13. Edge Cases

- Announcement to org with 0 active members: "No recipients match your selection."
- Scheduled announcement for past time: reject with validation error (not silent send).
- Template with invalid Handlebars: validation error on save, not at send time.
- Member unsubscribes between schedule and send: skipped at delivery time (check at dispatch).
- Bulk send to 10,000+ members: chunked processing via pg-boss, progress tracked.
- Officer role removed between compose and publish: 403 at publish time.
- Email service down during batch send: queue for retry, in-app still delivered.

## 14. Dependencies

### Internal Dependencies
- M01 (Auth — Better-Auth session), M04 (Org Admin — org context), M05 (Membership — audience data, member status)

### External Dependencies
- OneSignal (push notifications — app-agnostic single App ID pattern)
- Email service (SMTP/Postmark via email queue)
- pg-boss (scheduled message processing, email queue processor at 30s interval)
- WebSocket (chat rooms, video calls — `handlers/comms/`)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Email service down | Queue for retry (pg-boss), in-app still delivered | "Some emails may be delayed." |
| Push delivery fails | Log, skip, in-app still delivered | (Silent -- in-app backup) |
| Template render fails | Use fallback/placeholder text | "Some messages used default text." |
| No audience matches filter | Block publish | "No recipients match your selection." |
| Scheduled time in past | Reject | "Scheduled time must be in the future." |

## 16. Performance Expectations

- **Data volume:** 1000+ announcements per org per year
- **Concurrent delivery:** 200+ members receiving simultaneously, chunked via pg-boss
- **Response times:** Publish < 2s, email processing every 30s, template list < 500ms
- **Caching:** Template cache per-org (invalidate on create/update), announcement list cache (invalidate on publish)

## 17. Observability Hooks

**Log Events:**

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| comms.announcement.published | INFO | Sent | orgId, announcementId, recipientCount, channels | No |
| comms.announcement.scheduled | INFO | Scheduled | orgId, announcementId, scheduledAt | No |
| comms.email.sent | INFO | Email delivered | messageId, status | No |
| comms.email.failed | WARN | Delivery failure | messageId, error, retryCount | No |
| comms.push.sent | INFO | Push delivered | personId, type | No |
| comms.suppression.skipped | DEBUG | Member suppressed | personId, reason | No |

**Metrics:**

| Metric | Type | Labels | Description |
|---|---|---|---|
| announcements_published_total | counter | visibility, channels | Published count |
| email_queue_depth | gauge | -- | Pending emails in queue |
| email_delivery_duration_seconds | histogram | provider | Email delivery latency |
| push_delivery_total | counter | status | Push sent/failed count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| comms_scheduled_messages | release | true | Enable scheduled future delivery | -- |
| comms_video_calls | release | false | WebSocket video calls (comms subsystem) | -- |
| comms_push_notifications | release | true | OneSignal push delivery | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M07-S1 | Announcements | Create, publish, archive announcements | M04, M05 | P0 |
| M07-S2 | Message Templates | CRUD templates with Handlebars variables | M07-S1 | P0 |
| M07-S3 | Email Queue | Async email processing via pg-boss | M07-S1 | P0 |
| M07-S4 | Push Notifications | OneSignal push delivery with preferences | M07-S1 | P0 |
| M07-S5 | Scheduled Messages | Future delivery scheduling + cancellation | M07-S1 | P0 |
| M07-S6 | Subscription Preferences | Per-topic, per-channel member preferences | M07-S1 | P0 |
| M07-S7 | Delivery Tracking | Stats: sent, delivered, opened per announcement | M07-S1 | P1 |
| M07-S8 | Chat Rooms | Real-time WebSocket messaging (comms subsystem) | M01 | P1 |
| M07-S9 | Video Calls | WebRTC video via WebSocket signaling | M07-S8 | P2 |

## 20. AI Instructions

When implementing this module:
1. **Two handler dirs:** `handlers/communication/` (async broadcast) and `handlers/comms/` (real-time WebSocket). Separate bounded contexts -- do not merge.
2. **Spec-first:** Define TypeSpec in `specs/api/src/modules/communication.tsp` and `comms.tsp` separately. Generate routes/validators before implementing handlers.
3. **OneSignal pattern:** Use app-agnostic single App ID. Push via `notificationRepo.createNotificationForModule()` with no `targetApp` unless app-specific.
4. **pg-boss for async:** Email queue processor at 30s interval, scheduled message processor with cron. Do not use setTimeout.
5. **Vertical slices:** Implement M07-S1 (Announcements) first -- all other slices depend on it.
6. **Module pattern:** Router -> Validators -> Handlers -> Repositories. Follow `services/api-ts/src/handlers/person/createPerson.ts` as reference.
7. **Toasts:** Use `sonner`, not shadcn `useToast`.
8. **Auth route:** `/auth/sign-in`, not `/login`. Verify officer role via Better-Auth middleware.
9. **No `/api` prefix** in backend route registration.
10. **Test-first:** Follow VERTICAL_TDD.md -- write failing tests before implementation.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | From DOMAIN_GLOSSARY.md |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP.md WF-046 to WF-050 |
| 4. Workflow Details | COMPLETE | 3 of 5 workflows detailed; WF-048/WF-049 covered in UI section |
| 5. Business Rules | COMPLETE | 7 rules including BR-26 from cross-module |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX.md |
| 7. Data Requirements | COMPLETE | 5 entities from DOMAIN_MODEL.md |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL.md |
| 8. State Transitions | COMPLETE | Announcement + Message status machines |
| 9. UI/UX Requirements | COMPLETE | 3 screens with all states |
| 10. API Expectations | COMPLETE | 9 endpoints |
| 10b. Domain Events | COMPLETE | 3 published, 4 consumed |
| 11. Acceptance Criteria | COMPLETE | 6 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 8 test categories |
| 13. Edge Cases | COMPLETE | 7 edge cases |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | 5 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 6 log events, 4 metrics |
| 18. Feature Flags | COMPLETE | 3 flags |
| 19. Vertical Slice Plan | COMPLETE | 9 slices |
| 20. AI Instructions | COMPLETE | 10 directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M08 (Events):** Depends on M07 for event published notifications. If announcement delivery is broken, event notifications fail silently.
- **M09 (Training):** Depends on M07 for training published notifications. Same delivery dependency.
- **M12 (Elections):** Election opened announcements route through M07.
- **M05 (Membership):** Welcome messages on membership approval consume M07 templates.
- **SDK generation:** Changes to communication API endpoints require `specs/api && bun run build` + SDK regeneration.
- **Email queue:** All modules that trigger email (M06 dues reminders, M08 event notices) flow through M07's email processor.
