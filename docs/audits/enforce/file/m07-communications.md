# Per-File Spec Traceability: M07 Communications

**Module:** m07-communications
**Directories:** `communication/`, `comms/`, `email/`, `notifs/` + core services
**Date:** 2026-05-27
**Spec Sources:** MODULE_SPEC.md, API_CONTRACTS.md, ERROR_TAXONOMY.md, ROLE_PERMISSION_MATRIX.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md

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
| 19 | `getFeedPost.ts` | handler | M13 |
| 20 | `getMessage.ts` | handler | WF-049 |
| 21 | `getMessageTemplate.ts` | handler | WF-047 |
| 22 | `getSubscriptionTopic.ts` | handler | WF-050 |
| 23 | `getSurveyResults.ts` | handler | M18 |
| 24 | `listAnnouncements.ts` | handler | WF-049 |
| 25 | `listFeedPosts.ts` | handler | M13 |
| 26 | `listPersonSubscriptions.ts` | handler | WF-050 |
| 27 | `listSavedSegments.ts` | handler | WF-046 |
| 28 | `listSurveys.ts` | handler | M18 |
| 29 | `muteAuthor.ts` | handler | M13 (feed moderation) |
| 30 | `publishAnnouncement.ts` | handler | WF-046, AC-M07-003 |
| 31 | `reportFeedPost.ts` | handler | M13, BR-35 |
| 32 | `savedSegments.ts` | handler | WF-046 |
| 33 | `scheduleMessage.ts` | handler | WF-046, AC-M07-003, M07-004 |
| 34 | `searchMessageTemplates.ts` | handler | WF-047 |
| 35 | `searchMessages.ts` | handler | WF-049 |
| 36 | `sendMessage.ts` | handler | WF-046, AC-M07-001 |
| 37 | `submitSurveyResponse.ts` | handler | M18, BR-40 |
| 38 | `updateAnnouncement.ts` | handler | WF-046, M07-005 |
| 39 | `updateMessage.ts` | handler | WF-046 |
| 40 | `updateMessageTemplate.ts` | handler | WF-047 |
| 41 | `updatePersonSubscription.ts` | handler | WF-050 |
| 42 | `updateSubscriptionTopic.ts` | handler | WF-050 |
| 43 | `votePoll.ts` | handler | M13 |
| 44 | `repos/communication.repo.ts` | repository | WF-046..050 |
| 45 | `repos/communication.schema.ts` | schema | DOMAIN_MODEL sec.5 |
| 46 | `repos/feed-post.repo.ts` | repository | M13 |
| 47 | `repos/feed-post.schema.ts` | schema | M13 |
| 48 | `repos/survey.repo.ts` | repository | M18 |
| 49 | `repos/survey.schema.ts` | schema | M18 |
| 50 | `jobs/announcementSend.ts` | job | WF-046, AC-M07-001 |

**Test files (30):**

| # | File | Role |
|---|------|------|
| T1 | `015-announcements-templates.test.ts` | integration-test |
| T2 | `ac-m07.communications.test.ts` | acceptance-test |
| T3 | `ac-m13.professional-feed.test.ts` | acceptance-test |
| T4 | `ac-m18.surveys.test.ts` | acceptance-test |
| T5 | `announcement-handlers.test.ts` | unit-test |
| T6 | `archiveAnnouncement.test.ts` | unit-test |
| T7 | `br-26.session-management.test.ts` | rule-test |
| T8 | `br-35.feed-moderation.test.ts` | rule-test |
| T9 | `br-40.survey-anonymity.test.ts` | rule-test |
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
| T22 | `getMessage.test.ts` | unit-test |
| T23 | `getMessageTemplate.test.ts` | unit-test |
| T24 | `getSubscriptionTopic.test.ts` | unit-test |
| T25 | `jobs/announcementSend.test.ts` | unit-test |
| T26 | `listAnnouncements.test.ts` | unit-test |
| T27 | `listPersonSubscriptions.test.ts` | unit-test |
| T28 | `m13.professional-feed.test.ts` | integration-test |
| T29 | `m18.surveys.test.ts` | integration-test |
| T30 | `updateSubscriptionTopic.test.ts` | unit-test |

