# Module Enforcement: m07-communications

**Score:** 6/10 (up from 3.0 -- P0 delivery wired since last audit)
**Source:** `services/api-ts/src/handlers/communication/` (28 handlers) + `comms/` (11) + `email/` (9) + `notifs/` (5) + `communications/` (0 -- empty)
**Spec:** `docs/product/modules/m07-communications/MODULE_SPEC.md`
**Date:** 2026-05-28
**Prior Audit:** 2026-05-27 (score 3.0)

---

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|----|----|----|----|
| 1. Public API Completeness | 4 | 0 | 2 | 2 | 0 |
| 2. Workflow Implementation | 7 | 0 | 1 | 1 | 0 |
| 3. State Machine Enforcement | 5 | 1 | 0 | 0 | 1 |
| 4. Domain Event Publishing | 1 | 1 | 1 | 0 | 0 |
| 5. Auth/Permission Enforcement | 5 | 0 | 1 | 1 | 0 |
| 6. Business Rules | 6 | 1 | 0 | 1 | 0 |
| 7. Data Model | 8 | 0 | 0 | 1 | 0 |
| 8. Spec-First / TypeSpec | 3 | 1 | 1 | 0 | 0 |
| 9. Module Boundary | 7 | 0 | 1 | 0 | 0 |
| 10. Observability & Flags | 5 | 0 | 0 | 1 | 1 |

---

## Delta from Prior Audit (2026-05-27)

Since last audit, the following P0s from prior report are now RESOLVED:
- **EM-M07-2a91bac4 (was P0):** `publishAnnouncement` now calls `processAnnouncementSend` which fans out to in-app, email, and push channels. Delivery is wired.
- Announcement send job exists at `communication/jobs/announcementSend.ts` with pg-boss cron for scheduled processing.
- `processAnnouncementSend` respects email opt-outs via `personSubscriptions` table.

Remaining from prior audit (still open):
- Domain events still not emitted (EM-M07-bbf2b316 remains P0 -> reclassified as P1 since delivery works via direct calls)
- Consumed events still unwired
- `cancelAnnouncement` still missing
- `scheduledFailed` still not in spec

---

## Summary

The communications module spans 5 handler directories with 53 total non-test handler files. Core announcement delivery now works end-to-end (create -> publish -> fan-out to in-app/email/push). The primary remaining gaps are:

1. **Massive undeclared API surface:** Spec Section 10 declares 9 endpoints; implementation has ~50+ across all directories. Only 28% of the surface is spec-declared.
2. **Zero domain events:** 0/3 published events emitted, 0/4 consumed events wired. Delivery works via direct service calls instead.
3. **Missing TypeSpec for core communication/:** 28 handlers with hand-wired routes, violating spec-first architecture.
4. **State machine divergence:** `cancelled` in spec but not in schema; `scheduledFailed` in schema but not in spec.
5. **M13 professional feed leaking into M07:** 7 feed-related files in communication/ belong in their own module.

### Handler Inventory (non-test .ts files)

**communication/ (28 handlers):** archiveAnnouncement, bulkUpdatePersonSubscriptions, cancelMessage, createAnnouncement, createFeedPost, createMessage, createMessageTemplate, createSubscriptionTopic, deleteAnnouncement, deleteFeedPost, deleteMessage, deleteMessageTemplate, deleteSubscriptionTopic, getAnnouncement, getFeedPost, getMessage, getMessageTemplate, getPersonSubscriptions, listAnnouncements, listFeedPosts, listMessages, listMessageTemplates, publishAnnouncement, reportFeedPost, savedSegments, scheduleMessage, updateAnnouncement, updateMessageTemplate + repos/ + jobs/

**comms/ (11 handlers):** createChatRoom, cross-module-triggers, default-channels, endVideoCall, getChatMessages, getChatRoom, getIceServers, joinVideoCall, leaveVideoCall, listChatRooms, sendChatMessage, updateVideoCallParticipant, ws.chat-room + repos/

