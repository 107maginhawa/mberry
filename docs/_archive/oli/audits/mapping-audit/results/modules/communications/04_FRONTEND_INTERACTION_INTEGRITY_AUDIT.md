# Audit 04 — Frontend Interaction Integrity
## Module: Communications
**Scope:** `apps/memberry` + `apps/admin` — all interactive elements across `communication/` (28 handlers), `comms/` (11 handlers), and admin comms pages.
**Date:** 2026-05-26
**Auditor:** Claude Code (automated static analysis)
**Prior audit refs:** M5 (hardcoded admin stats confirmed)

---

## Section 1 — Interactive Element Inventory

### 1.1 Officer Communications Hub (`/org/$orgSlug/officer/communications`)

| Element | Component | Handler / Action |
|---|---|---|
| Tab bar (All / Sent / Scheduled / Drafts / Archived) | `AnnouncementList` | Sets `activeTab` state → re-queries `api.get` |
| Search input | `AnnouncementList` | Sets `search` state → re-queries |
| "New Message" button (`Link` to `.../new`) | Route `communications/index.tsx` | Navigation only |
| Announcement row click | `AnnouncementList` → `Link` | Navigates to `/$announcementId` detail |
| Stat cards (Total Sent, Total, Channels Used) | `AnnouncementList` | Rendered from live API data |

### 1.2 Compose Form (`/officer/communications/new`, edit via `?edit=<id>`)

| Element | Component | Handler / Action |
|---|---|---|
| Title input | `ComposeForm` | `register('title')`, validated |
| Content textarea | `ComposeForm` | `register('content')`, validated |
| Audience type picker (all / by_category) | `ComposeForm` | `Controller` field |
| Audience categories (conditional) | `ComposeForm` | Shown when `audienceType === 'by_category'` |
| Push channel toggle | `ComposeForm` | `Switch` → `channelPush` boolean |
| Email channel toggle | `ComposeForm` | `Switch` → `channelEmail` boolean |
| Visibility picker (internal / network) | `ComposeForm` | `Controller` field |
| Scheduled date-time picker | `ComposeForm` | `DateTimePicker` → `scheduledAt` |
| "Send Now" button | `ComposeForm` | `mutation.mutate('sent')` |
| "Save Draft" button | `ComposeForm` | `mutation.mutate('draft')` |
| "Schedule" button | `ComposeForm` | `mutation.mutate('scheduled')` |
| Server error display | `ComposeForm` | `setServerError` on `onError` |

### 1.3 Announcement Detail — Officer (`/officer/communications/$announcementId`)

| Element | Component | Handler / Action |
|---|---|---|
| Page render | Route component | `api.get` call (raw, not SDK hook) |
| Edit button | Route | Navigates to `/new?edit=<id>` |
| Archive button | Route | `api.patch` or `api.delete` (see §5 for modal gap) |
| Publish button | Route | Status transition via API |

### 1.4 Sent History (`/officer/communications/sent`)

| Element | Component | Handler / Action |
|---|---|---|
| Sent announcements table | `SentHistoryPage` | `useQuery` → `api.get` `/api/communications/announcements?organizationId=&status=sent` |
| Loading skeleton | `ListSkeleton` | `isLoading` guard |
| Delivery stat badges (recipients, emailSent, pushDelivered, inappViews) | Row render | From `stats` object on each announcement |

### 1.5 Analytics Dashboard (`/officer/communications/analytics`)

| Element | Component | Handler / Action |
|---|---|---|
| Analytics list | `AnalyticsDashboardPage` | `useQuery` → `api.get` (raw) |
| `DeliveryFunnel` chart | `DeliveryFunnel` | Receives per-row `stats` data |
| Loading skeleton | `ListSkeleton` | `isLoading` guard |

### 1.6 Templates (`/officer/communications/templates`)

| Element | Component | Handler / Action |
|---|---|---|
| Template list table | `TemplateList` | `useQuery` → `api.get` `/api/association/message-templates?organizationId=` |
| Search input | `TemplateList` | Client-side filter on `templates` array |
| "New Template" button | `TemplateListPage` | `navigate` to `.../templates/new` |
| Edit row button | `TemplateList` | Calls `onEdit(templateId)` → navigates to `.../new?edit=<id>` |
| Delete row button | `TemplateList` | `deleteMutation` → `api.delete` → `toast.success/error` |
| Template form (new/edit) | `TemplateForm` | Zod-validated, `api.post`/`api.patch` |

