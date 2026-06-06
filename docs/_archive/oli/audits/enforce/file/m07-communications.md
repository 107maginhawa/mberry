# Per-File Spec Traceability: M07 Communications

**Audit type:** oli-enforce-file
**Module:** m07-communications
**Spec:** `docs/product/modules/m07-communications/MODULE_SPEC.md`
**Source dirs:** `handlers/communication/`, `handlers/comms/`, `handlers/email/`, `handlers/notifs/`, `handlers/communications/` (empty)
**Date:** 2026-05-28
**Health Score: 6.8/10**

---

## 1. File Classification Table

### 1.1 `handlers/communication/` (50 non-test, 30 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 1 | `archiveAnnouncement.ts` | handler | WF-046, AC-M07-005 |
| 2 | `bulkUpdatePersonSubscriptions.ts` | handler | WF-050 |
| 3 | `cancelMessage.ts` | handler | WF-046 |
| 4 | `createAnnouncement.ts` | handler | WF-046, AC-M07-003 |
| 5 | `createFeedPost.ts` | handler | M13 (professional-feed) |
| 6 | `createMessage.ts` | handler | WF-046 |
| 7 | `createMessageTemplate.ts` | handler | WF-047 |
| 8 | `createPoll.ts` | handler | M13 (professional-feed) |
| 9 | `createSavedSegment.ts` | handler | WF-046 (audience targeting) |
| 10 | `createSubscriptionTopic.ts` | handler | WF-050 |
| 11 | `createSurvey.ts` | handler | M18 (surveys) |
| 12 | `deleteAnnouncement.ts` | handler | WF-046 |
| 13 | `deleteFeedPost.ts` | handler | M13 (professional-feed) |
| 14 | `deleteMessage.ts` | handler | WF-046 |
| 15 | `deleteMessageTemplate.ts` | handler | WF-047 |
| 16 | `deleteSavedSegment.ts` | handler | WF-046 |
| 17 | `deleteSubscriptionTopic.ts` | handler | WF-050 |
| 18 | `getAnnouncement.ts` | handler | WF-049 |
| 19 | `getAnnouncementStats.ts` | handler | WF-048 |
| 20 | `getFeedPost.ts` | handler | M13 |
| 21 | `getMessage.ts` | handler | WF-049 |
| 22 | `getMessageTemplate.ts` | handler | WF-047 |
| 23 | `getSubscriptionTopic.ts` | handler | WF-050 |
| 24 | `getSurveyResults.ts` | handler | M18 |
| 25 | `listAnnouncements.ts` | handler | WF-049 |
| 26 | `listFeedPosts.ts` | handler | M13 |
| 27 | `listPersonSubscriptions.ts` | handler | WF-050 |
| 28 | `listSavedSegments.ts` | handler | WF-046 |
| 29 | `listSurveys.ts` | handler | M18 |
| 30 | `muteAuthor.ts` | handler | M13 (feed moderation) |
| 31 | `publishAnnouncement.ts` | handler | WF-046, AC-M07-003 |
| 32 | `reportFeedPost.ts` | handler | M13, BR-35 |
| 33 | `savedSegments.ts` | handler | WF-046 |
| 34 | `scheduleMessage.ts` | handler | WF-046, AC-M07-003, M07-004 |
| 35 | `searchMessageTemplates.ts` | handler | WF-047 |
| 36 | `searchMessages.ts` | handler | WF-049 |
| 37 | `sendMessage.ts` | handler | WF-046, AC-M07-001 |
| 38 | `submitSurveyResponse.ts` | handler | M18, BR-40 |
| 39 | `updateAnnouncement.ts` | handler | WF-046, M07-005 |
| 40 | `updateMessage.ts` | handler | WF-046 |
| 41 | `updateMessageTemplate.ts` | handler | WF-047 |
| 42 | `updatePersonSubscription.ts` | handler | WF-050 |
| 43 | `updateSubscriptionTopic.ts` | handler | WF-050 |
| 44 | `votePoll.ts` | handler | M13 |
| 45 | `repos/communication.repo.ts` | repository | WF-046..050 |
| 46 | `repos/communication.schema.ts` | schema | DOMAIN_MODEL sec.5 |
| 47 | `repos/feed-post.repo.ts` | repository | M13 |
| 48 | `repos/feed-post.schema.ts` | schema | M13 |
| 49 | `repos/survey.repo.ts` | repository | M18 |
| 50 | `repos/survey.schema.ts` | schema | M18 |
| -- | `jobs/announcementSend.ts` | job | WF-046, AC-M07-001 |