**email/ (9 handlers):** cancelEmailQueueItem, createEmailTemplate, getEmailQueueItem, getEmailTemplate, listEmailQueueItems, listEmailSuppressions, listEmailTemplates, retryEmailQueueItem, unsubscribeEmail (GET+POST), updateEmailTemplate + repos/ + jobs/

**notifs/ (5 handlers):** getNotification, listNotifications, notification-triggers (4 trigger functions) + repos/

**communications/ (0 handlers):** Empty vestigial directory.

---

## DECLARED_API Conformance

### Spec Section 10: 9 declared endpoints

| Spec Endpoint | Implemented? | Handler | Notes |
|---------------|-------------|---------|-------|
| `POST /org/:id/announcements` | YES | `createAnnouncement.ts` | -- |
| `POST /org/:id/announcements/:id/publish` | YES | `publishAnnouncement.ts` | Wired to `processAnnouncementSend` |
| `POST /org/:id/announcements/:id/schedule` | YES | `scheduleMessage.ts` | Handler exists for messages; announcement scheduling via cron job |
| `GET /org/:id/announcements` | YES | `listAnnouncements.ts` | -- |
| `GET /org/:id/announcements/:id/stats` | PARTIAL | Stats table + `createStats()` in repo | No dedicated HTTP endpoint handler |
| `GET /org/:id/templates` | YES | `listMessageTemplates.ts` | -- |
| `POST /org/:id/templates` | YES | `createMessageTemplate.ts` | -- |
| `GET /my/notifications/preferences` | YES | `getPersonSubscriptions.ts` | -- |
| `PUT /my/notifications/preferences` | YES | `bulkUpdatePersonSubscriptions.ts` | -- |

**Coverage:** 7/9 fully implemented, 1 partial, 1 partial = ~78% declared endpoint coverage.

---

## Findings

