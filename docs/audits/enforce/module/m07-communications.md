# Module Enforcement: m07-communications

**Score:** 3.0/10 — NON-COMPLIANT (capped from 5.2 raw — 2 P0 findings)
**Source:** `services/api-ts/src/handlers/communication/` (35 handlers) + `services/api-ts/src/handlers/comms/` (13 handlers) + `services/api-ts/src/handlers/email/` (13 handlers) + `services/api-ts/src/handlers/notifs/` (6 handlers)
**Spec:** `docs/product/modules/m07-communications/MODULE_SPEC.md`, `docs/product/modules/m07-communications/API_CONTRACTS.md`
**Date:** 2026-05-27

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| 1. Public API Completeness | 5 | 0 | 3 | 0 | 0 |
| 2. Workflow Implementation | 4 | 1 | 0 | 1 | 0 |
| 3. Domain Term Consistency | 8 | 0 | 0 | 0 | 1 |
| 4. State Machine Enforcement | 6 | 0 | 0 | 1 | 1 |
| 5. Event Publishing | 2 | 1 | 3 | 0 | 0 |
| 6. Auth/Permission Enforcement | 6 | 0 | 1 | 1 | 0 |

## Summary

The communications module spans 4 handler directories with substantial handler coverage for announcements, message templates, subscription topics, messages, and notification preferences. However, two P0 blockers cap the score at 3.0:

1. **P0: publishAnnouncement has no delivery side-effects.** The handler transitions status to `sent` and writes an audit log, but does not enqueue email delivery, push notifications, or create in-app notifications. Announcements are marked "sent" but never actually reach recipients.

2. **P0: AnnouncementPublished domain event not emitted.** The spec declares this event should trigger email queue + push service. The domain event bus exists (`core/domain-events.ts`) but `publishAnnouncement` does not call `domainEvents.emit()`. The event is not even registered in `domain-events.registry.ts`.

Additionally, 3 spec endpoints have no route or handler (scheduleAnnouncement, getAnnouncementStats, listSubscriptionTopics), 4 consumed events are unwired, and `createSubscriptionTopic` lacks the spec-required president/2FA role guard.

### Handler Inventory

**communication/ (35 non-test .ts files):** archiveAnnouncement, bulkUpdatePersonSubscriptions, cancelMessage, createAnnouncement, createFeedPost, createMessage, createMessageTemplate, createPoll, createSavedSegment, createSubscriptionTopic, createSurvey, deleteAnnouncement, deleteFeedPost, deleteMessage, deleteMessageTemplate, deleteSavedSegment, deleteSubscriptionTopic, getAnnouncement, getFeedPost, getMessage, getMessageTemplate, getSubscriptionTopic, getSurveyResults, listAnnouncements, listFeedPosts, listPersonSubscriptions, listSavedSegments, listSurveys, muteAuthor, previewMessageTemplate, publishAnnouncement, scheduleMessage, searchMessageTemplates, sendMessage, updateAnnouncement, updateMessageTemplate, updatePersonSubscription + repos/

**comms/ (13 non-test .ts files):** createChatRoom, cross-module-triggers, default-channels, endVideoCall, getChatMessages, getChatRoom, getIceServers, joinVideoCall, leaveVideoCall, listChatRooms, sendChatMessage, updateVideoCallParticipant, ws.chat-room + repos/

**email/ (13 non-test .ts files):** cancelEmailQueueItem, createEmailTemplate, getEmailQueueItem, getEmailTemplate, listEmailQueueItems, listEmailSuppressions, listEmailTemplates, retryEmailQueueItem, testEmailTemplate, unsubscribeEmail, unsubscribeEmailGet, unsubscribeEmailPost, updateEmailTemplate + repos/

**notifs/ (6 non-test .ts files):** getNotification, listNotifications, markAllNotificationsAsRead, markAllNotificationsRead, markNotificationAsRead, notification-triggers