**Test files (30):**

| # | File | Role |
|---|------|------|
| T1 | `015-announcements-templates.test.ts` | integration-test |
| T2 | `ac-m07.communications.test.ts` | acceptance-test |
| T3 | `ac-m13.professional-feed.test.ts` | acceptance-test (M13) |
| T4 | `ac-m18.surveys.test.ts` | acceptance-test (M18) |
| T5 | `announcement-handlers.test.ts` | integration-test |
| T6 | `archiveAnnouncement.test.ts` | unit-test |
| T7 | `br-26.session-management.test.ts` | br-test |
| T8 | `br-35.feed-moderation.test.ts` | br-test (M13) |
| T9 | `br-40.survey-anonymity.test.ts` | br-test (M18) |
| T10 | `bulkUpdatePersonSubscriptions.test.ts` | unit-test |
| T11 | `cancelMessage.test.ts` | unit-test |
| T12 | `communication.test.ts` | integration-test |
| T13 | `createAnnouncement.test.ts` | unit-test |
| T14 | `createMessage.test.ts` | unit-test |
| T15 | `createMessageTemplate.test.ts` | unit-test |
| T16 | `createSubscriptionTopic.test.ts` | unit-test |
| T17 | `deleteAnnouncement.test.ts` | unit-test |
| T18 | `deleteMessage.test.ts` | unit-test |
| T19 | `deleteMessageTemplate.test.ts` | unit-test |
| T20 | `deleteSubscriptionTopic.test.ts` | unit-test |
| T21 | `getAnnouncement.test.ts` | unit-test |
| T22 | `getAnnouncementStats.test.ts` | unit-test |
| T23 | `getMessage.test.ts` | unit-test |
| T24 | `getMessageTemplate.test.ts` | unit-test |
| T25 | `getSubscriptionTopic.test.ts` | unit-test |
| T26 | `jobs/announcementSend.test.ts` | unit-test |
| T27 | `listAnnouncements.test.ts` | unit-test |
| T28 | `listPersonSubscriptions.test.ts` | unit-test |
| T29 | `listSavedSegments.test.ts` | unit-test |
| T30 | `listSurveys.test.ts` | unit-test (M18) |

### 1.2 `handlers/comms/` (17 non-test, 5 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 51 | `createChatRoom.ts` | handler | M07-S8, DOMAIN_MODEL chat_room |
| 52 | `cross-module-triggers.ts` | utility | Slice 027 cross-module |
| 53 | `default-channels.ts` | utility | org setup |
| 54 | `endVideoCall.ts` | handler | M07-S9, DOMAIN_MODEL video_call |
| 55 | `getChatMessages.ts` | handler | M07-S8, DOMAIN_MODEL chat_message |
| 56 | `getChatRoom.ts` | handler | M07-S8, DOMAIN_MODEL chat_room |
| 57 | `getIceServers.ts` | handler | M07-S9, WebRTC infra |
| 58 | `joinVideoCall.ts` | handler | M07-S9, DOMAIN_MODEL video_call |
| 59 | `leaveVideoCall.ts` | handler | M07-S9, DOMAIN_MODEL video_call |
| 60 | `listChatRooms.ts` | handler | M07-S8, DOMAIN_MODEL chat_room |
| 61 | `sendChatMessage.ts` | handler | M07-S8, DOMAIN_MODEL chat_message |
| 62 | `updateVideoCallParticipant.ts` | handler | M07-S9, DOMAIN_MODEL video_call |
| 63 | `ws.chat-room.ts` | websocket-handler | M07-S8, WebSocket transport |
| 64 | `repos/chatMessage.repo.ts` | repository | DOMAIN_MODEL chat_message |
| 65 | `repos/chatRoom.repo.ts` | repository | DOMAIN_MODEL chat_room |
| 66 | `repos/chatRoomMember.repo.ts` | repository | DOMAIN_MODEL chat_room |
| 67 | `repos/comms.schema.ts` | schema | DOMAIN_MODEL sec.5 |