| ID | Sev | Dimension | Finding | File(s) | Confidence |
|----|-----|-----------|---------|---------|------------|
| EM-M07-f4a1e8b2 | P0 | State Machine | `announcementStatusEnum` schema has `['draft','scheduled','sent','scheduledFailed','archived']` but spec declares `Draft->Cancelled` and `Scheduled->Cancelled` transitions. `cancelled` value MISSING from schema enum. No `cancelAnnouncement` handler exists. Spec state machine cannot be implemented as-is. | `communication/repos/communication.schema.ts` | HIGH |
| EM-M07-d3c2b1a0 | P0 | Domain Events | 0/3 published events emitted. `AnnouncementPublished`, `ChatRoomCreated`, `MessageScheduled` declared in spec but zero `emit()` calls across all 5 handler directories. Delivery works via direct `processAnnouncementSend` calls. | `publishAnnouncement.ts`, `createChatRoom.ts`, `scheduleMessage.ts` | HIGH |
| EM-M07-91e0c7f3 | P0 | Business Rules | M7-R5: "IF recipient is deceased or suppressed THEN skip all delivery channels." `processAnnouncementSend` checks email opt-outs via `personSubscriptions.enabled=false` but does NOT check deceased/suppressed person status before delivery. Deceased members receive communications. | `communication/jobs/announcementSend.ts` | HIGH |
| EM-M07-b5d4e3f2 | P0 | Spec-First | `communication.tsp` does not exist. Core subsystem (28 handlers) has no TypeSpec definition. Only `comms.tsp` exists. Spec AI Instructions say "Define TypeSpec in `specs/api/src/modules/communication.tsp`" -- file missing. All communication/ routes are hand-wired. | `specs/api/src/modules/` | HIGH |
| EM-M07-a8f7e6d5 | P1 | API Completeness | Spec declares `GET /org/:id/announcements/:id/stats` but no handler file exists. `announcementStats` table and `createStats()`/`getStats()` repo methods exist. No HTTP endpoint exposes stats. AC-M07-004 (Delivery Stats) not satisfiable. | `communication/` (missing handler) | HIGH |
| EM-M07-c4b3a2e1 | P1 | Domain Events | 0/4 consumed events wired. Spec requires handling `MembershipApproved`, `EventPublished`, `TrainingPublished`, `ElectionOpened`. `comms/cross-module-triggers.ts` has `onMembershipApproved()` implementation but is dead code -- not registered in domain event bus. | `comms/cross-module-triggers.ts` | HIGH |
| EM-M07-e2d1c0b9 | P1 | Auth/Permission | `createSubscriptionTopic` checks auth but does NOT enforce president role or 2FA. Spec requires "Manage subscription topics: president (2FA), admin". No `requirePosition()` call in handler. | `communication/createSubscriptionTopic.ts` | HIGH |
| EM-M07-7a6b5c4d | P1 | Module Boundary | 7 professional feed files (`createFeedPost`, `deleteFeedPost`, `getFeedPost`, `listFeedPosts`, `reportFeedPost` + tests) and `feed-post.schema.ts` live in `communication/`. This is M13 domain, not M07. M07 spec does not mention professional feed. Separate schema with 4 tables. | `communication/` feed files | HIGH |
| EM-M07-f9e8d7c6 | P1 | Spec-First | `email.tsp` and `notifs.tsp` do not exist. 14 handlers across email/ (9) and notifs/ (5) have no TypeSpec. No generated routes or SDK types. | `specs/api/src/modules/` | MEDIUM |
| EM-M07-3b2a1c0d | P2 | API Completeness | ~30+ handlers across communication/, comms/, email/, notifs/ have no spec Section 10 declaration. Spec declares 9 endpoints; implementation has ~50+. Message CRUD, subscription topic admin, saved segments, all email/ endpoints, all notifs/ endpoints, all comms/ endpoints are undeclared. | All directories | MEDIUM |
| EM-M07-8e7f6a5b | P2 | Auth/Permission | `createAnnouncement` checks session but no role guard. Spec says "Send broadcast: president, secretary" only. Route middleware uses broad `association:officer` role. Any officer can create announcements. | `communication/createAnnouncement.ts` | MEDIUM |
| EM-M07-d0c9b8a7 | P2 | Business Rules | M7-R6: "IF high-priority notification THEN push regardless of preference." No priority override logic found in any handler. Security alerts and dues-overdue notifications do not bypass member preferences. | All handlers | MEDIUM |
| EM-M07-4f3e2d1c | P2 | Business Rules | BR-26: Per-category channel preferences only partially implemented. Opt-out check in `processAnnouncementSend` checks global `personSubscriptions.enabled=false` but not per-category toggles. | `communication/jobs/announcementSend.ts` | MEDIUM |
| EM-M07-5a4b3c2d | P2 | Data Model | `communications/` directory is empty (0 files). CLAUDE.md describes it as "Announcements (8 handlers, hand-wired)" but announcements live in `communication/`. Vestigial empty dir. | `handlers/communications/` | LOW |
| EM-M07-6c5d4e3f | P2 | Observability | Spec Section 17 declares 4 metrics (`comm.announcements_sent`, `comm.email_queue_depth`, `comm.push_delivery_rate`, `comm.scheduled_processing_latency`). No metric emission found. Handlers use structured Pino logging only. | All handlers | LOW |
| EM-M07-7d6e5f4a | P3 | State Machine | `scheduledFailed` in schema enum but not in spec state diagram. No handler or job sets this status. Dead enum value. | `communication/repos/communication.schema.ts` | LOW |
| EM-M07-8e7f6a5c | P3 | Observability | Spec Section 18 declares 3 feature flags (`ff_scheduled_messages`, `ff_push_notifications`, `ff_email_broadcasts`). No feature flag checks in any handler. | All handlers | LOW |

---

## Workflow Conformance

| Workflow | Spec ID | Status | Notes |
|----------|---------|--------|-------|
| Send Announcement | WF-046 | IMPLEMENTED | Full create -> publish -> multi-channel fan-out. pg-boss cron for scheduled. Missing: cancel flow. |
| Message Templates | WF-047 | IMPLEMENTED | Full CRUD with Handlebars rendering and merge field support. |
| Email Opt-Out | WF-050 | PARTIAL | Opt-out checked during announcement send via `personSubscriptions`. No self-service unsubscribe flow connected to communication/ (email/ has `unsubscribeEmail` but separate subsystem). |
| Real-time Chat | WF-048 | IMPLEMENTED | WebSocket chat rooms in comms/ with full CRUD. |
| Video Calls | WF-049 | IMPLEMENTED | WebRTC signaling via comms/ handlers. |