### 1.7 Chat / Messages (`/org/$orgSlug/messages`)

| Element | Component | Handler / Action |
|---|---|---|
| Channel list sidebar | `ChannelList` | `useQuery(listChatRoomsOptions)` — SDK hook |
| Channel row click | `ChannelList` | `onSelectRoom(roomId)` prop callback |
| "Create Channel" button (officers) | `ChannelList` | Opens `CreateChannelDialog` |
| Create channel dialog | `CreateChannelDialog` | `createChatRoomMutation()` — SDK mutation |
| Chat view message list | `ChatView` | `useQuery(getChatMessagesOptions)` — SDK hook |
| Message input | `MessageComposer` | Text input, Enter key or send button |
| Send button | `MessageComposer` | `sendChatMessageMutation()` — SDK mutation |
| Typing indicator | `TypingIndicator` | WebSocket `chat.typing` event |
| Thread panel trigger | `ChatView` | `setThreadMessage` on message click |
| Video call panel trigger | `VideoCallPanel` | `enabled` prop + "Start Call" button |
| Reconnection banner | `ChatView` | `isReconnecting` state from `useChatWebSocket` |

### 1.8 DM Page (`/org/$orgSlug/messages/dm`)

| Element | Component | Handler / Action |
|---|---|---|
| DM list sidebar | `DmList` | `useQuery(listChatRoomsOptions)` — SDK hook, filtered to 2-participant rooms |
| DM row click | `DmList` | `onSelectRoom(roomId)` prop callback |
| "New DM" button | `DmList` | `onNewDm` prop callback (no dialog implemented — see §4) |

### 1.9 Video Call

| Element | Component | Handler / Action |
|---|---|---|
| "Start Call" button | `VideoCallPanel` | `setActive(true)` — locally activates peer connection |
| Join API call | `VideoCallPanel` | `joinVideoCallMutation()` — SDK mutation |
| Leave API call | `VideoCallPanel` | `leaveVideoCallMutation()` on unmount |
| ICE servers fetch | `VideoCallPanel` | `getIceServersOptions()` — SDK query, lazy (only when `active=true`) |
| Mic toggle | `CallControls` | `onToggleMic` → `useMediaStream.toggleMic()` |
| Camera toggle | `CallControls` | `onToggleCamera` → `useMediaStream.toggleCamera()` |
| Screen share toggle | `CallControls` | `onStartScreenShare`/`onStopScreenShare` |
| End call button | `CallControls` | `onEndCall` → `leave.mutate()` + cleanup |

### 1.10 Admin Communications Pages

| Page | Element | Handler / Action |
|---|---|---|
| `/communications` | Stat cards | **Hardcoded literals** ("34", "1,247", "12", "5") |
| `/communications` | Broadcast form | Placeholder `<p>` — not implemented |
| `/communications` | Recent broadcasts list | Hardcoded "No broadcasts sent yet." |
| `/communications/templates` | "New Template" button | Renders `<Button>` with no `onClick` handler |
| `/communications/templates` | Category filter tabs | Renders buttons — no filter logic |
| `/communications/templates` | Template list | Hardcoded empty state — never loads data |

---

## Section 2 — Handler Wiring Verification

### 2.1 Backend Handler Coverage (comms module)

All 11 `comms/` handlers confirmed present:
- `createChatRoom.ts`, `getChatRoom.ts`, `listChatRooms.ts`
- `getChatMessages.ts`, `sendChatMessage.ts`
- `joinVideoCall.ts`, `leaveVideoCall.ts`, `endVideoCall.ts`, `updateVideoCallParticipant.ts`
- `getIceServers.ts`
- `ws.chat-room.ts` (WebSocket handler at `/ws/comms/chat-rooms/:room`)

### 2.2 Backend Handler Coverage (communication module)

28 handlers confirmed, including:
- `createAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts`
- `createMessageTemplate.ts`, `createMessage.ts`, `cancelMessage.ts`
- `bulkUpdatePersonSubscriptions.ts`, `createSubscriptionTopic.ts`
- `createFeedPost.ts`, `createPoll.ts`, `createSurvey.ts`
- `createSavedSegment.ts`