**Test files (5):**

| # | File | Role |
|---|------|------|
| T31 | `chat-rooms-stabilization.test.ts` | stabilization-test |
| T32 | `comms-rest-handlers.test.ts` | integration-test |
| T33 | `joinVideoCall.test.ts` | unit-test |
| T34 | `video-calls-stabilization.test.ts` | stabilization-test |
| T35 | `ws.chat-room.test.ts` | integration-test |

### 1.3 `handlers/email/` (23 non-test, 18 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 68 | `cancelEmailQueueItem.ts` | handler | M07-S3, email queue |
| 69 | `createEmailTemplate.ts` | handler | WF-047 |
| 70 | `getEmailQueueItem.ts` | handler | M07-S3 |
| 71 | `getEmailTemplate.ts` | handler | WF-047 |
| 72 | `listEmailQueueItems.ts` | handler | M07-S3 |
| 73 | `listEmailSuppressions.ts` | handler | M7-R5 |
| 74 | `listEmailTemplates.ts` | handler | WF-047 |
| 75 | `retryEmailQueueItem.ts` | handler | M07-S3 |
| 76 | `testEmailTemplate.ts` | handler | WF-047 |
| 77 | `unsubscribeEmail.ts` | handler | WF-050, M7-R2 |
| 78 | `unsubscribeEmailGet.ts` | handler | WF-050, M7-R2, RFC 8058 |
| 79 | `unsubscribeEmailPost.ts` | handler | WF-050, M7-R2, RFC 8058 |
| 80 | `updateEmailTemplate.ts` | handler | WF-047 |
| 81 | `jobs/index.ts` | job-registry | M07-S3 |
| 82 | `jobs/processor.ts` | job | M07-S3, pg-boss 30s interval |
| 83 | `repos/email.schema.ts` | schema | DOMAIN_MODEL email_template, email_queue |
| 84 | `repos/queue.repo.ts` | repository | M07-S3 |
| 85 | `repos/suppression.repo.ts` | repository | M7-R5 |
| 86 | `repos/suppression.schema.ts` | schema | DOMAIN_MODEL email_suppression |
| 87 | `repos/template.repo.ts` | repository | WF-047 |
| 88 | `templates/initializer.ts` | utility | seed templates |
| 89 | `utils/bulk-rate-limiter.ts` | utility | M07-S3 perf |
| 90 | `utils/unsub-token.ts` | utility | WF-050, RFC 8058 |

**Test files (18):**

| # | File | Role |
|---|------|------|
| T36 | `cancelEmailQueueItem.test.ts` | unit-test |
| T37 | `createEmailTemplate.test.ts` | unit-test |
| T38 | `getEmailQueueItem.test.ts` | unit-test |
| T39 | `getEmailTemplate.test.ts` | unit-test |
| T40 | `listEmailQueueItems.test.ts` | unit-test |
| T41 | `listEmailSuppressions.test.ts` | unit-test |
| T42 | `listEmailTemplates.test.ts` | unit-test |
| T43 | `retryEmailQueueItem.test.ts` | unit-test |
| T44 | `testEmailTemplate.test.ts` | unit-test |
| T45 | `unsubscribeEmail.test.ts` | unit-test |
| T46 | `updateEmailTemplate.test.ts` | unit-test |
| T47 | `jobs/index.test.ts` | unit-test |
| T48 | `jobs/processor.test.ts` | unit-test |
| T49 | `repos/queue.repo.test.ts` | repo-test |
| T50 | `repos/suppression.repo.test.ts` | repo-test |
| T51 | `repos/template.repo.test.ts` | repo-test |
| T52 | `utils/bulk-rate-limiter.test.ts` | unit-test |
| T53 | `utils/unsub-token.test.ts` | unit-test |