### 1.2 `handlers/comms/` (17 non-test, 5 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 51 | `createChatRoom.ts` | handler | DOMAIN_MODEL chat_room |
| 52 | `cross-module-triggers.ts` | utility | Slice 027 cross-module |
| 53 | `default-channels.ts` | utility | org setup |
| 54 | `endVideoCall.ts` | handler | DOMAIN_MODEL video_call |
| 55 | `getChatMessages.ts` | handler | DOMAIN_MODEL chat_message |
| 56 | `getChatRoom.ts` | handler | DOMAIN_MODEL chat_room |
| 57 | `getIceServers.ts` | handler | WebRTC infra |
| 58 | `joinVideoCall.ts` | handler | DOMAIN_MODEL video_call |
| 59 | `leaveVideoCall.ts` | handler | DOMAIN_MODEL video_call |
| 60 | `listChatRooms.ts` | handler | DOMAIN_MODEL chat_room |
| 61 | `sendChatMessage.ts` | handler | DOMAIN_MODEL chat_message |
| 62 | `updateVideoCallParticipant.ts` | handler | DOMAIN_MODEL video_call |
| 63 | `ws.chat-room.ts` | websocket-handler | WebSocket transport |
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
| 68 | `cancelEmailQueueItem.ts` | handler | email_queue entity |
| 69 | `createEmailTemplate.ts` | handler | email_template entity |
| 70 | `getEmailQueueItem.ts` | handler | email_queue entity |
| 71 | `getEmailTemplate.ts` | handler | email_template entity |
| 72 | `listEmailQueueItems.ts` | handler | email_queue entity |
| 73 | `listEmailSuppressions.ts` | handler | email_suppression entity |
| 74 | `listEmailTemplates.ts` | handler | email_template entity |
| 75 | `retryEmailQueueItem.ts` | handler | email_queue entity |
| 76 | `testEmailTemplate.ts` | handler | WF-047 (template preview) |
| 77 | `unsubscribeEmail.ts` | handler | WF-050, M07-007 |
| 78 | `unsubscribeEmailGet.ts` | handler | WF-050, RFC 8058 |
| 79 | `unsubscribeEmailPost.ts` | handler | WF-050, RFC 8058 |
| 80 | `updateEmailTemplate.ts` | handler | email_template entity |
| 81 | `jobs/index.ts` | job-registry | email queue processor |
| 82 | `jobs/processor.ts` | job | email_queue processing |
| 83 | `repos/email.schema.ts` | schema | DOMAIN_MODEL email_template, email_queue |
| 84 | `repos/queue.repo.ts` | repository | email_queue entity |
| 85 | `repos/suppression.repo.ts` | repository | email_suppression entity |
| 86 | `repos/suppression.schema.ts` | schema | DOMAIN_MODEL email_suppression |
| 87 | `repos/template.repo.ts` | repository | email_template entity |
| 88 | `templates/initializer.ts` | utility | default template seeding |
| 89 | `utils/bulk-rate-limiter.ts` | utility | rate limiting |
| 90 | `utils/unsub-token.ts` | utility | RFC 8058, M07-007 |

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
| T49 | `repos/queue.repo.test.ts` | unit-test |
| T50 | `repos/suppression.repo.test.ts` | unit-test |
| T51 | `repos/template.repo.test.ts` | unit-test |
| T52 | `utils/bulk-rate-limiter.test.ts` | unit-test |
| T53 | `utils/unsub-token.test.ts` | unit-test |

### 1.4 `handlers/notifs/` (9 non-test, 8 test files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 91 | `getNotification.ts` | handler | notification entity |
| 92 | `listNotifications.ts` | handler | notification entity |
| 93 | `markAllNotificationsAsRead.ts` | handler | notification entity |
| 94 | `markAllNotificationsRead.ts` | handler | notification entity |
| 95 | `markNotificationAsRead.ts` | handler | notification entity |
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

### 1.5 Core Services (3 files)

| # | File | Role | Spec Trace |
|---|------|------|------------|
| 100 | `core/email.ts` | service | EmailService abstraction (SMTP/Postmark/OneSignal) |
| 101 | `core/notifs.ts` | service | NotificationService abstraction (OneSignal/in-app) |
| 102 | `core/email-types.ts` | type-definition | Email DTOs (QueueEmailRequest, SendEmailRequest, etc.) |

---

## 2. Totals