### 2.3 SDK Hook Usage vs Raw API Calls

| Surface | Method | Assessment |
|---|---|---|
| `ChannelList` | `listChatRoomsOptions` (SDK) | Correct |
| `DmList` | `listChatRoomsOptions` (SDK) | Correct |
| `ChatView` messages | `getChatMessagesOptions` (SDK) | Correct |
| `MessageComposer` send | `sendChatMessageMutation` (SDK) | Correct |
| `VideoCallPanel` join | `joinVideoCallMutation` (SDK) | Correct |
| `VideoCallPanel` ICE | `getIceServersOptions` (SDK) | Correct |
| `CreateChannelDialog` | `createChatRoomMutation` (SDK) | Correct |
| `AnnouncementList` | `api.get` (raw) | [LIKELY BUG] No SDK hook used |
| `SentHistoryPage` | `api.get` (raw) | [LIKELY BUG] No SDK hook used |
| `AnalyticsDashboardPage` | `api.get` (raw) | [LIKELY BUG] No SDK hook used |
| `ComposeForm` create/update | `api.post`/`api.patch` (raw) | [LIKELY BUG] No SDK mutation used |
| `TemplateList` data fetch | `api.get` (raw) | [LIKELY BUG] No SDK hook used |
| `TemplateList` delete | `api.delete` (raw) | [LIKELY BUG] No SDK mutation used |
| `TemplateForm` create/update | `api.post`/`api.patch` (raw) | [LIKELY BUG] No SDK mutation used |

---

## Section 3 — WebSocket Interaction Audit

### 3.1 Frontend WebSocket (`useChatWebSocket`)

- **URL construction:** `${protocol}//${window.location.host}/api/ws/comms/chat-rooms/${roomId}`
- **Reconnection:** Exponential backoff implemented via `retryCountRef`
- **Keep-alive:** Ping every 30 seconds when connected
- **Typing events:** Throttled to once per 2 seconds via `MessageComposer`
- **Message dedup:** ChatView checks `m.id` before appending optimistic messages
- **Reconnection UI:** `WifiOff` icon + banner shown when `isReconnecting === true`

**Status: Correctly implemented.** WebSocket path matches backend `ws.chat-room.ts` config at `/ws/comms/chat-rooms/:room`.

### 3.2 Backend WebSocket Handler (`ws.chat-room.ts`)

Message types handled:
- `chat.message` — broadcast to room channel
- `chat.typing` — broadcast typing event
- `video.offer`, `video.answer`, `video.ice-candidate` — WebRTC signaling relay
- `ping` — pong response

Auth: `authMiddleware()` applied. Room participant check performed on `onConnect`.

**Status: Correctly implemented.**

### 3.3 WebSocket URL Mismatch Risk

Frontend sends to: `/api/ws/comms/chat-rooms/${roomId}`
Backend registers at: `/ws/comms/chat-rooms/:room`

The Vite proxy strips `/api` prefix. This alignment depends on the proxy config stripping `/api` for WebSocket upgrades as well as HTTP.

**[E2E GAP] P2** — No E2E test confirms WebSocket upgrade succeeds end-to-end. A misconfigured proxy for WS upgrades would silently fail.

---

## Section 4 — Video Call Interaction Audit

### 4.1 Call Initiation Flow

1. `VideoCallPanel` renders with `enabled` prop (controlled by booking time window).
2. When `enabled=false`, a disabled-state card is shown — no start button rendered.
3. When `enabled=true`, "Start / Join Call" button calls `setActive(true)`.
4. `active=true` triggers lazy fetch of ICE servers via SDK query.
5. On ICE servers available: `VideoPeerConnection` constructed, `joinVideoCallMutation` fired.
6. `useVideoCall` hook wires peer connection state to `VideoCallUI` props.

**Status: Correctly wired.**

### 4.2 Call Controls

| Control | onClick | Disabled State |
|---|---|---|
| Mic toggle | `onToggleMic` prop | None (always clickable) |
| Camera toggle | `onToggleCamera` prop | None (always clickable) |
| Screen share | `onStartScreenShare`/`onStopScreenShare` | None |
| End call | `onEndCall` → `leave.mutate()` | None |

**[LIKELY BUG] P2** — End call button has no loading/pending state. If `leave.mutate()` is slow, user can click multiple times, causing duplicate `leaveVideoCall` API calls.