### 1.4 `handlers/notifs/` (9 non-test, 8 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 91 | `getNotification.ts` | handler | M07-S4, notification entity |
| 92 | `listNotifications.ts` | handler | M07-S4, notification entity |
| 93 | `markAllNotificationsAsRead.ts` | handler | M07-S4, notification entity |
| 94 | `markAllNotificationsRead.ts` | handler | M07-S4, notification entity |
| 95 | `markNotificationAsRead.ts` | handler | M07-S4, notification entity |
| 96 | `notification-triggers.ts` | utility | Slice 027 (GAP-003/006/012/017) |
| 97 | `jobs/index.ts` | job-registry | notification processing |
| 98 | `repos/notification.repo.ts` | repository | notification entity |
| 99 | `repos/notification.schema.ts` | schema | DOMAIN_MODEL notification |

**Test files (8):**

| # | File | Role |
|---|------|------|
| T54 | `getNotification.test.ts` | unit-test |
| T55 | `listNotifications.test.ts` | unit-test |
| T56 | `markAllNotificationsAsRead.test.ts` | unit-test |
| T57 | `markAllNotificationsRead.test.ts` | unit-test |
| T58 | `markNotificationAsRead.test.ts` | unit-test |
| T59 | `notification-triggers.test.ts` | unit-test |
| T60 | `notifs-handlers.test.ts` | integration-test |
| T61 | `jobs/index.test.ts` | unit-test |

### 1.5 `handlers/communications/` (0 files)

Empty directory. CLAUDE.md references it as "Org announcements: draft/schedule/send announcements to members (8 handlers)" but no files exist. All announcement functionality lives in `handlers/communication/` (singular).

### 1.6 Core Services (3 files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 100 | `core/email.ts` | service | M07-S3, email delivery abstraction |
| 101 | `core/notifs.ts` | service | M07-S4, push notification abstraction |
| 102 | `core/domain-events.ts` | service | M07 S10b domain events |

---

## 2. Totals

| Directory | Impl Files | Test Files | Total |
|-----------|-----------|------------|-------|
| `communication/` | 50 | 30 | 80 |
| `comms/` | 17 | 5 | 22 |
| `email/` | 23 | 18 | 41 |
| `notifs/` | 9 | 8 | 17 |
| `communications/` | 0 | 0 | 0 |
| core/ | 3 | 0 | 3 |
| **Total** | **102** | **61** | **163** |

Test coverage ratio: 61/102 = 60% file-level coverage.

---

## 3. Findings

### EF-M07-e48fb2a4 | P1 | WORKFLOW_GAP | `publishAnnouncement` marks "sent" but performs no delivery

**File:** `communication/publishAnnouncement.ts`
**Check:** WF-046 workflow completeness
**Issue:** Handler sets announcement status to `sent` via `repo.updateStatus(id, 'sent')` and emits a domain event, but does not enqueue emails, trigger push notifications, or invoke the `announcementSend` job. The announcement appears "sent" to officers but no member receives it through any channel.
**Spec ref:** MODULE_SPEC S4 WF-046 step 4: "System delivers per-channel (in-app, email, push)" + S10b: `AnnouncementPublished` event
**Note:** The `announcementSend.ts` job has full delivery logic (email fan-out via EmailService, push via NotificationService, stats creation) but is never triggered by `publishAnnouncement`.
**Fix:** Wire `publishAnnouncement` to enqueue the `announcementSend` job via pg-boss, or call delivery inline.

---

### EF-M07-8b87b372 | P1 | API_SURFACE | Missing `scheduleAnnouncement` endpoint

**File:** `communication/` (absent file)
**Check:** API surface vs spec S10
**Issue:** Spec requires `POST /org/:id/announcements/:id/schedule` with `scheduledAt` input. No `scheduleAnnouncement.ts` handler exists. `scheduleMessage.ts` handles generic messages, not announcements specifically. No announcement-specific scheduling action endpoint for drafts.
**Spec ref:** MODULE_SPEC S10 row 3: "POST /org/:id/announcements/:id/schedule"
**Fix:** Add `scheduleAnnouncement.ts` handler, or route `scheduleMessage` to handle announcement type, or document that scheduling is via `updateAnnouncement` with `scheduledAt` field.

