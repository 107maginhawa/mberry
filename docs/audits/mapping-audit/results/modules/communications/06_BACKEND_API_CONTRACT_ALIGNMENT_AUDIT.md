# Audit 06 — Backend / API Contract Alignment
## Module: Communications (communication/ + communications/ + comms/)
**Date:** 2026-05-26
**Auditor:** Automated Mapping Audit
**Severity scale:** P0 = data loss / security breach · P1 = broken feature · P2 = degraded UX · P3 = tech debt

---

## 06-1. Endpoint Catalogue

### Sub-module A: `communication/` — Templated Messaging (TypeSpec-generated)

| # | Method | Path | Auth Roles | Handler | Status |
|---|--------|------|------------|---------|--------|
| 1 | POST | `/association/message-templates` | admin, coordinator | createMessageTemplate | Implemented |
| 2 | GET | `/association/message-templates` | admin, coordinator, member | searchMessageTemplates | Implemented |
| 3 | GET | `/association/message-templates/:templateId` | admin, coordinator, member | getMessageTemplate | Implemented |
| 4 | PATCH | `/association/message-templates/:templateId` | admin, coordinator | updateMessageTemplate | Implemented |
| 5 | DELETE | `/association/message-templates/:templateId` | admin, coordinator | deleteMessageTemplate | Implemented |
| 6 | POST | `/association/message-templates/:templateId/preview` | admin, coordinator | previewMessageTemplate | Implemented |
| 7 | POST | `/association/messages` | admin, coordinator | createMessage | Implemented |
| 8 | GET | `/association/messages` | admin, coordinator, member | searchMessages | Implemented |
| 9 | GET | `/association/messages/:messageId` | admin, coordinator, member | getMessage | Implemented |
| 10 | PATCH | `/association/messages/:messageId` | admin, coordinator | updateMessage | Implemented |
| 11 | DELETE | `/association/messages/:messageId` | admin, coordinator | deleteMessage | Implemented |
| 12 | POST | `/association/messages/:messageId/cancel` | admin, coordinator | cancelMessage | Implemented |
| 13 | POST | `/association/messages/:messageId/schedule` | admin, coordinator | scheduleMessage | Implemented |
| 14 | POST | `/association/messages/:messageId/send` | admin, coordinator | sendMessage | Implemented |
| 15 | POST | `/association/subscription-topics` | admin, coordinator | createSubscriptionTopic | Implemented |
| 16 | GET | `/association/subscription-topics` | admin, coordinator, member | listSubscriptionTopics | Implemented |
| 17 | POST | `/association/persons/:personId/subscriptions/bulk` | admin, coordinator | bulkUpdatePersonSubscriptions | Implemented |
| 18 | GET | `/association/persons/:personId/subscriptions` | admin, coordinator, member | getPersonSubscriptions | Implemented |
| 19 | POST | `/association/surveys` | admin, coordinator | createSurvey | Implemented |
| 20 | GET | `/association/surveys` | admin, coordinator, member | listSurveys | Implemented |
| 21 | POST | `/association/polls` | admin, coordinator | createPoll | Implemented |
| 22 | GET | `/association/polls` | admin, coordinator, member | listPolls | Implemented |
| 23 | POST | `/association/feed` | admin, coordinator, member | createFeedPost | Implemented |
| 24 | GET | `/association/feed` | admin, coordinator, member | listFeedPosts | Implemented |
| 25 | GET | `/association/feed/:postId` | admin, coordinator, member | getFeedPost | Implemented |
| 26 | DELETE | `/association/feed/:postId` | admin, coordinator | deleteFeedPost | Implemented |
| 27 | POST | `/association/segments` (generated) | admin, coordinator | createSavedSegment | **DUPLICATE** |

### Sub-module B: `communications/` — Announcements (hand-wired in app.ts)