## Findings

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M07-2a91bac4 | P0 | Workflow | `publishAnnouncement` transitions status to `sent` and writes audit log, but does NOT: (a) enqueue emails via email queue, (b) send push notifications via OneSignal, (c) create in-app notifications, (d) create `announcementStats` record. Announcements are marked "sent" but never delivered. WF-046 postcondition "members receive announcement" is violated. AC-M07-001 (In-App Always On) fails. | `handlers/communication/publishAnnouncement.ts` | HIGH |
| EM-M07-bbf2b316 | P0 | Event Publishing | `AnnouncementPublished` domain event is never emitted. Spec declares it as a published event that should trigger email queue + push service. `publishAnnouncement` handler does not import or call `domainEvents.emit()`. The event type is not registered in `core/domain-events.registry.ts` (which only has `dues.payment.recorded` and `membership.status.changed`). | `handlers/communication/publishAnnouncement.ts`, `core/domain-events.registry.ts` | HIGH |
| EM-M07-c5d1ec35 | P1 | API Completeness | `POST /org/:id/announcements/:id/schedule` — no route in generated routes, no handler file `scheduleAnnouncement.ts`. API_CONTRACTS spec declares this endpoint. `scheduleMessage.ts` exists for messages but not for announcements. Announcement scheduling (WF-046 step 3, AC-M07-003) is unimplemented. | `handlers/communication/` (missing file) | HIGH |
| EM-M07-e146df5b | P1 | API Completeness | `GET /org/:id/announcements/:id/stats` — no route in generated routes, no handler file `getAnnouncementStats.ts`. API_CONTRACTS spec declares this endpoint. `announcementStats` table exists in schema and repo has `createStats()` + `getStats()` methods, but no HTTP endpoint exposes per-announcement stats. AC-M07-004 (Delivery Stats) fails. | `handlers/communication/` (missing file) | HIGH |
| EM-M07-7f315e59 | P1 | API Completeness | `GET /org/:id/subscription-topics` (list all topics) — no route in generated routes. Only `GET /association/subscription-topics/:topicId` (get by ID) exists. API_CONTRACTS spec declares a list endpoint. Officers cannot discover available topics. | `generated/openapi/routes.ts` | HIGH |
| EM-M07-72dcb42c | P1 | Event Publishing | `MessageScheduled` and `ChatRoomCreated` domain events are never emitted. Spec declares 3 published events; 0/3 are implemented. `scheduleMessage.ts` does not emit `MessageScheduled`. `createChatRoom.ts` does not emit `ChatRoomCreated`. Neither event type exists in `domain-events.registry.ts`. | `handlers/communication/scheduleMessage.ts`, `handlers/comms/createChatRoom.ts` | HIGH |
| EM-M07-2324ea6a | P1 | Event Publishing | 0/4 consumed events are wired to the domain event bus. Spec requires M07 to react to: `MembershipApproved` (send welcome), `EventPublished` (event notification), `TrainingPublished` (training notification), `ElectionOpened` (election announcement). `domain-event-consumers.ts` only handles `dues.payment.recorded`. None of the M07 events are registered. | `core/domain-event-consumers.ts` | HIGH |
| EM-M07-cf759ba6 | P1 | Event Publishing | `cross-module-triggers.ts` in comms/ has `onMembershipApproved()` method with correct implementation (sends welcome notification), but it is NOT wired to the domain event bus. `app.ts` does not reference `cross-module-triggers` or register these handlers. The implementation exists but is dead code. | `handlers/comms/cross-module-triggers.ts`, `app.ts` | HIGH |
| EM-M07-ecb1ec3b | P1 | Auth/Permission | `createSubscriptionTopic` handler checks user auth and org context but does NOT enforce president role or 2FA. Spec requires "Manage subscription topics: president (2FA), admin". Route-level auth uses `roles: ["admin"]` which partially covers admin but misses president+2FA requirement. Handler has no `requirePosition()` call. | `handlers/communication/createSubscriptionTopic.ts` | HIGH |
| EM-M07-558fca6a | P2 | Auth/Permission | `createAnnouncement` handler checks session existence but has no `requirePosition()` call. Spec says "Send broadcast: president, secretary" only. Route-level middleware uses `roles: ["association:officer"]` which is broader than spec (allows VP, treasurer, etc.). Compare: `publishAnnouncement` correctly uses `requirePosition([PRESIDENT, SECRETARY])`. | `handlers/communication/createAnnouncement.ts` | MEDIUM |
| EM-M07-f650f090 | P2 | Workflow | WF-050 (Email Opt-Out) has dual preference systems: `personSubscriptions` table (communication/) with per-topic channel toggles, AND `notificationPreferences` table (person/) with per-category push/email toggles. No documented reconciliation between them. Could cause members to opt out in one system but still receive via the other. | `handlers/communication/repos/communication.schema.ts`, `handlers/person/repos/notification-preferences.schema.ts` | MEDIUM |
| EM-M07-6d817e98 | P2 | State Machine | `scheduledFailed` status exists in `announcementStatusEnum` but no handler sets it or recovers from it. No cron job or background worker processes scheduled announcements. The `scheduled` -> `scheduledFailed` and `scheduledFailed` -> retry paths are dead. | `handlers/communication/repos/communication.schema.ts` | MEDIUM |
| EM-M07-e748dbba | P3 | Domain Terms | Schema defines `announcementStatusEnum` with values `[draft, scheduled, sent, scheduledFailed, archived]`. API_CONTRACTS shared types declare `AnnouncementStatus` as `draft | scheduled | sending | sent | cancelled | archived`. Mismatch: schema has `scheduledFailed` (not in spec), spec has `sending` + `cancelled` (not in schema). | `handlers/communication/repos/communication.schema.ts` | LOW |
| EM-M07-bbcc50af | P3 | State Machine | Spec defines `Cancelled` as a valid announcement status reachable from `Draft` and `Scheduled` via cancel action. No `cancelAnnouncement` handler exists (`cancelMessage` exists for messages, not announcements). `cancelled` is in the message schema but not in the announcement schema enum. | `handlers/communication/repos/communication.schema.ts` | LOW |