---

### EF-M07-eaa14a14 | P1 | AUTHZ_GAP | `createSubscriptionTopic` missing role guard

**File:** `communication/createSubscriptionTopic.ts`
**Check:** Permission enforcement per S6
**Issue:** Handler checks session existence but does not call `requirePosition()` or any role-based access check. Spec requires president (with 2FA) or admin for subscription topic management.
**Spec ref:** MODULE_SPEC S6 Permissions, ROLE_PERMISSION_MATRIX: "Manage subscription topics: president (2FA), admin"
**Fix:** Add `requirePosition(['president', 'admin'])` guard. Add 2FA verification for president role.

---

### EF-M07-f01c8964 | P2 | AUTHZ_GAP | `createAnnouncement` missing officer role verification

**File:** `communication/createAnnouncement.ts`
**Check:** Permission enforcement per S6
**Issue:** Handler creates announcements without verifying the caller is an officer of the target organization. Any authenticated user could create announcements for any org. Only `publishAnnouncement` properly uses `requirePosition()`.
**Spec ref:** MODULE_SPEC S6: "Create/send announcements: officer (any position)"
**Fix:** Add officer position verification via `requirePosition()`.

---

### EF-M07-e78a1824 | P2 | BR_VIOLATION | `updatePersonSubscription` missing M7-R1 enforcement

**File:** `communication/updatePersonSubscription.ts`
**Check:** Business rule M7-R1 enforcement
**Issue:** Does not enforce M7-R1: "IF announcement published THEN in-app delivery is mandatory." No validation prevents a member from disabling in-app channel for announcement-type subscription topics.
**Spec ref:** MODULE_SPEC S5 M7-R1 + AC-M07-001
**Fix:** Add validation: if topic type includes announcements, reject requests that disable the in-app channel.

---

### EF-M07-f30103ac | P2 | DATA_SHAPE | `announcementStats` table defined but never populated by handlers

**File:** `communication/getAnnouncementStats.ts` + `repos/communication.schema.ts`
**Check:** Data entity population
**Issue:** Schema defines `announcementStats` table matching spec entity (6 columns). `getAnnouncementStats` handler reads from it. But no handler or job writes to it from the `publishAnnouncement` flow. The `announcementSend` job has stats creation logic but is never triggered (see EF-M07-e48fb2a4).
**Spec ref:** MODULE_SPEC S7 Entity: AnnouncementStats + AC-M07-004
**Fix:** Blocked on EF-M07-e48fb2a4. Once delivery is wired, stats will populate.

---

### EF-M07-8644b817 | P2 | DATA_SHAPE | `listPersonSubscriptions` response shape mismatch

**File:** `communication/listPersonSubscriptions.ts`
**Check:** API response shape vs spec S10
**Issue:** Spec expects `GET /my/notifications/preferences` returning `Subscription[]` with shape `{topicId, topicName, channels: {email, push, inApp}}`. Handler returns raw DB rows without transforming to spec-defined shape.
**Spec ref:** MODULE_SPEC S10 row 8: "GET /my/notifications/preferences -> Subscription[]"
**Fix:** Add response transformation to match spec shape.

---

### EF-M07-8b636373 | P2 | DATA_SHAPE | Schema enum extends beyond spec

**File:** `repos/communication.schema.ts`
**Check:** Enum alignment with spec S8
**Issue:** `announcementStatusEnum` includes values not in spec state machine. Spec defines: `draft -> scheduled -> sending -> sent -> archived`. Implementation adds `scheduledFailed` undeclared in spec.
**Spec ref:** MODULE_SPEC S8 Announcement Status
**Fix:** Document `scheduledFailed` as implementation extension or add to spec.

---

### EF-M07-dd61483f | P2 | EVENT_GAP | No M07 domain events registered in event bus

**File:** `communication/` (all handlers)
**Check:** Domain event compliance per S10b
**Issue:** Spec declares 3 published events: `AnnouncementPublished`, `AnnouncementScheduled`, `MessageDelivered`. While `publishAnnouncement` calls `domainEvents.emit()`, no formal event type registration exists. Event payloads are untyped.
**Spec ref:** MODULE_SPEC S10b Published Events
**Fix:** Register typed event schemas in `core/domain-events.ts` for M07 events.

