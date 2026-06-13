# AHA Module/Group Gap Plan: Realtime Comms

Date: 2026-06-11
Auditor prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Realtime Comms (chat rooms, DMs, WebSocket, video calls) |
| Module slug | realtime-comms |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/realtime-comms-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m07-communications/MODULE_SPEC.md` (realtime sections: §1, §2, §7b ChatRoom aggregate, §14, §18 flags, §19 slices M07-S8/S9) |
| Supporting PRDs/specs used | `specs/api/src/modules/comms.tsp` (REST + WS protocol models), `specs/api/src/modules/comms.md` (healthcare-template residue — treated as stale), `docs/product/modules/m07-communications/NAVIGATION_MAP.md` (messages routes), memory `wave4-comms-phase1` plan notes |
| PRD/spec coverage quality | Partial — m07 covers realtime in ~6 lines; `comms.md` is stale healthcare-template content; m07 `API_CONTRACTS.md` contains **zero** realtime endpoints; WS protocol formally documented only in `comms.tsp` |
| Paths inspected | `services/api-ts/src/handlers/comms/` (all 13 handlers + 3 repos + schema), `services/api-ts/src/generated/websocket/registry.ts`, `services/api-ts/src/generated/openapi/routes.ts` (comms block ~L2672–2745), `services/api-ts/src/core/ws.ts`, `services/api-ts/src/middleware/org-context.ts`, `services/api-ts/src/app.ts` (L437–443, L621), migrations `0016`, `0019`, `0051`, `0061`, `apps/memberry/src/features/comms/**` (19 components, 4 hooks), `apps/memberry/src/routes/_authenticated/org/$orgSlug/messages/**`, `apps/memberry/src/routes/_authenticated/my/bookings/$bookingId.tsx`, `apps/memberry/vite.config.ts`, `packages/sdk-ts/src/utils/webrtc/{signaling-client,peer-connection}.ts`, `specs/api/tests/contract/comms*.hurl` |
| PRDs/specs inspected | m07 MODULE_SPEC, m07 NAVIGATION_MAP, m07 API_CONTRACTS, comms.tsp, comms.md |
| KG used | Yes (status notes only, as context per `docs/aha/kg/knowledge-graph-status.md`) |
| KG refreshed | No |
| `/understand-domain` used | Yes (status notes only) |
| `/understand-domain` refreshed | No |
| Webwright used | No |
| Playwright/E2E inspected | Yes (inventory only; not executed) |
| Existing tests inspected | 7 backend test files in `handlers/comms/`, `packages/sdk-ts/src/utils/webrtc/signaling-client.test.ts`, `apps/memberry/src/features/comms/__tests__/create-channel-dialog.test.tsx`, `channel-list.test.tsx`, `chat-thread.test.tsx`, 3 Hurl files |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | Static review sufficient; browser tooling skipped for batch run. No live WS/dev-server verification — findings about Vite WS proxying and cookie auth over cross-port WS are marked `[NEEDS CONFIRMATION]`. `handlers/communication/` (async broadcast) explicitly out of scope. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M07 Module Spec | `docs/product/modules/m07-communications/MODULE_SPEC.md` | PRD/module spec | Current (2026-05-21) | Defines realtime as slices M07-S8 (Chat Rooms, P1) and M07-S9 (Video Calls, P2); ChatRoom aggregate invariants ("Participants tracked. Messages immutable after send."); `comms_video_calls` flag default **false** |
| Comms TypeSpec | `specs/api/src/modules/comms.tsp` | API contract | Current | 11 REST operations + formal WS envelope (`WebSocketMessageEnvelope { event, payload }`, `x-websocket-endpoint: /ws/comms/chat-rooms/{room}`) |
| Comms module doc | `specs/api/src/modules/comms.md` | API contract doc | **Stale** — healthcare-template residue (clients/hosts, appointments, consultations, 2-participant limit, Redis caching, recording consent) | Useful only for original design intent (concurrency transaction, unique constraints, rate limits) — none of which made it into this codebase |
| M07 Navigation Map | `docs/product/modules/m07-communications/NAVIGATION_MAP.md` | UI route contract | Current | Lists `/org/$orgSlug/messages/`, `/messages/dm/`, `/officer/messages/` — all exist |
| M07 API Contracts | `docs/product/modules/m07-communications/API_CONTRACTS.md` | API contract | Current but **incomplete** | Contains zero realtime/chat/video endpoints `[BLOCKED BY MISSING SPEC]` for REST surface |
| Wave 4 Phase 1 notes | memory `wave4-comms-phase1` (design spec `~/.claude/plans/shimmering-churning-crown.md`) | implementation plan | Current | Declares Phase 1 shipped; threading/read-unread/typing/video UI = Phase 2; reactions/search = Phase 3. Explains forward-looking schema columns |

## 3. Expected vs Actual

**Expected (m07 + comms.tsp + Wave 4 plan):** Members open `/org/$orgSlug/messages`, see org channels (#general, #announcements auto-created per org/chapter), chat in real time over `GET /ws/comms/chat-rooms/{room}` using `{ event, payload }` frames; DMs between two members; officers create channels; video calls (P2, behind `comms_video_calls` flag, default off) start as `video_call` messages with admin-only start, join/leave/end actions, one active call per room; messages immutable; archived rooms read-only; chat data isolated per org (P0-7 multi-tenant scoping).

**Actual:**
- Backend REST surface (11 operations) is generated/registered correctly (`generated/openapi/routes.ts` L2672–2745) and the WS route is registered via `generated/websocket/registry.ts`. Handler-level participant/admin checks exist on every endpoint.
- **Real-time delivery does not work end-to-end.** The frontend sends messages via REST (`message-composer.tsx` → `sendChatMessageMutation`), but `sendChatMessage.ts` never broadcasts to the WS channel. The only broadcast path is the WS `chat.message` frame, which the chat UI never sends. On top of that, the client hook (`use-chat-websocket.ts`) reads incoming frames as `{ type, data }` while the server emits `{ event, payload }` (`core/ws.ts` L112–121) — so even server-initiated events (presence, typing, broadcasts) are silently dropped by the UI.
- **Channels cannot be created or seen.** `create-channel-dialog.tsx` sends `participants: []` ("Backend adds creator automatically" — it does not); `createChatRoom.ts` rejects `< 2` participants. The dialog also sends `context: "channel:<name>"` while `comms.tsp` types `context` as `UUID` (validator rejects). `createDefaultChannels()` (`default-channels.ts`, header says "Called from association:member handler after chapter creation") has **zero callers** in production code. Net: members see "No channels yet" forever.
- **DMs have no creation path.** `DmList` accepts `onNewDm` but `messages/dm/index.tsx` never passes it; no UI anywhere creates a 2-person room except the booking page. Empty state says "start a new one" — a dead end.
- **The `chat_room_member` join table, read-state, mute, reactions, and threading columns are all write-only or dead.** Only the seed script touches `chatRoomMembers`/`chatMessageReactions`. All auth checks use the legacy JSONB `participants` array. Unread state is localStorage-only (`use-unread-counts.ts` comments "Will migrate to server-side lastReadAt via API when endpoint is available"). This matches the Wave 4 "Phase 2/3 next" plan `[INFERRED]` — but UI for threads/reactions/search already shipped half-wired.
- **Video calls:** no frontend code ever sends `messageType: 'video_call'`, so `joinVideoCall` always 404s ("No active video call"); `VideoCallPanel` (booking page) fires `join.mutate` on start and will toast "Could not join the call" every time, while the P2P WebRTC connection proceeds independently over WS signaling — so calls may work but server-side call state never exists. The `comms_video_calls` feature flag from m07 §18 is not implemented anywhere.
- **Multi-tenant scoping is declared but not enforced.** Drizzle schema marks `organizationId` `.notNull()` but migration `0016` created the columns nullable and `0019`'s `SET NOT NULL` is gated behind an `IF NOT EXISTS(column)` check that is false after 0016 → columns remain nullable. `/comms/*` uses `orgContextOptionalMiddleware()` (fail-open, `app.ts` L437–443); the comms frontend never sends `x-org-id`; the WS route `/ws/comms/*` has no org middleware at all; WS-created messages and all system messages call repos without `organizationId` → rows with NULL `organization_id`. No comms read path filters by org.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M07-S8 Chat Rooms (P1): real-time WebSocket messaging | Messages appear live for all room participants | REST persist works; no REST→WS broadcast; client/server WS frame shape mismatch | `use-chat-websocket.ts` L58–71, L94–98; `chat-view.tsx` L56–89 | `sendChatMessage.ts` (no `publishToChannel`); `core/ws.ts` L112–121; `ws.chat-room.ts` L116 | `chat_message` table fine | `ws.chat-room.test.ts` tests server side only with server-shaped frames | Partially Implemented | **Yes — G1** |
| Channels (#general/#announcements per org) — Wave 4 plan + `default-channels.ts` intent | Auto-created on chapter/org creation; officers create more | `createDefaultChannels` never called; officer Create Channel dialog always fails validation | `create-channel-dialog.tsx` L54–55 (`participants: []`, `context: 'channel:x'`) | `createChatRoom.ts` L36–42 rejects <2 participants; `comms.tsp` L335 `context?: UUID` rejects `channel:x` | `chat_room.name/room_type` exist (mig 0051) | `create-channel-dialog.test.tsx` exists (component-level, mocked) | Missing (wiring) | **Yes — G2** |
| DM between two members (Wave 4 "DM interface") | Member starts a DM with another member | List/filter of 2-participant rooms only; no creation UI | `messages/dm/index.tsx` (no `onNewDm`); `dm-list.tsx` L34–43 | `createChatRoom` works if called | — | none | Partially Implemented | **Yes — G3** |
| ChatRoom aggregate invariant: "Messages immutable after send" (m07 §7b) | No message update/delete endpoints | No update/delete handlers exist; `updateVideoCallData` mutates only `videoCallData` JSONB | — | `chatMessage.repo.ts` | — | implicit | Implemented | No |
| Archived room read-only (comms.tsp `ChatRoomStatus.archived` "read-only") | Sends to archived rooms rejected | No status check in `sendChatMessage.ts` or `ws.chat-room.ts` — archived rooms accept new messages | — | `sendChatMessage.ts` L69–83 (no status check) | `status` enum exists | `chat-rooms-stabilization.test.ts` L415 asserts WS *connection* allowed to archived room (read), nothing blocks writes | Missing | **Yes — G10** |
| One active call per room, atomic (comms.md "Atomic operation… transaction") | Concurrent start prevented atomically | Check-then-set without transaction (`findActiveVideoCall` → `createVideoCallMessage` → `setActiveVideoCall`) | — | `sendChatMessage.ts` L115–164 | no DB unique/partial index for active call | `video-calls-stabilization.test.ts` L225 (sequential only) | Partially Implemented | Yes — G11 |
| Admin-only video call start/end (comms.tsp `x-security-required-roles user:admin` on end; handler checks) | Non-admin start/end rejected | Implemented in handlers (`room.admins.includes`) | — | `sendChatMessage.ts` L121–125; `endVideoCall.ts` L71–75 | `admins` JSONB | `video-calls-stabilization.test.ts` L499 | Implemented | No |
| Video call lifecycle (start → join → leave/end, status transitions) | UI starts call via `video_call` message, join returns WebRTC info | Backend complete; **frontend never starts a call** → join 404s | `video-call-panel.tsx` L52–77 (join without start); zero `messageType: 'video_call'` in apps/memberry | `joinVideoCall.ts` L85–92 (404 path) | `video_call_data` JSONB | backend covered; no FE/E2E | Partially Implemented | **Yes — G7** |
| `comms_video_calls` release flag default false (m07 §18) | Video UI gated by flag | No flag exists in code (grep: 0 hits) | `video-call-panel.tsx` rendered unconditionally on booking page | — | — | — | Missing | Yes — G14 |
| P0-7 multi-tenant chat isolation (schema comments; mig 0019 title) | Every room/message org-scoped, NOT NULL, queries filtered | Columns nullable in DB; fail-open middleware; FE sends no `x-org-id`; WS path unscoped; no read-path org filter | comms FE: zero `x-org-id` usage (grep) | `org-context.ts` L165–198 fail-open; `ws.chat-room.ts` L130 (no orgId); `chatMessage.repo.ts` L91/L132/L162 `organizationId!` | mig `0016` L15–31 (nullable, NOT NULL commented out); mig `0019` L709–715 (skipped when column exists) | none | Partially Implemented | **Yes — G4** |
| WS protocol per comms.tsp (`{event, payload}` envelope, typed payloads) | Client and server use spec'd envelope | Server outbound matches; server inbound expects `{type, data}`; app client sends `{type, ...spread}` and reads `.type/.data` | `use-chat-websocket.ts` L94–98 | `ws.chat-room.ts` L116 | — | `signaling-client.test.ts` (SDK matches; app hook untested against server shape) | Partially Implemented | **Yes — G1/G9** |
| Rate limiting on video start/join (comms.md §Rate Limiting) | 5/h start, 10/min join | None implemented | — | no rate-limit middleware on comms routes | — | — | Missing | Not Required for V1 `[INFERRED]` — see §23 |
| Message search (searchChatMessages, comms.tsp) | User searches own rooms | Backend implemented + tested; **no frontend consumer** (`message-search.tsx` unmounted) | grep: `MessageSearch` has no importers | `searchChatMessages.ts` | — | `searchChatMessages.test.ts` (103 lines) | Implemented but unwired UI | Yes — §12 |
| Read/unread, mute, threading, reactions (Wave 4 Phase 2/3) | Deferred to later phases | Schema + repo shipped; localStorage stand-in for unread; thread/reaction UI components dormant | `use-unread-counts.ts`; `thread-panel.tsx` L32; `message-reactions.tsx` (no live consumer with handlers) | `chatRoomMember.repo.ts` zero production callers | `chat_room_member`, `chat_message_reaction`, `parent_message_id`, `reply_count` | none | Not Required for V1 (planned Phase 2/3) | §12/§23 |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| Real-time chat (M07-S8, P1 slice) | REST `sendChatMessage` never broadcasts to WS channel; recipients see nothing until a refetch | P0 | `V1 REQUIRED` | `services/api-ts/src/handlers/comms/sendChatMessage.ts` (no `ctx.get('ws')`/`publishToChannel`); contrast `ws.chat-room.ts` L140 | After persist, `publishToChannel('chat-rooms/'+room, 'chat.message', savedMessage)` from the REST handler (or have FE send via WS) |
| WS protocol contract (comms.tsp envelope) | App client frame shape wrong both directions: sends `{type, ...spread}` (server reads `data.text` → undefined), reads `.type/.data` (server sends `.event/.payload`) | P0 (same journey as above) | `V1 REQUIRED` | `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts` L58–71, L94–98 vs `core/ws.ts` L120 and `ws.chat-room.ts` L116 | Align hook to `{event, payload}` inbound and `{type, data}` outbound (or migrate server inbound to the spec'd `{event, payload}` and regenerate) |
| Officer channel creation (Wave 4; officer messages route) | Create Channel always fails: empty `participants` rejected; `context: 'channel:x'` fails UUID validator | P0 | `V1 REQUIRED` | `create-channel-dialog.tsx` L54–55; `createChatRoom.ts` L36–42; `comms.tsp` L335 (`context?: UUID`) | Extend TypeSpec/handler with channel semantics (`name`, `roomType`, creator auto-added) or fix dialog to send valid body; decide channel-vs-context modeling `[NEEDS PRODUCT DECISION]` |
| Default channels per org/chapter | `createDefaultChannels` never invoked; members always see empty channel list | P1 | `V1 REQUIRED` | `default-channels.ts` header claims caller in association:member; grep shows zero callers; `channel-list.tsx` L93–94 empty state | Wire into chapter/org creation flow `[CROSS-MODULE RISK]` (association:member) |
| Channel membership model | Auth checks use JSONB `participants` only; join-table members (the intended model for channels) would be denied WS/REST access; org members have no way to join a channel | P1 | `V1 REQUIRED` | `ws.chat-room.ts` L74; `getChatMessages.ts` L71; `chatRoomMember.repo.ts` (no production callers) | Single membership source of truth; check join table OR participants; add join/leave channel endpoint `[NEEDS PRODUCT DECISION]` (auto-join all org members?) |
| DM creation (Wave 4 "DM interface") | No UI path to start a DM; `onNewDm` never passed | P1 | `V1 REQUIRED` | `messages/dm/index.tsx` L37–41; `dm-list.tsx` L9–14 | Member-picker → `createChatRoom({participants:[me,them], upsert:true})` |
| P0-7 tenant isolation | `organization_id` nullable in DB despite `.notNull()` schema; fail-open middleware; FE/WS never supply org; reads unfiltered by org | P1 | `V1 REQUIRED` | mig `0016_multi_tenant_scoping.sql` L15–31; mig `0019` L709–715; `app.ts` L437–443; `ws.chat-room.ts` L130 | Backfill + `SET NOT NULL` migration; derive orgId server-side from room row on message create; org-filter list/search `[SHARED DEPENDENCY]` (org-context middleware), `[DO NOT OVERBUILD]` — derive from room, don't build new middleware |
| Archived = read-only (comms.tsp) | Archived rooms accept new messages via REST and WS | P2 | `V1 RECOMMENDED` | `sendChatMessage.ts` (no status check); `ws.chat-room.ts` `chat.message` case | Reject sends when `room.status === 'archived'` |
| Video call start journey (M07-S9) | No FE path creates the `video_call` message; `joinVideoCall` 404s; join toast errors on every call attempt while P2P proceeds untracked | P1 | `V1 RECOMMENDED` (video is a P2 slice; the *misleading shipped UI* is the V1 problem) | `video-call-panel.tsx` L52–77; grep `video_call` in apps/memberry = 0; `joinVideoCall.ts` L85–92 | Either gate the panel behind `comms_video_calls` flag (fastest) or add start-call REST step before join |
| `comms_video_calls` flag (m07 §18, default false) | Flag absent; video UI ships ungated | P2 | `V1 RECOMMENDED` | grep `comms_video_calls` = 0 hits | Implement flag check or document flag removal in spec |
| Concurrency: atomic active-call set (comms.md) | Check-then-set race allows 2 concurrent calls | P2 | `V1 RECOMMENDED` | `sendChatMessage.ts` L115–164; no transaction; no DB partial unique index | Transaction or `UPDATE … WHERE active_video_call_message IS NULL` guard |
| Room uniqueness `(participants, context)` (comms.md SQL) | No DB unique constraint; upsert race can duplicate rooms; `findRoomWithParticipants` uses `@>` containment (superset rooms match) | P2 | `V1 RECOMMENDED` | `comms.schema.ts` (no unique); `chatRoom.repo.ts` L128–135 | Exact-match lookup (length + containment) and/or DB constraint |
| m07 API_CONTRACTS.md realtime section | Zero realtime endpoints documented in the product API contract | P2 | `V1 RECOMMENDED` | `docs/product/modules/m07-communications/API_CONTRACTS.md` (grep chat/video/ws = 0) | Add the 11 REST ops + WS endpoint to API_CONTRACTS.md `[BLOCKED BY MISSING SPEC]` until written |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `chat_room_member` join table + full repo (read-state, mute, unread, bulk add) | `comms.schema.ts` L116–131; `chatRoomMember.repo.ts` (222 lines, zero production callers) | Wave 4 Phase 2 plan only (memory note) | Dead code drifting; dual membership sources of truth | Keep but clarify — wire in Phase 2 or G5 fix; do not add more methods. `[DO NOT OVERBUILD]` |
| `chat_message_reaction` table + `MessageReactions` UI | mig `0061`; `message-reactions.tsx`; only seed writes | Wave 4 Phase 3 | Dormant UI/columns | Move to V2; do not expand |
| Threading (`parent_message_id`, `reply_count`, `ThreadPanel`) | `comms.schema.ts` L157–158; `thread-panel.tsx` (renders only when `replyCount > 0`, which nothing sets) | Wave 4 Phase 2 | Dormant; client-side filter comment admits no API support | Move to V2; do not expand |
| WebRTC HMAC token (`generateWebRTCToken`) | `joinVideoCall.ts` L209–222; never verified anywhere (WS auth is cookie-based); `'dev-fallback'` secret fallback | EF-M07 note in code only | Unverified token = false sense of security; weak fallback secret | Keep but clarify — either verify on WS connect or remove; kill `'dev-fallback'` `[NEEDS CONFIRMATION]` |
| `roomUrl` pointing to `/comms/chat-rooms/{id}/video-call/signal` | `joinVideoCall.ts` L200–206 | No such route exists (actual WS: `/ws/comms/chat-rooms/:room`); FE ignores `roomUrl` | Dead/wrong URL in API response | Fix URL or drop field; consider removal later |
| `participantTypeEnum('client','host')`, `CallParticipant.userType: 'host'` hardcoded | `comms.schema.ts` L42–45, L213–221; `joinVideoCall.ts` L113 | Healthcare-template residue (comms.md) | Misleading domain vocabulary in an AMS | Keep but clarify; clean up in next schema touch. `[NEEDS CONFIRMATION]` whether comms.md should be deleted/rewritten |
| `findOrCreateBookingChatRoom` repo method | `chatRoom.repo.ts` L159–213; zero callers (booking page creates room from FE instead) | none | Dead path with `organizationId!` non-null assertion | Consider removal later |
| `getChatRoomStats` repo method | `chatMessage.repo.ts` L398–422; zero callers | none | Dead code; loads all messages into memory | Consider removal later |
| `searchChatMessages` endpoint + `message-search.tsx` | endpoint tested; component has zero importers | comms.tsp documents it | Backend API with no consumer | Keep; mount the component in messages page (small win) or defer |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Member chats in org channel | Member | Opens `/org/$orgSlug/messages` | list channels → select → load history → live messages | List/history work *only for rooms where member is in JSONB participants*; channels never exist; live updates broken | **Yes (P0)** | `channel-list.tsx` L93; G1/G2 |
| Member DMs another member | Member | Opens `/messages/dm` | pick person → create/open room → chat | No creation path; only pre-existing 2-person rooms listed; live updates broken | **Yes (P1)** | `messages/dm/index.tsx` L37–41 |
| Officer creates channel | Officer | `/officer/messages` → Create Channel | dialog → POST /comms/chat-rooms → channel appears | Always fails (empty participants + non-UUID context) | **Yes (P0)** | `create-channel-dialog.tsx` L54–55 |
| Booking video consult | Client + Host | Booking page within ±15 min window | room auto-created → start call → join → talk → end | Room auto-created (NULL org); call never "started" server-side → join 404 toast; P2P may still connect; no call record/duration | **Yes (P1)** | `$bookingId.tsx` L66–99, L289–293; `video-call-panel.tsx` L52–77 |
| Typing indicators | Member | typing in composer | WS `chat.typing` → others see indicator | Broken both directions (frame shape + payload fields `senderId/senderName` vs `from/isTyping`) | Yes (P2) | `message-composer.tsx` L77; `chat-view.tsx` L66–86; `ws.chat-room.ts` L146–151 |
| Presence (user.joined/left) | Member | WS connect/disconnect | server broadcasts presence | Server emits; client drops (reads `.type` not `.event`) | Yes (P2) | `use-chat-websocket.ts` L66–75 |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Channel auto-provisioning on org/chapter create | #general + #announcements created, members enrolled | Missing | `default-channels.ts` zero callers | `V1 REQUIRED` | `[CROSS-MODULE RISK]` association:member owns the trigger |
| Officer creates channel | Valid request, creator auto-admin | Missing (always-fail) | G2 evidence | `V1 REQUIRED` | Needs TypeSpec change (name/roomType or relaxed context) |
| Member joins/sees channels | Org members see and read channels | Missing | membership checks JSONB-only | `V1 REQUIRED` | `[NEEDS PRODUCT DECISION]` auto-join vs explicit join |
| Send message (REST) | Persist + live broadcast + unread bump | Partially Implemented | persist OK; broadcast missing; messageCount race | `V1 REQUIRED` | G1 |
| Receive message (WS) | Render incoming `chat.message` | Missing (frame mismatch) | `use-chat-websocket.ts` L94–98 | `V1 REQUIRED` | G1 |
| Reconnect/backoff | Exponential backoff, resume | Implemented (client-side) | `use-chat-websocket.ts` L77–92 | — | No missed-message catch-up on reconnect (refetch covers it) |
| Start video call | Admin sends `video_call` message; one active per room | Backend Implemented / FE Missing | G7 | `V1 RECOMMENDED` | Video = P2 slice; gate or finish |
| Join/leave/end call | Status transitions, system messages, notifications | Implemented (backend) | `joinVideoCall.ts`, `leaveVideoCall.ts`, `endVideoCall.ts` | — | System messages insert NULL orgId (G4) |
| Archive room | Read-only afterwards | Partially Implemented | no write-block | `V1 RECOMMENDED` | G10 |
| Unread badges | Server-side lastReadAt | Not Required for V1 | localStorage stand-in works | `V2 DEFERRED` | Wave 4 Phase 2 |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Read channel/DM history | Member | Paginated messages | Implemented | No | — | `getChatMessages.ts` + tests |
| Send text message | Member | Persist + deliver live | Partially Implemented | Yes | `V1 REQUIRED` | G1 |
| Create channel | Officer | Channel with name/type | Missing | Yes | `V1 REQUIRED` | G2 |
| Start DM | Member | Pick member, open room | Missing | Yes | `V1 REQUIRED` | G3 |
| List my conversations | Member | Org-scoped channels + DMs | Partially Implemented (no org filter; pagination/context-filter bugs) | Yes | `V1 REQUIRED` | `listChatRooms.ts` L100–108 (context filter applied *after* pagination slice; totals wrong) |
| Search my messages | Member | Find text across rooms | Backend done, UI unmounted | Yes | `V1 RECOMMENDED` | §6 |
| Mute/notifications per room | Member | Mute until time | Missing (repo only) | No | `V2 DEFERRED` | `chatRoomMember.repo.ts` L195–220 |
| React to message | Member | Emoji reactions | Missing (dormant UI/table) | No | `V2 DEFERRED` | §6 |
| Thread replies | Member | Reply under parent | Missing (dormant) | No | `V2 DEFERRED` | §6 |
| Video call in booking | Client/Host | Start, join, talk, end, record duration | Partially Implemented | Yes | `V1 RECOMMENDED` | G7 |
| Group video (>2) | Members | Multi-party calls | Missing (peer-connection is 1:1) | No | `V2 DEFERRED` / `DO NOT ADD` now | `peer-connection.ts` single peer |
| Moderation (delete message, ban) | Officer | Remove abusive content | Missing | No | `V2 DEFERRED` `[NEEDS PRODUCT DECISION]` | immutability invariant conflicts — needs product call |

## 10. Critical Gaps

| # | Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | Real-time delivery broken end-to-end: REST send doesn't broadcast; client WS frames mismatch server (`{type,data}`+spread vs `{event,payload}`) — recipients never see messages live; typing/presence also dropped | backend + frontend | **P0** | `V1 REQUIRED` | `sendChatMessage.ts` (no publish); `core/ws.ts` L112–121; `ws.chat-room.ts` L116; `use-chat-websocket.ts` L58–71, L94–98; `chat-view.tsx` L56–89 | The module's entire purpose is *real-time* comms; today it's a slow REST message board for the sender only | Broadcast from REST handler; fix client envelope to comms.tsp shape; add a contract test for frame shapes |
| G2 | Channel creation impossible: dialog sends `participants: []` (rejected, needs ≥2) and `context: 'channel:x'` (fails UUID validation); `createDefaultChannels` has zero callers | frontend + API contract | **P0** | `V1 REQUIRED` | `create-channel-dialog.tsx` L54–55; `createChatRoom.ts` L36–42; `comms.tsp` L335; grep `createDefaultChannels` = repo+seed only | Channels are the primary member-facing surface of `/messages`; empty state is permanent | TypeSpec channel support (name/roomType, creator auto-add) + wire default channels into chapter creation |
| G3 | No DM creation path (`onNewDm` never passed; no member picker) | frontend | P1 | `V1 REQUIRED` | `messages/dm/index.tsx` L37–41; `dm-list.tsx` L9–14, L70–80 | DM page is a dead end; empty state instructs an action that doesn't exist | Member picker + `createChatRoom` upsert |
| G4 | Tenant isolation not enforced: nullable `organization_id` (migration ordering bug 0016→0019), fail-open org middleware, FE sends no `x-org-id`, WS/system messages insert NULL org, reads unfiltered | schema + middleware + handlers | P1 | `V1 REQUIRED` | mig `0016` L15–31; mig `0019` L709–715; `app.ts` L437–443; `ws.chat-room.ts` L130; `chatMessage.repo.ts` L91 (`organizationId!`) | P0-7 isolation promise broken; cross-org room visibility constrained only by participant arrays; schema/DB drift means Drizzle types lie | Backfill orgId from rooms, `SET NOT NULL` migration; derive orgId from the room row server-side (drop reliance on header for comms); org-filter listChatRooms/search `[SHARED DEPENDENCY]` |
| G5 | Membership split-brain: all auth uses legacy JSONB `participants`; join-table members denied; no join/leave-channel API; unread/mute repo dead | backend | P1 | `V1 REQUIRED` | `ws.chat-room.ts` L74; `getChatRoom.ts` L61; `chatRoomMember.repo.ts` zero callers | Channels (G2) can't work for ordinary members even after creation is fixed; two sources of truth invite authz bugs | Make membership check honor join table OR participants; pick one canonical source for channels |
| G6 | Admin escalation via upsert: any room participant can replace the room's `admins` (and relink `context`) through `POST /comms/chat-rooms {upsert:true}` | security | P1 | `V1 REQUIRED` | `createChatRoom.ts` L88–121 (updates `admins` from request body with only `isInvolved` check) | Participant→admin self-promotion grants video-call end/start control and future admin powers | On upsert, only an *existing admin* may change admins/context; add test |
| G7 | Video call start missing in FE: `joinVideoCall` always 404s; error toast on every call; P2P proceeds untracked; `roomUrl` returned by API points to nonexistent `/video-call/signal` route; no `comms_video_calls` flag | frontend + API | P1 | `V1 RECOMMENDED` | `video-call-panel.tsx` L52–77; grep `video_call` in FE = 0; `joinVideoCall.ts` L200–206 vs `ws.chat-room.ts` path; flag grep = 0 | Shipped UI misleads users and ops (no call records, durations, or audit of calls); spec says flag default false | Gate panel behind flag now; wire start-call (admin) before join when video graduates |
| G8 | Dev WS proxying likely broken: `vite.config.ts` `/api` proxy lacks `ws: true`; chat hook targets `/api/ws/comms/...` through the proxy | environment/frontend | P1 `[NEEDS CONFIRMATION]` | `V1 REQUIRED` (verify first) | `apps/memberry/vite.config.ts` L9–15; `use-chat-websocket.ts` L31–34 | If upgrade isn't proxied, the chat UI shows a permanent "Reconnecting…" loop in dev and any prod setup that mirrors it | Verify with a live run; add `ws: true` if confirmed |
| G9 | Server WS inbound contract diverges from comms.tsp spec (`{event,payload}` documented; `{type,data}` implemented) | API contract | P2 | `V1 RECOMMENDED` | `comms.tsp` L547–559 vs `ws.chat-room.ts` L116 | Spec is the polyglot source of truth; any second client implements the wrong protocol | Align implementation or spec — one PR, plus frame-shape test |
| G10 | Archived rooms accept new messages (REST + WS) | backend | P2 | `V1 RECOMMENDED` | `sendChatMessage.ts` (no status check); `ws.chat-room.ts` chat.message case | Violates documented read-only semantics; surprises after archive | Reject writes on archived status |
| G11 | Race conditions: `updateLastMessage` read-then-write `messageCount`; active-call check-then-set non-atomic; create-room upsert race (no unique constraint) | backend/schema | P2 | `V1 RECOMMENDED` | `chatRoom.repo.ts` L219–242; `sendChatMessage.ts` L115–164; `comms.schema.ts` (no unique) | Wrong counts, possible double active calls/dup rooms under concurrency | SQL `messageCount + 1` increment; guarded UPDATE for active call |
| G12 | `listChatRooms` filter/pagination bugs: context filter applied after slice; `withParticipant` totals wrong; in-memory pagination of all rooms | backend | P2 | `V1 RECOMMENDED` | `listChatRooms.ts` L70–92, L100–122 | Booking page looks rooms up by `context` — wrong page can hide the room, breaking booking chat | Push context/withParticipant into SQL where-clause (repo already supports both) |
| G13 | WS chat.message has no input validation before repo throw; repo errors surface only as a generic close/log, client gets no feedback | backend | P3 | `V1 RECOMMENDED` | `ws.chat-room.ts` L125–143; registry catch in `generated/websocket/registry.ts` | Empty/oversized WS sends die silently | Validate + send `error` event per spec |
| G14 | Healthcare-template residue: `specs/api/src/modules/comms.md` (appointments/clients/hosts/Redis/recording), `participantTypeEnum`, hardcoded `userType: 'host'` | docs/schema | P2 | `V1 RECOMMENDED` | comms.md whole file; `comms.schema.ts` L42–45; `joinVideoCall.ts` L113 | Stale spec actively contradicts the live system (its SQL constraints/transactions were never ported); confuses future audits | Rewrite comms.md or mark superseded by comms.tsp + m07 |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Member A sends message, Member B is viewing the room | B sees the message within ~1s | B sees nothing until refocus/refetch (REST no-broadcast + frame mismatch) | G1 chain | P0 | Integration: REST send → assert `publishToChannel` called with spec envelope; FE test: hook parses `{event:'chat.message', payload}` |
| Officer clicks "Create Channel" | Channel created, appears in list | 400 every time (participants <2; context fails UUID) | `create-channel-dialog.tsx` L47–56 | P0 | Component+contract test: dialog payload accepted by validator |
| Member opens Messages page | Sees org channels | Permanent "No channels yet" (nothing creates channels; member not in participants even if created) | G2+G5 | P0 | E2E: seeded org has #general visible to member |
| Member opens DM page to message a colleague | Start new DM | No affordance; empty state references nonexistent action | `messages/dm/index.tsx` L52–59 | P1 | E2E: new DM flow |
| Booking video call "Join call" | Joins tracked call | Toast "Could not join the call" (404 no active call); video may still connect P2P | `video-call-panel.tsx` L52–55; `joinVideoCall.ts` L85–92 | P1 | E2E/contract: start-then-join sequence |
| Typing indicator | "X is typing…" | Never shows (both frame and field mismatch) | `chat-view.tsx` L66–69 expects `senderId/senderName`; server sends `payload:{from,isTyping}` | P2 | FE unit test against server frame fixture |
| Chat connectivity dot / reconnect banner | Green dot when live | `[NEEDS CONFIRMATION]` likely perpetual "Reconnecting…" in dev (no `ws:true` proxy) | `vite.config.ts` L9–15 | P1 | Manual/dev-server verification, then E2E smoke |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `ChatRoomMemberRepository` (markRead, unread, mute, bulk add) | service not called | zero production callers (grep) | dual-membership drift | Wire during G5 or freeze until Phase 2 |
| `createDefaultChannels` | service not called | grep: repo+seed only; header comment claims a caller | channels never provisioned | Wire into chapter/org creation (G2) |
| `chat_message_reaction` table + `MessageReactions` UI | dead schema + dormant UI | mig 0061; component only used by `message-bubble.tsx` with no `onReact` passed from `chat-view.tsx` | dormant | V2; do not expand |
| `parent_message_id`/`reply_count` + `ThreadPanel` | dead schema + dormant UI | no write path sets either; panel gated on `replyCount > 0` | dormant | V2; do not expand |
| `MessageSearch` component | unwired UI | zero importers | backend search has no consumer | Mount in messages page (small) or defer |
| `VideoLobby`, `ConnectionStatus`, `CallControls`, `VideoGrid` components | unwired UI | zero importers outside `features/comms/components/` | dead UI | Leave; clean up when video graduates |
| `findOrCreateBookingChatRoom`, `getChatRoomStats` | services not called | `chatRoom.repo.ts` L159–213; `chatMessage.repo.ts` L398–422 | dead code w/ footguns (`organizationId!`) | Consider removal later |
| WebRTC token + `roomUrl` from `joinVideoCall` | API fields with no consumer/verifier | FE passes `'session'` placeholder (`video-call-panel.tsx` L67); token never verified | false security affordance | Verify-or-remove (G7 batch) |
| `updateVideoCallParticipant` endpoint | API with no FE consumer | FE toggles mic/cam locally only (`use-video-call.ts`) | server call state stale | Acceptable for V1; note in video batch |
| `hasActiveCall`, `withParticipant` query params | API params unused by FE | grep apps/memberry = 0 | none | Keep (spec'd) |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `organization_id` nullable in DB but `.notNull()` in Drizzle schema (mig 0016 created nullable; 0019's NOT NULL skipped because column existed) | migration | `0016_multi_tenant_scoping.sql` L15–31 (NOT NULL commented out); `0019` L709–715 conditional | P1 | Backfill + enforce NOT NULL; this is the G4 schema leg |
| WS-path and system messages insert `organizationId: undefined` (Drizzle omits → NULL) | backend/service | `ws.chat-room.ts` L130–134; `joinVideoCall.ts` L179–183; `endVideoCall.ts` L140–144; `leaveVideoCall.ts` L147–151, L164–168; repo `organizationId!` asserts | P1 | Fetch room's orgId and pass through (room is already loaded in every path) |
| `context` typed `UUID` in TypeSpec but `text` in DB; default channels store `channel:general` strings | API/schema mismatch | `comms.tsp` L335 vs `comms.schema.ts` L82 | P2 | Decide channel modeling; align types |
| No DB uniqueness for rooms (spec'd `UNIQUE(participants, context)` never implemented) | schema | comms.md L757 vs `comms.schema.ts` indexes | P2 | Add exact-match guard in handler at minimum |
| `messageCount` non-atomic increment | backend | `chatRoom.repo.ts` L226–234 | P2 | `sql\`message_count + 1\`` |
| `findActiveVideoCall` scans all video messages in app code | backend | `chatMessage.repo.ts` L355–378 | P3 | Use `room.activeVideoCallMessage` (already maintained) |
| ChatRoom TypeSpec model omits `name`, `roomType`, `organizationId` that DB/UI rely on (SDK casts) | API contract | `comms.tsp` L35–56; memory note "TypeSpec not updated yet for name/roomType — SDK type uses cast" | P2 | Add to TypeSpec, regenerate (unblocks G2 cleanly) |
| `listChatRooms` in-memory pagination + post-slice context filter | backend | `listChatRooms.ts` L95–108 | P2 | SQL-side filters (repo supports) |
| ILIKE search doesn't escape `%`/`_` in user query | backend | `searchChatMessages.ts` L49 | P3 | Escape pattern chars |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Upsert admin replacement: any participant can overwrite `admins` and `context` on an existing room | room admin model | `createChatRoom.ts` L88–121 | P1 | Restrict admin/context mutation to current admins (G6) |
| Fail-open org context on `/comms/*`; WS route has none; first-UUID-in-path heuristic mis-extracts the *room id* as orgId on `/comms/chat-rooms/{room}/...` (then silently no-ops on membership miss) | tenant isolation | `app.ts` L437–443; `org-context.ts` L181–198 | P1 | Part of G4 — derive org from room server-side |
| WS auth relies on `authMiddleware` (cookie/bearer) — correct; but the issued WebRTC HMAC token is never verified by any server and falls back to `'dev-fallback'` secret | call auth | `joinVideoCall.ts` L217–222 | P2 | Verify-or-remove; remove weak fallback |
| Participant checks consistently enforced on all 8 room-scoped REST handlers + WS connect (good) | room access | `getChatRoom.ts` L60–64 et al.; `ws.chat-room.ts` L73–81 | — | Keep; extend to join-table membership (G5) |
| No officer/position checks (`x-require-officer`/`x-require-position`) anywhere in comms — channel creation is open to all users once G2 is fixed | officer surface | `comms.tsp` (all routes `x-security-required-roles: user`) | P2 | When adding channel semantics, gate channel creation per m07 permissions (officers) `[NEEDS PRODUCT DECISION]` |
| No rate limiting on message send / room create | abuse | no middleware on comms routes | P3 | Defer; rely on platform-level limits `[DO NOT OVERBUILD]` |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| No `x-audit` extensions on any comms operation — room creation, admin changes, call start/end produce no audit-trail events (only pino logs) | communications records | `comms.tsp` (zero `x-audit`); contrast CLAUDE.md P1.5 pattern | P2 | Add `x-audit` to createChatRoom (admin changes) and endVideoCall at minimum |
| Message immutability honored (no update/delete endpoints) | chat history | handler inventory | — | Keep |
| Video call durations/system messages recorded only when the REST lifecycle is used — current FE bypass (G7) means **zero** call records exist | call records | G7 | P1 (folded into G7) | Fix with G7 |
| `ON DELETE CASCADE` from `chat_rooms` → messages: archiving exists but room deletion (none exposed) would silently destroy history | retention | `comms.schema.ts` L144 | P3 | No delete endpoint exists — acceptable; note for person-deletion cascade review `[CROSS-MODULE RISK]` (comms is *not* among the 9 `person.deleted` subscribers — sender ids of deleted persons remain) |

## 16. Knowledge Graph Findings

KG used as context only (per `docs/aha/kg/knowledge-graph-status.md`, graph predates Jun 6–11 changes; not regenerated). Wiring below verified by direct grep, not KG.

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Audit index lists comms as "13 handlers / 7 tests, test coverage thin" | `docs/aha/outputs/module-audit-index.md` §8, §18 | Confirmed: 7 backend test files, but they are mock-level and miss the FE↔BE frame contract | See §20 |
| `sdk-ts` hand-written webrtc extras flagged `[INFERRED]`/undocumented in index §9 | index §9, §17 | Confirmed: `signaling-client.ts` implements the correct server frames; the *app hook* (`use-chat-websocket.ts`) does not — duplicate WS clients with divergent protocols | Consolidate on one WS client (SDK) `[SHARED DEPENDENCY]` |
| Cross-module trigger: `default-channels.ts` ↔ association:member chapter creation | grep callers = none | The only intended cross-module wire is missing | G2 fix lives partly in association:member `[CROSS-MODULE RISK]` |
| comms absent from `core/domain-event-consumers.ts` `person.deleted` subscribers | CLAUDE.md P1.6 list | Deleted persons' chat data is never cleaned | `[CROSS-MODULE RISK]` — flag for person/core-platform audit, do not fix here |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Audit index §17 already flagged "Presence/reconnect/retention semantics — WebSocket behavior only inferable from code" `[INFERRED]` | `module-audit-index.md` §17 | Confirmed and worse: documented behavior (comms.tsp envelope) is contradicted by both server-inbound and client code | Write the WS contract down once (comms.tsp), make code match (G1/G9) |
| The AMS domain (associations, chapters, members) was bolted onto a telehealth chat design (client/host consultations) | comms.md; `participantTypeEnum` | Domain vocabulary mismatch causes drift like `userType: 'host'` for every member | G14 cleanup |
| m07 treats realtime as P1 (chat) / P2 (video, flag off) — so chat is V1-load-bearing, video is not | m07 §19 slice plan, §18 flags | Severity calibration: chat gaps are P0/P1; video gaps capped at P1 (misleading UI) | Reflected in §10 |
| Channel membership semantics undefined (auto-join all org members? officer-curated?) | no spec section covers it | Blocks the "right" G5 fix | `[NEEDS PRODUCT DECISION]` Q2 below |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No evidence files saved. Existing E2E inventory inspected statically: the only comms-adjacent spec is `apps/memberry/tests/e2e/states/communications-states.spec.ts` (announcements states; one regex mentions "no messages"). **No E2E exercises `/org/$orgSlug/messages`, DMs, WS connectivity, or video calls.**

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| No browser verification of chat journeys this audit | — | — | G8 (Vite ws proxy) remains `[NEEDS CONFIRMATION]` | Verify G8 during fix phase with dev server |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/comms/comms-rest-handlers.test.ts` (884 lines) | backend/unit | REST handler happy/permission/error paths (mocked repos) | Medium |
| `handlers/comms/chat-rooms-stabilization.test.ts` (473) | backend/unit | createRoom edge cases, archived read access, filters, WS unknown-type/broadcast | Medium |
| `handlers/comms/video-calls-stabilization.test.ts` (507) | backend/unit | call initiate/join/toggle/end lifecycle, admin-only checks | Medium |
| `handlers/comms/ws.chat-room.test.ts` (308) | backend/unit | onConnect auth, ping/pong, chat.message persist+broadcast, typing relay, signaling relay — **uses server-side `{type,data}` fixtures, so the client-shape bug is invisible (fake-green for the journey)** | Low (for E2E truth) / Medium (for handler logic) |
| `handlers/comms/joinVideoCall.test.ts` (296) | backend/unit | join flows | Medium |
| `handlers/comms/searchChatMessages.test.ts` (103) | backend/unit | search | Medium |
| `handlers/comms/webrtc-token.test.ts` (37) | backend/unit | token is HMAC, not sentinel — but only asserts source-code strings, never verifies a token | Low |
| `packages/sdk-ts/src/utils/webrtc/signaling-client.test.ts` | frontend/unit | SDK signaling frames | Medium |
| `features/comms/__tests__/create-channel-dialog.test.tsx`, `channel-list.test.tsx`, `chat-thread.test.tsx` | frontend/component | rendering with mocked hooks — dialog test does not validate payload against the real validator (the always-400 bug passes) | Low |
| `specs/api/tests/contract/comms.hurl` (85), `comms-edge.hurl` (96), `comms-extended-flow.hurl` (122) | contract | room create/list/messages, edge codes — create-room step asserts only `status < 500` (tolerates 4xx) | Low/Medium |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| WS frame-contract test: client hook fixture ↔ server envelope (`{event,payload}` both directions) | integration | The single biggest fake-green: each side tested only against itself (G1/G9) | **Before** G1 fix |
| REST send → WS broadcast assertion | backend/unit | Locks in the G1 broadcast fix | Before/during G1 |
| Channel create round-trip: dialog payload → real generated validator → handler | integration | G2 regressions; current component test mocks the mutation | Before G2 |
| Upsert cannot change admins unless caller is admin | backend/unit + permission/RBAC | G6 security regression guard | **Before** G6 fix |
| `organization_id` NOT NULL + populated on REST, WS, and system-message paths | data/schema | G4; would have caught NULL-org inserts | Before G4 |
| Archived room rejects REST + WS sends | backend/unit | G10 | During |
| listChatRooms context filter correctness across pages (booking-room lookup) | backend/unit | G12 breaks booking chat discoverability | During |
| E2E: two-session chat (A sends, B receives live), channel visibility for plain member, DM creation | E2E/Playwright | No E2E touches the messages routes at all | After G1–G3 land (journey proof) |
| Contract: start-video-call → join → end sequence (replace `status < 500` tolerance in comms.hurl) | contract | Hurl currently can't fail on the broken paths | During video batch |
| Concurrent video-call start (two parallel requests, one 409) | backend/unit | G11 | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `core/ws.ts` WebSocketService envelope + `generated/websocket/registry.ts` | shared/platform `[SHARED DEPENDENCY]` | G1/G9 frame shapes | Changing the envelope affects any future WS handler | Fix client to match server/spec rather than changing `core/ws.ts` |
| `orgContextOptionalMiddleware` fail-open + UUID-path heuristic | shared/platform `[SHARED DEPENDENCY]` | `org-context.ts` L165–198; shared by billing/booking/storage/etc. | G4 fix must not regress 8 other prefixes — prefer deriving orgId inside comms handlers from the room row | Module-local fix; flag heuristic as cross-cutting candidate for prompt 05 |
| Migration ordering bug pattern (`0016` nullable + `0019` conditional NOT NULL skipped) | database/schema | §13 row 1 | Same pattern may afflict other 0019 tables — possible platform-wide issue | Note for prompt 06 database audit; fix only comms tables here |
| `association:member` chapter creation → `createDefaultChannels` | cross-module `[CROSS-MODULE RISK]` | `default-channels.ts` header | G2 wiring lives in another module's handler | Coordinate; smallest hook = one call post-chapter-create |
| `notifs.createNotification` per-participant loop | cross-module | `sendChatMessage.ts` L167–193 et al. | Sequential awaits; failure tolerated (good) | No change `[DO NOT OVERBUILD]` |
| `person.deleted` cascade excludes comms | cross-module `[CROSS-MODULE RISK]` | `core/domain-event-consumers.ts` (no comms subscriber) | PII retention of deleted members' messages | Hand to person/core-platform audit; product decision on message retention `[NEEDS PRODUCT DECISION]` |
| Booking page room auto-creation | cross-module | `$bookingId.tsx` L66–99 | Depends on G12 (context filter) and G4 (org NULL) | Covered by those fixes |
| `comms.tsp` regen pipeline (`specs/api && bun run build` → `bun run generate`) | shared/platform | CLAUDE.md API-first workflow | Any TypeSpec fix (G2, G9, name/roomType) requires regen + SDK regen | Standard pipeline |

## 22. Raw Recommended Fix Ideas

This section is not the final fix order.

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Broadcast persisted message to `chat-rooms/{room}` channel from REST `sendChatMessage` | G1 | P0 | `V1 REQUIRED` | REST→publish unit test | ~10 LOC; `ctx.get('ws')` already available |
| Rewrite `use-chat-websocket.ts` to send `{type, data}` and parse `{event, payload}`; fix `chat-view.tsx`/typing payload fields | G1 | P0 | `V1 REQUIRED` | frame-contract test w/ shared fixtures | Or swap hook for SDK `SignalingClient` which already matches |
| Add `ws: true` to Vite `/api` proxy | G8 | P1 | `V1 REQUIRED` | manual + E2E smoke | Verify first `[NEEDS CONFIRMATION]` |
| TypeSpec: add `name`/`roomType` to ChatRoom + CreateChatRoomRequest; allow creator-only channel creation (auto-add creator); regen | G2 | P0 | `V1 REQUIRED` | validator round-trip test | Resolves UUID-context hack too |
| Fix `create-channel-dialog.tsx` payload | G2 | P0 | `V1 REQUIRED` | component test against real schema | After TypeSpec change |
| Call `createDefaultChannels` from chapter/org creation | G2 | P1 | `V1 REQUIRED` | integration test | `[CROSS-MODULE RISK]` |
| Membership check honors `chat_room_member` OR JSONB participants | G5 | P1 | `V1 REQUIRED` | RBAC tests both sources | Decide auto-join policy first (Q2) |
| DM member-picker + upsert create | G3 | P1 | `V1 REQUIRED` | E2E | Reuse directory search |
| Upsert guard: only existing admins may mutate `admins`/`context` | G6 | P1 | `V1 REQUIRED` | permission test | Small handler change |
| Org backfill + NOT NULL migration; pass room.organizationId in WS/system-message creation; org-filter listChatRooms/search | G4 | P1 | `V1 REQUIRED` | schema + handler tests | Derive from room; don't trust header |
| Gate `VideoCallPanel` behind `comms_video_calls` flag (or env) | G7/G14-flag | P1 | `V1 RECOMMENDED` | render test | Fastest honest state; full video fix is V2-adjacent |
| Reject sends to archived rooms | G10 | P2 | `V1 RECOMMENDED` | unit | REST + WS |
| SQL-side context/withParticipant filters + atomic messageCount | G12/G11 | P2 | `V1 RECOMMENDED` | unit | Repo already has filter support |
| Guarded UPDATE for active-call set | G11 | P2 | `V1 RECOMMENDED` | concurrency test | `WHERE active_video_call_message IS NULL` |
| Fix/remove dead `roomUrl` signal path + unverified token | G7 | P2 | `V1 RECOMMENDED` | token verify test | Verify-or-remove |
| Mount `MessageSearch` in messages page | §12 | P3 | `V1 RECOMMENDED` | component test | Backend already done |
| Rewrite `specs/api/src/modules/comms.md`; add realtime section to m07 API_CONTRACTS.md | G14 | P2 | `V1 RECOMMENDED` | — | Doc-only |
| Add `x-audit` to createChatRoom/endVideoCall | §15 | P2 | `V1 RECOMMENDED` | audit middleware test | Use P1.5 extension pattern |
| Escape ILIKE wildcards in search | §13 | P3 | `V1 RECOMMENDED` | unit | One-liner |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Threading (parent/replyCount API + ThreadPanel activation) | `V2 DEFERRED` | Wave 4 Phase 2 by plan; zero V1 dependency |
| Reactions API + UI activation | `V2 DEFERRED` | Wave 4 Phase 3 by plan |
| Server-side read-state/unread/mute endpoints | `V2 DEFERRED` | localStorage stand-in acceptable for V1; repo ready |
| Full video-call productization (start UI in chat, lobby, grid, participant sync) | `V2 DEFERRED` | m07 marks video P2 with flag default false; gate it instead |
| Group/multi-party video (>2 peers) | `DO NOT ADD` `[DO NOT OVERBUILD]` | peer-connection is 1:1 by design; no product requirement |
| Redis caching layer for rooms/messages (comms.md §Caching) | `DO NOT ADD` `[DO NOT OVERBUILD]` | Stale template idea; no scale evidence |
| Message edit/delete | `[NEEDS PRODUCT DECISION]` | Conflicts with m07 immutability invariant; moderation story undefined |
| Rate limiting bespoke to comms (5/h call starts etc.) | `V2 DEFERRED` | From stale comms.md; platform-level limits first |
| Presence/online-status indicators beyond join/leave events | `V2 DEFERRED` | Not in any spec; index §17 already flags semantics undefined |
| Rewriting comms to drop JSONB participants entirely (big-bang migration to join table) | `DO NOT ADD` (now) `[DO NOT OVERBUILD]` | G5 needs a compatibility check, not a rewrite; revisit after channels work |

## 24. Audit Decision

**FAIL**

The module's V1 core promise — real-time chat (m07 slice M07-S8, P1) — is broken end-to-end: messages persisted via REST are never broadcast (`sendChatMessage.ts`), and even server-originated WS events are dropped by the client because the app hook speaks a different frame dialect than `core/ws.ts` emits (G1). The two primary creation journeys are also dead: officer channel creation always fails validation (G2) and DMs have no creation path (G3), so the entire Messages surface renders permanent empty states. Compounding P1s: tenant isolation declared but unenforced (G4), participant→admin escalation via upsert (G6), membership split-brain (G5), and a shipped video panel whose join call 404s by construction (G7). Backend handler logic and unit tests are individually solid — the failure is in the seams (FE↔WS contract, cross-module wiring, migrations), which the current mock-level test suite cannot see.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Does the dev/prod proxy actually upgrade WS on `/api/ws/...` (Vite lacks `ws: true`)? | `[NEEDS CONFIRMATION]` / `[BLOCKED BY ENVIRONMENT]` | Determines whether G8 is a real outage or theoretical | Eng (verify with live run) |
| Channel membership model: do all org members auto-join #general/#announcements, or explicit join? Who may create channels (officers only?) | `[NEEDS PRODUCT DECISION]` | Shapes the G2/G5 fix (join-table population, permission gates) | Product |
| Are DMs org-scoped (only within an org) or cross-org? Current code is org-agnostic for participant rooms | `[NEEDS PRODUCT DECISION]` | Determines G4 read-filter strictness for DMs | Product |
| Is video calling in V1 scope at all? m07 flag default false but booking UI ships it | `[NEEDS PRODUCT DECISION]` | Decides gate-vs-finish for G7 | Product |
| Should `specs/api/src/modules/comms.md` be deleted/rewritten (healthcare-template residue, contradicts implementation)? | `[NEEDS CONFIRMATION]` | Stale spec misleads future work; audit index flagged sibling files (patient.md, emr.md) already | Eng/Docs |
| Message retention for deleted persons (comms missing from `person.deleted` cascade) | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | PII/compliance posture | Product + person-module audit |
| Was `createDefaultChannels` intended to be wired in Phase 1 (header says so) or deferred? | `[NEEDS CONFIRMATION]` | Affects whether G2 wiring is a regression or known deferral | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (fix-ready order candidates):** G1 (REST broadcast + client frame fix — one coherent batch, write the frame-contract test first), G2 (TypeSpec channel support + dialog fix + default-channel wiring), G6 (upsert admin guard — small, security, do early), G4 (org backfill/NOT NULL + pass orgId from room — schema-touching, sequence after G6), G3 (DM creation UI), G5 (membership check honoring join table — blocked by product decision Q2 for the full fix, but the OR-check compatibility shim is safe), G8 (verify then one-line Vite fix).
- **Tests to write first:** WS frame-contract fixture test (kills the fake-green in `ws.chat-room.test.ts`); upsert-admin permission test; org-NOT-NULL data test; channel-create validator round-trip.
- **Blocked by product decisions:** channel membership/auto-join (G5 full fix), DM org-scoping strictness, video V1 scope (G7 finish-vs-gate), message retention on person deletion.
- **Shared/database dependencies to handle carefully:** org-context middleware is shared by 8 other prefixes — fix comms locally by deriving orgId from the room row, do **not** change the middleware in this module's batch; migration NOT NULL needs backfill first; TypeSpec changes require the full regen pipeline (spec build → generate → SDK).
- **Must not implement yet:** threading/reactions/read-state APIs (Phase 2/3), multi-party video, Redis caching, message edit/delete, comms-specific rate limits, JSONB→join-table big-bang migration.
- **Implemented-but-not-in-PRD items not to expand:** `ChatRoomMemberRepository` surface, dormant video components, WebRTC token (verify-or-remove only), dead repo methods (`findOrCreateBookingChatRoom`, `getChatRoomStats`).
- **Cross-cutting signals for prompt 05/06:** fail-open `orgContextOptionalMiddleware` UUID-path heuristic (shared across 8 prefixes); migration pattern where a later conditional `SET NOT NULL` is silently skipped (0016/0019) may affect other P0-7 tables; healthcare-template residue family (`comms.md`, `patient.md`, `emr.md`, `provider.md`).

---

Next recommended step:
Module/group: Realtime Comms
Module slug: realtime-comms
Primary PRD/spec: docs/product/modules/m07-communications/MODULE_SPEC.md + specs/api/src/modules/comms.tsp
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/realtime-comms-gap-plan.md