| Directory | Non-test | Test | Total |
|-----------|----------|------|-------|
| communication/ | 50 | 30 | 80 |
| comms/ | 17 | 5 | 22 |
| email/ | 23 | 18 | 41 |
| notifs/ | 9 | 8 | 17 |
| core/ | 3 | 0 | 3 |
| **TOTAL** | **102** | **61** | **163** |

---

## 3. Findings

### EF-M07-a1a1a1a1 | P1 | ERROR_TAXONOMY | `publishAnnouncement` marks "sent" but performs no delivery

**File:** `communication/publishAnnouncement.ts:38-40`
**Check:** Error taxonomy, workflow completeness
**Issue:** Handler sets announcement status to `sent` via `repo.updateStatus(id, 'sent')` but creates no email queue entry, no push notification, no `AnnouncementPublished` domain event. Announcement appears sent but nobody receives it.
**Spec ref:** MODULE_SPEC S4 WF-046: "System delivers per-channel" + S10b Published Events: AnnouncementPublished
**Fix:** Wire delivery: on publish, enqueue emails via `core/email.ts`, trigger push via `core/notifs.ts`, emit `AnnouncementPublished` domain event.

---

### EF-M07-b1b1b1b1 | P1 | DATA_SHAPE | Missing `scheduleAnnouncement` endpoint

**File:** `communication/` (missing)
**Check:** API surface completeness
**Issue:** Spec requires `POST /org/:id/announcements/:id/schedule` with `scheduledAt` input. No dedicated handler exists. `createAnnouncement` may accept `scheduledAt` in body, but there is no action endpoint to schedule an already-created draft.
**Spec ref:** MODULE_SPEC S10 API: "POST /org/:id/announcements/:id/schedule"
**Fix:** Add `scheduleAnnouncement.ts` handler or document that scheduling is handled via `updateAnnouncement` with `scheduledAt` body field.

---

### EF-M07-c1c1c1c1 | P1 | IMPORT_BOUNDARY | `createSubscriptionTopic` missing role guard

**File:** `communication/createSubscriptionTopic.ts:17-18`
**Check:** Permission enforcement
**Issue:** Handler checks session existence but does not call `requirePosition()` or any role check. Spec requires president (2FA) or admin for subscription topic management.
**Spec ref:** MODULE_SPEC S6, ROLE_PERMISSION_MATRIX: "Manage subscription topics: president (2FA), admin"
**Fix:** Add `requirePosition(['president', 'admin'])` guard with 2FA verification for president role.

---

### EF-M07-d1d1d1d1 | P2 | IMPORT_BOUNDARY | `createAnnouncement` missing officer role verification

**File:** `communication/createAnnouncement.ts:18-19`
**Check:** Permission enforcement
**Issue:** Checks session existence but no officer role verification. Only `publishAnnouncement` properly uses `requirePosition()`. Create should also restrict to officers per spec.
**Spec ref:** MODULE_SPEC S6: "Send broadcast: president, secretary"
**Fix:** Add officer role guard to `createAnnouncement`.

---

### EF-M07-e1e1e1e1 | P2 | DATA_SHAPE | `listPersonSubscriptions` response shape mismatch

**File:** `communication/listPersonSubscriptions.ts`
**Check:** Data shape compliance
**Issue:** Returns raw subscription records instead of spec-defined response shape: `{topicId, topicName, channels: {email, push, inApp}}`. Two separate preference systems exist: `personSubscriptions` (communication module) and `notificationPreferences` (person module).
**Spec ref:** API_CONTRACTS S2.3: GET `/my/notifications/preferences` response shape
**Fix:** Transform response to match spec shape or document the divergence.

---

### EF-M07-f1f1f1f1 | P2 | DOMAIN_TERMS | `updatePersonSubscription` missing M7-R1 enforcement

**File:** `communication/updatePersonSubscription.ts`
**Check:** Business rule enforcement
**Issue:** Does not enforce spec rule M7-R1: "In-app cannot be disabled for announcements." No validation prevents setting in-app to false for announcement-type topics.
**Spec ref:** MODULE_SPEC S5 BR M7-R1 + AC-M07-001
**Fix:** Add validation: if topic type is announcement, reject disabling in-app channel.

---

### EF-M07-a2a2a2a2 | P2 | DATA_SHAPE | `announcementStats` table defined but never populated