---

### EF-M07-c138ba2e | P2 | EVENT_GAP | No consumers for M07 consumed events

**File:** `communication/` (missing consumer files)
**Check:** Consumed event wiring per S10b
**Issue:** Spec declares 4 consumed events: `MembershipApproved` (welcome message), `DuesOverdue` (reminder), `EventPublished` (notification), `TrainingCompleted` (certificate). No event listeners or consumer handlers exist in any M07 directory.
**Spec ref:** MODULE_SPEC S10b Consumed Events
**Fix:** Add event consumer handlers or document as deferred.

---

### EF-M07-0f2c0b6a | P2 | INTEGRATION_GAP | Email module disconnected from announcement delivery

**File:** `email/jobs/processor.ts` + `communication/publishAnnouncement.ts`
**Check:** Cross-subsystem integration
**Issue:** `email/` has a full pg-boss email queue processor running at 30s intervals. `communication/publishAnnouncement.ts` does not enqueue any emails into this queue. The two subsystems are architecturally connected (shared pg-boss) but functionally disconnected for announcements.
**Spec ref:** MODULE_SPEC S19 M07-S3 (Email Queue) depends on M07-S1 (Announcements)
**Fix:** `publishAnnouncement` (or `announcementSend` job) must enqueue per-recipient emails via `core/email.ts` into the email queue.

---

### EF-M07-53b60efd | P2 | INTEGRATION_GAP | Notifs module lacks M07 announcement delivery trigger

**File:** `notifs/notification-triggers.ts`
**Check:** Cross-subsystem integration
**Issue:** `notification-triggers.ts` has triggers for booking, events, membership, dunning, and other modules -- but no trigger for M07 announcement delivery. Announcements should create in-app notifications for all recipients per M7-R1.
**Spec ref:** MODULE_SPEC S5 M7-R1: "in-app delivery is mandatory" + AC-M07-001
**Fix:** Add announcement notification trigger in `notification-triggers.ts` or wire from `announcementSend` job.

---

### EF-M07-97665a5c | P2 | NAMING | Duplicate: `markAllNotificationsAsRead` vs `markAllNotificationsRead`

**Files:** `notifs/markAllNotificationsAsRead.ts`, `notifs/markAllNotificationsRead.ts`
**Check:** Naming consistency
**Issue:** Two handler files with near-identical names and overlapping functionality. Both export handler functions for the same conceptual operation. Creates API surface confusion and maintenance burden.
**Spec ref:** No spec distinguishes these two operations.
**Fix:** Verify which OperationId is in the OpenAPI spec. Remove the orphan or consolidate.

---

### EF-M07-a3ab090f | P2 | NAMING | `savedSegments.ts` breaks verb-noun naming convention

**File:** `communication/savedSegments.ts`
**Check:** Handler naming convention
**Issue:** All other handlers follow `verbNoun.ts` pattern (e.g., `createAnnouncement.ts`, `listSavedSegments.ts`). `savedSegments.ts` is a bare noun. Likely a router/index file masquerading as a handler.
**Spec ref:** CONTRIBUTING.md handler naming convention
**Fix:** Rename to match its actual role or merge into the specific CRUD handlers.

---

### EF-M07-a4a00b63 | P2 | ERROR_TAXONOMY | M07 error codes not used in handler implementations

**Files:** All `communication/*.ts` handlers
**Check:** Error taxonomy compliance
**Issue:** ERROR_TAXONOMY.md defines M07-001 through M07-007. These codes appear only in `ac-m07.communications.test.ts` as acceptance criteria references, not as actual error codes thrown in handler code. Handlers use generic `BusinessLogicError`, `NotFoundError`, `ValidationError` without module-prefixed codes.
**Spec ref:** ERROR_TAXONOMY.md section 5.7
**Fix:** Add M07-prefixed error codes to handler throw sites.

---

### EF-M07-ddba5682 | P2 | BOUNDARY | `communication/` hosts 3 bounded contexts (M07, M13, M18)