| # | Method | Path | Auth Roles | Handler | Status |
|---|--------|------|------------|---------|--------|
| 1 | GET | `/communications/announcements/detail/:id` | association:member | getAnnouncement | Implemented |
| 2 | PATCH | `/communications/announcements/:id` | association:officer | updateAnnouncement | Implemented |
| 3 | DELETE | `/communications/announcements/:id` | association:officer | deleteAnnouncement | Implemented |
| 4 | POST | `/communications/announcements/:id/archive` | association:officer | archiveAnnouncement | Implemented |
| 5 | POST | `/communications/announcements/:id/publish` | association:officer | publishAnnouncement | Implemented |
| 6 | GET | `/communications/announcements/:organizationId` | association:member | listAnnouncements | Implemented |
| 7 | POST | `/communications/announcements/:organizationId` | association:officer | createAnnouncement | Implemented |
| 8 | POST | `/communications/segments` (generated route) | admin, coordinator | createSavedSegment | **DUPLICATE — see §06-4** |
| 9 | GET | `/communications/segments` (generated route) | admin, coordinator | listSavedSegments | **DUPLICATE — see §06-4** |
| 10 | DELETE | `/communications/segments/:id` (generated route) | admin, coordinator | deleteSavedSegment | **DUPLICATE — see §06-4** |
| 11 | POST | `/communications/segments` (hand-wired, app.ts:319) | bare authMiddleware() | createSavedSegment | **DUPLICATE** |
| 12 | GET | `/communications/segments` (hand-wired, app.ts:320) | bare authMiddleware() | listSavedSegments | **DUPLICATE** |
| 13 | DELETE | `/communications/segments/:id` (hand-wired, app.ts:321) | bare authMiddleware() | deleteSavedSegment | **DUPLICATE** |

### Sub-module C: `comms/` — Real-Time Chat + Video (TypeSpec-generated)

| # | Method | Path | Auth Roles | Handler | Status |
|---|--------|------|------------|---------|--------|
| 1 | POST | `/comms/chat-rooms` | user | createChatRoom | Implemented |
| 2 | GET | `/comms/chat-rooms` | user | listChatRooms | Implemented |
| 3 | GET | `/comms/chat-rooms/:room` | user | getChatRoom | Implemented |
| 4 | GET | `/comms/chat-rooms/:room/messages` | user | getChatMessages | Implemented |
| 5 | POST | `/comms/chat-rooms/:room/messages` | user | sendChatMessage | Implemented |
| 6 | POST | `/comms/chat-rooms/:room/video-call/end` | user:admin | endVideoCall | Implemented |
| 7 | POST | `/comms/chat-rooms/:room/video-call/join` | user | joinVideoCall | Implemented |
| 8 | POST | `/comms/chat-rooms/:room/video-call/leave` | user | leaveVideoCall | Implemented |
| 9 | PATCH | `/comms/chat-rooms/:room/video-call/participant` | user | updateVideoCallParticipant | Implemented |
| 10 | GET | `/comms/ice-servers` | user | getIceServers | Implemented |
| 11 | WS | `/ws/comms/chat-rooms/:room` | authMiddleware() | ws.chat-room | Implemented |

---

## 06-2. Frontend → Backend Endpoint Mapping

### Memberry app (memberry/)

| Frontend location | HTTP call | Backend endpoint | Match? |
|---|---|---|---|
| `announcements/index.tsx` | `api.get(/api/communications/announcements/${orgId}?status=sent)` | `GET /communications/announcements/:organizationId` | OK |
| `announcements/$announcementId.tsx` | `api.get(/api/communications/announcements/detail/${announcementId})` | `GET /communications/announcements/detail/:id` | OK |
| `officer/communications/index.tsx` | Delegates to `<AnnouncementList>` component | `GET /communications/announcements/:organizationId` | OK |
| `officer/communications/new.tsx` (edit draft) | `api.get(/api/communications/announcements/detail/${edit})` | `GET /communications/announcements/detail/:id` | OK |
| `officer/communications/$announcementId.tsx` | `api.get(/api/communications/announcements/detail/${announcementId})` | `GET /communications/announcements/detail/:id` | OK |
| `officer/communications/$announcementId.tsx` | `api.post(/api/communications/announcements/${announcementId}/publish)` | `POST /communications/announcements/:id/publish` | OK |
| `officer/communications/$announcementId.tsx` | `api.post(/api/communications/announcements/${announcementId}/archive)` | `POST /communications/announcements/:id/archive` | OK |
| `officer/communications/sent.tsx` | `api.get(/api/communications/announcements?organizationId=${orgId}&status=sent)` | `GET /communications/announcements/:organizationId` | **MISMATCH — see §06-5** |
| `officer/communications/analytics.tsx` | `api.get(/api/communications/announcements/${orgId}?status=sent)` | `GET /communications/announcements/:organizationId` | OK |
| `compose-form.tsx` (create) | `api.post(/api/communications/announcements/${orgId}, data)` | `POST /communications/announcements/:organizationId` | OK |
| `compose-form.tsx` (update) | `api.patch(/api/communications/announcements/${existingAnnouncement.id}, data)` | `PATCH /communications/announcements/:id` | OK |
| `messages/index.tsx` | SDK: `getPersonOptions`, REST via `ChatView`/`ChannelList` components | `GET /comms/chat-rooms`, WebSocket `/ws/comms/chat-rooms/:room` | OK |
| `messages/dm/index.tsx` | SDK: `getPersonOptions`, REST via `DmList`/`ChatView` | `GET /comms/chat-rooms`, WebSocket `/ws/comms/chat-rooms/:room` | OK |