**File:** `communication/repos/communication.schema.ts:170-180`
**Check:** Data shape completeness
**Issue:** Schema defines `announcementStats` table but no handler creates stats records on publish. `publishAnnouncement` does not initialize a stats row. Stats endpoint would return empty data.
**Spec ref:** MODULE_SPEC S7: Entity AnnouncementStats + AC-M07-004: Delivery Stats
**Fix:** Create stats row on publish, update on delivery/open events.

---

### EF-M07-b2b2b2b2 | P2 | DATA_SHAPE | Schema enum extends beyond spec

**File:** `communication/repos/communication.schema.ts:133-134`
**Check:** Data shape alignment
**Issue:** `announcementStatusEnum` has 5 values: `draft, scheduled, sent, scheduledFailed, archived`. Spec defines 3: `draft, scheduled, sent`. Extensions (`scheduledFailed`, `archived`) undeclared in API_CONTRACTS.
**Spec ref:** API_CONTRACTS S5: AnnouncementStatus enum
**Fix:** Document `scheduledFailed` and `archived` as implementation extensions, or add to spec.

---

### EF-M07-c2c2c2c2 | P2 | DOMAIN_TERMS | No communications domain events registered

**File:** `core/domain-events.registry.ts`
**Check:** Domain event completeness
**Issue:** Domain event registry has no communications events. Missing: `AnnouncementPublished`, `ChatRoomCreated`, `MessageScheduled`. None of spec's 3 published events are registered.
**Spec ref:** MODULE_SPEC S10b Published Events
**Fix:** Register M07 domain events in the event registry.

---

### EF-M07-d2d2d2d2 | P2 | DOMAIN_TERMS | No consumers for M07 consumed events

**File:** `core/domain-event-consumers.ts`
**Check:** Domain event completeness
**Issue:** No handlers for M07's consumed events: `MembershipApproved`, `EventPublished`, `TrainingPublished`, `ElectionOpened`. Cross-module reactions not wired -- new member welcome messages, event notifications, etc. will not fire automatically.
**Spec ref:** MODULE_SPEC S10b Consumed Events
**Fix:** Add consumer handlers for each consumed event.

---

### EF-M07-e2e2e2e2 | P2 | IMPORT_BOUNDARY | Email module disconnected from announcement delivery

**File:** `email/` (all handlers)
**Check:** Integration completeness
**Issue:** Email module provides queue infrastructure (templates, queue, processing) but is not connected to communication module's announcement delivery. When an announcement is "published", no email queue entry is created.
**Spec ref:** MODULE_SPEC S4 WF-046 step 4: "System delivers per-channel (in-app, push, email)"
**Fix:** Wire `publishAnnouncement` to email queue via `core/email.ts` service.

---

### EF-M07-f2f2f2f2 | P2 | IMPORT_BOUNDARY | Notifs module lacks M07 announcement delivery trigger

**File:** `notifs/notification-triggers.ts`
**Check:** Integration completeness
**Issue:** Notification triggers exist for dunning (M06), waitlist, late cancellation, task overdue -- but no trigger for M07 announcement push delivery. The `notifyDunningEscalation()` pattern exists but no equivalent `notifyAnnouncementPublished()`.
**Spec ref:** MODULE_SPEC S10b: AnnouncementPublished consumers: "Email queue, Push service"
**Fix:** Add announcement delivery trigger function.

---

### EF-M07-a3a3a3a3 | P2 | NAMING | Duplicate: `markAllNotificationsAsRead` vs `markAllNotificationsRead`

**Files:** `notifs/markAllNotificationsAsRead.ts`, `notifs/markAllNotificationsRead.ts`
**Check:** Naming consistency
**Issue:** Two handlers with near-identical names, different OperationIds. Both export functions. Creates API surface confusion.
**Spec ref:** No spec distinguishes these two operations.
**Fix:** Verify which OperationId is in OpenAPI spec. Remove the orphan or consolidate.

---

### EF-M07-b3b3b3b3 | P2 | NAMING | `savedSegments.ts` breaks verb-noun naming convention