**Files:** M13: `createFeedPost.ts`, `listFeedPosts.ts`, `deleteFeedPost.ts`, `getFeedPost.ts`, `reportFeedPost.ts`, `muteAuthor.ts`, `createPoll.ts`, `votePoll.ts`, `repos/feed-post.*`. M18: `createSurvey.ts`, `listSurveys.ts`, `getSurveyResults.ts`, `submitSurveyResponse.ts`, `repos/survey.*`.
**Check:** Domain boundary compliance
**Issue:** Directory contains handlers for 3 distinct module specs: M07 Communications (28 handlers), M13 Professional Feed (8 handlers + schema), M18 Surveys (4 handlers + schema). Each has separate acceptance tests and schemas, confirming they are distinct bounded contexts.
**Spec ref:** DOMAIN_MODEL sec.5, MODULE_SPEC scope
**Fix:** Extract M13/M18 handlers into `handlers/feed/` and `handlers/surveys/`, or document colocation as intentional with cross-references.

---

### EF-M07-607fde49 | P3 | DATA_SHAPE | Notification type enum tightly coupled to other modules

**File:** `notifs/repos/notification.schema.ts`
**Check:** Schema independence
**Issue:** `notificationTypeEnum` hardcodes types from booking, comms, and other modules. Adding a type requires schema migration. Should use generic types with module-specific mapping in application layer.
**Spec ref:** DOMAIN_MODEL notification entity
**Fix:** Consider `varchar` with app-level validation, or accept enum migration overhead.

---

### EF-M07-598c7311 | P3 | DATA_SHAPE | `core/notifs.ts` duplicates notification type enum as TS union

**File:** `core/notifs.ts`
**Check:** DRY compliance
**Issue:** `core/notifs.ts` defines a TypeScript union type for notification types that mirrors the enum in `notifs/repos/notification.schema.ts`. Two sources of truth for the same concept.
**Spec ref:** Architecture: single source of truth for types
**Fix:** Derive TS type from schema: `type NotificationType = typeof notificationTypeEnum.enumValues[number]`.

---

### EF-M07-bc4143dd | P3 | IMPORT_BOUNDARY | `notification-triggers.ts` imports from local repo instead of core

**File:** `notifs/notification-triggers.ts`
**Check:** Import boundary compliance
**Issue:** File is imported by `association:operations/` handlers (`cancelEventRegistration.ts`, `promoteWaitlistEntry.ts`). These cross-handler imports create tight coupling. The trigger functions should be in `core/` or a shared utility.
**Spec ref:** Architecture: handler directories should not be imported across boundaries
**Fix:** Move notification trigger functions to `core/notifs.ts` or a shared trigger registry.

---

### EF-M07-c44a1f9b | P3 | NAMING | Unsubscribe triple: `unsubscribeEmail.ts` + GET + POST variants

**Files:** `email/unsubscribeEmail.ts`, `email/unsubscribeEmailGet.ts`, `email/unsubscribeEmailPost.ts`
**Check:** Handler naming consistency
**Issue:** Three files for one unsubscribe flow. GET/POST split justified by RFC 8058 (List-Unsubscribe-Post). Original `unsubscribeEmail.ts` may be legacy or shared utility.
**Spec ref:** CONTRIBUTING.md handler naming, WF-050
**Fix:** Verify `unsubscribeEmail.ts` is still in route registration. If GET/POST handles all cases, deprecate or rename original.

---

### EF-M07-9b532017 | P3 | IMPORT_BOUNDARY | `core/email.ts` eagerly loads 3 provider SDKs

**File:** `core/email.ts`
**Check:** Import efficiency
**Issue:** Top-level imports for `nodemailer`, `postmark`, and `@onesignal/node-onesignal`. All loaded regardless of which provider is configured. Lazy init exists for instances but module imports are eager, increasing cold start time.
**Spec ref:** Architecture: core services should be lightweight
**Fix:** Use dynamic `import()` inside provider init methods.

---

### EF-M07-c0a1b2c3 | PASS | IMPORT_BOUNDARY | No cross-handler imports detected within M07