### Admin app (admin/)

| Frontend location | HTTP call | Backend endpoint | Match? |
|---|---|---|---|
| `communications/index.tsx` | **NONE — hardcoded static values** | n/a | **[LIKELY BUG] P1** |
| `communications/templates.tsx` | **NONE — empty shell UI** | n/a | **[LIKELY BUG] P1** |
| `communications/email.tsx` | **NONE — no API call found** | n/a | **[LIKELY BUG] P1** |
| `communications/moderation.tsx` | **NONE — placeholder UI** | n/a | **[LIKELY BUG] P1** |

---

## 06-3. Auth Role Alignment

### communication/ sub-module

Auth roles defined in TypeSpec are propagated correctly through generated validators. No misalignments found. The `createMessageTemplate` handler manually checks for `user` and `organizationId` context — consistent with `admin, coordinator` restriction.

### communications/ sub-module

Announcement endpoints use `association:member` (read) and `association:officer` (write) via the generated route middleware. This aligns with business intent.

**No misalignment on announcement endpoints.**

### comms/ sub-module

Chat room endpoints use a generic `user` role — any authenticated user can create/join rooms. This is appropriate for DM use cases (member-to-member). The `endVideoCall` endpoint uses `user:admin` (room admin, not platform admin), which is correct.

**No misalignment on comms endpoints.**

---

## 06-4. Segments Route Duplication [LIKELY BUG] — P1

**Finding:** The `/communications/segments` CRUD routes are registered **twice**:

1. **Generated route** (from TypeSpec/OpenAPI): role-restricted to `admin, coordinator`
2. **Hand-wired in `app.ts` lines 319–321**: uses bare `authMiddleware()` — **no role restriction**

```
// app.ts Wave 4β hand-wiring:
app.post('/communications/segments', authMiddleware(), createSavedSegment as any);
app.get('/communications/segments', authMiddleware(), listSavedSegments as any);
app.delete('/communications/segments/:id', authMiddleware(), deleteSavedSegment as any);
```

**Impact:** Hono route matching is first-match-wins. If the hand-wired routes register before the generated routes, **any authenticated user** (including plain members) can create, list, and delete saved segments — bypassing `admin, coordinator` role enforcement.

**Risk:** P1 security — privilege escalation for segment management.

**Recommendation:** Remove the 3 hand-wired lines from `app.ts`. The generated routes already handle these endpoints with proper role enforcement.

---

## 06-5. Sent History URL Mismatch — P2

**Finding:** `officer/communications/sent.tsx` constructs the list URL as:
```
/api/communications/announcements?organizationId=${orgId}&status=sent
```

The backend route signature is `GET /communications/announcements/:organizationId` — the org ID is a **path parameter**, not a query parameter. The correct URL is:
```
/api/communications/announcements/${orgId}?status=sent
```

The analytics page (`analytics.tsx`) correctly uses the path-parameter form. The `sent.tsx` page uses the query-param form. This will either silently return all records (if the handler ignores the path param and only filters by query) or return an empty/wrong dataset.

**Risk:** P2 — sent history may show incorrect data or empty results.

---

## 06-6. Admin App: Hardcoded Fake Data — P1

`apps/admin/src/routes/communications/index.tsx` renders static hardcoded values directly in JSX:

```jsx
<StatCard title="Broadcasts Sent" value="34" trend="This month" icon={Send} />
<StatCard title="Total Recipients" value="1,247" icon={Radio} />
<StatCard title="Email Queue" value="12" trend="Pending" icon={Mail} />
<StatCard title="Flagged Content" value="5" trend="Pending review" icon={ShieldAlert} />
```