**File:** `communication/savedSegments.ts`
**Check:** Naming convention
**Issue:** File breaks `{verb}{Noun}.ts` convention used by all other handler files (e.g., `createSavedSegment.ts`). Likely a compound handler or router.
**Spec ref:** Handler naming convention from CONTRIBUTING.md
**Fix:** Inspect contents. If compound handler, split into verb-noun files. If utility/router, move to `utils/`.

---

### EF-M07-c3c3c3c3 | P2 | ERROR_TAXONOMY | M07 error codes not used in handler implementations

**Files:** All `communication/*.ts` handlers
**Check:** Error taxonomy compliance
**Issue:** ERROR_TAXONOMY.md defines M07-001..007. These appear only in `ac-m07.communications.test.ts` as acceptance criteria references, not as actual error codes thrown in handler code. Handlers use generic `BusinessLogicError`, `NotFoundError`, `ValidationError`.
**Spec ref:** ERROR_TAXONOMY.md section 5.7
**Fix:** Add M07-prefixed error codes to handler throw sites. E.g., `scheduleMessage.ts` should throw with code `M07-004`.

---

### EF-M07-d3d3d3d3 | P2 | DOMAIN_TERMS | `communication/` hosts 3 bounded contexts (M07, M13, M18)

**Files:** All M13/M18 files in `communication/`
**Check:** Domain term alignment
**Issue:** Directory contains handlers for 3 module specs: M07 Communications (28 handlers), M13 Professional Feed (8 handlers: createFeedPost, listFeedPosts, deleteFeedPost, getFeedPost, reportFeedPost, muteAuthor, createPoll, votePoll), M18 Surveys (4 handlers: createSurvey, listSurveys, getSurveyResults, submitSurveyResponse). Each has separate acceptance tests and schemas.
**Spec ref:** DOMAIN_MODEL sec.5, MODULE_SPEC scope
**Fix:** Extract M13/M18 handlers into `handlers/feed/` and `handlers/surveys/`, or document as intentional colocation.

---

### EF-M07-e3e3e3e3 | P3 | DATA_SHAPE | Notification type enum tightly coupled to other modules

**File:** `notifs/repos/notification.schema.ts`
**Check:** Data shape compliance
**Issue:** `notificationTypeEnum` hardcodes types from booking, comms, and cross-cutting modules. Adding types requires schema migration.
**Spec ref:** DOMAIN_MODEL notification entity
**Fix:** Consider `varchar` with app-level validation. Low priority since enum migrations are straightforward.

---

### EF-M07-f3f3f3f3 | P3 | DATA_SHAPE | `core/notifs.ts` duplicates notification type enum as TS union

**File:** `core/notifs.ts`
**Check:** Data shape consistency
**Issue:** `CreateNotificationRequest.type` is a TS union literal mirroring `notificationTypeEnum` in schema. Two sources of truth.
**Spec ref:** DOMAIN_MODEL notification entity
**Fix:** Derive TS type from schema: `type NotificationType = typeof notificationTypeEnum.enumValues[number]`.

---

### EF-M07-a4a4a4a4 | P3 | IMPORT_BOUNDARY | `notification-triggers.ts` imports from local repo instead of core

**File:** `notifs/notification-triggers.ts`
**Check:** Import boundary
**Issue:** Imports `CreateNotificationRequest` from `./repos/notification.schema` while importing `NotificationService` from `@/core/notifs`. The type exists in both locations.
**Spec ref:** Architecture: core services are public API for cross-module access.
**Fix:** Single source for `CreateNotificationRequest` type.

---

### EF-M07-b4b4b4b4 | P3 | NAMING | Unsubscribe triple: `unsubscribeEmail.ts` + GET + POST

**Files:** `email/unsubscribeEmail.ts`, `email/unsubscribeEmailGet.ts`, `email/unsubscribeEmailPost.ts`
**Check:** Naming consistency
**Issue:** Three files for one action. GET/POST split justified by RFC 8058 (List-Unsubscribe-Post). Original `unsubscribeEmail.ts` may be legacy.
**Spec ref:** WF-050, M07-007, RFC 8058
**Fix:** Verify `unsubscribeEmail.ts` is still in route registration. If GET/POST handles all cases, deprecate original.

---

### EF-M07-c4c4c4c4 | P3 | IMPORT_BOUNDARY | `core/email.ts` eagerly loads 3 provider SDKs