**Files:** All handler files across 4 directories
**Result:** No handler in `communication/` imports from `comms/`, `email/`, or `notifs/` directly. Cross-subsystem communication goes through `core/` services. Clean architectural boundary.

---

### EF-M07-d1e2f3a4 | PASS | DOMAIN_TERMS | `comms/` domain terms aligned with spec

**Files:** All `comms/*.ts`
**Result:** Chat Room, Chat Message, Video Call, Participant types all match DOMAIN_MODEL sec.5 and MODULE_SPEC sec.2. Schema enums aligned.

---

### EF-M07-e2f3a4b5 | PASS | DATA_SHAPE | `email/` schema well-organized

**Files:** `email/repos/`
**Result:** Clean separation: `email.schema.ts` (templates + queue), `suppression.schema.ts` (bounce/unsub). Matches DOMAIN_MODEL entities. Type exports include proper Drizzle inferred types.

---

### EF-M07-f3a4b5c6 | PASS | DATA_SHAPE | Strong test coverage across subsystems

**Files:** All test files (61 total)
**Result:** 60% file-level test coverage. Every CRUD handler in `communication/` has a matching test. Business rule tests exist for BR-26, BR-35, BR-40. Acceptance criteria tests cover M07, M13, M18.

---

## 4. Summary

| Severity | Count | Key Finding IDs |
|----------|-------|-----------------|
| P1 | 3 | e48fb2a4 (publish no delivery), 8b87b372 (missing scheduleAnnouncement), eaa14a14 (no role guard) |
| P2 | 13 | f01c8964, e78a1824, f30103ac, 8644b817, 8b636373, dd61483f, c138ba2e, 0f2c0b6a, 53b60efd, 97665a5c, a3ab090f, a4a00b63, ddba5682 |
| P3 | 5 | 607fde49, 598c7311, bc4143dd, c44a1f9b, 9b532017 |
| PASS | 4 | c0a1b2c3, d1e2f3a4, e2f3a4b5, f3a4b5c6 |

**Health Score: 6.8/10**

The M07 communications subsystem has solid architectural boundaries (no cross-handler imports), good test coverage (60% file-level), and well-organized schemas. The 3 P1 issues are critical: (1) `publishAnnouncement` marks announcements "sent" without delivering to anyone, (2) the spec-required `scheduleAnnouncement` endpoint is missing, and (3) subscription topic management has no authorization guard. The P2 cluster around domain events (none registered, no consumers wired) means cross-module reactive flows (welcome messages, dues reminders, event notifications) are inert. The `communication/` directory hosting M13 and M18 handlers adds organizational debt.

---

## 5. Recommended Actions (Priority Order)

1. **P1 -- Wire delivery** (EF-M07-e48fb2a4): Connect `publishAnnouncement` to `announcementSend` job. Unblocks f30103ac (stats), 0f2c0b6a (email), 53b60efd (notifs).
2. **P1 -- Add role guards** (EF-M07-eaa14a14 + f01c8964): Add `requirePosition()` to `createSubscriptionTopic` and `createAnnouncement`. Security gap.
3. **P1 -- Add scheduleAnnouncement** (EF-M07-8b87b372): Implement spec endpoint or document `updateAnnouncement` with `scheduledAt` as equivalent.
4. **P2 -- Wire domain events** (EF-M07-dd61483f + c138ba2e): Register typed M07 event schemas. Add consumers for `MembershipApproved`, `DuesOverdue`, `EventPublished`, `TrainingCompleted`.
5. **P2 -- Enforce BR M7-R1** (EF-M07-e78a1824): Add in-app channel validation in `updatePersonSubscription`.
6. **P2 -- Resolve naming duplicates** (EF-M07-97665a5c): Consolidate `markAllNotificationsAsRead` vs `markAllNotificationsRead`.
7. **P2 -- Adopt M07 error codes** (EF-M07-a4a00b63): Replace generic error classes with M07-prefixed codes per ERROR_TAXONOMY.md.
8. **P2 -- Extract M13/M18** (EF-M07-ddba5682): Move professional-feed and surveys handlers to dedicated directories or document colocation.
9. **P3 -- Type deduplication, import boundaries, naming** (5 items): Low-priority cleanup.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