## Remediation Priority

### Must-fix before shipping (P0 — 2 findings)
1. **EM-M07-2a91bac4**: Wire `publishAnnouncement` to actually deliver announcements. On publish: (a) resolve recipients via segment filters, (b) enqueue emails to `emailQueue` table, (c) send push via OneSignal, (d) create in-app notifications, (e) create `announcementStats` record with delivery counts. Consider pg-boss job for async fan-out.
2. **EM-M07-bbf2b316**: Register `AnnouncementPublished` in `domain-events.registry.ts` and emit it from `publishAnnouncement`. Wire consumers in email/push services.

### Should-fix (P1 — 7 findings)
3. **EM-M07-c5d1ec35**: Add `scheduleAnnouncement` handler + TypeSpec endpoint + route. Transitions `draft -> scheduled` with `scheduledAt` timestamp.
4. **EM-M07-e146df5b**: Add `getAnnouncementStats` handler + TypeSpec endpoint + route. Query `announcementStats` table by announcement ID.
5. **EM-M07-7f315e59**: Add `listSubscriptionTopics` TypeSpec endpoint + route.
6. **EM-M07-72dcb42c**: Register `MessageScheduled` + `ChatRoomCreated` in event registry, emit from handlers.
7. **EM-M07-2324ea6a**: Register consumed events in `domain-event-consumers.ts` or wire `cross-module-triggers.ts`.
8. **EM-M07-cf759ba6**: Wire `CrossModuleTriggers` class in `app.ts` startup to domain event bus.
9. **EM-M07-ecb1ec3b**: Add `requirePosition([PRESIDENT])` + 2FA check to `createSubscriptionTopic` handler.
