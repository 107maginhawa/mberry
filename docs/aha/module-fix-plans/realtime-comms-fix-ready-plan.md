# AHA Fix-Ready Plan: Realtime Comms

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Realtime Comms (chat rooms, DMs, WebSocket, video calls) |
| Module slug | realtime-comms |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/realtime-comms-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` |
| Audit decision | FAIL (carried from gap plan §24) |
| Superpowers used | No (organize-only pass; no implementation. TDD sequencing reasoned directly from gap plan §20/§22/§26) |
| Organizer decision | PARTIALLY READY |
| Reason | The two highest-value blockers — real-time delivery (G1) and the upsert admin-escalation security hole (G6) — are fully evidence-backed, root-cause-clear, and safe to fix now in Batch A/B. Channel creation (G2), DM creation (G3), membership model (G5), tenant isolation (G4), and video (G7) are real V1 gaps but each carries either a [NEEDS PRODUCT DECISION] (channel auto-join policy, DM org-scoping, video V1 scope) or a sequencing/migration dependency. The module cannot reach a clean PASS in one pass: G1+G6 are ready immediately; G2/G5/G7 need product confirmations before the "right" fix; G8 needs a one-line env verification first. |
| Limitations | No live WS / dev-server verification performed (organize-only). G8 (Vite `ws:true`) confirmed absent in `vite.config.ts` but whether prod/dev WS upgrade truly fails is still `[NEEDS CONFIRMATION]` until a live run. KG predates Jun 6–11 changes (context only). `handlers/communication/` (async broadcast) is out of scope per the gap plan. No source/tests modified. |

## 2. Fix Strategy Summary

**Fix first (Batch A — P0 core workflow):** Make real-time chat actually work. This is a single coherent journey fix: (1) broadcast the persisted message from the REST `sendChatMessage` handler to the WS channel, and (2) align the client hook's frame envelope (`use-chat-websocket.ts`) to the server/spec shape so incoming `chat.message`/typing/presence frames are no longer silently dropped. Write the WS frame-contract test FIRST — it is the single biggest fake-green in the suite (`ws.chat-room.test.ts` tests the server against its own fixtures, so the client-shape bug is invisible). Channel creation (G2) is also P0 but is split out because it requires a TypeSpec change + a `[NEEDS PRODUCT DECISION]` on channel modeling; its dialog-payload leg can ship once the contract decision lands.

**Then (Batch B — P1 security/trust/reliability):** Close the upsert admin-escalation hole (G6 — small, security, do early), DM creation UI (G3), tenant-isolation enforcement (G4 — but its schema leg is isolated into Batch F), membership compatibility shim (G5 — only the safe OR-check shim; the full join-table model is product-blocked), and verify-then-fix the Vite WS proxy (G8 — env verify first).

**Then (Batch C — selected P2 V1 completeness):** archived-room write-block (G10), `listChatRooms` filter/pagination correctness (G12 — protects booking-chat discoverability), atomic active-call/messageCount (G11), WS inbound contract alignment with spec (G9), mount `MessageSearch` (small win), `x-audit` on createChatRoom/endVideoCall, doc cleanup (G14), ILIKE escaping.

**Test hardening (Batch D):** the frame-contract integration test, the upsert-admin permission test, the org-NOT-NULL data test, the channel-create validator round-trip, and a two-session chat E2E (only after G1–G3 land). These are partly listed inline with each batch above but tracked as a discrete hardening batch.

**Shared/platform (Batch E — ISOLATED):** Do NOT touch `orgContextOptionalMiddleware` or `core/ws.ts`. Verified: the middleware is shared across 9 prefixes (`/billing /booking /comms /communications /storage /reviews /audit /persons /surveys`). G4 must be fixed module-locally by deriving orgId from the already-loaded room row. The fail-open UUID-path heuristic and the WS envelope are cross-cutting candidates for prompt 05 — flag, do not fix here.

**Database/schema (Batch F — ISOLATED):** The `organization_id` nullable-vs-`.notNull()` drift (migration 0016 created nullable; 0019's conditional `SET NOT NULL` was skipped). Requires a backfill-then-`SET NOT NULL` migration. This is the schema leg of G4 and must run as its own labeled batch; the migration pattern itself is a prompt-06 signal.

**Do NOT fix in this module pass:** threading/reactions/read-state APIs (Wave 4 Phase 2/3), multi-party video, Redis caching, message edit/delete, comms-specific rate limits, and any JSONB→join-table big-bang migration. The full video productization stays V2 — the V1 action is to gate the misleading panel behind the `comms_video_calls` flag.

**Major risks:** (1) Promoting G5's full join-table membership model without the Q2 product decision would be a premature rewrite — only the OR-check shim is in active scope. (2) Touching shared org-context middleware would regress 8 other prefixes. (3) The G4 migration without a backfill would fail on existing NULL rows. (4) TypeSpec edits (G2/G9) require the full regen pipeline (`specs/api && bun run build` → `services/api-ts && bun run generate` → SDK regen) or generated code drifts.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED / selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — Real-time delivery broken end-to-end: REST `sendChatMessage` never broadcasts; client WS hook frame shape mismatches server (`{type,data}`+spread vs `{event,payload}`); incoming chat/typing/presence dropped | P0 | V1 REQUIRED | Batch A | Module's entire purpose is real-time comms; today it is a slow REST message board for the sender only | `handlers/comms/sendChatMessage.ts` (verified: no `publishToChannel`/`ctx.get('ws')`); `core/ws.ts` L112–121; `ws.chat-room.ts` L116; `use-chat-websocket.ts` L58–71, L94–98; `chat-view.tsx` L56–89 |
| FIX-002 | G2 (dialog-payload leg) — Create Channel dialog sends `participants: []` (rejected, needs ≥2) and `context: 'channel:x'` (fails UUID validator) | P0 | V1 REQUIRED | Batch A | Channels are the primary member-facing surface of `/messages`; empty state is permanent | `create-channel-dialog.tsx` L54–55; `createChatRoom.ts` L36–42; `comms.tsp` L335 |
| FIX-003 | G2 (TypeSpec leg) — ChatRoom/CreateChatRoomRequest lack `name`/`roomType`; channel semantics need creator auto-add; `context` typed UUID conflicts with `channel:x` strings | P0 | V1 REQUIRED | Batch A | Backend cannot accept a valid channel create until the contract models channels; unblocks FIX-002 cleanly | `comms.tsp` L35–56, L335; `comms.schema.ts` L82; gap §13 row "ChatRoom TypeSpec model omits name/roomType" — **gated by [NEEDS PRODUCT DECISION] PD-1 (channel modeling)** |
| FIX-004 | G2 (default-channels wiring) — `createDefaultChannels` has zero production callers; members always see "No channels yet" | P1 | V1 REQUIRED | Batch B | Even after creation is fixed, no org has #general/#announcements provisioned | `default-channels.ts` (grep: repo+seed only); `channel-list.tsx` L93–94 — `[CROSS-MODULE RISK]` association:member chapter/org creation owns the trigger |
| FIX-005 | G6 — Admin escalation via upsert: any room participant can overwrite `admins` and `context` via `POST /comms/chat-rooms {upsert:true}` | P1 | V1 REQUIRED | Batch B | Participant→admin self-promotion grants video start/end and future admin powers; security regression | `createChatRoom.ts` L88–121 (updates `admins` from body with only `isInvolved` check) |
| FIX-006 | ✅ RESOLVED (Step 42) — DM creation path built: `DmMemberPicker` + pure `buildDmCreateBody` → `createChatRoom{roomType:'dm', upsert}`; `onNewDm` wired in `messages/dm/index.tsx`; empty-state exposes real "New message" action. FE-only, member-allowed, org-scoped create (PD-2 read-strictness untouched). Component+body-builder nets GREEN; live E2E `[BLOCKED BY ENVIRONMENT]` | P1 | V1 REQUIRED | Batch B | DM page was a dead end | fix-report §42; `dm-member-picker.tsx` |
| FIX-007 | G5 (compatibility shim only) — Membership check honors only legacy JSONB `participants`; join-table members would be denied | P1 | V1 REQUIRED | Batch B | Channels (FIX-002/003) can't work for ordinary members otherwise; shim is safe, the full model is product-blocked | `ws.chat-room.ts` L74; `getChatRoom.ts` L61; `chatRoomMember.repo.ts` (zero callers) — **full model gated by [NEEDS PRODUCT DECISION] PD-1; only the OR-check shim is active** |
| FIX-008 | G4 (handler/middleware leg) — Tenant isolation unenforced: fail-open org middleware, FE/WS send no org, WS+system messages insert NULL org; reads unfiltered | P1 | V1 REQUIRED | Batch B | P0-7 isolation promise broken; cross-org visibility constrained only by participant arrays | `app.ts` L437–443 (verified shared by 9 prefixes); `ws.chat-room.ts` L130; `chatMessage.repo.ts` L91 (`organizationId!`). Fix module-locally: derive orgId from the loaded room row — do NOT change shared middleware |
| FIX-009 | G8 — Dev WS proxying likely broken: `vite.config.ts` `/api` proxy lacks `ws: true`; chat hook targets `/api/ws/comms/...` | P1 | V1 REQUIRED | Batch B | Confirmed `ws:true` absent (verified `vite.config.ts` L9–15). If upgrade isn't proxied, chat UI shows permanent "Reconnecting…" | `vite.config.ts` L9–15 (verified); `use-chat-websocket.ts` L31–34 — **verify with live run first `[NEEDS CONFIRMATION]`, then one-line fix** |
| FIX-010 | G4 (schema leg) — `organization_id` nullable in DB despite `.notNull()` (mig 0016 nullable; 0019 conditional `SET NOT NULL` skipped) | P1 | V1 REQUIRED | Batch F | Drizzle types lie; NULL-org rows already possible; must backfill before enforcing | mig `0016_multi_tenant_scoping.sql` L15–31; mig `0019` L709–715 — **database/schema dependency; isolated batch** |
| FIX-011 | ✅ RESOLVED (Step 43, gated) — Video panel gated behind `comms_video_calls` flag (m07 default false): flag OFF → honest "Video calls aren't available yet." card, no join control, no `joinVideoCallMutation`, no peer connection; flag ON → existing UI unchanged. New `useFeatureFlag` hook reads public `GET /feature-flags` (fail-closed false). FE-only (no TypeSpec/schema/regen/SDK). Component nets GREEN (3 pass); comms suite 41/41; memberry typecheck clean. Live E2E `[BLOCKED BY ENVIRONMENT]`. **PD-3 finish stays deferred.** | P1 | V1 RECOMMENDED | Batch C (video) | Shipped UI misled users/ops (no call records); m07 flag default false. V1 action = gate, not finish | fix-report §43; `video-call-panel.tsx`, `hooks/use-feature-flag.ts` — **finish-vs-gate (PD-3) remains [NEEDS PRODUCT DECISION]; gating done** |
| FIX-012 | G10 — Archived rooms accept new messages via REST + WS | P2 | V1 RECOMMENDED | Batch C | Violates documented read-only semantics | `sendChatMessage.ts` (no status check); `ws.chat-room.ts` chat.message case |
| FIX-013 | G12 — `listChatRooms` filter/pagination bugs: context filter applied after slice; `withParticipant` totals wrong; in-memory pagination | P2 | V1 RECOMMENDED | Batch C | Booking page looks rooms up by `context`; wrong page hides the room, breaking booking chat | `listChatRooms.ts` L70–92, L100–122 |
| FIX-014 | G11 — Race conditions: non-atomic `messageCount` increment; check-then-set active-call; upsert room duplication (no unique constraint) | P2 | V1 RECOMMENDED | Batch C | Wrong counts, possible double active calls / dup rooms under concurrency | `chatRoom.repo.ts` L219–242; `sendChatMessage.ts` L115–164; `comms.schema.ts` (no unique) |
| FIX-015 | G9 — Server WS inbound contract diverges from comms.tsp (`{event,payload}` documented; `{type,data}` implemented) | P2 | V1 RECOMMENDED | Batch C | Spec is polyglot source of truth; a second client would implement the wrong protocol | `comms.tsp` L547–559 vs `ws.chat-room.ts` L116 — TypeSpec/regen; pairs with FIX-001 |
| FIX-016 | §12 — `MessageSearch` component unmounted; backend search done + tested but has no consumer | P2 | V1 RECOMMENDED | Batch C | Small win; closes an unwired-but-complete feature | grep: `MessageSearch` has zero importers; `searchChatMessages.test.ts` |
| FIX-017 | §15 — No `x-audit` on any comms op; room creation, admin changes, call start/end produce no audit trail | P2 | V1 RECOMMENDED | Batch C | Trust/compliance: privileged actions (admin change, call end) leave only pino logs | `comms.tsp` (zero `x-audit`); CLAUDE.md P1.5 pattern |
| FIX-018 | G14 — Healthcare-template residue: `comms.md` (appointments/clients/hosts/Redis/recording) contradicts the live system; misleads future audits | P2 | V1 RECOMMENDED | Batch C | Stale spec actively contradicts implementation | `specs/api/src/modules/comms.md`; `comms.schema.ts` L42–45; `joinVideoCall.ts` L113 — **doc-only; clean-vs-delete gated by [NEEDS CONFIRMATION] CF-1** |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A | P0 core-workflow blockers — make real-time chat work + unblock channel creation | FIX-001, FIX-002, FIX-003 | High (FE↔WS contract + TypeSpec regen) | Run in current `04` pass. FIX-001 fully ready now. FIX-003 requires PD-1 (channel modeling) before the TypeSpec change; FIX-002 dialog leg lands after FIX-003. |
| Batch B | P1 reliability / trust / permission / tenant gaps | FIX-004, FIX-005, FIX-006, FIX-007, FIX-008, FIX-009 | High (security + tenant scoping + cross-module wiring) | Run after Batch A. FIX-005 (security) and FIX-006 (DM) ready now. FIX-007 = OR-check shim only (full model needs PD-1). FIX-008 handler leg here, schema leg in Batch F. FIX-004 needs association:member coordination (`[CROSS-MODULE RISK]`). FIX-009 = verify env first. |
| Batch C | Selected P2 V1 completeness + trust/doc | FIX-012, FIX-013, FIX-014, FIX-015, FIX-016, FIX-017, FIX-018 | Medium | Run after Batch A/B land and are green. FIX-015 pairs with FIX-001 (same WS contract) — may co-land. FIX-011 sits here conceptually but is listed in its own row below. |
| Batch C (video) | Honest video state | FIX-011 | Medium | Run after Batch A/B. Gate the panel behind `comms_video_calls` flag (fastest honest state). Full video finish is V2 — needs PD-3. |
| Batch D | Test hardening / regression coverage | (tests for FIX-001/005/008/002 + two-session E2E) | Medium | Test-FIRST items run interleaved before each fix (see §5); the cross-fix E2E runs only after FIX-001–FIX-006 land. |
| Batch E | Shared/platform dependency — **DO NOT modify in this module pass** | (none — flag only) | High blast radius (9 prefixes) | Do not run here. Flag `orgContextOptionalMiddleware` fail-open UUID-path heuristic + `core/ws.ts` envelope as prompt-05 cross-cutting candidates. |
| Batch F | Database/schema dependency — org_id backfill + NOT NULL | FIX-010 | High (data migration on existing rows) | Run as its own labeled migration step. Backfill orgId from rooms FIRST, then `SET NOT NULL`. Sequence alongside FIX-008 handler leg (handlers must populate orgId before NOT NULL is safe). Migration pattern is a prompt-06 signal. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | WS frame-contract fixture test (client hook ↔ server envelope, both directions) | integration | Server emits `{event,payload}` and the client hook parses it (not `{type,data}`); inbound `chat.message`/`typing`/`presence` render. Kills the fake-green where each side is tested only against itself | New: `apps/memberry/src/features/comms/__tests__/ws-frame-contract.test.ts` (shared fixture); update `handlers/comms/ws.chat-room.test.ts` to assert spec envelope |
| FIX-001 | REST send → `publishToChannel` assertion | backend/unit | After persist, `sendChatMessage` broadcasts to `chat-rooms/{room}` with the spec envelope | Extend `handlers/comms/comms-rest-handlers.test.ts` or `chat-rooms-stabilization.test.ts` |
| FIX-002 / FIX-003 | Channel-create round-trip: dialog payload → real generated validator → handler | integration | A valid channel-create body (name/roomType, creator auto-added, no fake `channel:x` context) is accepted by the generated validator and creates a room | Extend `features/comms/__tests__/create-channel-dialog.test.tsx` to validate against the real schema (current test mocks the mutation) + backend `chat-rooms-stabilization.test.ts` |
| FIX-004 | Default-channels provisioning on chapter/org create | integration | Creating a chapter/org provisions #general + #announcements visible to members | New: alongside association:member chapter-creation test (`[CROSS-MODULE RISK]`) |
| FIX-005 | Upsert cannot change `admins`/`context` unless caller is an existing admin | backend/unit + permission/RBAC | A non-admin participant's upsert with new `admins` is rejected | Extend `handlers/comms/comms-rest-handlers.test.ts` (createRoom upsert path) |
| FIX-006 | DM creation flow | E2E/Playwright | Member picks a colleague → `createChatRoom` upsert → DM room opens | New: `apps/memberry/tests/e2e/comms/dm-create.spec.ts` (only after FIX-001 broadcast works) |
| FIX-007 | Membership check honors `chat_room_member` OR JSONB participants | backend/unit + permission/RBAC | A join-table member (not in JSONB participants) is granted WS+REST access | Extend `handlers/comms/comms-rest-handlers.test.ts` + `ws.chat-room.test.ts` |
| FIX-008 / FIX-010 | `organization_id` NOT NULL + populated on REST, WS, and system-message paths | data/schema | No path inserts NULL org; WS + join/leave/end + REST all populate orgId from the room | New: `handlers/comms/org-scoping.test.ts`; extend migration assertions |
| FIX-009 | Dev WS smoke (post-fix) | E2E/Playwright (manual verify first) | With `ws:true`, the chat hook reaches a "connected" state, not perpetual "Reconnecting…" | Manual/dev verify first `[NEEDS CONFIRMATION]`; then `apps/memberry/tests/e2e/comms/chat-connect.spec.ts` |
| FIX-011 | Video panel gated by `comms_video_calls` flag | frontend/component | Panel does not render (or shows disabled state) when flag is off | New: `features/comms/__tests__/video-call-panel.test.tsx` |
| FIX-012 | Archived room rejects REST + WS sends | backend/unit | Send to `status === 'archived'` returns error on both paths | Extend `chat-rooms-stabilization.test.ts` (currently only asserts WS connect allowed to archived) |
| FIX-013 | `listChatRooms` context filter correctness across pages | backend/unit | Context-filtered room is found regardless of page (booking-room lookup) | Extend `handlers/comms/comms-rest-handlers.test.ts` |
| FIX-014 | Concurrent video-call start (two parallel requests, one 409) | backend/unit | Atomic active-call set; `messageCount` increment is SQL-side | Extend `handlers/comms/video-calls-stabilization.test.ts` (currently sequential only) |
| FIX-015 | WS inbound contract matches comms.tsp envelope | integration | Server inbound accepts `{event,payload}` per spec (or spec updated to match + frame test) | Shared fixture with FIX-001 frame-contract test |
| FIX-016 | MessageSearch mounted + queries | frontend/component | Component renders in messages page and calls the search endpoint | Extend `features/comms` component tests |
| FIX-017 | `x-audit` emits on createChatRoom + endVideoCall | integration (audit middleware) | Privileged actions produce an audit event (per P1.5 extension pattern) | New: alongside audit-middleware tests |
| FIX-018 | (doc-only; no test) | — | — | — |

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `handlers/comms/sendChatMessage.ts` (add broadcast), `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts`, `chat-view.tsx`, `message-composer.tsx` (typing payload fields) | module-local (consume shared `core/ws.ts`, do not modify it) | module-local; comms FE + comms handler |
| FIX-002 | `apps/memberry/src/features/comms/components/create-channel-dialog.tsx` | module-local | comms FE only |
| FIX-003 | `specs/api/src/modules/comms.tsp` (+ regen → `generated/openapi/*`, SDK) | cross-module (TypeSpec/contract pipeline) | regen affects generated validators/routes/types + SDK consumers of ChatRoom |
| FIX-004 | `default-channels.ts` (caller), association:member chapter/org creation handler | cross-module | association:member + comms |
| FIX-005 | `handlers/comms/createChatRoom.ts` | module-local | comms handler |
| FIX-006 | `apps/memberry/src/routes/_authenticated/.../messages/dm/index.tsx`, `dm-list.tsx`, member-picker component | module-local | comms FE |
| FIX-007 | `ws.chat-room.ts`, `getChatRoom.ts`, `getChatMessages.ts`, `chatRoomMember.repo.ts` (read path) | module-local | comms backend authz |
| FIX-008 | `ws.chat-room.ts`, `joinVideoCall.ts`, `leaveVideoCall.ts`, `endVideoCall.ts`, `chatMessage.repo.ts`, `listChatRooms.ts`/`searchChatMessages.ts` (org filter) | module-local (derive orgId from room; do NOT touch `org-context.ts`) | comms backend |
| FIX-009 | `apps/memberry/vite.config.ts` (add `ws: true`) | shared/platform (single app config) | memberry dev proxy only; verify prod parity |
| FIX-010 | new migration under `services/api-ts/src/generated/migrations/` (generated via `bun run db:generate` from `comms.schema.ts`); backfill SQL | database/schema | comms tables (`chat_room`, `chat_message`) |
| FIX-011 | `video-call-panel.tsx`, feature-flag check; optionally `joinVideoCall.ts` `roomUrl`/token | module-local | comms FE (booking page) |
| FIX-012 | `sendChatMessage.ts`, `ws.chat-room.ts` | module-local | comms backend |
| FIX-013 | `listChatRooms.ts`, `chatRoom.repo.ts` (push filters into SQL) | module-local | comms backend |
| FIX-014 | `chatRoom.repo.ts` (`messageCount + 1`), `sendChatMessage.ts` (guarded UPDATE for active call) | module-local | comms backend |
| FIX-015 | `ws.chat-room.ts` and/or `comms.tsp` (+ regen) | cross-module (if spec changes) | as FIX-003 |
| FIX-016 | messages page route component (mount `MessageSearch`) | module-local | comms FE |
| FIX-017 | `comms.tsp` (`x-audit` extensions on createChatRoom/endVideoCall) + regen | cross-module | contract pipeline + audit middleware |
| FIX-018 | `specs/api/src/modules/comms.md` (rewrite/mark superseded), `m07 API_CONTRACTS.md` (add realtime section) | unknown (doc-only) | docs |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001, FIX-015 | shared/platform | `core/ws.ts` WebSocketService envelope + `generated/websocket/registry.ts` | Changing the envelope affects any future WS handler | No — fix the CLIENT to match the server/spec; do NOT change `core/ws.ts` |
| FIX-003, FIX-015, FIX-017 | shared/platform | `comms.tsp` regen pipeline (`specs/api && bun run build` → `services/api-ts && bun run generate` → SDK regen) | TypeSpec changes without regen leave generated validators/routes/SDK stale | Yes — run full regen after each TypeSpec edit |
| FIX-004 | cross-module `[CROSS-MODULE RISK]` | association:member chapter/org creation → `createDefaultChannels` | The intended wiring lives in another module's handler | Coordinate; smallest hook = one call post-chapter-create |
| FIX-008 | shared/platform `[SHARED DEPENDENCY]` | `orgContextOptionalMiddleware` (verified shared by 9 prefixes: billing/booking/comms/communications/storage/reviews/audit/persons/surveys) | A middleware change would regress 8 other prefixes | No — fix module-locally by deriving orgId from the room row; do NOT modify the middleware |
| FIX-010 | database/schema | Migration ordering bug (0016 nullable + 0019 conditional NOT NULL skipped); backfill required before NOT NULL | NOT NULL on a table with existing NULL rows fails | Yes — backfill orgId from rooms first, then SET NOT NULL; sequence with FIX-008 handler population |
| FIX-009 | environment/tooling `[NEEDS CONFIRMATION]` | Vite `/api` proxy lacks `ws: true` (verified absent) | Determines whether G8 is a real dev outage or theoretical; prod proxy parity unknown | Yes — verify with a live dev run before the one-line change |
| (no fix) | cross-module `[CROSS-MODULE RISK]` | `person.deleted` cascade excludes comms (`core/domain-event-consumers.ts`) | Deleted members' chat data never cleaned | Out of scope — hand to person/core-platform audit + PD-4 |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| PD-1: Channel membership model — do all org members auto-join #general/#announcements, or explicit join? Who may create channels (officers only)? | `[NEEDS PRODUCT DECISION]` | FIX-003, FIX-004, FIX-007 (full model) | Shapes join-table population, the `name`/`roomType` contract, and channel-create permission gating | Product decision before the TypeSpec channel-modeling change; until then ship only the safe FIX-007 OR-check shim and the FIX-001 chat path |
| PD-2: Are DMs org-scoped or cross-org? Current code is org-agnostic for participant rooms | ✅ **DECIDED 2026-06-13** | FIX-006, FIX-008 (DM read-filter strictness) | Determines how strict the G4 org filter is for DM rooms | **DMs org-scoped (no cross-org DM).** Built: `sendChatMessage` org-match guard + `findUserRoomsPage` strict `organizationId` filter (DM exemption removed). See fix-report §48. |
| PD-3: Is video calling in V1 scope at all? m07 flag default false, but booking UI ships it | ◑ **DECIDED 2026-06-13 (gate done; finish infra-blocked)** | FIX-011 | Decides gate-vs-finish | V1 = 1:1/small-group over existing WS signaling, no recording. Gate shipped (Step 43). The *finish* (ungate + lobby/call-records) needs STUN/TURN + media infra → `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]`. See fix-report §48. |
| CF-1: Should `comms.md` be deleted or rewritten (healthcare-template residue contradicting implementation)? | `[NEEDS CONFIRMATION]` | FIX-018 | Avoids ambiguous doc-only churn; sibling files (patient.md/emr.md/provider.md) flagged in audit index | Eng/Docs confirm intent; default = mark superseded by comms.tsp + m07 |
| CF-2: Was `createDefaultChannels` meant to wire in Phase 1 (header says so) or deferred? | `[NEEDS CONFIRMATION]` | FIX-004 | Affects whether FIX-004 is a regression fix or a known deferral | Eng confirm; if deferred, FIX-004 still required for channels to be usable |
| CF-3: Does dev/prod proxy actually upgrade WS on `/api/ws/...`? | `[NEEDS CONFIRMATION]` / `[BLOCKED BY ENVIRONMENT]` | FIX-009 | Determines whether G8 is a real outage | Verify with a live dev run at the start of the `04` pass |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| G5 full join-table membership model (replace JSONB participants as canonical source for channels) | `[NEEDS PRODUCT DECISION]` (PD-1) | The "right" membership model depends on auto-join vs explicit-join policy | PD-1 resolved; until then ship only the FIX-007 OR-check compatibility shim |
| Full video-call productization (start UI in chat, lobby, grid, participant sync, call records) | `[NEEDS PRODUCT DECISION]` (PD-3) | m07 marks video P2 with flag default false; V1 action is to gate | PD-3 resolved; V1 ships FIX-011 (gate) only |
| Message retention / cleanup for deleted persons (comms absent from `person.deleted` cascade) | `[NEEDS PRODUCT DECISION]` (PD-4) + `[CROSS-MODULE RISK]` | PII/compliance posture undecided; lives in person/core-platform, not comms | Product decision on retention + handled by person-module audit; do not fix here |
| `comms.md` realtime endpoints missing from m07 API_CONTRACTS.md | `[BLOCKED BY MISSING SPEC]` | The product API contract documents zero realtime endpoints | FIX-018 doc work adds them once CF-1 confirms direction |
| G9 spec-vs-implementation WS inbound direction (align which way) | `[NEEDS CONFIRMATION]` | Whether to change the implementation to `{event,payload}` or update the spec | Confirm with FIX-001 frame decision; co-land FIX-015 |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Threading (parent/replyCount API + ThreadPanel activation) | §9, §12, §23 | V2 DEFERRED | Wave 4 Phase 2 by plan; zero V1 dependency; UI is dormant |
| Reactions API + UI activation (`chat_message_reaction`, `MessageReactions`) | §6, §23 | V2 DEFERRED | Wave 4 Phase 3 by plan |
| Server-side read-state / unread / mute endpoints (`ChatRoomMemberRepository` markRead/unread/mute) | §6, §12, §23 | V2 DEFERRED | localStorage stand-in acceptable for V1; repo ready but unwired |
| Full video-call productization | §9, §23 | V2 DEFERRED | m07 video is P2, flag default false; gate (FIX-011) instead |
| WebRTC token verify-on-connect (full enforcement) | §6, §14 | V2 DEFERRED `[DO NOT OVERBUILD]` | Verify-or-remove only in FIX-011; full server-side verification is not V1 |
| Bespoke comms rate limiting (5/h call starts, 10/min join) | §5, §14, §23 | V2 DEFERRED | From stale comms.md; rely on platform-level limits first |
| Presence/online-status beyond join/leave events | §7, §23 | V2 DEFERRED | Not in any spec; semantics undefined (audit index §17) |
| Dead repo cleanup (`findOrCreateBookingChatRoom`, `getChatRoomStats`) | §6, §12 | `[DO NOT OVERBUILD]` | Dead methods; remove during a later schema touch, not in active fix pass |
| `participantTypeEnum('client','host')` / hardcoded `userType:'host'` cleanup | §6, §13 | `[NEEDS CONFIRMATION]` | Healthcare-template residue; clean during next schema touch (tied to CF-1) |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Group / multi-party video (>2 peers) | §9, §23 | `peer-connection.ts` is 1:1 by design; no product requirement — `[DO NOT OVERBUILD]` |
| Redis caching layer for rooms/messages | §6 (comms.md §Caching), §23 | Stale healthcare-template idea; no scale evidence — `[DO NOT OVERBUILD]` |
| Message edit/delete | §9, §23 | Conflicts with m07 "messages immutable" invariant; moderation story undefined — `[NEEDS PRODUCT DECISION]`, not a build target |
| JSONB→join-table big-bang membership migration | §23, §26 | G5 needs a compatibility OR-check, not a rewrite; revisit after channels work — `[DO NOT OVERBUILD]` |
| New org-context middleware for comms | §5, §21 | Derive orgId from the room row instead; building new middleware duplicates shared behavior and risks 9-prefix regression — `[DO NOT OVERBUILD]` |
| Expanding `ChatRoomMemberRepository` surface (more methods) | §6, §12 | Already over-built ahead of Phase 2; wire what exists in FIX-007, add nothing — `[DO NOT OVERBUILD]` |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Two independent root causes in one journey: (a) REST handler omits the broadcast call; (b) client hook speaks a different frame dialect than `core/ws.ts`. Both must be fixed; neither is a workaround |
| FIX-002 | Root cause | Dialog constructs an invalid payload (empty participants + non-UUID context) |
| FIX-003 | Root cause | Contract never modeled channels (`name`/`roomType` absent; `context` typed UUID) — the dialog hack is downstream of this |
| FIX-004 | Root cause | The intended cross-module wire (`createDefaultChannels` from chapter creation) was never connected |
| FIX-005 | Root cause | Upsert path trusts request-body `admins` with only an `isInvolved` check — missing an existing-admin authorization guard |
| FIX-006 | Root cause | `onNewDm` callback never wired; no member-picker UI exists |
| FIX-007 | Root cause (shim) / symptom-adjacent | The OR-check shim addresses the dual-source-of-truth symptom safely; the true root cause (one canonical membership model) is product-blocked (PD-1) |
| FIX-008 | Root cause | Handlers/WS never populate orgId; fix is to derive it from the loaded room row (root, not a header workaround) |
| FIX-009 | Unclear (verify first) | `ws:true` confirmed absent, but whether the upgrade actually fails in dev/prod is `[NEEDS CONFIRMATION]`; classify after live verification |
| FIX-010 | Root cause | Migration ordering bug left the column nullable; backfill + enforce is the root fix |
| FIX-011 | Workaround (honest) | Gating the panel is a deliberate honest workaround; the full start-call flow (root finish) is V2 (PD-3) |
| FIX-012 | Root cause | No archived-status check on either write path |
| FIX-013 | Root cause | Filters applied in memory after pagination slice instead of in SQL |
| FIX-014 | Root cause | Read-then-write / check-then-set without atomic SQL or DB constraint |
| FIX-015 | Root cause | Implementation diverged from the spec'd inbound envelope |
| FIX-016 | Symptom | Complete backend with no mounted consumer; mounting is the fix |
| FIX-017 | Root cause | Audit extensions never declared on comms operations |
| FIX-018 | Symptom (doc drift) | Stale spec was never updated after the AMS pivot |

## 13. Recommended First Fix Batch

**Batch name:** Batch A — P0 core-workflow blockers (real-time chat delivery)

**Included Fix IDs:** FIX-001 (always), FIX-003 + FIX-002 (after PD-1 channel-modeling decision lands).

**Why this batch comes first:** The module's entire reason to exist is real-time messaging, and the audit decision is FAIL precisely because that journey is broken end-to-end. FIX-001 has two clear root causes (missing REST→WS broadcast, client/server frame mismatch), is fully evidence-backed, touches only comms-local files (it consumes — does not modify — shared `core/ws.ts`), and is independently shippable without any product decision. It is also the prerequisite for proving G2/G3 journeys (a created channel or DM is worthless if messages don't deliver live). FIX-002/FIX-003 complete the second P0 (channel creation) but require PD-1 first, so they trail FIX-001 within the same pass.

**Tests to write first (before any implementation):**
1. WS frame-contract fixture test — client hook ↔ server envelope, both directions (kills the single biggest fake-green in `ws.chat-room.test.ts`).
2. REST send → `publishToChannel` assertion (locks in the broadcast fix).
3. Channel-create validator round-trip — dialog payload → real generated validator → handler (for FIX-002/003, once PD-1 lands).

**Explicit out-of-scope items for Batch A:**
- Tenant isolation / org backfill (FIX-008/FIX-010 → Batch B/F).
- Upsert admin guard (FIX-005 → Batch B).
- DM creation (FIX-006 → Batch B).
- Video gating (FIX-011 → Batch C).
- Any `core/ws.ts` or `orgContextOptionalMiddleware` change (Batch E — do not touch).
- Threading, reactions, read-state, multi-party video, Redis, message edit/delete, comms rate limits (Deferred / Do Not Build).

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Realtime Comms
- **Exact module slug:** `realtime-comms`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md`
- **Exact batch to execute first:** Batch A — P0 core-workflow blockers (real-time chat delivery). Start with FIX-001 in full; only proceed to FIX-003/FIX-002 after PD-1 (channel-modeling) is resolved.
- **Tests to prioritize (write FIRST, must fail before the fix):**
  1. WS frame-contract fixture test (client hook ↔ server `{event,payload}` envelope, both directions) — new `apps/memberry/src/features/comms/__tests__/ws-frame-contract.test.ts` + update `handlers/comms/ws.chat-room.test.ts` to assert the spec envelope (do not keep the self-shaped fixtures).
  2. REST send → `publishToChannel` assertion — extend `handlers/comms/comms-rest-handlers.test.ts`.
  3. (For FIX-002/003, after PD-1) channel-create validator round-trip — extend `features/comms/__tests__/create-channel-dialog.test.tsx` against the real generated validator.
- **Files likely to touch (Batch A):** `services/api-ts/src/handlers/comms/sendChatMessage.ts`; `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts`, `chat-view.tsx`, `message-composer.tsx`; (FIX-003) `specs/api/src/modules/comms.tsp` then full regen; (FIX-002) `create-channel-dialog.tsx`.
- **Shared / database cautions:**
  - Do NOT modify `core/ws.ts` — fix the CLIENT to match the server/spec envelope.
  - Do NOT modify `orgContextOptionalMiddleware` / `middleware/org-context.ts` — it is shared by 9 prefixes; the G4/FIX-008 fix derives orgId from the loaded room row instead (and lands in Batch B, not Batch A).
  - Any TypeSpec edit (FIX-003) requires the full regen pipeline: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → regenerate the SDK. Never hand-edit generated files.
  - The org `SET NOT NULL` migration (FIX-010, Batch F) must backfill from rooms FIRST — do not run NOT NULL against existing NULL rows.
  - Verify the Vite `ws: true` question (FIX-009/CF-3) with a live dev run before changing `vite.config.ts`.
- **Items NOT to implement in this pass:** the full G5 join-table membership model (PD-1 blocked — ship only the OR-check shim in Batch B), full video productization (PD-3 — gate only), message retention on person deletion (PD-4 — person/core-platform audit), threading, reactions, server-side read-state/unread/mute, multi-party video, Redis caching, message edit/delete, comms-specific rate limiting, JSONB→join-table big-bang migration, new comms org-context middleware, and any expansion of `ChatRoomMemberRepository` or dormant video components.

---

Next recommended step:
Module/group: Realtime Comms
Module slug: realtime-comms
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md
Recommended batch: Batch A — P0 core-workflow blockers (real-time chat delivery)

---

## Decisions — Step 29 (2026-06-12) — PD-1 channel-membership model RESOLVED

User delegated to engineering judgment ("your call whats best").

**Decision: auto-join org members to org channels; officer-only channel creation.**

- Channel membership: **auto-join** — org members are members of their org's
  channels by default (no explicit join step). Makes the `/messages` primary
  member surface non-empty out of the box.
- Channel creation: **officer-only** (officer term required) — members do not
  create channels in V1.
- Wiring: provision org channels via the existing `createDefaultChannels`
  (`default-channels.ts`, currently 0 callers) on org/membership provisioning so
  every org ships with channels its members auto-belong to.
- Rationale: auto-join is the lowest-friction model that fixes the permanently-empty
  `/messages` surface for the pilot; officer-gated creation retains control. A
  full explicit-join + JSONB→join-table migration stays V2 (§16).

**Unblocks FIX-003/FIX-007 (PD-1).** Sequenced after documents Batch A per roadmap §8.
DM scope (PD-2) and video (PD-3) remain separately gated.

### Step 42 (2026-06-13) — FIX-006 DM creation RESOLVED

- FIX-006 (G3) → **resolved** (fix-report Step 42): `DmMemberPicker` + pure
  `buildDmCreateBody` → `createChatRoom{ roomType:'dm', participants:[me,them], upsert:true }`;
  `onNewDm` wired in `messages/dm/index.tsx`; `dm-list` empty-state now points at a real
  "New message" action. FE-only (no TypeSpec/regen/SDK), member-allowed, org-scoped create.
  Component + body-builder nets GREEN (3 pass); full comms suite 38/38; memberry typecheck
  clean. Live E2E `[BLOCKED BY ENVIRONMENT]` (no auth/seed).
- **PD-2** (DM org-scoping strictness — the FIX-008 DM read-filter leg) remains a separate
  open product decision; NOT touched this pass.

### Step 31 (2026-06-13) — FIX-002/003/004/007 SHIPPED; Step 41 — decision-3 enforced

- FIX-002/003/004/007 → **resolved** (Channel-Model Batch, fix-report Step 31): channel
  creation modeled in `comms.tsp`, dialog payload fixed, defaults provisioned + member
  auto-join, officer-only create + `chat_room_member` populated.
- PD-1 decision-3 (`#announcements` officer-post-only) → **resolved** (fix-report Step 41):
  enforced on REST `sendChatMessage` + WS `chat.message` write paths (TDD).
- PD-1 status → **resolved-pending-ratification**. One open ratification flag: the shipped
  **per-member-row** auto-join model vs the CONTINUE-41-pinned **implicit no-rows** model
  (see fix-report §41.6). Membership model kept as shipped; flagged, not rewritten.

### Step 43 (2026-06-13) — FIX-011 video gate SHIPPED (gated); PD-3 finish deferred

- FIX-011 (G7) → **resolved as gated** (fix-report §43): `VideoCallPanel` gated
  behind `comms_video_calls` flag (m07 default false). Flag OFF (default) →
  honest "Video calls aren't available yet." card, no join control / mutation /
  peer connection; flag ON → existing UI unchanged. New `useFeatureFlag` hook
  fetches public `GET /feature-flags` (no `/api` prefix, fail-closed false).
  FE-only (no TypeSpec/schema/regen/SDK). TDD RED→GREEN; comms suite 41/41;
  memberry typecheck clean. Live E2E `[BLOCKED BY ENVIRONMENT]`.
- **PD-3** (video V1 *finish* scope — lobby, grid, call records, token verify)
  remains a separate open `[NEEDS PRODUCT DECISION]`; NOT built this pass.

### Step 49 (2026-06-13) — FIX-011 / PD-3 video V1 *finish* (no-infra slice) SHIPPED; media/TURN V2

- **PD-3 V1 no-infra slice → BUILT** (fix-report §49, TDD RED→GREEN):
  - **Capacity cap** `VIDEO_CALL_MAX_PARTICIPANTS = 6` (new schema const). 1:1=2,
    small-group up to 6. Enforced on the **start** path (`sendChatMessage` →
    `BusinessLogicError('VIDEO_CALL_CAPACITY_EXCEEDED')` when seeded > 6) and the
    **join** path (`joinVideoCall` → `ConflictError` when active participants ≥ 6;
    left participants don't count).
  - **No-recording invariant**: `VideoCallData` carries no recording field
    (structurally asserted); start path rejects any `recording/recordingEnabled/
    record === true` payload (`BusinessLogicError('VIDEO_RECORDING_NOT_SUPPORTED')`)
    and persists only canonical fields. New `assertNoRecording()` +
    `countActiveCallParticipants()` helpers.
  - Module-local backend only. No TypeSpec/regen/SDK/migration (next free still `0072`).
    comms suite **180/180**; api-ts `tsc --noEmit` clean.
- **Still V2 / blocked** (NOT built): ungate (`comms_video_calls` stays default-off —
  not flipped), lobby/grid/participant-sync UI, call-records productization, STUN/TURN/
  media-server/recording/large-rooms → `[CROSS-MODULE RISK]` / `[BLOCKED BY ENVIRONMENT]`.
  `peer-connection.ts` left 1:1 by design; `core/ws.ts` consumed, untouched.
- **PD-3 status → V1 no-infra slice resolved; media/TURN finish remains infra-blocked.**