### 4.3 Video Call Panel `enabled` Prop

The `VideoCallPanel` accepts an `enabled` prop but the chat route (`/messages`) does not clearly set this based on booking context. Chat rooms are general-purpose; video calls require a "booking confirmed + within ±15min" guard per the component JSDoc.

**[LIKELY BUG] P2** — If `VideoCallPanel` is rendered in the chat route with `enabled` always true (no booking context), any user can start a call at any time, bypassing the intended scheduling guard.

### 4.4 ICE Server Token

`joinVideoCall.ts` generates a token via `generateWebRTCToken(user.id, activeCall.id)` but the function is partially deferred ("Generate sh..." cut in source). The frontend `VideoPeerConnection` receives this token but the WebSocket signaling server uses cookie-based auth.

**[LIKELY BUG] P1** — Token generation for WebRTC signaling may be a no-op stub. If the signaling WebSocket rejects connections without a valid token, video calls silently fail after join API succeeds.

---

## Section 5 — Navigation & Route Coverage

### 5.1 Officer Communications Routes

| Route | File | Status |
|---|---|---|
| `/officer/communications` (index) | `communications/index.tsx` | Renders `AnnouncementList` |
| `/officer/communications/new` | `communications/new.tsx` | Renders `ComposeForm` |
| `/officer/communications/$announcementId` | `communications/$announcementId.tsx` | Detail view |
| `/officer/communications/sent` | `communications/sent.tsx` | Sent history table |
| `/officer/communications/analytics` | `communications/analytics.tsx` | Delivery dashboard |
| `/officer/communications/templates` | `communications/templates/index.tsx` | Template list |
| `/officer/communications/templates/new` | `communications/templates/new.tsx` | Template create/edit |

All routes file-present and registered.

### 5.2 Missing Routes

- No `/officer/communications/templates/$templateId` — template detail view absent. Edit uses `?edit=` query param on the new route instead.
- No `/officer/communications/segments` route in memberry app (segment management is API-only or admin-only).

### 5.3 DM "New DM" Action

`DmList` exposes `onNewDm` callback prop. The messages route must pass a handler. No DM creation dialog or navigation target was found.

**[LIKELY BUG] P2** — "New DM" button renders but clicking it likely does nothing if the parent route passes no `onNewDm` handler, or if the handler opens a dialog that does not exist.

---

## Section 6 — State Management & Loading/Error Patterns

### 6.1 Loading States

| Surface | Loading Treatment |
|---|---|
| `AnnouncementList` | `isLoading` → `<Skeleton>` elements inline |
| `SentHistoryPage` | `isLoading` → `<ListSkeleton>` |
| `AnalyticsDashboardPage` | `isLoading` → `<ListSkeleton>` |
| `TemplateList` | `isLoading` → `<TableSkeleton rows={5} cols={5}>` |
| `ChatView` messages | `messagesQuery.isLoading` → `<Skeleton>` rows |
| `ChannelList` | `roomsQuery.isLoading` → `<Skeleton>` rows |
| `DmList` | `roomsQuery.isLoading` → `<Skeleton>` rows |
| `VideoCallPanel` | `join.isPending` not reflected in button state |

**[LIKELY BUG] P2** — `VideoCallPanel` "Start Call" button has no `isPending` disable guard while `join.mutate()` is in flight.

### 6.2 Error States

- `ComposeForm`: `setServerError` on mutation error — displays inline `<p>` with error message. Correct.
- `MessageComposer`: `toast.error('Could not send message')` on send failure. Correct.
- `TemplateList` delete: `toast.error('Failed to delete template')`. Correct.
- `CreateChannelDialog`: `toast.error('Failed to create channel')`. Correct.
- `SentHistoryPage`, `AnalyticsDashboardPage`, `AnnouncementList`: No error state UI — query errors silently render empty. **[E2E GAP] P2**

---

## Section 7 — Admin App Interaction Audit

### 7.1 `/communications` (Platform Broadcasts)

| Element | Behavior | Severity |
|---|---|---|
| Stat card "Broadcasts Sent" | Value hardcoded `"34"` | P1 |
| Stat card "Total Recipients" | Value hardcoded `"1,247"` | P1 |
| Stat card "Email Queue" | Value hardcoded `"12"` | P1 |
| Stat card "Flagged Content" | Value hardcoded `"5"` | P1 |
| Broadcast form area | Placeholder text only, no form | P1 |
| Recent broadcasts list | Hardcoded "No broadcasts sent yet." | P1 |