**File:** `core/email.ts`
**Check:** Import efficiency
**Issue:** Top-level imports for `nodemailer`, `postmark`, `@onesignal/node-onesignal`. All loaded regardless of configured provider. Lazy init exists for instances but not for module imports.
**Spec ref:** Architecture: core services should be lightweight.
**Fix:** Use dynamic `import()` inside provider init methods.

---

### EF-M07-p1p1p1p1 | PASS | IMPORT_BOUNDARY | No cross-handler imports detected

**Files:** All 4 handler directories
**Check:** Import boundary
**Result:** No handler file imports from another handler directory. All cross-module communication goes through core services. Correctly follows architecture pattern.

---

### EF-M07-p2p2p2p2 | PASS | DOMAIN_TERMS | `comms/` domain terms aligned with spec

**Files:** All `comms/*.ts`
**Check:** Domain term alignment
**Result:** Chat Room, Chat Message, Video Call, Participant types all match DOMAIN_MODEL sec.5 and MODULE_SPEC sec.2. Schema enums aligned.

---

### EF-M07-p3p3p3p3 | PASS | DATA_SHAPE | `email/` schema well-organized

**Files:** `email/repos/`
**Check:** Data shape compliance
**Result:** Clean separation: `email.schema.ts` (templates + queue), `suppression.schema.ts` (bounce/unsub). Matches DOMAIN_MODEL entities. Type exports include proper Drizzle inferred types.

---

### EF-M07-p4p4p4p4 | PASS | DATA_SHAPE | Strong test coverage

**Check:** Test file presence
**Result:** 61 test files / 102 source files = 60% file-level coverage. Includes acceptance criteria tests (ac-m07, ac-m13, ac-m18), business rule tests (br-26, br-35, br-40), stabilization tests, repo-level tests, and utility tests.

---

## 4. Summary

| Severity | Count | IDs |
|----------|-------|-----|
| P1 | 3 | a1a1a1a1 (no delivery on publish), b1b1b1b1 (missing scheduleAnnouncement), c1c1c1c1 (no role guard on subscriptionTopic) |
| P2 | 13 | d1..f2, a3..d3 (role guards, data shapes, domain events, naming, error codes, multi-context dir) |
| P3 | 5 | e3..c4 (enum coupling, type duplication, import boundary, naming, eager SDK loading) |
| PASS | 4 | No cross-handler imports, domain terms aligned, schema organized, strong test coverage |

**Health Score: 6.8/10**

The M07 communications subsystem has solid architectural boundaries (no cross-handler imports), good test coverage (60% file-level), and well-organized schemas. The 3 P1 issues are significant: announcement publish does not actually deliver, scheduleAnnouncement endpoint is missing, and subscription topic management lacks required role guards. The P2 cluster around domain events (no events registered, no consumers wired) means cross-module reactive flows are inert. The communication/ directory silently hosting M13 and M18 handlers adds organizational debt.

---

## 5. Recommended Actions (Priority Order)

1. **P1** -- Wire delivery in `publishAnnouncement`: email queue + push + domain event emission
2. **P1** -- Add `scheduleAnnouncement.ts` handler or document scheduling via update
3. **P1** -- Add role guard (`requirePosition`) to `createSubscriptionTopic` with 2FA
4. **P2** -- Register M07 domain events (AnnouncementPublished, ChatRoomCreated, MessageScheduled)
5. **P2** -- Wire M07 consumed event consumers (MembershipApproved, EventPublished, etc.)
6. **P2** -- Add M07-001..007 error codes to handler throw sites
7. **P2** -- Add officer role guard to `createAnnouncement`
8. **P2** -- Enforce M7-R1 in `updatePersonSubscription` (in-app always on)
9. **P2** -- Wire email module to announcement delivery pipeline
10. **P2** -- Deduplicate `markAllNotificationsAsRead` / `markAllNotificationsRead`
11. **P2** -- Decide: extract M13/M18 from communication/ or document as intentional
12. **P2** -- Fix `listPersonSubscriptions` response shape
13. **P2** -- Populate `announcementStats` on publish
14. **P2** -- Document `scheduledFailed` / `archived` status extensions
15. **P3** -- Consolidate `CreateNotificationRequest` type to single source
16. **P3** -- Use dynamic imports in `core/email.ts`
17. **P3** -- Derive TS notification type from schema enum