No API calls are made. The broadcast form is a non-functional placeholder. `templates.tsx`, `email.tsx`, and `moderation.tsx` are similarly UI-only with no backend wiring.

**Risk:** P1 — admin operators see fabricated metrics. No real monitoring capability exists for platform-level communications.

---

## 06-7. Missing Frontend Endpoints (No Frontend Coverage)

The following backend endpoints have **no corresponding frontend page or component** in either app:

| Endpoint | Sub-module | Gap |
|---|---|---|
| `/association/message-templates` (CRUD) | communication/ | No admin/officer UI for template management in memberry (only `templates/` route shell exists) |
| `/association/messages` (CRUD, schedule, send, cancel) | communication/ | No frontend page consumes these endpoints |
| `/association/subscription-topics` | communication/ | No subscription preference UI wired to these endpoints |
| `/association/surveys`, `/association/polls` | communication/ | Survey/poll UI components exist but frontend wiring unclear |
| `/association/feed` | communication/ | Professional feed endpoints not surfaced in any route |
| `/communications/segments` | communications/ | No segment management UI in memberry |

**Risk:** P2 — backend capabilities invisible to users. Coordinator workflows completely unsupported in UI.

---

## 06-8. WebSocket Contract Coverage

The WebSocket handler at `/ws/comms/chat-rooms/:room` is implemented with:
- Auth: `authMiddleware()` (correct — participant check happens inside handler)
- Participant enforcement: verified in `onConnect` before allowing messages
- Message types: `chat.message`, `chat.typing`, `video.offer`, `video.answer`, `video.ice-candidate`, `ping`

The WebSocket path `/ws/comms/chat-rooms/:room` differs from the REST path `/comms/chat-rooms/:room`. Frontend must connect to the `/ws/` prefixed path. No contract test verifies the WS upgrade handshake.

**Risk:** P2 — WebSocket connection path assumed correct but untested by contract suite.

---

## 06-9. Response Shape Consistency

Frontend pages use `api.get<{ data: any }>()` with untyped `any` responses for all announcement endpoints. The backend returns `{ data: T }` envelopes. No TypeScript enforcement of response shape exists at the frontend call sites. Drift between backend response shape and frontend consumption is undetectable at compile time.

**Risk:** P3 — silent shape mismatch risk on future backend changes.

---

## 06-10. Sub-module Naming Confusion Risk

Three sub-modules share the communications domain:
- `communication/` — async templated messaging (TypeSpec)
- `communications/` — announcements + segments (hand-wired)
- `comms/` — real-time chat/video (TypeSpec)

The frontend uses:
- `/api/communications/announcements/...` → maps to `communications/` backend routes
- Chat SDK hooks → maps to `comms/` backend routes
- No frontend uses `/association/message-templates` or `/association/messages`

The sub-module naming creates a persistent confusion risk for future developers. No renaming is recommended at this stage (API contract established), but documentation of the bounded context split is essential.

---

## 06-11. Summary of Findings

| # | Finding | Severity | File(s) |
|---|---------|----------|---------|
| 1 | Segments routes duplicated — hand-wired strips role enforcement | P1 | `services/api-ts/src/app.ts:319-321` |
| 2 | Admin comms pages have hardcoded fake data, no API calls | P1 | `apps/admin/src/routes/communications/index.tsx`, `templates.tsx`, `email.tsx`, `moderation.tsx` |
| 3 | `sent.tsx` uses wrong URL format (query param vs path param) for org ID | P2 | `apps/memberry/.../officer/communications/sent.tsx:39` |
| 4 | No frontend coverage for 6+ backend endpoint groups | P2 | Template CRUD, message CRUD, subscriptions, surveys, polls, feed, segments |
| 5 | WebSocket path differs from REST path — no contract test for WS upgrade | P2 | `services/api-ts/src/handlers/comms/ws.chat-room.ts` |
| 6 | All announcement API calls use untyped `any` — no compile-time shape safety | P3 | Multiple route files in `apps/memberry/src/routes/` |

---

## Gate 6

**GATE STATUS: FAIL**

Blockers:
- **P1-A**: Segments route duplication bypasses role enforcement (§06-4)
- **P1-B**: Admin communications pages render hardcoded fake data with zero API integration (§06-6)

Must resolve P1 items before this gate can pass.