**All admin broadcast page interactive content is non-functional.** [LIKELY BUG] P1

### 7.2 `/communications/templates` (Platform Templates)

| Element | Behavior | Severity |
|---|---|---|
| "New Template" button | `<Button>` renders but has **no `onClick`** handler | P1 |
| Category filter buttons (All / Email / Push / In-App) | No filter logic — always shows empty state | P1 |
| Template list | Hardcoded empty state, no API call | P1 |

### 7.3 Missing Admin Routes

- `/communications/email` — Not found in admin routes directory. Listed in audit context as "email queue monitoring" but route file absent.
- `/communications/moderation` — Not found in admin routes directory. Listed as "content moderation queue" but route file absent.

**[LIKELY BUG] P1** — Two documented admin routes do not exist. Navigation links (if any) to these routes would 404.

---

## Section 8 — Auth & Role Gating

### 8.1 Officer Hub
- Officer communications routes are under `/_authenticated/org/$orgSlug/officer/` — requires auth session.
- No explicit role check observed at the route level for officer-specific pages.

**[LIKELY BUG] P2** — Any authenticated member who navigates to `/org/$orgSlug/officer/communications` directly may access officer-only compose and publish actions without a role guard.

### 8.2 Admin
- Admin comms routes use `<RequireRole allowed={['super', 'support']}>` — correctly gated.
- Templates page uses `<RequireRole allowed={['super']}>` only — more restrictive than broadcasts page.

---

## Section 9 — Feedback & Notification Patterns

### 9.1 Toast Usage
All mutation success/error feedback in `comms/` uses `sonner` toast. Correct per CLAUDE.md convention.

### 9.2 Missing Feedback
- `ComposeForm` success: navigates silently to communications index. No success toast shown.
- `AnnouncementList` stats query failure: silent — user sees `—` dashes with no explanation.

---

## Section 10 — E2E Test Coverage Gaps

| Flow | E2E Covered | Gap |
|---|---|---|
| Compose + send announcement | Unknown | [E2E GAP] P1 |
| Edit draft via `?edit=` param | Unknown | [E2E GAP] P1 |
| Tab switching in announcement list | Unknown | [E2E GAP] P2 |
| Template create / edit / delete | Unknown | [E2E GAP] P2 |
| Chat WebSocket connect + send message | Unknown | [E2E GAP] P1 |
| Video call start / join / end | Unknown | [E2E GAP] P1 |
| WebSocket reconnection behavior | Unknown | [E2E GAP] P2 |
| Admin broadcast stat cards (verify not hardcoded) | Unknown | [E2E GAP] P1 |
| DM "New DM" action | Unknown | [E2E GAP] P2 |

---

## Gate 4 — Frontend Interaction Integrity

| Check | Result |
|---|---|
| All buttons have `onClick` or form submit handlers | FAIL — admin templates "New Template" has no handler |
| All interactive elements reach a real backend handler | FAIL — admin broadcast page is entirely placeholder |
| WebSocket integration tested or verifiably wired | PARTIAL — correctly wired, no E2E coverage |
| Video call flow end-to-end wired | PARTIAL — wired; token generation possibly stub |
| No orphaned nav links | FAIL — `/communications/email`, `/communications/moderation` routes absent |
| Raw `api.*` calls replaced with SDK hooks | FAIL — 7 surfaces use raw API instead of SDK |
| Auth/role guards on officer-write routes | FAIL — no explicit role check on officer comms routes |

**Gate 4 status: FAIL**

### Issue Summary

| Severity | Count | Key Issues |
|---|---|---|
| P0 | 0 | — |
| P1 | 8 | Admin hardcoded stats (×4 cards), admin broadcast form placeholder, admin "New Template" no handler, missing admin routes (email, moderation) |
| P2 | 7 | Raw API instead of SDK (×7 surfaces), end call double-fire, video panel enabled guard, WS proxy E2E gap, DM new action missing, officer role guard missing |
| P3 | 2 | Missing success toast on compose, silent query errors in announcement list |

---

*End of Audit 04*