---

## Data Model Conformance

| Spec Entity | Schema Table | Status |
|-------------|-------------|--------|
| Announcement (11 cols) | `announcement` | EXISTS |
| AnnouncementStats (6 cols) | `announcement_stats` | EXISTS |
| MessageTemplate (9 cols) | `message_template` | EXISTS |
| SubscriptionTopic (5 cols) | `subscription_topic` | EXISTS |
| PersonSubscription (3 cols) | `person_subscription` | EXISTS |

**Extra (not in spec):** `message`, `saved_segment`, `feed_post`, `feed_post_reaction`, `feed_post_report`, `feed_muted_author` (M13), `chat_room`, `chat_room_member`, `chat_message`, `chat_message_reaction` (comms), `email_template`, `email_queue`, `email_suppressions` (email), `notification` (notifs).

---

## State Machine Conformance

### Announcement Status

| Transition | Spec | Schema | Handler | Gap |
|-----------|------|--------|---------|-----|
| Draft -> Sent (publish) | YES | YES | `publishAnnouncement.ts` | -- |
| Draft -> Scheduled | YES | YES | `scheduleMessage.ts` | -- |
| Scheduled -> Sent (process) | YES | YES | pg-boss cron job | -- |
| Sent -> Archived | YES | YES | `archiveAnnouncement.ts` | -- |
| Draft -> Cancelled | YES | **NO `cancelled` enum** | **NO handler** | P0 |
| Scheduled -> Cancelled | YES | **NO `cancelled` enum** | **NO handler** | P0 |
| * -> scheduledFailed | **NOT IN SPEC** | YES | No handler sets it | P3 |

### Message Status
Fully aligned: `draft`, `scheduled`, `sending`, `sent`, `cancelled`, `failed` all in schema and spec.

---

## Remediation Priority

### P0 -- Must fix
1. **EM-M07-f4a1e8b2:** Add `cancelled` to `announcementStatusEnum`. Create `cancelAnnouncement` handler.
2. **EM-M07-91e0c7f3:** Add deceased/suppressed person check to `processAnnouncementSend` before delivery.
3. **EM-M07-b5d4e3f2:** Create `communication.tsp` TypeSpec definition for announcement/template/subscription endpoints.
4. **EM-M07-d3c2b1a0:** Emit domain events from `publishAnnouncement`, `createChatRoom`, `scheduleMessage`.

### P1 -- Should fix
5. **EM-M07-a8f7e6d5:** Create `getAnnouncementStats` handler and route.
6. **EM-M07-c4b3a2e1:** Wire `cross-module-triggers.ts` to domain event bus for consumed events.
7. **EM-M07-e2d1c0b9:** Add president role + 2FA check to `createSubscriptionTopic`.
8. **EM-M07-7a6b5c4d:** Extract professional feed files to `handlers/feed/` directory.
9. **EM-M07-f9e8d7c6:** Create `email.tsp` and `notifs.tsp` TypeSpec definitions.

### P2 -- Nice to have
10. Add all implemented endpoints to spec Section 10.
11. Tighten `createAnnouncement` role check to president+secretary.
12. Implement M7-R6 high-priority preference override.
13. Add operational metrics per spec Section 17.
14. Delete empty `communications/` directory.

### P3 -- Low priority
15. Add `scheduledFailed` to spec or remove from schema.
16. Implement feature flag checks.


---

*Re-validated by /oli-check --enforcement on 2026-06-02T00:00:00Z. Baseline v50 confirms no drift; no new findings; no resolved findings. Working-tree changes since map v6 are limited to 12 frontend UX-polish files + 7 generated SDK/OpenAPI files — no structural change touches this module enforcement surface. Trust context: STALE-OVERLAP on map; this report findings remain accurate per baseline.*
