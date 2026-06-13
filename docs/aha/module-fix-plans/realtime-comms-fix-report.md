# AHA Module/Group Fix Report: Realtime Comms

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Realtime Comms (chat rooms, DMs, WebSocket, video calls) |
| Module slug | realtime-comms |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/realtime-comms-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/realtime-comms-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — P0 real-time chat delivery (G1) + G6 upsert-admin security (FIX-001 + FIX-005) |
| Superpowers used | Yes (`superpowers:using-superpowers`, `superpowers:test-driven-development`) |
| Working tree status checked | Yes |
| Fix scope | P0 (FIX-001/G1) + P1 security (FIX-005/G6); both `V1 REQUIRED` |
| Out of scope | FIX-002/FIX-003 (PD-1 channel-modeling gated), FIX-004/006/007/008/009/010/011 (Batch B/C/F), `core/ws.ts` envelope (Batch E), `orgContextOptionalMiddleware` (Batch E), `org_id` NOT NULL migration (Batch F), `vite.config.ts` `ws:true` (G8, not in selected batch), all V2 DEFERRED / DO NOT ADD items |
| Shared files touched | No |
| Schema/migration touched | No |
| Limitations | No live WS/dev-server run (organize/fix discipline + no running WS stack); real-time delivery proven at unit/integration level (REST→`publishToChannel` broadcast assertion + shared client/server frame-contract test), not browser E2E `[BLOCKED BY ENVIRONMENT]`. FIX-003/002 deliberately excluded (PD-1 product decision). |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — Real-time delivery broken end-to-end (REST send never broadcasts; client WS frame shape mismatches server) | P0 | V1 REQUIRED | Batch A | Module's entire purpose is real-time comms; fully evidence-backed, two clear root causes, comms-local, no product decision | Fixed |
| FIX-005 | G6 — Admin escalation via upsert (any participant can overwrite `admins`/`context` through `POST /comms/chat-rooms {upsert:true}`) | P1 | V1 REQUIRED | Batch A (per orchestrator scope) | Security: participant→admin self-promotion grants video start/end; small, root-cause-clear, comms-local | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/handlers/comms/comms-rest-handlers.test.ts` (after adding new failing tests) | 54 pass / 4 fail | FIX-001, FIX-005 | RED confirmed for the right reasons: 2 broadcast tests fail (`publishToChannel` never called by `sendChatMessage`); 2 escalation tests fail (non-admin's `admins`/`context` updates ARE applied — `updateOneById` received `{ admins, context }`) |
| `bun test .../ws-frame-contract.test.ts` (new) | 0 pass / 1 error (module not found) | FIX-001 (client leg) | RED: `comms-ws-frames` helper did not yet exist |
| Full comms backend suite (pre-fix logic) | 122 tests existing; `ws.chat-room.test.ts` was a fake-green for the journey (server tested only against its own `{type,data}` fixtures) | FIX-001 | Documented in gap plan §19; the client was never tested against the server `{event,payload}` shape |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 (server leg) | After persist + `updateLastMessage`, broadcast the saved message to `chat-rooms/${room}` via `ctx.get('ws').publishToChannel(..., 'chat.message', message)`. Best-effort (try/catch, never fails the persisted send). Covers both `text` and `video_call` branches (single broadcast at end). | `services/api-ts/src/handlers/comms/sendChatMessage.ts` | No — *consumes* shared `core/ws.ts`, does not modify it | `ctx.get('ws')` is injected app-wide by `middleware/dependency.ts` |
| FIX-001 (client leg) | New pure frame helper `comms-ws-frames.ts` (`serializeOutboundFrame` → `{type,data}`; `parseInboundFrame` → `{event,payload}`). Hook now serializes outbound as `{type,data}` (was `{type,...data}` spread → server saw `data.text` undefined) and parses inbound as `{event,payload}` (was reading `.type/.data`, dropping every server frame; pong now keyed off `event==='pong'`). Consumer (`chat-view`) reads `frame.event`/`frame.payload`; typing reads `payload.from`/`payload.isTyping`. Composer emits typing as `{ isTyping: true }` (server reads `data.isTyping`). | `apps/memberry/src/features/comms/hooks/comms-ws-frames.ts` (new), `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts`, `apps/memberry/src/features/comms/components/chat-view.tsx`, `apps/memberry/src/features/comms/components/message-composer.tsx` | No — module-local comms FE | Server side untouched (already emits the correct envelope) |
| FIX-005 | On upsert of an existing room, gate `admins`/`context` mutation behind an existing-admin check (`room.admins.includes(user.id)`). Non-admin attempts to change those fields are ignored (idempotent upsert preserved) and logged as `reject_upsert_privilege_escalation` for trace. | `services/api-ts/src/handlers/comms/createChatRoom.ts` | No — comms handler | Status/reactivate-on-archived behavior unchanged |
| (test infra) | Added `ws` to the comms REST test `makeCtx` store + `_ws()` accessor so broadcast can be asserted. | `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | No | Test-only |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` (added 2 tests) | backend/unit + integration | REST `sendChatMessage` broadcasts the persisted message to `chat-rooms/room-1` with event `chat.message` and payload = full saved message, for both text and video_call | FIX-001 |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` (added 3 tests in a new describe) | permission/RBAC + regression | Non-admin participant cannot self-promote `admins` or relink `context` via upsert; existing admin still can change `admins` | FIX-005 |
| `apps/memberry/src/features/comms/__tests__/ws-frame-contract.test.ts` (new) | integration (shared fixture) | Outbound frames wrap payload under `data` (kills the spread bug); inbound frames parse `{event,payload}` (not `{type,data}`); pong recognized via `event:"pong"`; legacy `{type,data}` inbound yields undefined event | FIX-001 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/comms/comms-rest-handlers.test.ts` (api-ts) | Passed | 58 pass / 0 fail (was 54/4 at RED) |
| `bun test src/handlers/comms/` (api-ts, full module) | Passed | 122 pass / 0 fail across 7 files — no regressions |
| `bun test apps/memberry/src/features/comms/__tests__/ws-frame-contract.test.ts` | Passed | 7 pass / 0 fail |
| `bun test apps/memberry/src/features/comms/` | Passed | 18 pass / 0 fail across 4 files (existing component tests + new frame contract) |
| `bun run typecheck` (services/api-ts) | Passed | `tsc --noEmit` clean |
| `bun run typecheck` (apps/memberry) | Passed | `tsc --noEmit` clean |

## 7. Validation Summary

- **Passed:** All targeted and module-level tests for both fixes (backend comms 122/122, frontend comms 18/18, new frame-contract 7/7) plus typecheck on both touched workspaces.
- **Failed:** None after the fix.
- **Not run:** Whole-repo suite (out of scope per 04 §11 focused-validation instruction). No browser-level WS E2E.
- **Blocked:** Live two-session chat E2E and dev WS connectivity smoke `[BLOCKED BY ENVIRONMENT]` — no running WS/dev stack; real-time delivery proven at unit/integration level instead (REST→`publishToChannel` broadcast assertion + bidirectional client/server frame contract).
- **Pre-existing/unrelated:** Working tree carried prior AHA fixes (membership, dues, billing, communication, elections, training, SDK/generated regen, `app.ts`); all preserved, none touched by this pass.

## 8. Shared / Cross-Module / Database Impact

No shared/platform/database files were modified. `core/ws.ts` (`WebSocketService`/envelope) and `middleware/org-context.ts` (`orgContextOptionalMiddleware`, 9-prefix blast radius) were deliberately left untouched — the client was fixed to match the server/spec, per Batch E isolation. `ctx.get('ws')` is consumed via the existing app-wide `middleware/dependency.ts` injection (no change there).

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Channel creation (TypeSpec `name`/`roomType`, dialog payload) | FIX-002 / FIX-003 (G2) | Gated by PD-1 (channel membership/auto-join + who-may-create) | Resolve PD-1, then run a `04` pass for the channel-create legs (TypeSpec regen pipeline) |
| Default channels wiring | FIX-004 (G2) | Cross-module (`association:member` chapter creation) + PD-1 | Coordinate with association:member; Batch B |
| DM creation UI | FIX-006 (G3) | Batch B | Run Batch B `04` pass |
| Membership compatibility shim | FIX-007 (G5) | Batch B (full model PD-1 blocked) | Batch B — OR-check shim only |
| Tenant isolation (handler leg) | FIX-008 (G4) | Batch B | Batch B — derive orgId from room row (module-local) |
| Vite `ws:true` dev proxy | FIX-009 (G8) | Not in selected batch; needs live verify `[NEEDS CONFIRMATION]` | Verify with dev run, then Batch B |
| `org_id` backfill + NOT NULL | FIX-010 (G4 schema leg) | Batch F (data migration) | Dedicated Batch F migration step |
| Video panel gating | FIX-011 (G7) | Batch C; PD-3 gated | Gate behind `comms_video_calls` flag in Batch C |
| Archived write-block, listChatRooms paging, atomic counts, x-audit, MessageSearch mount, doc cleanup | FIX-012..018 | Batch C | Run Batch C `04` pass after Batch B |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Channel modeling (FIX-003) + dialog payload (FIX-002) | `[NEEDS PRODUCT DECISION]` (PD-1) | Auto-join vs explicit-join + who may create channels shapes the contract | PD-1 resolved |
| Two-session chat E2E + dev WS connectivity smoke | `[BLOCKED BY ENVIRONMENT]` | No running WS/dev stack in this fix pass | Run dev server + Playwright; proven at unit/integration here |
| Full G5 join-table membership model | `[NEEDS PRODUCT DECISION]` (PD-1) | Canonical membership model undecided | PD-1; ship only OR-check shim (Batch B) |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Threading, reactions, server-side read-state/unread/mute | V2 DEFERRED | Wave 4 Phase 2/3; zero V1 dependency |
| Full video productization, multi-party video | V2 DEFERRED / DO NOT ADD | m07 video P2 (flag default false); peer-connection is 1:1 |
| Redis caching, message edit/delete, comms-specific rate limits | DO NOT ADD / V2 DEFERRED | Stale healthcare-template ideas / conflicts with immutability invariant |
| JSONB→join-table big-bang migration; new comms org-context middleware; expanding `ChatRoomMemberRepository` | `[DO NOT OVERBUILD]` | Premature rewrite / duplicates shared behavior |
| `core/ws.ts` envelope change | Batch E (isolated) | 9-prefix blast radius; client fixed to match instead |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/comms/sendChatMessage.ts` | Added best-effort WS broadcast of persisted message to `chat-rooms/${room}` | FIX-001 |
| `services/api-ts/src/handlers/comms/createChatRoom.ts` | Gated upsert `admins`/`context` mutation behind existing-admin check; log rejected escalation | FIX-005 |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | Added `ws` to test ctx + `_ws()`; 2 broadcast tests + 3 escalation-guard tests | FIX-001, FIX-005 |
| `apps/memberry/src/features/comms/hooks/comms-ws-frames.ts` (new) | Pure frame contract helper (serialize `{type,data}`, parse `{event,payload}`) | FIX-001 |
| `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts` | Use frame helper for send/ping/onmessage; pong via `event==='pong'` | FIX-001 |
| `apps/memberry/src/features/comms/components/chat-view.tsx` | Read inbound `{event,payload}`; typing via `payload.from`/`payload.isTyping` | FIX-001 |
| `apps/memberry/src/features/comms/components/message-composer.tsx` | Emit typing as `{ isTyping: true }` | FIX-001 |
| `apps/memberry/src/features/comms/__tests__/ws-frame-contract.test.ts` (new) | Bidirectional frame-contract test | FIX-001 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| RED baseline: 54 pass / 4 fail (broadcast + escalation), with exact failure messages | Section 3 (test output captured in this fix pass) | FIX-001, FIX-005 |
| GREEN: comms backend 122/122, frontend comms 18/18, frame contract 7/7, typecheck clean | Section 6 | FIX-001, FIX-005 |
| No screenshots / Playwright / Webwright (no live WS stack) | n/a | — |

## 14. Completion Decision

**PARTIALLY COMPLETE.**

The selected Batch A scope as defined by the orchestrator (FIX-001/G1 + FIX-005/G6) is fully fixed and validated: real-time chat delivery now works end-to-end at the contract level (REST broadcasts; client and server speak the same `{type,data}` ⇄ `{event,payload}` envelope, proven by a shared bidirectional frame-contract test that kills the prior fake-green), and the upsert admin-escalation hole is closed with permission/RBAC + regression tests. All module-level comms tests and typecheck pass with no regressions and no shared/schema files touched.

Decision is PARTIALLY COMPLETE (not COMPLETE) because the fix-ready plan's Batch A also nominally contains FIX-002/FIX-003, which are gated by `[NEEDS PRODUCT DECISION] PD-1` (channel modeling) and were correctly excluded from this pass. Browser-level E2E proof of the live chat journey is `[BLOCKED BY ENVIRONMENT]` (no running WS stack); delivery was proven at unit/integration level. Counts — Fixed: 2; Partially-Fixed: 0; Not-Fixed: 0; Blocked (this batch's gated siblings): FIX-002, FIX-003.

## 15. Recommended Next Step

Request the PD-1 product decision (channel membership/auto-join model + who may create channels), then run another `04-module-or-group-fix-tdd.md` pass for the channel-creation legs (FIX-003 TypeSpec + FIX-002 dialog), followed by **Batch B** (FIX-005 already done; FIX-006 DM creation, FIX-007 membership shim, FIX-008 tenant-isolation handler leg, FIX-009 verify-then-fix Vite `ws:true`).

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Input fix-ready plan: `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md`
- Recommended next batch: Batch B — P1 reliability / trust / permission / tenant gaps
- Before the channel legs: resolve PD-1 (`request product decision`).
- Optionally, once a dev/WS stack is available: rerun a two-session chat E2E to confirm the live journey (`apps/memberry/tests/e2e/comms/`).

---

## Batch B+F Addendum — R-1 tenant org_id (FIX-008 handler leg + FIX-010 migration) (2026-06-12)

Executed the roadmap §8 order-4 item R-1: enforce `chat_room`/`chat_message.organization_id` NOT NULL. This required both the **FIX-008 handler leg** (no path may insert a NULL org) and the **FIX-010 Batch F migration** (backfill + SET NOT NULL) — they are coupled (the migration is unsafe while a live path inserts NULL). Ran against the booted + seeded local stack.

### Pre-flight verification (live DB)

- `chat_room.organization_id` and `chat_message.organization_id` were both `is_nullable = YES` (drift: 0016 nullable, 0019 conditional SET NOT NULL skipped).
- `chat_room`: 5 rows, **0** NULL org. `chat_message`: 107 rows, **2** NULL org; **0** orphan messages (every message has a valid room).
- Root cause of the NULL rows: `ws.chat-room.ts:130` called `createTextMessage(roomId, user.id, data.text)` with **no** org → `createTextMessage` inserted `organizationId!` (undefined → NULL). REST (`sendChatMessage`) already passed org.

### Batch executed

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-008 (handler leg) | WS + system + video message paths could insert NULL org (`organizationId!` lie) | P1 | Fixed |
| FIX-010 (Batch F) | `organization_id` nullable in DB despite schema `.notNull()`; NULL-org rows already present | P1 | Fixed (applied + verified on live DB) |

### TDD evidence (RED → GREEN)

- FIX-008: new `repos/chatMessage.repo.test.ts` — `createTextMessage` (and system/video) derive org from the room when the caller omits it; RED `captured.organizationId` was `undefined`, now the room's org. Explicit-org callers short-circuit the lookup.
- FIX-010: `migration-verify.test.ts` comms block (direct pg) — RED before 0064: both columns `is_nullable = YES`, `chat_message` had 2 NULL rows; GREEN after boot-applied 0064: both `NO`, 0 NULL rows. Confirmed independently via a direct `pg` query.

### Changes made

| File | Change | Fix ID |
| --- | --- | --- |
| `handlers/comms/repos/chatMessage.repo.ts` | Added private `resolveOrgId(chatRoomId, organizationId?)` (returns the passed org or derives it from the room row); used in `createTextMessage`, `createVideoCallMessage`, `createSystemMessage`. Imports `chatRooms`. No path can now insert a NULL org | FIX-008 |
| `generated/migrations/0064_comms_org_id_not_null.sql` (new) | Backfill `chat_message.organization_id` from its room; then **unconditional** `SET NOT NULL` on both `chat_room` + `chat_message` (deliberately not the 0019-style conditional guard that silently skipped) | FIX-010 |
| `generated/migrations/meta/_journal.json` | Registered idx 64 (`0064_comms_org_id_not_null`) | FIX-010 |
| `handlers/comms/repos/chatMessage.repo.test.ts` (new) | 4 org-scoping tests (pollution-proof via make-ctx pristine-restore) | FIX-008 |
| `migration-verify.test.ts` | +comms org NOT NULL data-test (direct pg; NOT NULL + 0-NULL-rows) | FIX-010 |
| `handlers/comms/{ws.chat-room,comms-rest-handlers,chat-rooms-stabilization,video-calls-stabilization,joinVideoCall}.test.ts` | Added `ensurePristine` + `afterEach(restoreRepo)` hygiene — these files raw-patched `ChatMessageRepository.prototype` without restoring, leaking across bun's single-process file-by-file run (latent bug exposed by the new repo test) | test infra |

### Design notes

- **FIX-008 at the repo chokepoint:** deriving org from the room inside the repo closes all 8 callers (WS, REST, video-call, system) + future ones in one place — exactly the plan's "derive orgId from the loaded room row," without touching shared org-context middleware (9-prefix blast radius avoided).
- **Migration safety ordering:** the API was booted with FIX-008 already in the code, so the migrator backfilled the 2 legacy NULLs and enforced NOT NULL while the running app no longer inserts NULL — no runtime breakage. `SET NOT NULL` is a no-op on an already-NOT-NULL column, so re-runs are safe.
- **Live-apply, not just code-level:** unlike 0062/0063 (env-blocked), 0064 was applied through the real migrator on the booted stack and verified ("Database migrations completed successfully" + post-state query).

### Validation

- Full comms handler suite: **126 pass / 0 fail** (incl. the new repo test; the 5 raw-patching files now restore cleanly).
- `migration-verify.test.ts` comms block: GREEN (4 assertions) against the live post-0064 DB.
- API typecheck: 0 errors. API boots; migration 0064 applied successfully.

### Still open in realtime-comms (unchanged)

FIX-002/003 (PD-1 channel modeling), FIX-006 (DM UI), FIX-007 (membership shim — PD-1 for full model), FIX-009 (Vite `ws:true` — live verify), FIX-011..018 (Batch C). The FIX-008 *route-read filtering* leg (reads unfiltered by org) is a separate concern from the insert-path fix done here; the insert NULL hole (the migration blocker) is closed.

### Completion decision — R-1

**COMPLETE** for FIX-008 (insert-path org derivation) + FIX-010 (backfill + NOT NULL, applied and verified on the live booted DB). Test-first, no weakened assertions, full comms suite + typecheck green, and the pre-existing cross-file test pollution that the new test exposed was fixed at its source.

---

## Batch B subset — FIX-007 membership OR-shim + FIX-009 Vite ws:true (decision-free) (2026-06-12)

Executed the decision-free Batch B subset: **FIX-007** (G5 — membership compatibility OR-shim) and **FIX-009** (G8 — Vite dev WS proxy, verify-then-fix). Both are independently shippable without any product decision. The full G5 join-table membership model stays gated by `[NEEDS PRODUCT DECISION] PD-1` — only the OR-check shim was shipped. No TypeSpec / schema / migration / SDK / regen this pass.

### B.1 Fix scope (this subset)

| Item | Details |
| --- | --- |
| Batch executed | Batch B subset — FIX-007 (membership OR-shim) + FIX-009 (Vite `ws:true` verify-then-fix) |
| Superpowers used | Yes (`superpowers:test-driven-development`; RED→GREEN per fix) |
| Working tree status checked | Yes — handler sources (`getChatRoom.ts`/`getChatMessages.ts`/`ws.chat-room.ts`) were clean; both test files were already dirty from Batch A (preserved + extended); report untracked (appended) |
| Fix scope | P1 / `V1 REQUIRED` (FIX-007, FIX-009) |
| Out of scope (untouched) | FIX-002/003/004 (PD-1), FIX-006 (DM UI), FIX-008 route-READ filter leg, FIX-011..018 (Batch C), the full G5 join-table model (PD-1), `core/ws.ts` + `middleware/org-context.ts` (Batch E), TypeSpec/schema/migration/SDK |
| Shared files touched | Yes — `apps/memberry/vite.config.ts` (single-app dev proxy config; one line) |
| Schema/migration touched | No |
| Adversarial verification | Yes — 3-lens parallel skeptic pass (Correctness/Security, Scope, Test-Integrity): **SOLID / SOLID / MINOR** (the MINOR must-fix addressed — see B.8) |
| Limitations | FIX-009 functional end-to-end proof (authenticated WS reaching `connected`) needs a logged-in browser session — that is the deferred `apps/memberry/tests/e2e/comms/chat-connect.spec.ts` (plan §5/Batch D); this pass proves the proxy now **forwards** the upgrade (the only thing `ws:true` changes) via a live before/after probe + a config-presence regression guard |

### B.2 Fixes selected

| Fix ID | Gap | Severity | Scope Label | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-007 | G5 — membership/authz honored ONLY the legacy JSONB `participants`; a member tracked only in the `chat_room_member` join table was wrongly denied WS + REST access | P1 | V1 REQUIRED | Safe OR-check shim; full model PD-1-blocked; channels can't work for ordinary members otherwise | Fixed |
| FIX-009 | G8 — `apps/memberry/vite.config.ts` `/api` proxy missing `ws: true`; chat hook targets `/api/ws/comms/...` | P1 | V1 REQUIRED | Verify-then-fix: live probe confirmed the dev proxy never forwards the WS upgrade (permanent "Reconnecting…") | Fixed |

### B.3 Baseline before changes (RED)

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test comms-rest-handlers.test.ts ws.chat-room.test.ts -t "FIX-007"` | 3 pass / 3 fail | FIX-007 | Honest RED: the 3 **grant** tests fail (a join-table-only member is denied — `ForbiddenError` in `getChatRoom`/`getChatMessages`, `connected` event absent in `ws.chat-room onConnect`). The 3 deny/regression tests already pass (JSONB-only denial). |
| Live WS probe `ws://localhost:3004/api/ws/comms/chat-rooms/X` (BEFORE `ws:true`) | `timeout/hang` (no 101, no response) | FIX-009 | Confirms G8 is real: the dev proxy silently drops the Upgrade request → chat hangs on "Reconnecting…". Direct backend `ws://localhost:7213/ws/...` returned a fast `CLOSE 1002 "Expected 101"` (backend reachable, rejects the unauthenticated upgrade). |

### B.4 Changes made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-007 | Membership/authz now grants access if the user is in the JSONB `participants` array **OR** in the `chat_room_member` join table: `room.participants.includes(user.id) || (await new ChatRoomMemberRepository(db, logger).isMember(roomId, user.id))`. The `\|\|` short-circuits, so the join-table query runs only when JSONB misses — JSONB stays canonical and existing happy-paths make no extra DB call. Calls the **existing** `isMember(chatRoomId, personId)` — **no new repo method added**. | `services/api-ts/src/handlers/comms/getChatRoom.ts`, `getChatMessages.ts`, `ws.chat-room.ts` (onConnect) | No — comms-local authz | Out-of-scope handlers (`sendChatMessage`, `endVideoCall`, `joinVideoCall`, `leaveVideoCall`, `updateVideoCallParticipant`) deliberately left JSONB-only — not in FIX-007 scope |
| FIX-009 | Added `ws: true` (one line) to the `/api` proxy so Vite forwards WebSocket Upgrade requests to the API. | `apps/memberry/vite.config.ts` | Yes `[SHARED DEPENDENCY]` — single-app dev proxy config; memberry dev only | Verified live (B.6); production parity assumed (no prod Vite proxy in play) |

### B.5 Tests added / updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` (extended) | backend/unit + permission/RBAC + regression | `getChatRoom` and `getChatMessages` grant access to a join-table member NOT in JSONB participants (`isMember`→true → 200); and deny a user in neither source (`isMember`→false → `ForbiddenError`). Added `ChatRoomMemberRepository` to `ensurePristine`/`afterEach restoreRepo`; default `isMember` mock = `false`. | FIX-007 |
| `services/api-ts/src/handlers/comms/ws.chat-room.test.ts` (extended) | backend/unit + permission/RBAC + regression | `onConnect` grants a join-table-only member (`connected` event + `trackChannel`, no `close`) and still closes 1008 when in neither source. Same repo pristine-restore hygiene. | FIX-007 |
| `apps/memberry/src/features/comms/__tests__/vite-ws-proxy.test.ts` (new) | regression (config guard) | The `/api` proxy retains `ws: true` — fails if the FIX-009 line is reverted. Config-PRESENCE guard, not a functional WS proof (see B.8). | FIX-009 |

### B.6 FIX-009 live verify-then-fix evidence (before → after)

| Probe (Bun WS client; curl/wget hook-blocked) | BEFORE (`ws:true` absent) | AFTER (`ws:true` added, dev server restarted) |
| --- | --- | --- |
| `ws://localhost:3004/api/ws/comms/chat-rooms/X` (memberry Vite proxy) | `timeout/hang` — upgrade never forwarded | `CLOSE 1002 "Expected 101"` — **identical to the direct backend** |
| `ws://localhost:7213/ws/comms/chat-rooms/X` (backend API, control) | `CLOSE 1002 "Expected 101"` | `CLOSE 1002 "Expected 101"` |

**Interpretation:** the BEFORE→AFTER transition `hang → backend-response` proves the proxy now forwards the WS Upgrade to :7213 (the *only* thing `ws:true` controls). The remaining non-101 is the backend rejecting an **unauthenticated** upgrade — identical on the direct and proxied paths, orthogonal to FIX-009. A logged-in browser session reaches 101/`connected` (the deferred `chat-connect.spec.ts` E2E). Root cause classified (plan marked `[NEEDS CONFIRMATION]`): **confirmed real** — missing `ws: true`.

### B.7 Validation

| Command | Result | Notes |
| --- | --- | --- |
| `bun test comms-rest-handlers.test.ts ws.chat-room.test.ts -t "FIX-007"` (RED) | 3 pass / 3 fail | RED for the right reason (B.3) |
| `bun test comms-rest-handlers.test.ts ws.chat-room.test.ts` (GREEN) | 77 pass / 0 fail | +6 FIX-007 tests, all green |
| `bun test src/handlers/comms/` (full module) | 132 pass / 0 fail (8 files) | No comms regressions |
| `bun test` (full api-ts) | **6187 pass / 1 fail / 4 todo** (565 files) | +6 over the 6181 baseline = the 6 new FIX-007 tests. The 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs > registers email.processor as interval job` (interval 30000 vs 1000) — named in the prompt as known; not this batch. `getNextBookableTime` did not fail this run. |
| `bun test vite-ws-proxy.test.ts` (memberry) | 1 pass / 0 fail | FIX-009 config-presence guard |
| `bun run --filter '*' typecheck` (monorepo) | 5/5 Exited code 0 | `@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry` all clean (incl. the new guard test) |
| Live WS probe (FIX-009) | Pass | hang → forwards-to-backend (B.6) |

### B.8 Adversarial verification (3-lens skeptic pass)

A parallel adversarial review (3 independent skeptics, distinct lenses) was run against the changes:

- **Correctness & Security — SOLID.** Confirmed: `\|\|` short-circuits (no DB call when JSONB hits); `isMember` returns a real boolean; **fail-closed** (in-neither still denied); correct `(chatRoomId, personId)` arg order (no swap); null-safety (user/room validated before the shim); out-of-scope handlers remain JSONB-only; tests are not fake-green (grant test would fail if the OR-leg were removed).
- **Scope Discipline — SOLID.** `chat_room_member.repo.ts` diff is empty (no new method); `core/ws.ts`, `middleware/org-context.ts`, comms TypeSpec/schema unchanged; only the 3 handlers + their tests + the one `vite.config.ts` line changed. (The reviewer noted `createChatRoom.ts`/`sendChatMessage.ts` are also dirty but correctly attributed them to prior-pass FIX-005/FIX-001 — not this batch.)
- **Test Integrity & FIX-009 Proof — MINOR.** FIX-007 tests judged honest/well-structured; the FIX-009 live proof judged logically sound for the forwarding claim. **One `must-fix`:** FIX-009 had no automated regression guard ("a developer reverting this line could do so without any test failure"). **Resolved:** added `vite-ws-proxy.test.ts` (B.5) which fails if `ws: true` is removed (honest RED demonstrated: the presence check returns `false` when the flag is absent). The *functional* end-to-end guard (authenticated WS reaching `connected`) remains the deferred `chat-connect.spec.ts` E2E — documented in B.9, not in this decision-free subset.

### B.9 Remaining gaps / deferred (unchanged by this subset)

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| FIX-009 functional WS E2E (authenticated upgrade → `connected`) | plan §5 / Batch D | Needs a logged-in browser session + live WS stack as a CI fixture; out of the decision-free one-line subset | Add `apps/memberry/tests/e2e/comms/chat-connect.spec.ts` once a WS+auth E2E harness exists |
| Full G5 join-table canonical membership model | PD-1 | Product decision (auto-join vs explicit-join) gates the "right" model | Resolve PD-1; this pass shipped only the safe OR-check shim |
| FIX-008 route-READ org filtering leg | Batch B (separate from the done insert leg) | Reads still unfiltered by org; not in this subset | Run after PD-2 (DM org-scoping strictness) |
| FIX-002/003 (channel create), FIX-004 (default channels), FIX-006 (DM UI) | PD-1 / cross-module / frontend build | Gated / out of subset | Resolve PD-1; then channel + DM passes |
| FIX-011..018 (Batch C: video gating, archived write-block, paging, atomic counts, x-audit, MessageSearch mount, doc cleanup) | Batch C | Later batch | Run Batch C `04` pass |

### B.10 Files changed (this subset)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/comms/getChatRoom.ts` | OR-shim: grant if in JSONB participants OR `chat_room_member` (existing `isMember`) | FIX-007 |
| `services/api-ts/src/handlers/comms/getChatMessages.ts` | Same OR-shim on the message-read authz | FIX-007 |
| `services/api-ts/src/handlers/comms/ws.chat-room.ts` | Same OR-shim in `onConnect` participant check | FIX-007 |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | +`ChatRoomMemberRepository` pristine-restore; default `isMember`=false; grant+deny tests for `getChatRoom`/`getChatMessages` | FIX-007 |
| `services/api-ts/src/handlers/comms/ws.chat-room.test.ts` | Same repo hygiene; onConnect grant+deny tests | FIX-007 |
| `apps/memberry/vite.config.ts` | Added `ws: true` to the `/api` proxy (one line + comment) | FIX-009 |
| `apps/memberry/src/features/comms/__tests__/vite-ws-proxy.test.ts` (new) | Config-presence regression guard for `ws:true` | FIX-009 |

### B.11 Completion decision — Batch B subset

**COMPLETE.** Both selected decision-free fixes are implemented and validated: FIX-007 (membership OR-shim) test-first RED→GREEN with grant + fail-closed regression coverage across REST + WS; FIX-009 (Vite `ws:true`) verified live (hang → upgrade forwarded) and guarded against revert. Full comms suite (132/132), full api-ts (`+6`, only the pre-existing unrelated `registerEmailJobs` fail), and monorepo typecheck (5/5) all green. No restricted/shared backend files, TypeSpec, schema, migration, or SDK touched. Adversarially verified (Correctness/Scope SOLID; the one Test-Integrity must-fix on FIX-009 regression coverage was resolved). Out-of-subset items (PD-1/PD-2/PD-3-gated fixes, FIX-006 DM UI, FIX-008 read-filter, Batch C, Batch E shared files) deliberately untouched.

### B.12 Recommended next step

Per the continuation todolist, proceed to **A12 — Dues Batch B subset** (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope) via another `04-module-or-group-fix-tdd.md` pass — NOT another realtime-comms batch. Realtime-comms next-in-line items are decision-GATED (PD-1/PD-2/PD-3) or carry-forward (FIX-006 DM UI as its own comms-UI pass) and are tracked in the roadmap.

- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`
- Next module: Dues (Batch B subset) — see the continuation prompt's Track A sequence.

---

## Channel-Model Batch — FIX-003 + FIX-002 + FIX-004 + FIX-007 (PD-1 unblocked) (2026-06-13)

Executed the **PD-1-unblocked channel-model cluster** (continuation Step 31): channel
creation now actually works end-to-end and is officer-gated, members auto-join their
org's channels. PD-1 was resolved Step 29 (auto-join + officer-only creation). Fix-only,
TDD (RED→GREEN per fix), no autorun, no commit.

### C.1 Fix scope

| Item | Details |
| --- | --- |
| Batch executed | Channel-model cluster — FIX-003 (TypeSpec channel modeling + regen), FIX-002 (Create-Channel dialog payload), FIX-004 (default-channel provisioning + member auto-join), FIX-007 (real `chat_room_member` model: join-table population + officer-only create gate) |
| Superpowers used | Yes (`superpowers:test-driven-development`; RED→GREEN per fix) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2); preserved. Forbidden destructive git commands not used. |
| Fix scope | P0 (FIX-002/003) + P1 (FIX-004/007); all `V1 REQUIRED` |
| Out of scope (untouched) | DM PD-2, video PD-3, FIX-008 read-filter leg, FIX-011..018 (Batch C), `core/ws.ts` + `orgContextOptionalMiddleware` (Batch E), threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build) |
| Shared files touched | Yes — `comms.tsp` (regen pipeline) + `core/domain-event-consumers.ts` (comms-owned consumers, `[CROSS-MODULE RISK]` org/membership events) |
| Schema/migration touched | No — `chat_room.name`/`room_type` columns + `chat_room_member` join table already existed (prior migration); FIX-003 only aligns the TypeSpec contract to the live schema. No `db:generate`. |
| Limitations | Live two-session channel E2E + real-DB provisioning integration `[BLOCKED BY ENVIRONMENT]` (no running WS/seeded stack this pass); proven at unit/integration level (real generated validator round-trip + handler officer-gate/auto-add + consumer capturing-db provisioning/auto-join). Existing orgs/members are NOT backfilled into channels (see C.9). |

### C.2 Fixes selected

| Fix ID | Gap | Severity | Scope Label | Status |
| --- | --- | --- | --- | --- |
| FIX-003 | G2 (TypeSpec leg) — ChatRoom/CreateChatRoomRequest lacked `name`/`roomType`; `context` typed UUID rejected `channel:*` slugs | P0 | V1 REQUIRED | Fixed |
| FIX-002 | G2 (dialog leg) — Create-Channel dialog sent `participants: []` + non-UUID `context: 'channel:x'` (rejected) | P0 | V1 REQUIRED | Fixed |
| FIX-004 | G2 (provisioning) — `createDefaultChannels` had zero callers; members always saw "No channels yet" | P1 | V1 REQUIRED | Fixed (wiring + auto-join; live backfill deferred) |
| FIX-007 | G5 — channel membership model: populate `chat_room_member` (creator admin + auto-join) + officer-only create gate | P1 | V1 REQUIRED | Fixed |

### C.3 Baseline before changes (RED)

| Check/Test | Result Before | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `channel-create-validator.test.ts` (new) | 4 fail | FIX-003 | Generated `CreateChatRoomRequestSchema` stripped `name`/`roomType`, accepted a `bogus` roomType, and rejected a `channel:*` context (`context: z.string().uuid()`) |
| `comms-rest-handlers.test.ts -t channels` (new block) | 3 fail / 1 pass | FIX-002/003/007 | Officer channel create rejected by the ≥1/≥2 participant rule; no officer gate; no join-table populate |
| `domain-event-consumers.test.ts -t FIX-004` (new block) | 2 fail / 1 pass | FIX-004 | `organization.created`/`membership.created` had no channel consumers → 0 inserts captured |
| `create-channel-dialog.test.tsx` (new `buildChannelCreateBody`) | 1 fail (export missing) | FIX-002 | Payload builder did not exist |

### C.4 Changes made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-003 | Added `ChatRoomType` enum (`channel`/`dm`/`group`); added `name?`/`roomType` to `ChatRoom` + `CreateChatRoomRequest`; changed `context` `UUID`→`string` (accepts booking UUIDs AND `channel:*` slugs). Regenerated. | `specs/api/src/modules/comms.tsp` → regen `generated/openapi/{validators,routes,registry}.ts`; `handlers/comms/repos/comms.schema.ts` (hand `CreateChatRoomRequest` interface) | Yes — TypeSpec regen pipeline | DB columns already existed; no migration |
| FIX-002 | Extracted pure `buildChannelCreateBody(name, orgId)` → `{ name: slug, roomType: 'channel', organizationId, participants: [] }`; dropped the `context: 'channel:x'` hack. Dialog takes an `orgId` prop; officer messages page passes `useOrgProvider().orgId`. | `apps/memberry/src/features/comms/components/create-channel-dialog.tsx`; `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/messages/index.tsx` | No — comms FE | `organizationId` is read by `orgContextOptionalMiddleware` from the raw body, then stripped by the validator |
| FIX-007 | `createChatRoom`: when `roomType==='channel'` → (a) `requireOfficerTerm(ctx)` gate (officer-only PD-1); (b) relax the ≥2-participant rule (channel may start with just the creator); (c) auto-add creator to participants + admins; (d) skip participant-set dedup lookup; (e) populate `chat_room_member` (creator as `admin`) via the existing `ChatRoomMemberRepository.addMember`. | `services/api-ts/src/handlers/comms/createChatRoom.ts` | No — comms handler | OR-shim read path (Batch B) retained; join table is now authoritative for channels |
| FIX-004 | Added `autoJoinOrgChannels(db, orgId, personId)` (join-table insert + idempotent JSONB participants append so `listChatRooms` surfaces the channel). Wired 3 comms-owned consumers: `organization.created` → `createDefaultChannels`; `membership.created` + `membership.imported` → `autoJoinOrgChannels`. | `services/api-ts/src/handlers/comms/default-channels.ts`; `services/api-ts/src/core/domain-event-consumers.ts` | Yes `[CROSS-MODULE RISK]` — subscribes to platformadmin/membership events; no edits to those handlers (they already emit) | Fire-and-forget, each consumer owns try/catch + structured error log (P1.6 pattern) |

### C.5 Tests added / updated

| Test File | Type | What It Proves | Fix ID |
| --- | --- | --- | --- |
| `handlers/comms/channel-create-validator.test.ts` (new) | integration (real generated validator) | Channel payload (`name`+`roomType: 'channel'`) survives parsing; non-UUID `channel:*` context accepted; UUID context still accepted (regression); unknown roomType rejected. Round-trip against the REAL `CreateChatRoomRequestSchema`, not a mocked mutation. | FIX-003 |
| `handlers/comms/comms-rest-handlers.test.ts` (+4) | backend/unit + permission/RBAC | Officer channel create → 201 with `roomType=channel`, persisted `name`, creator auto-added to participants+admins, `addMember(roomId, creator, 'admin')`; non-officer → 403 (no create, no addMember); non-channel keeps ≥2 rule. | FIX-007/002/003 |
| `core/domain-event-consumers.test.ts` (+3) | integration (capturing db) | `organization.created` provisions `#general`+`#announcements` (roomType channel, org-scoped); `membership.created` auto-joins member to join table + appends JSONB participants; idempotent (no double-append when already a participant). | FIX-004 |
| `features/comms/__tests__/create-channel-dialog.test.tsx` (+1) | frontend/component | `buildChannelCreateBody` emits a valid org-scoped channel payload and drops the `context` hack. | FIX-002 |

### C.6 Tests run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test channel-create-validator + comms-rest-handlers + domain-event-consumers` | Passed | 103 pass / 0 fail (RED was 4+3+2 fail) |
| `bun test src/handlers/comms/` (full module) | Passed | 140 pass / 0 fail (9 files) |
| `bun test` (full api-ts) | Passed | **6196 pass / 1 fail / 3 todo** (584 files). +11 over the 6185 baseline (4 validator + 4 handler + 3 consumer). The 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs` interval (30000 vs 1000), named known in the prompt. |
| `bun run test` (full memberry) | Passed | **670 pass / 0 fail** (+1 over 669 baseline = the dialog payload test) |
| `bun run --filter '*' typecheck` (monorepo) | Passed | 5/5 Exited code 0 (`@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry`) |
| `bun run check:sdk-compat` (root) | Exit 1 — pre-existing | 25 BREAKING op-id changes are ALL pre-existing advertising/jobs/marketplace `/association/*` path moves (dirty tree) — **zero comms ops** appear; the FIX-003 change is field-level/additive on existing comms ops, invisible to the op-level gate. Per the prompt, do NOT `--update` `SDK_BASELINE_OPS.json` until milestone Step 6. |

### C.7 Validation summary

- **Passed:** every targeted + module + full-suite test on both workspaces; 5/5 monorepo typecheck.
- **Failed:** none from this batch. The single api-ts fail is the pre-existing unrelated `registerEmailJobs` interval test.
- **Pre-existing (not this batch):** `check:sdk-compat` exit-1 from advertising/jobs/marketplace baseline drift; do not baseline-update.
- **Blocked:** live channel E2E + real-DB provisioning `[BLOCKED BY ENVIRONMENT]`.

### C.8 Shared / cross-module impact

| Area | Files | Blast Radius | Coverage |
| --- | --- | --- | --- |
| TypeSpec regen | `comms.tsp` → `generated/openapi/{validators,routes,registry}.ts` | Comms ops only (additive fields); the regen also re-emitted the working tree's pre-existing advertising/jobs/marketplace drift into the generated files (dirty-tree reality, not new behavior) | validator round-trip test + full api-ts suite green |
| Domain-event consumers `[CROSS-MODULE RISK]` | `core/domain-event-consumers.ts` (+3 `domainEvents.on`) | Subscribes to `organization.created` (platformadmin) + `membership.created`/`membership.imported` (member) — **no edits to those emitters**; fire-and-forget so a failure cannot break org/membership creation | capturing-db consumer tests + full consumer suite (no regressions to the existing welcome-notification consumers) |

### C.9 Remaining gaps

| Gap | Source | Reason | Next Step |
| --- | --- | --- | --- |
| Existing orgs/members not backfilled into channels | FIX-004 | Provisioning/auto-join fire only on NEW org/membership events; pre-existing rows are untouched | One-off backfill script (`createDefaultChannels` + `autoJoinOrgChannels` over current orgs/members) during the next seeded-stack pass — `[BLOCKED BY ENVIRONMENT]` here |
| `createMembership` manual officer path does not emit `membership.created` | FIX-004 | Only application/invite/import paths emit it; manual create skips auto-join | Emit `membership.created` from `member/membership/createMembership.ts` (its own small cross-module change) or auto-join inline there |
| Live two-session channel chat E2E | plan §5 / Batch D | No running WS+auth stack | `apps/memberry/tests/e2e/comms/` once a WS E2E harness exists |
| FIX-008 route-READ org filtering leg | Batch B (separate from done insert leg) | Reads still unfiltered by org | After PD-2 (DM org-scoping strictness) |

### C.10 Files changed (this batch)

| File | Change | Fix ID |
| --- | --- | --- |
| `specs/api/src/modules/comms.tsp` | `ChatRoomType` enum; `name?`/`roomType` on ChatRoom + CreateChatRoomRequest; `context` UUID→string | FIX-003 |
| `services/api-ts/src/generated/openapi/{validators,routes,registry}.ts` | Regenerated (DO NOT hand-edit) | FIX-003 |
| `services/api-ts/src/handlers/comms/repos/comms.schema.ts` | `CreateChatRoomRequest` interface +`name?`/`roomType?` | FIX-003 |
| `services/api-ts/src/handlers/comms/createChatRoom.ts` | Officer gate + creator auto-add + relaxed participant rule + join-table populate for channels | FIX-007 |
| `services/api-ts/src/handlers/comms/default-channels.ts` | New `autoJoinOrgChannels` | FIX-004 |
| `services/api-ts/src/core/domain-event-consumers.ts` | 3 comms consumers (org.created provision; membership.created/.imported auto-join) | FIX-004 |
| `apps/memberry/src/features/comms/components/create-channel-dialog.tsx` | `buildChannelCreateBody`; `orgId` prop; dropped `channel:x` context hack | FIX-002 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/messages/index.tsx` | Pass `useOrgProvider().orgId` to the dialog | FIX-002 |
| `handlers/comms/channel-create-validator.test.ts` (new), `comms-rest-handlers.test.ts`, `core/domain-event-consumers.test.ts`, `features/comms/__tests__/create-channel-dialog.test.tsx` | Tests | all |

### C.11 Completion decision — channel-model batch

**COMPLETE.** All four selected fixes implemented test-first (RED→GREEN) with no weakened
assertions: channel creation is modeled in the contract (FIX-003, real-validator round-trip),
the dialog sends a valid org-scoped payload (FIX-002), creation is officer-only with the
creator auto-joined to the authoritative `chat_room_member` table (FIX-007), and orgs ship
with `#general`/`#announcements` whose members auto-join (FIX-004). Full api-ts (+11, only the
pre-existing `registerEmailJobs` fail), full memberry (+1), and 5/5 monorepo typecheck green.
No DB migration (columns pre-existed); no `core/ws.ts`/org-middleware edits; OR-shim read path
retained. The one-off backfill of existing orgs/members and the live channel E2E are the only
deferred items, both `[BLOCKED BY ENVIRONMENT]`.

### C.12 Recommended next step

Per the continuation Stop condition, recommend exactly one next gated batch (do NOT auto-chain):

- **realtime FIX-008 tenant-isolation read-filter leg + DM PD-2** — the channel path is now
  org-provisioned, so the read-filter strictness question (and DM org-scoping, PD-2) is the
  natural next realtime batch. Run via `docs/aha/prompts/04-module-or-group-fix-tdd.md` against
  `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md`.
- Alternatives per consolidated-roadmap §8: surveys PD-1/2/3, or documents Batch C (certificates, gated on Q8).

---

## Batch C — decision-free completeness/trust subset — FIX-012 + FIX-013 + FIX-014 + FIX-016 + FIX-017 (2026-06-13)

Executed the **decision-free** Batch C subset: archived-room write-block, `listChatRooms`
filter/pagination correctness, atomic message-count + active-call claim, mounting the
unwired `MessageSearch`, and `x-audit` on the privileged comms ops. Fix-only, TDD
(RED→GREEN per fix), no autorun, no commit. The product-gated Batch C items
(FIX-011 video PD-3, FIX-015/018 spec-direction CF-1, FIX-008 DM read-filter PD-2)
were deliberately **not** touched.

### D.1 Fix scope

| Item | Details |
| --- | --- |
| Batch executed | Batch C decision-free subset — FIX-012 (archived write-block REST+WS), FIX-013 (`listChatRooms` SQL filter+pagination), FIX-014 (atomic `messageCount` + active-call claim), FIX-016 (mount `MessageSearch`), FIX-017 (`x-audit` on createChatRoom + endVideoCall) |
| Superpowers used | Yes (`superpowers:test-driven-development`; RED→GREEN per fix) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2 + Step 31 channel-model); preserved. No forbidden destructive git commands used. |
| Fix scope | Selected P2 / `V1 RECOMMENDED` (FIX-012/013/014/016/017) |
| Out of scope (untouched) | FIX-011 video gating (PD-3), FIX-015 WS inbound spec-vs-impl (CF-1), FIX-018 `comms.md` cleanup (CF-1), FIX-008 DM read-filter (PD-2); FIX-014 upsert dup-room **constraint** leg (needs a DB unique index → Batch F); `core/ws.ts` + `orgContextOptionalMiddleware` (Batch E); threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build) |
| Shared files touched | Yes — `comms.tsp` (regen pipeline, FIX-017) |
| Schema/migration touched | No — `messageCount`/`active_video_call_message` columns pre-exist; the atomic guards are SQL on existing columns. No `db:generate`. |
| Limitations | Live two-session/concurrency E2E `[BLOCKED BY ENVIRONMENT]` (no running WS/seeded stack this pass). FIX-014 atomicity proven at the contract level (repo conditional-UPDATE returns/throws on rows-affected; handler retires the orphan on a lost claim) — true DB-level concurrency is enforced by the `WHERE active_video_call_message IS NULL` clause + SQL `+ 1`, exercised here via capturing-db + handler mocks, not a real parallel DB run. |

### D.2 Fixes selected

| Fix ID | Gap | Severity | Scope Label | Status |
| --- | --- | --- | --- | --- |
| FIX-012 | G10 — archived rooms accept new messages via REST + WS | P2 | V1 RECOMMENDED | Fixed |
| FIX-013 | G12 — `listChatRooms` context filter applied AFTER slice; `withParticipant` totals wrong; in-memory pagination | P2 | V1 RECOMMENDED | Fixed |
| FIX-014 | G11 — non-atomic `messageCount` increment; check-then-set active-call | P2 | V1 RECOMMENDED | Fixed (count + active-call); **upsert dup-room constraint deferred to Batch F** |
| FIX-016 | §12 — `MessageSearch` unmounted (backend search done + tested, zero consumers) | P2 | V1 RECOMMENDED | Fixed |
| FIX-017 | §15 — no `x-audit` on comms ops; room creation + call end leave only pino logs | P2 | V1 RECOMMENDED | Fixed |

### D.3 Baseline before changes (RED)

| Check/Test | Result Before | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `comms-audit.test.ts` (new, pre-regen) | 2 fail | FIX-017 | Authentic RED: the generated `routes.ts` blocks for createChatRoom/endVideoCall contained no `createPerRouteAuditMiddleware(...)` (x-audit not yet declared). After the `comms.tsp` edit + regen → GREEN. |
| `comms-rest-handlers.test.ts` (FIX-012 archived REST) | RED (no guard) | FIX-012 | Without the `room.status === 'archived'` guard, `createTextMessage` IS called for an archived room; the new test asserts it is **not** called + `BusinessLogicError`. |
| `ws.chat-room.test.ts` (FIX-012 archived WS) | RED (no guard) | FIX-012 | Pre-fix the WS `chat.message` path never read room status → persisted + broadcast to archived rooms. |
| `comms-rest-handlers.test.ts` (FIX-013) | RED | FIX-013 | Old handler sliced then filtered in-memory and reported `total = page length`; new tests assert filters reach the repo and `pagination.totalCount` = SQL total. |
| `chatRoom.repo.test.ts` (new, FIX-014) | RED | FIX-014 | `updateLastMessage` did findOneById + `count + 1` (read-then-write); `setActiveVideoCall` was an unconditional set. |
| `comms-rest-handlers.test.ts` (FIX-014 orphan) | RED | FIX-014 | No conditional claim → no ConflictError → no orphan retirement on a lost race. |
| `messages-search-mount.test.tsx` (new, FIX-016) | RED (source guard) | FIX-016 | The page source did not import/render `<MessageSearch`. |

### D.4 Changes made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-012 | REST: reject sends to `status === 'archived'` rooms with `BusinessLogicError('…archived…','ROOM_ARCHIVED')` after the participant check. WS: load the room in the `chat.message` case and, if archived, send an `{event:'error'}` frame and `break` (no persist, no broadcast). | `handlers/comms/sendChatMessage.ts`, `handlers/comms/ws.chat-room.ts` | No | Mirrors the documented read-only semantics on both write paths |
| FIX-013 | Pushed status/context/withParticipant filtering AND LIMIT/OFFSET into SQL. New `ChatRoomFilters.withParticipants` (AND semantics → multiple `@>` ANDed) + new `ChatRoomRepository.findUserRoomsPage()` using `findManyWithPagination` (true total). Handler no longer slices-then-filters. | `handlers/comms/listChatRooms.ts`, `handlers/comms/repos/chatRoom.repo.ts`, `handlers/comms/repos/comms.schema.ts` | No | Booking-chat lookup by `context` now works regardless of page |
| FIX-014 | `updateLastMessage`: `messageCount` increments SQL-side (`message_count + 1`), removing the read-then-write. `setActiveVideoCall(roomId, msgId)` for a non-null id is now a conditional UPDATE (`WHERE active_video_call_message IS NULL`) returning the row; 0 rows → `ConflictError`. `sendChatMessage` retires the orphan call message (`status: 'ended'`) when it loses the claim. The clear path (`null`) stays unconditional. | `handlers/comms/repos/chatRoom.repo.ts`, `handlers/comms/sendChatMessage.ts` | No | Upsert dup-room **constraint** leg deferred (needs a DB unique index → Batch F; JSONB participant-set uniqueness can't be app-level-guarded safely) |
| FIX-016 | Mounted `MessageSearch` in the member messages page behind a header "Search" toggle; selecting a result opens that room. Uses `useOrgProvider().orgId`. | `apps/memberry/src/routes/_authenticated/org/$orgSlug/messages/index.tsx` | No | Officer page already had its own surface; this wires the member surface |
| FIX-017 | Declared `@extension("x-audit", #{ action:"create", resourceType:"chat-room" })` on createChatRoom and `#{ action:"complete", resourceType:"video-call" }` on endVideoCall; regenerated. createChatRoom now `ctx.set('auditResourceId', room.id)` (op has no path param, else the audit row would record `unknown`). | `specs/api/src/modules/comms.tsp` → regen `generated/openapi/{routes,validators,registry}.ts`; `handlers/comms/createChatRoom.ts` | Yes — TypeSpec regen pipeline | endVideoCall's resource id falls back to the `:room` path param (no handler change) |

### D.5 Tests added / updated

| Test File | Type | What It Proves | Fix ID |
| --- | --- | --- | --- |
| `handlers/comms/comms-rest-handlers.test.ts` | backend/unit + regression | REST send to an archived room throws `BusinessLogicError` and never persists; orphan call message retired (`status:'ended'`) on a lost active-call claim; `listChatRooms` passes `withParticipant`+`context` to the repo and surfaces the SQL `totalCount`; createChatRoom sets `auditResourceId`. Added `ctx.set`/`_set` to the test ctx. | FIX-012/013/014/017 |
| `handlers/comms/ws.chat-room.test.ts` | backend/unit + regression | WS `chat.message` to an archived room sends an error frame and does NOT persist or broadcast | FIX-012 |
| `handlers/comms/repos/chatRoom.repo.test.ts` (new) | backend/unit (capturing-db) | `updateLastMessage` increments SQL-side (no findOneById read; messageCount is a SQL fragment); `setActiveVideoCall` claims on rows-affected and throws `ConflictError` on 0 rows; `findUserRoomsPage` ANDs `[user, participant]`, passes context/status + pagination, returns the true total | FIX-013/014 |
| `handlers/__tests__/comms-audit.test.ts` (new) | integration (generated routes) | createChatRoom + endVideoCall register `createPerRouteAuditMiddleware(...)` in the generated route table | FIX-017 |
| `apps/memberry/src/features/comms/__tests__/messages-search-mount.test.tsx` (new) | frontend/component + source guard | `MessageSearch` renders and queries `/api/comms/messages/search?q=…` after typing ≥2 chars; the member messages page imports + renders `<MessageSearch` (RED if the mount is reverted) | FIX-016 |
| `handlers/comms/chat-rooms-stabilization.test.ts` | backend/unit (updated) | listChatRooms permission-boundary tests updated to the new `findUserRoomsPage` delegate; added `ctx.set` to its makeCtx | FIX-013/017 |

### D.6 Tests run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/handlers/comms/ src/handlers/__tests__/comms-audit.test.ts` (api-ts) | Passed | 152 pass / 0 fail (FIX-017 was 2-fail RED pre-regen) |
| `bun test` (full api-ts) | Passed* | **6208 pass / 1 fail / 3 todo / 93 skip** (586 files). +12 over the 6196 baseline (= the 12 new Batch C tests). *The 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs > registers email.processor as interval job` (interval 30000 vs 1000), named known in the prompt. |
| `bun test messages-search-mount.test.tsx` (memberry) | Passed | 4 pass / 0 fail |
| `bun run test` (full memberry) | Passed | **674 pass / 0 fail** (+4 over the 670 baseline) |
| `bun run --filter '*' typecheck` (monorepo) | Passed | 5/5 Exited code 0 (`@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry`) |
| `bun run check:sdk-compat` (root) | Exit 1 — pre-existing | The same 25 BREAKING op-id changes are ALL pre-existing advertising/jobs/marketplace `/association/*` path moves — **zero comms ops**; FIX-017's x-audit is additive extension metadata, invisible to the op-level gate. Per the prompt, did NOT `--update` `SDK_BASELINE_OPS.json`. |

### D.7 Validation summary

- **Passed:** every targeted + module + full-suite test on both workspaces; 5/5 monorepo typecheck.
- **Failed:** none from this batch. The single api-ts fail is the pre-existing unrelated `registerEmailJobs` interval test.
- **Pre-existing (not this batch):** `check:sdk-compat` exit-1 from advertising/jobs/marketplace baseline drift; do not baseline-update.
- **Blocked:** live concurrency / two-session WS E2E `[BLOCKED BY ENVIRONMENT]`.

### D.8 Shared / cross-module impact

| Area | Files | Blast Radius | Coverage |
| --- | --- | --- | --- |
| TypeSpec regen (FIX-017) | `comms.tsp` → `generated/openapi/{routes,validators,registry}.ts` | Comms ops only (additive `x-audit` middleware on createChatRoom/endVideoCall). The regen also re-emitted the working tree's pre-existing advertising/jobs/marketplace path-move drift into the generated files (dirty-tree reality, not new behavior). | `comms-audit.test.ts` generated-routes assertion + full api-ts suite green |

`core/ws.ts`, `middleware/org-context.ts`, and the comms schema/migrations were **not** touched.

### D.9 Remaining gaps

| Gap | Source Fix ID | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Upsert dup-room race (two concurrent DM/group creates → duplicate rooms) | FIX-014 (constraint leg) | A JSONB participant-set unique index is a DB/schema change (Batch F); not app-level-guardable safely | Add a partial unique index / canonical-participants column in a Batch F migration |
| Live concurrency proof (parallel active-call starts → exactly one 409 at the DB) | FIX-014 | No running seeded DB this pass | Add an integration test against a booted DB when a WS/DB harness exists |
| Live two-session message E2E (archived reject + search in browser) | FIX-012/016 | No running WS/auth stack | `apps/memberry/tests/e2e/comms/` once a WS E2E harness exists |

### D.10 Files changed (this batch)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/comms/sendChatMessage.ts` | Archived-room reject (REST); atomic active-call claim + orphan retirement | FIX-012/014 |
| `services/api-ts/src/handlers/comms/ws.chat-room.ts` | Archived-room reject on the WS `chat.message` path | FIX-012 |
| `services/api-ts/src/handlers/comms/listChatRooms.ts` | Delegates to SQL-filtered, paginated `findUserRoomsPage`; true total | FIX-013 |
| `services/api-ts/src/handlers/comms/repos/chatRoom.repo.ts` | `withParticipants` AND filter; `findUserRoomsPage`; SQL-side `messageCount + 1`; conditional atomic active-call claim | FIX-013/014 |
| `services/api-ts/src/handlers/comms/repos/comms.schema.ts` | `ChatRoomFilters.withParticipants` | FIX-013 |
| `services/api-ts/src/handlers/comms/createChatRoom.ts` | `ctx.set('auditResourceId', room.id)` for the x-audit middleware | FIX-017 |
| `specs/api/src/modules/comms.tsp` | `x-audit` on createChatRoom + endVideoCall | FIX-017 |
| `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` | Regenerated (DO NOT hand-edit) | FIX-017 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/messages/index.tsx` | Mounted `MessageSearch` behind a Search toggle | FIX-016 |
| `handlers/comms/comms-rest-handlers.test.ts`, `ws.chat-room.test.ts`, `chat-rooms-stabilization.test.ts`, `repos/chatRoom.repo.test.ts` (new), `handlers/__tests__/comms-audit.test.ts` (new), `apps/memberry/.../messages-search-mount.test.tsx` (new) | Tests | all |

### D.11 Completion decision — Batch C decision-free subset

**COMPLETE.** All five decision-free Batch C fixes implemented test-first (RED→GREEN) with
no weakened assertions: archived rooms are read-only on both REST + WS (FIX-012);
`listChatRooms` filters and paginates in SQL with a true total (FIX-013); `messageCount`
increments atomically and the active-call slot is claimed via a conditional UPDATE with
orphan retirement (FIX-014); `MessageSearch` is mounted and queries the endpoint (FIX-016);
createChatRoom + endVideoCall emit audit events via `x-audit` (FIX-017, regen). Full api-ts
(+12, only the pre-existing `registerEmailJobs` fail), full memberry (+4), and 5/5 monorepo
typecheck green. No `core/ws.ts`/org-middleware edits, no DB migration. The FIX-014 upsert
dup-room **constraint** leg is the only deferred slice (→ Batch F schema), plus the
`[BLOCKED BY ENVIRONMENT]` live concurrency/E2E proofs.

### D.12 Recommended next step

Per the Stop condition, recommend exactly one next gated batch (do NOT auto-chain):

- **realtime FIX-008 DM read-filter leg + DM PD-2** (or **video PD-3 gate FIX-011**, or
  **spec-direction FIX-015/018 CF-1**) — all remaining realtime items are product/spec-gated.
  Run via `docs/aha/prompts/04-module-or-group-fix-tdd.md` against
  `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` once the gating decision lands.
- Alternatives per consolidated-roadmap §8: surveys PD-1/2/3, or documents Batch C
  (certificates, gated on Q8).

---

## FIX-008 read-path org-scoping — decision-free non-DM subset (2026-06-13)

Executed the **FIX-008 read-path** leg (continuation Step 33): enforce org isolation on
comms **reads** for org-scoped rooms (channel / booking / group), deriving the caller org
from `ctx.get('organizationId')` (set by the shared `orgContextOptionalMiddleware`) and the
room org from the loaded row — **module-local, the shared middleware was NOT touched**
(verified 9-prefix blast radius). DM rooms (`roomType === 'dm'`) are org-agnostic by design
and were deliberately **left untouched** (PD-2 gated). The insert-path leg of FIX-008 +
the FIX-010 NOT NULL migration were already DONE (Batch B+F Addendum); only the read filter
remained. Fix-only, TDD (RED→GREEN), no autorun, no commit. No TypeSpec / regen / schema /
migration / SDK / frontend change.

### E.1 Fix scope

| Item | Details |
| --- | --- |
| Batch executed | FIX-008 read-path org-scoping — decision-free non-DM subset (`getChatRoom`, `getChatMessages` cross-org deny; `listChatRooms`, `searchChatMessages` org-scope; DM rooms exempt) |
| Superpowers used | Yes (`superpowers:using-superpowers`, `superpowers:test-driven-development`; RED→GREEN per leg) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2 + Step 31 channel-model + Step 32 Batch C); preserved. No forbidden destructive git commands used. |
| Fix scope | P1 / `V1 REQUIRED` (FIX-008 read leg, non-DM subset) |
| Out of scope (untouched) | **DM org-scoping strictness (PD-2)** — DM rooms keep participant-based access; **FIX-011 video PD-3**, **FIX-015/018 spec-direction CF-1**, FIX-014 upsert dup-room constraint (Batch F); `core/ws.ts` + `orgContextOptionalMiddleware` (Batch E); WS `onConnect` read path (not in the prompt's read-path list); threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build) |
| Shared files touched | No — `orgContextOptionalMiddleware`/`core/ws.ts` deliberately untouched; orgId derived module-locally from `ctx.get('organizationId')` + the loaded room row |
| Schema/migration touched | No — `organization_id`/`room_type` columns pre-exist; the read filter is a WHERE clause (`organizationIdOrDm`) on existing columns. No `db:generate`. |
| Frontend touched | No — the memberry chat UI does not yet send `x-org-id` on comms reads, so the new backend guard/filter is **dormant for that surface today** and active for any org-aware caller (platform-admin flows, SDK clients that pass `x-org-id`, future FE wiring). See E.9 (remaining gap: wire `x-org-id` onto the comms read calls). |
| Limitations | The enforcement keys off `ctx.get('organizationId')`, which the optional middleware only populates when the request carries org context (`x-org-id` header / `orgId` query / path UUID). For non-DM reads where no org context is present, behavior is unchanged (the existing participant/`chat_room_member` OR-shim still governs) — the org guard is additive defense-in-depth, never fail-open-weakening. Live cross-org browser E2E `[BLOCKED BY ENVIRONMENT]` (no running WS/seeded stack); proven at unit level. |

### E.2 Fixes selected

| Fix ID | Gap | Severity | Scope Label | Status |
| --- | --- | --- | --- | --- |
| FIX-008 (read leg, getChatRoom) | G4 — a cross-org caller could read a non-DM room's metadata if listed as a (stale) participant; reads were unfiltered by org | P1 | V1 REQUIRED | Fixed |
| FIX-008 (read leg, getChatMessages) | G4 — same for a non-DM room's message history | P1 | V1 REQUIRED | Fixed |
| FIX-008 (read leg, listChatRooms) | G4 — listing returned all of the user's rooms unfiltered by org | P1 | V1 REQUIRED | Fixed (org-scoped when caller org known; DMs preserved) |
| FIX-008 (read leg, searchChatMessages) | G4 — search spanned all of the user's rooms unfiltered by org | P1 | V1 REQUIRED | Fixed (org-scoped when caller org known; DMs preserved) |
| DM org-scoping strictness | PD-2 | — | — | **Blocked** `[NEEDS PRODUCT DECISION] PD-2` — DM rooms deliberately exempt (cleanly separated via `roomType === 'dm'`) |

### E.3 Baseline before changes (RED)

| Check/Test | Result Before | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `comms-rest-handlers.test.ts` (3 new FIX-008 getChatRoom/getChatMessages cross-org tests) | fail | FIX-008 read | Without the guard, a cross-org participant of a non-DM room is granted 200 — RED for the right reason (no org check existed). The DM-allow + same-org-allow tests already passed pre-fix (correct without a guard). |
| `comms-rest-handlers.test.ts` (listChatRooms caller-org passthrough) | fail | FIX-008 read | `findUserRoomsPage` was called without an `organizationId`. |
| `chatRoom.repo.test.ts` (2 new) | fail | FIX-008 read | `findUserRoomsPage` did not map a caller org to a filter key; `buildWhereConditions` had no org-or-dm branch. |
| `searchChatMessages.test.ts` (org-scope appended) | fail | FIX-008 read | The WHERE clause carried no org filter even when org context was present. |
| Combined RED run | **85 pass / 6 fail** | FIX-008 read | The 6 fails are exactly the new enforcement assertions; DM-exempt + same-org-regression assertions passed pre-fix. |

### E.4 Changes made

| Fix ID | Fix Implemented | Files Changed | Shared? | Notes |
| --- | --- | --- | --- | --- |
| FIX-008 (getChatRoom) | After loading the room (before the participant check): if `room.roomType !== 'dm'` AND `ctx.get('organizationId')` is set AND differs from `room.organizationId` → `ForbiddenError`. | `handlers/comms/getChatRoom.ts` | No | Org derived from ctx + room row; DM-exempt |
| FIX-008 (getChatMessages) | Same org guard after the room load, before the participant/OR-shim check. | `handlers/comms/getChatMessages.ts` | No | DM-exempt |
| FIX-008 (listChatRooms) | Pass `organizationId: ctx.get('organizationId')` into `findUserRoomsPage`; when set, the repo ANDs `(organization_id = X OR room_type = 'dm')` so non-DM rooms are org-scoped and DMs preserved. | `handlers/comms/listChatRooms.ts`, `repos/chatRoom.repo.ts`, `repos/comms.schema.ts` | No | New `ChatRoomFilters.organizationIdOrDm` |
| FIX-008 (searchChatMessages) | When `ctx.get('organizationId')` is set, append ` AND (chat_room.organization_id = X OR chat_room.room_type = 'dm')` to the search WHERE. | `handlers/comms/searchChatMessages.ts` | No | DM messages still searchable; participant scope retained |

### E.5 Tests added / updated

| Test File | Type | What It Proves | Fix ID |
| --- | --- | --- | --- |
| `handlers/comms/comms-rest-handlers.test.ts` (+6) | backend/unit + permission/RBAC + regression | `getChatRoom`/`getChatMessages` deny a cross-org caller on a non-DM room (`ForbiddenError`), ALLOW a cross-org caller on a DM room (PD-2 preserved), and are unaffected for a same-org participant; `listChatRooms` forwards the caller org to `findUserRoomsPage`. | FIX-008 read |
| `handlers/comms/repos/chatRoom.repo.test.ts` (+2) | backend/unit | `findUserRoomsPage` maps the caller org to `organizationIdOrDm`; `buildWhereConditions` emits a clause for it. | FIX-008 read |
| `handlers/comms/searchChatMessages.test.ts` (+2, +`onWhere` capture / `sqlCollect` helper / `organizationId` ctx opt) | backend/unit | With org context the search WHERE includes the org param + a `dm` leg; without org context no org filter is appended (existing behavior). | FIX-008 read |

### E.6 Tests run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test comms-rest-handlers.test.ts repos/chatRoom.repo.test.ts searchChatMessages.test.ts` (RED) | 85 pass / 6 fail | RED for the right reasons (E.3) |
| Same three files (GREEN) | **91 pass / 0 fail** | +10 over the prior 81 across these files (6 + 2 + 2 new) |
| `bun test src/handlers/comms/ src/handlers/__tests__/comms-audit.test.ts` (full module) | **162 pass / 0 fail** (11 files) | +10 over the 152 Step-32 module total; no comms regressions |
| `bun test` (full api-ts) | **6217 pass / 2 fail / 3 todo / 93 skip** (586 files) | +9 net over the 6208 baseline (= the 10 new tests, minus the date-dependent `getNextBookableTime` flake flipping to fail this run). The **2 fails are both pre-existing + unrelated**: `registerEmailJobs` interval (30000 vs 1000, named known in the prompt) and `getNextBookableTime > returns a time in the future` (booking slot-rounding; asserts `result ≥ Date.now()` and is wall-clock-dependent — today is Sat 2026-06-13; zero booking files touched this pass; fails identically in isolation). |
| `bun run --filter '*' typecheck` (monorepo) | **5/5 Exited code 0** | `@monobase/ui`, `admin`, `@monobase/sdk-ts`, `@monobase/api-ts`, `memberry` all clean |
| `bun run test` (full memberry) | **674 pass / 0 fail** | Unchanged — no frontend files touched this pass |

### E.7 Validation summary

- **Passed:** every targeted + full comms module + the 10 new FIX-008 tests; 5/5 monorepo typecheck; full memberry unchanged.
- **Failed:** none from this batch. The 2 api-ts fails are both pre-existing/unrelated (E.6): `registerEmailJobs` (known) and the date-dependent `getNextBookableTime` booking flake (no booking files touched).
- **Blocked:** live cross-org read E2E `[BLOCKED BY ENVIRONMENT]`; DM org-scoping strictness `[NEEDS PRODUCT DECISION] PD-2`.

### E.8 Shared / cross-module impact

No shared/platform/database files touched. `orgContextOptionalMiddleware` (9-prefix blast
radius) and `core/ws.ts` were deliberately left untouched — the caller org is read from the
`ctx.organizationId` the middleware already sets, and the room org from the loaded row. No
TypeSpec regen, no schema/migration, no SDK change.

### E.9 Remaining gaps

| Gap | Source | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Memberry chat UI does not send `x-org-id` on comms reads, so the new backend guard/filter is dormant for that surface | FIX-008 read (activation) | The memberry `ChannelList`/`DmList`/`ChatView` call `listChatRooms`/`getChatRoom`/`getChatMessages` without an org header; threading `orgId` through 4+ chat components is broader than the "smallest correct change" backend read-leg and was kept out to preserve scope | A small FE pass: pass `orgId` (already available via `useOrgProvider`) into `headers: { 'x-org-id': orgId }` on the comms read calls — activates the guard for the primary surface. Pattern already used in dues/chapters components. |
| WS `onConnect` org guard | FIX-008 read | The prompt's read-path list covered the 4 REST reads; the WS connect path's DM/non-DM + org-context handling is murkier and not enumerated | Fold into a later WS pass alongside `core/ws.ts` (Batch E) if needed |
| DM org-scoping strictness | PD-2 | Whether DMs are org-scoped or cross-org is an unresolved product decision; cleanly separated here via `roomType === 'dm'` and left exempt | Resolve PD-2, then a follow-up `04` pass to apply (or confirm exemption of) org strictness to DM reads |
| Live cross-org read E2E | plan §5 / Batch D | No running WS/auth/seeded stack this pass | `apps/memberry/tests/e2e/comms/` once a WS+auth E2E harness exists |

### E.10 Blocked items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| DM read-path org strictness | `[NEEDS PRODUCT DECISION] PD-2` | DM org-agnostic-vs-scoped is undecided | PD-2 resolved |
| FIX-011 video gating | `[NEEDS PRODUCT DECISION] PD-3` | Gate-vs-finish undecided | PD-3 resolved |
| FIX-015/018 WS-inbound spec direction + `comms.md` cleanup | `[NEEDS CONFIRMATION] CF-1` | Align implementation-to-spec vs spec-to-implementation | CF-1 confirmed |
| Live cross-org E2E | `[BLOCKED BY ENVIRONMENT]` | No running WS/seeded stack | WS+auth E2E harness |

### E.11 Files changed (this batch)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/handlers/comms/getChatRoom.ts` | Cross-org deny guard for non-DM rooms (after room load) | FIX-008 read |
| `services/api-ts/src/handlers/comms/getChatMessages.ts` | Same cross-org deny guard for message-read | FIX-008 read |
| `services/api-ts/src/handlers/comms/listChatRooms.ts` | Pass caller org to `findUserRoomsPage` (org-scope when known) | FIX-008 read |
| `services/api-ts/src/handlers/comms/searchChatMessages.ts` | Append `(org = X OR room_type='dm')` to the search WHERE when org context present | FIX-008 read |
| `services/api-ts/src/handlers/comms/repos/chatRoom.repo.ts` | `organizationIdOrDm` branch in `buildWhereConditions`; `organizationId` opt → filter in `findUserRoomsPage` | FIX-008 read |
| `services/api-ts/src/handlers/comms/repos/comms.schema.ts` | New `ChatRoomFilters.organizationIdOrDm` | FIX-008 read |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | +6 FIX-008 read tests (getChatRoom/getChatMessages/listChatRooms) | FIX-008 read |
| `services/api-ts/src/handlers/comms/repos/chatRoom.repo.test.ts` | +2 FIX-008 filter-mapping tests | FIX-008 read |
| `services/api-ts/src/handlers/comms/searchChatMessages.test.ts` | +2 FIX-008 org-scope tests + `onWhere`/`sqlCollect` capture helpers | FIX-008 read |

### E.12 Completion decision — FIX-008 read-path non-DM subset

**COMPLETE** (for the decision-free non-DM read-path subset). All four REST reads now enforce
org isolation for org-scoped (channel/booking/group) rooms, derived module-locally from
`ctx.get('organizationId')` + the loaded room row, with DM rooms cleanly exempt (PD-2
preserved). Test-first RED→GREEN (6-fail RED → 91/91 across the three files), full comms
module 162/162, full api-ts +10 new (only the two pre-existing/unrelated flakes remain),
5/5 monorepo typecheck, memberry 674/674 unchanged. No shared middleware, `core/ws.ts`,
TypeSpec/regen, schema/migration, SDK, or frontend touched. The one honest caveat: the guard
keys off `ctx.organizationId`, which the memberry chat UI does not yet send on comms reads —
so activation for that surface is the FE follow-up in E.9 (deliberately out of the backend
read-leg scope). DM strictness remains `[NEEDS PRODUCT DECISION] PD-2`.

### E.13 Recommended next step

Per the Stop condition, recommend exactly one next gated batch (do NOT auto-chain):

- **DM org-scoping strictness (PD-2)** — the natural successor: now that non-DM reads are
  org-scoped, decide whether DM rooms are org-scoped or cross-org and apply (or formally
  confirm the exemption of) org strictness to the DM read path. Run via
  `docs/aha/prompts/04-module-or-group-fix-tdd.md` against
  `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` once PD-2 lands.
- Alternatives per consolidated-roadmap §8: **video PD-3 gate (FIX-011)**, **spec-direction
  CF-1 (FIX-015/018)**, surveys PD-1/2/3, or documents Batch C (certificates, gated on Q8).
- Decision-free FE activation follow-up (E.9): wire `x-org-id` onto the memberry comms read
  calls so this backend guard is live for the chat UI — a small standalone FE pass.

---

## FIX-008 read-path FE activation (Step 34 — closes E.9)

### F.1 Fix scope

| Item | Details |
| --- | --- |
| Module/group | Realtime Comms |
| Module slug | `realtime-comms` |
| Fix date | 2026-06-13 |
| Batch executed | FIX-008 read-path **FE activation** (decision-free) — closes E.9 gap |
| Superpowers used | Yes (`test-driven-development` skill, TDD RED→GREEN) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + prior AHA passes incl. Step 31/32/33); preserved, no destructive git |
| Fix scope | P1 (org-isolation activation for the chat UI surface) |
| Out of scope | DM strictness PD-2, video PD-3 (FIX-011), spec-direction CF-1 (FIX-015/018), `core/ws.ts` + `orgContextOptionalMiddleware`, WS `onConnect` guard, chat-thread booking surface |
| Shared files touched | No |
| Schema/migration touched | No |
| Backend touched | No (Step-33 guard/filter already exist) |
| TypeSpec/regen/SDK touched | No (SDK already supports per-call `headers`) |
| Limitations | `chat-thread.tsx` (the `/my/bookings/$bookingId` surface) NOT wired — see F.6 |

### F.2 What activated

The Step-33 backend guard keys off `ctx.get('organizationId')`, which
`orgContextOptionalMiddleware` only sets when the request carries org context. The memberry
comms components issued their reads **without** `x-org-id`, so the guard/filter were dormant
(E.9). This pass threads `orgId` (from `useOrgProvider().orgId`, already available on the
org-scoped messages routes) into the four read surfaces and forwards it as
`headers: { 'x-org-id': orgId }` on the SDK option calls, mirroring the existing dues/chapters
pattern (`dues-invoice-list.tsx`, `payment-history-table.tsx`).

Header is attached **conditionally** (`...(orgId ? { headers: { 'x-org-id': orgId } } : {})`):
when `orgId` is absent the call stays org-agnostic so the `@hey-api` query key is unchanged
(headers participate in `createQueryKey`), preserving existing seeded-cache tests and the
prod single-org read path.

### F.3 Changes made

| Surface | Read | File | Change |
| --- | --- | --- | --- |
| Channel list | `listChatRooms` | `channel-list.tsx` | `+orgId?` prop, conditional `x-org-id` header |
| DM list | `listChatRooms` | `dm-list.tsx` | `+orgId?` prop, conditional `x-org-id` header (DM still returned via `(org OR dm)`) |
| Chat view | `getChatMessages` | `chat-view.tsx` | `+orgId?` prop, conditional header on read + matching invalidation key; forwards `orgId` to `ThreadPanel` |
| Thread replies | `getChatMessages` | `thread-panel.tsx` | `+orgId?` prop, conditional header |
| Route — member messages | — | `org/$orgSlug/messages/index.tsx` | passes `orgId` to `ChannelList` + `ChatView` |
| Route — officer messages | — | `org/$orgSlug/officer/messages/index.tsx` | passes `orgId` to `ChannelList` + `ChatView` |
| Route — DM | — | `org/$orgSlug/messages/dm/index.tsx` | adds `useOrgProvider`, passes `orgId` to `DmList` + `ChatView` (DM exempt server-side, harmless) |

### F.4 Correctness preserved (verified)

- **DM still shows** — `DmList` filters DMs client-side from the same `listChatRooms` query;
  backend `(organization_id = caller OR room_type = 'dm')` still returns DM rooms. New test
  `dm-list.test.tsx` seeds the org-scoped key and asserts the DM row renders.
- **Single-org pilot** — `orgContextOptionalMiddleware` sets `ctx.organizationId` for active
  members → same-org guard passes; other-org rooms scoped out. No regression.
- **DM semantics (PD-2)** — DM access stays participant-based server-side; FE sends the header
  but the backend exempts DM rooms, so no behavior change. NOT touched.

### F.5 Tests added / run (RED→GREEN)

| Test File | Type | What It Proves |
| --- | --- | --- |
| `channel-list.test.tsx` | frontend/component | `listChatRooms` carries `x-org-id` when `orgId` set; omits header (org-agnostic key) when absent |
| `dm-list.test.tsx` (new) | frontend/component | `listChatRooms` carries `x-org-id`; DM rooms still render under org-scoped read |
| `chat-view.test.tsx` (new) | frontend/component | `getChatMessages` carries `x-org-id` when `orgId` set |

| Command | Result | Notes |
| --- | --- | --- |
| `bun test` (3 comms component files) | RED 4 fail → GREEN 12 pass / 0 fail | RED confirmed missing-header for the right reason |
| `bun test apps/memberry/.../comms/` | Passed | 35 pass / 0 fail (8 files) |
| `apps/memberry bun run test` | Passed | **679 pass / 0 fail** (up from 674 baseline; +5 new) |
| `bun run typecheck` (monorepo) | Passed | 5/5 workspaces clean |
| `bun test src/handlers/comms/` (api-ts) | Passed | 160 pass / 0 fail (backend unchanged) |

(act() warnings from `ChatView`'s WebSocket state updates are pre-existing/non-fatal.)

### F.6 Remaining gap

| Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- |
| `chat-thread.tsx` (`/my/bookings/$bookingId`) `getChatMessages` not org-scoped | That route is personal (no `useOrgProvider` in scope) and booking rooms are server-exempt-or-already-guarded; threading `orgId` there would need route context plumbing beyond this decision-free FE pass | Wire in a later pass if booking chat needs explicit org-scoping; non-blocking (no regression vs prior dormant state) |

### F.7 Completion decision

**COMPLETE** — the four chat-UI read surfaces (`listChatRooms` via channel-list + dm-list,
`getChatMessages` via chat-view + thread-panel) now send `x-org-id`, making the Step-33
backend org-isolation guard/filter live for the memberry chat UI. TDD RED→GREEN, full
memberry 679/679, 5/5 typecheck, comms backend unchanged. E.9 closed. PD-2 DM strictness and
the booking `chat-thread` surface remain out of scope by design.

### F.8 Recommended next step

Per the Stop condition, recommend exactly one next **gated** batch (do NOT auto-chain):

- **DM org-scoping strictness (PD-2)** — now that both backend non-DM guard (Step 33) and the
  FE activation (Step 34) are in place, PD-2 is the natural successor: decide whether DM rooms
  are org-scoped or remain cross-org, then run `04-module-or-group-fix-tdd.md` against
  `realtime-comms-fix-ready-plan.md`.
- Alternatives per consolidated-roadmap §8: **video PD-3 gate (FIX-011)**, **spec-direction
  CF-1 (FIX-015/018)**, surveys PD-1/2/3, or documents Batch C (certificates, gated on Q8).

---

## Step 41 — PD-1 channel-model reconciliation + #announcements officer-post gate (2026-06-13)

Executed continuation `CONTINUE-41-prompt.md` (PD-1 channel-membership model, eng-default
+ ratify). **Reconciliation finding:** CONTINUE-41 was authored from the pre-Step-31
"`/messages` channels are permanently empty" framing, but that framing is already stale —
the channel-create cluster (**FIX-002/003/004/007**) shipped in the **Channel-Model Batch
(Step 31, 2026-06-13)** above and is live in the (dirty) working tree:

- `comms.tsp` already models channels (`name?`, `roomType: ChatRoomType`, `context: string`,
  `x-audit` on createChatRoom) — verified L35–62, L80–89, L349–367, L410.
- `create-channel-dialog.tsx` already sends `buildChannelCreateBody` (`name`+`roomType:'channel'`
  +`organizationId`, no `context:'channel:x'` hack) — verified L33–41.
- `createChatRoom.ts` already officer-gates channels (`requireOfficerTerm`), auto-adds the
  creator as admin, relaxes the ≥2 rule, and populates `chat_room_member` — verified L49–94,
  L168–190.
- `default-channels.ts` already provisions `#general`+`#announcements` and `autoJoinOrgChannels`,
  wired through `core/domain-event-consumers.ts` (org.created / membership.created/.imported).

Per AHA rules (evidence-based, do **not** re-do shipped fixes, `[DO NOT OVERBUILD]`), the
shipped cluster was **not** re-implemented. The one genuine **un-enforced** PD-1 sub-decision
was closed this pass.

### 41.1 Fix scope

| Item | Details |
| --- | --- |
| Batch executed | Step 41 — PD-1 decision-3 enforcement: `#announcements` officer-post-only (REST + WS write paths) |
| Superpowers used | Yes (`superpowers:test-driven-development`; RED→GREEN, both write paths) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + AHA Steps 31/33/34…); preserved. No forbidden destructive git commands used. |
| Fix scope | P1 / `V1 REQUIRED` (PD-1 decision-3 — a pinned product decision left un-enforced) |
| Out of scope (untouched) | FIX-002/003/004/007 (already shipped Step 31), DM PD-2, video PD-3, FIX-015/018 CF-1, Batch E shared files, threading/reactions/read-state/etc. |
| Shared files touched | No — comms-local handlers only. **No TypeSpec edit → no regen, no SDK drift** (channels were already modeled Step 31). |
| Schema/migration touched | No |
| Limitations | Live two-session E2E `[BLOCKED BY ENVIRONMENT]` (no running WS/seeded stack); enforcement proven at unit level (REST returns 403 + no persist for non-officer; WS sends error frame + no persist). |

### 41.2 The gap closed

`#announcements` is documented "read-only for officers to post" (`default-channels.ts:6`) and
PD-1 decision-3 pins it as **officer-post-only**, but **no code enforced it** — any room
participant could post to the provisioned announcements channel via REST `sendChatMessage` OR
the WS `chat.message` path. Closed both:

- **REST** (`sendChatMessage.ts`): after the participant + archived checks, when
  `room.context === 'channel:announcements'`, run `requireOfficerTerm(ctx)` — non-officers get
  the standard 403 Response (no message persisted).
- **WS** (`ws.chat-room.ts`, `chat.message` case): mirror of the FIX-012 both-paths pattern.
  WS connections carry no org-context middleware, so the officer term is checked against the
  room's **own** `organizationId` via `OfficerTermRepository.findActiveByPersonAndOrg`; a
  non-officer gets an `error` frame and the message is not persisted/broadcast.

The official memberry client posts via **REST** (`sendChatMessageMutation`) — WS is receive-only
for it — but the WS write path is a real server endpoint, so gating both prevents a bypass of
the permission control.

### 41.3 RED → GREEN

| Check | RED (before gate) | GREEN (after gate) |
| --- | --- | --- |
| `comms-rest-handlers.test.ts` + `ws.chat-room.test.ts` (gate block) | 95 pass / **2 fail** — the two deny tests fail: non-officer post returns 201 + persists (no gate) | **97 pass / 0 fail** |
| `bun test src/handlers/comms/` (full module) | (baseline 160/162) | **165 pass / 0 fail** (10 files) |
| `bun run typecheck` (api-ts `tsc --noEmit`) | — | Clean |

The allow + `#general` regression tests already passed at RED (posting was open), so RED was
honest — exactly the two officer-deny assertions failed.

### 41.4 Tests added

| Test File | Type | What It Proves | 
| --- | --- | --- |
| `handlers/comms/comms-rest-handlers.test.ts` (+3) | backend/unit + permission/RBAC + regression | officer posts to `#announcements` → 201; non-officer → 403 (no persist); any member posts to `#general` → 201 (gate is announcements-specific) |
| `handlers/comms/ws.chat-room.test.ts` (+2) | backend/unit + permission/RBAC | WS non-officer `chat.message` to `#announcements` → error frame, no persist/broadcast; officer → persists + broadcasts. Added `OfficerTermRepository` pristine-restore hygiene. |

### 41.5 Files changed

| File | Change | 
| --- | --- |
| `services/api-ts/src/handlers/comms/sendChatMessage.ts` | Import `requireOfficerTerm`; officer gate for `context:'channel:announcements'` after the archived check |
| `services/api-ts/src/handlers/comms/ws.chat-room.ts` | Import `OfficerTermRepository`; officer gate (room-org-scoped) in the `chat.message` case |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | +3 REST announcements-gate tests |
| `services/api-ts/src/handlers/comms/ws.chat-room.test.ts` | +2 WS announcements-gate tests + `OfficerTermRepository` pristine-restore |

### 41.6 PD-1 ratification flag — shipped model vs CONTINUE-41-pinned model `[NEEDS PRODUCT DECISION]`

CONTINUE-41 pins PD-1 as **implicit org-scoped access — "no per-member join rows for
channels"** (every active org member implicitly has access via an extended OR-check). The
**shipped Step 31 model is different**: it uses **per-member rows** — `autoJoinOrgChannels`
writes a `chat_room_member` row + appends the JSONB `participants` array on each
`membership.created/.imported` event (so `listChatRooms`, which filters on `participants`,
surfaces the channel).

Both satisfy the product goal (members see/read their org's channels; officer-only creation;
defaults provisioned). The shipped row-based model is **working + tested GREEN**; switching to
the pinned no-rows model would be a rewrite of live code (`autoJoinOrgChannels` consumers +
`listChatRooms` would need an implicit `roomType:'channel'`+org branch + OR-check change) and
would re-open the membership source-of-truth — a net negative against "do not re-do shipped
fixes / `[DO NOT OVERBUILD]`". **This pass kept the shipped row-based model** and surfaces the
divergence for ratification rather than silently rewriting.

Known carry-forward of the row-based model (from Step 31 C.9, unchanged): existing
orgs/members are not back-filled into channels, and the manual `createMembership` officer path
does not emit `membership.created` (so no auto-join there). These are the items a one-off
backfill / event-emit would close.

### 41.7 Completion decision — Step 41

**COMPLETE (eng-default awaiting ratification).** The PD-1 channel-create cluster
(FIX-002/003/004/007) was already shipped (Step 31) and verified live in the tree — not
re-done. The one un-enforced PD-1 sub-decision (**decision-3: `#announcements` officer-post-only**)
is now enforced on both write paths, test-first RED→GREEN, with no weakened assertions; full
comms module suite 165/165 and api-ts typecheck clean. The PD-1 **membership model divergence**
(shipped per-member rows vs CONTINUE-41-pinned implicit no-rows) is flagged in 41.6 for user
ratification — per the prompt's "eng-default + FLAG, do not treat as final product law."

### 41.8 Recommended next step

Do NOT auto-chain. PD-1 channel model is now fully enforced + flagged for ratification. Next
**gated** realtime batch per the roadmap:

- **DM org-scoping strictness (PD-2)** — the natural successor now that channels are complete.
- Alternatives: **video PD-3 gate (FIX-011)**, **spec-direction CF-1 (FIX-015/018)**, or a
  non-comms gated batch (surveys PD-1/2/3, documents Batch C).
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`; plan: `realtime-comms-fix-ready-plan.md`.

---

## Step 42 — FIX-006 DM creation (decision-free, FE-only) (2026-06-13)

| Item | Details |
| --- | --- |
| Batch executed | Batch B subset — **FIX-006 only** (G3, DM creation UI) |
| Superpowers used | Yes (`/using-superpowers` TDD discipline) |
| Working tree status checked | Yes — intentionally dirty (recovery-2025 + AHA 31–41); only FIX-006 files touched |
| Fix scope | P1 / V1 REQUIRED |
| Out of scope | PD-2 (DM org-scoping read-filter strictness), all other batches |
| Shared files touched | No |
| Schema / migration touched | No — **FE-only**, no TypeSpec / regen / SDK change |

### 42.1 Fix scope

FIX-006 (G3) only. The DM page was a dead end: `dm-list.tsx` exposed an optional
`onNewDm` prop with **no caller**, there was no member-picker, and the empty state
referenced an action that did nothing. Backend `createChatRoom` already accepts
`roomType:'dm'` (Step 31) and dedups DM/group rooms by participant set
(`findRoomWithParticipants` → upsert returns the existing room). This pass built the
missing FE create-DM journey only. **PD-2 (DM org-scoping strictness — the FIX-008 DM
read-filter leg) is explicitly NOT in this pass**; the create flow is built org-scoped
(both participants from the current org, `organizationId` in the body, resolved by the
shared org-context middleware's POST-body branch) without changing FIX-008 read strictness.

### 42.2 The gap closed

- New **`buildDmCreateBody(myPersonId, targetPersonId, orgId)`** — pure, unit-testable,
  mirrors `buildChannelCreateBody`. Emits `{ roomType:'dm', organizationId, participants:[me,them], upsert:true }`,
  dedupes participants, no `context` hack.
- New **`DmMemberPicker`** dialog — searches the current org's roster via the existing
  `listRosterMembers` SDK hook (reused, no new endpoint), excludes self, member-allowed
  (NOT officer-gated — channels are officer-only, DMs are not). On select →
  `createChatRoomMutation({ body: buildDmCreateBody(...) })` → on success opens the new
  (or upsert-returned existing) room and closes the dialog. `sonner` toast on error.
- Wired `onNewDm` in `messages/dm/index.tsx` (`pickerOpen` state) → opens the picker,
  passes `useOrgProvider().orgId`; `onCreated(roomId)` selects/opens the room.
- Fixed the `dm-list.tsx` empty state to expose a real **"New message"** action
  (wired to `onNewDm`) instead of dead copy.

### 42.3 RED → GREEN (TDD)

1. **RED:** wrote `dm-member-picker.test.tsx` first → failed to resolve the missing
   `../components/dm-member-picker` module (import error), then asserted the
   body-builder + picker→mutation behavior.
2. **GREEN:** implemented `buildDmCreateBody` + `DmMemberPicker` → `3 pass / 0 fail`.
   No weakened assertions; the picker test drives the **real** generated
   `createChatRoomMutation` shape (`mutationFn(variables, ctx)`) and asserts the
   `{ body }` variables, not a hand-faked payload.

### 42.4 Tests added

| Test File | Type | What It Proves |
| --- | --- | --- |
| `apps/memberry/src/features/comms/__tests__/dm-member-picker.test.tsx` | frontend/component | `buildDmCreateBody` emits valid org-scoped dm body + dedupes; `DmMemberPicker` lists roster (self excluded), select → `createChatRoom{roomType:'dm'}` with valid body → opens room + closes dialog |

### 42.5 Files changed

| File | Change | Fix ID |
| --- | --- | --- |
| `apps/memberry/src/features/comms/components/dm-member-picker.tsx` | **new** — `buildDmCreateBody` + `DmMemberPicker` | FIX-006 |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/messages/dm/index.tsx` | wired `onNewDm` → picker, `pickerOpen` state, `onCreated` opens room | FIX-006 |
| `apps/memberry/src/features/comms/components/dm-list.tsx` | empty-state now exposes real "New message" action | FIX-006 |
| `apps/memberry/src/features/comms/__tests__/dm-member-picker.test.tsx` | **new** test | FIX-006 |

### 42.6 Tests run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../comms/__tests__/dm-member-picker.test.tsx` | Passed | 3 pass / 0 fail / 12 expect() |
| `bun test apps/memberry/src/features/comms/` | Passed | 38 pass / 0 fail (no regressions) |
| `bunx tsc --noEmit` (memberry) | Passed | 0 errors |
| Live E2E (`/browse`) | Blocked | `[BLOCKED BY ENVIRONMENT]` — app :3004 redirects to `/auth/sign-in`; no auth session / seeded roster. Proven via component + body-builder nets. Evidence: `docs/aha/evidence/playwright-findings/step-42-fix-006-dm-create.md` |

### 42.7 Validation summary

DM-create round-trips GREEN at the component+contract level: member picked → valid
`roomType:'dm'` body (real mutation shape) → room opens on success. No TypeSpec/schema/
regen/SDK touched (FE-only, as scoped). No shared files. Full comms suite green; memberry
typecheck clean. Live browser E2E blocked by missing auth/seed in this environment.

### 42.8 Completion decision — Step 42

**COMPLETE.** FIX-006 DM creation built test-first (RED→GREEN), member-allowed,
org-scoped create, upsert dedup, dead-end removed (empty-state + `onNewDm` wired).
Out-of-scope PD-2 strictness untouched. Live E2E `[BLOCKED BY ENVIRONMENT]` only.

### 42.9 Recommended next step

Do NOT auto-chain. Remaining realtime work stays separate `/clear` sessions:
- `[NEEDS PRODUCT DECISION]`: **PD-2** (DM org-scoping strictness — FIX-008 DM read-filter leg),
  **PD-3** (video V1 scope), **CF-1** (FIX-015/018 spec-doc direction).
- Decision-free shippable: **FIX-011** (gate `video-call-panel.tsx` behind `comms_video_calls` flag).
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`; plan: `realtime-comms-fix-ready-plan.md`.

---

## Step 43 — FIX-011 video gate (honest state) — 2026-06-13

### 43.1 Scope

Gate the misleading `VideoCallPanel` behind the `comms_video_calls` release flag
(m07 `MODULE_SPEC.md:392`, default false). Honest-state fix, **not** product:
today the panel ships ungated on the booking-detail page where `joinVideoCall`
404s by construction, an error toast fires on every attempt, P2P proceeds
untracked (no call records), and a dead `roomUrl` signal path exists. When the
flag is OFF (default) the panel renders a short "Video calls aren't available
yet." card — no join control, no `joinVideoCallMutation`, no peer connection.
When ON, the existing UI is unchanged. **FE-only, module-local to comms. No
TypeSpec / schema / regen / SDK change.** PD-3 (finishing the start-call flow —
lobby, grid, call records, token verify) stays deferred — gate only.

### 43.2 Fixes selected

| Fix ID | Gap | Severity | Scope Label | Batch | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-011 | G7 — video panel ships ungated; misleads users/ops | P1 | V1 RECOMMENDED | Batch C (video) | Fixed (gated) |

### 43.3 Baseline before changes

| Check/Test | Result Before | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `video-call-panel.test.tsx` (new) | Failed (1/3 pass) | FIX-011 | RED: flag-OFF honest-state assertion failed; panel never called `useFeatureFlag`. Only the pre-existing-UI case passed. |
| comms suite | 38 pass (Step 42) | — | Baseline before new test |

### 43.4 Changes made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-011 | New `useFeatureFlag` hook reads public `GET /feature-flags` (no `/api` prefix; fail-closed false). `VideoCallPanel` early-returns honest "unavailable" card when `commsVideoCalls` is off — takes precedence over the schedule window; join/active/peer paths unreachable. | `hooks/use-feature-flag.ts` (new), `components/video-call-panel.tsx` | No | No TypeSpec/schema/regen/SDK. `joinVideoCall.ts`, WebRTC util untouched. `GET /feature-flags` already exists — no route added. |

### 43.5 Tests added / updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `apps/memberry/src/features/comms/__tests__/video-call-panel.test.tsx` | frontend/component | flag OFF (default) → honest unavailable card, no Start/Join control, no VideoCallUI surface (join path unreachable); correct key `commsVideoCalls`; flag ON + enabled → existing Start/Join control mounts (real branch, not a permanent hide) | FIX-011 |

### 43.6 Tests run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test .../comms/__tests__/video-call-panel.test.tsx` | Passed | 3 pass / 0 fail / 6 expect() |
| `bun test apps/memberry/src/features/comms/` | Passed | 41 pass / 0 fail (38 baseline + 3 new); no regressions |
| `bunx tsc --noEmit` (memberry) | Passed | exit 0, clean |
| Live E2E (`/browse`) | Blocked | `[BLOCKED BY ENVIRONMENT]` — booking detail behind `_authenticated`; :3004 redirects to `/auth/sign-in`, no seeded auth/booking (per Step 42). Proven via component nets. Evidence: `docs/aha/evidence/playwright-findings/step-43-fix-011-video-gate.md` |

### 43.7 Validation summary

Panel honestly gated GREEN. Flag OFF (default) → unavailable state, no join
attempt, no peer connection; flag ON → existing UI unchanged. FE-only, module-
local. No shared/TypeSpec/schema/SDK files touched. Full comms suite green;
memberry typecheck clean. Live browser E2E blocked by missing auth/seed only.

### 43.8 Completion decision — Step 43

**COMPLETE.** FIX-011 resolved as **gated** (honest state), test-first (RED→GREEN).
The full video-call finish (start-call flow, lobby, grid, call records, token
verify) stays **PD-3 deferred** — explicitly not built this pass.

### 43.9 Recommended next step

Do NOT auto-chain. Remaining realtime work stays separate `/clear` sessions:
- `[NEEDS PRODUCT DECISION]`: **PD-2** (DM org-scoping strictness — FIX-008 DM
  read-filter leg), **PD-3** (video V1 *finish* scope — beyond this gate),
  **CF-1** (FIX-015/018 spec-doc direction).
- Newly pending ratification (eng-defaults shipped): realtime PD-1 channel model
  (per-member-row vs implicit-no-rows, §41.6) + prior pile (documents Q1,
  elections FIX-002, m09 training-selector seam, Q6 zero-credit certs).
- Prompt: `docs/aha/prompts/04-module-or-group-fix-tdd.md`; plan: `realtime-comms-fix-ready-plan.md`.

---

# Step 48 (2026-06-13) — PD-2 DM org-scoping SHIPPED; PD-1 ratified; PD-3 finish deferred (CONTINUE-48)

**Batch:** PD-gated drain · **Superpowers:** Yes (`test-driven-development`) · **Working tree checked:** Yes (dirty tree preserved) · **Schema/migration:** No (no new table — `chat_room_member` already exists from Step 31) · **TypeSpec regen:** No

## 48.1 Decisions applied (no AskUserQuestion — pre-authorized defaults)

| Gate | Decision applied | Action |
| --- | --- | --- |
| **PD-1** — channel membership model | **Org-scoped membership** (org members auto-see their org's public channels; `chat_room_member` backs explicit/private channels). | **RATIFIED** — already shipped Steps 29/31/41 (auto-join, officer-only create, `chat_room_member` populated). The CONTINUE-48 org-scoped decision matches the shipped model; the per-member-row vs implicit-no-rows ratification flag (§41.6) is closed in favor of the shipped per-member-row model. No new migration. |
| **PD-2** — DM org-scoping | **DMs scoped within the same org** (no cross-org DM); enforce org match at send + list. | **BUILT** (this pass). |
| **PD-3** — video V1 | 1:1 + small-group over existing WS signaling, capacity-capped, no recording; richer video = V2. | Gate shipped (Step 43). 1:1 signaling primitives exist behind the `comms_video_calls` flag; the V1 *finish* (ungate + lobby/call-records) needs STUN/TURN + media infra → **`[CROSS-MODULE RISK]` / `[BLOCKED BY ENVIRONMENT]`**, own later pass. |

## 48.2 Changes made (PD-2)

- **`handlers/comms/sendChatMessage.ts`** — org-match guard after the participant check: when both the caller's org context and the room's org are known and differ, throw `ForbiddenError` (no cross-org send). Guarded on both-present so org-agnostic legacy rows aren't falsely blocked.
- **`handlers/comms/repos/chatRoom.repo.ts`** — `findUserRoomsPage` now maps the caller org to the **strict `organizationId`** filter instead of `organizationIdOrDm` (which exempted DMs). DMs are now org-scoped at the list path — cross-org DMs are invisible. (The `organizationIdOrDm` filter branch is left in place, now unused by this path.)

## 48.3 Tests

| Test | Type | Proves |
| --- | --- | --- |
| `comms-rest-handlers.test.ts` → `sendChatMessage — PD-2 org scoping` (new) | backend/unit + permission | A send where caller org ≠ room org returns 403 (RED→GREEN observed) |
| `repos/chatRoom.repo.test.ts` → updated mapping test | backend/unit | `findUserRoomsPage` maps caller org to strict `organizationId` (not `organizationIdOrDm`); DM exemption removed |

**Validation:** `bun test src/handlers/comms/` → **166 pass / 0 fail**; `bunx tsc --noEmit` (api-ts) → exit 0. RED→GREEN observed for the send guard (no-throw → 403) and the repo mapping flip. Live WS/E2E `[BLOCKED BY ENVIRONMENT]` (:3004 redirects to `/auth/sign-in`, no seeded auth).

## 48.4 Not built / deferred (honest)

| Item | Label | Why |
| --- | --- | --- |
| DM create-time participant-org validation | `[CROSS-MODULE RISK]` | Verifying every DM participant shares the creator's org needs a cross-module person→org membership lookup. The list+send org-match already make a cross-org DM invisible and unusable (effective enforcement); create-time validation is belt-and-suspenders for its own later pass. |
| PD-3 video V1 *finish* (ungate, lobby, grid, call records, TURN) | `[CROSS-MODULE RISK]` / `[BLOCKED BY ENVIRONMENT]` | Needs STUN/TURN + media-server infra not present here; 1:1 signaling primitives already exist behind the flag. |
| CF-1 (FIX-015/018 spec-doc direction) | `[NEEDS CONFIRMATION]` | Doc-only; unchanged this pass. |

## 48.5 Completion decision: **PARTIALLY COMPLETE**

PD-2 (DM org-scoping) landed test-first and green; PD-1 ratified (already shipped, no migration). PD-3 finish remains infra-blocked `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]` — gate already shipped. No migration was required (next free is still `0072`).

---

## Step 49 (2026-06-13) — PD-3 video V1 *finish* (no-infra slice): capacity cap + no-recording invariant — **PARTIALLY COMPLETE**

### 49.1 Fix scope

| Item | Details |
| --- | --- |
| Prompt | `docs/aha/prompts/04-module-or-group-fix-tdd.md` (FIX-011 / PD-3 V1 finish) |
| Decision (NOT re-opened) | **PD-3 DECIDED**: V1 video = 1:1 + small-group over the EXISTING WS signaling, capacity-capped, NO recording. Richer video (recording, large rooms, dedicated TURN) = V2. |
| Superpowers used | Yes (`superpowers:test-driven-development`; RED→GREEN per fix) |
| Working tree status | Intentionally dirty (prior AHA passes); preserved. No forbidden destructive git commands. No commit. |
| Built (no-infra, module-local) | (1) Hard participant **capacity cap** on the video start + join signaling paths; (2) **No-recording invariant** enforced at the write boundary + asserted structurally. |
| Out of scope / NOT built | Ungate (`comms_video_calls` stays default-off), lobby/grid UI, call-records productization, STUN/TURN/media-server/peer-connection media flow, recording, large rooms, multi-party `peer-connection.ts` (1:1 by design — untouched), `core/ws.ts` (consumed, untouched). |
| Shared files touched | None — module-local only. No TypeSpec, no `generated/**`, no SDK, no migration. |

### 49.2 PD-3 decision applied (V1 caps chosen)

- **Capacity cap = `VIDEO_CALL_MAX_PARTICIPANTS = 6`** (new exported constant in `repos/comms.schema.ts`). 1:1 = 2; small-group up to 6 — covers a small committee/officer huddle without implying a large-room / SFU product. Documented inline.
- **Join path** (`joinVideoCall.ts`): rejects with `ConflictError` when *active* participants (joined && !left) already `>= 6`. Left participants do not count (re-join allowed). Cap check sits after the "already in call" guard so a re-join by an active user still yields the existing already-in-call error.
- **Start path** (`sendChatMessage.ts` video_call branch): rejects with `BusinessLogicError('VIDEO_CALL_CAPACITY_EXCEEDED')` when the de-duplicated seeded participant set (initiator included) exceeds 6.
- **No-recording invariant**: `VideoCallData` shape carries NO recording field (structurally enforced — verified by test). The start path additionally rejects any payload smuggling `recording`/`recordingEnabled`/`record === true` via `BusinessLogicError('VIDEO_RECORDING_NOT_SUPPORTED')`, and only the canonical (recording-free) fields are persisted. `assertNoRecording()` + `countActiveCallParticipants()` helpers added to the schema.

### 49.3 RED → GREEN (TDD)

Wrote failing tests first, watched them fail, implemented minimal, re-ran green.

- **RED:** 3 rejection tests failed (`Expected promise that rejects / Received ... resolved`):
  - `joinVideoCall > V1 capacity cap (PD-3) > rejects join when the call is already at the V1 cap (6)`
  - `sendChatMessage > V1 video capacity cap (PD-3) > rejects starting a call seeded above the V1 cap (6)`
  - `sendChatMessage > V1 no-recording invariant (PD-3) > rejects a start payload carrying a recording flag`
  - (the "allows below/at cap" + persisted-no-recording + schema-helper tests passed pre-impl, as expected — no cap existed to wrongly block them.)
- **GREEN:** after adding the cap + no-recording guards → `106 pass / 0 fail` across the 3 touched test files; full comms suite **180 pass / 0 fail**.

### 49.4 Tests added / updated

| Test File | Type | What it proves | New? |
| --- | --- | --- | --- |
| `handlers/comms/video-call-v1-invariants.test.ts` | backend/unit (pure) | cap constant = 6 (≥2); `countActiveCallParticipants` counts joined-and-not-left only + null-safe; `assertNoRecording` throws on `recording/recordingEnabled/record === true`, passes otherwise; `VideoCallData` structurally has no recording key | new |
| `handlers/comms/joinVideoCall.test.ts` → `V1 capacity cap (PD-3)` | backend/unit | join at cap → `ConflictError` + no add; join below cap → 200 + add; left participants don't count | added describe |
| `handlers/comms/comms-rest-handlers.test.ts` → `V1 video capacity cap` + `V1 no-recording invariant` | backend/unit | start seeded above 6 → `BusinessLogicError` + no create; start at exactly 6 → 201; recording flag → `BusinessLogicError` + no create; persisted data has no `recording`/`recordingEnabled` | added describes |

### 49.5 Files changed

| File | Change |
| --- | --- |
| `services/api-ts/src/handlers/comms/repos/comms.schema.ts` | + `VIDEO_CALL_MAX_PARTICIPANTS` const, `assertNoRecording()`, `countActiveCallParticipants()` |
| `services/api-ts/src/handlers/comms/joinVideoCall.ts` | + V1 capacity cap (`ConflictError` at/above 6 active) |
| `services/api-ts/src/handlers/comms/sendChatMessage.ts` | + V1 no-recording guard + start-path capacity cap (`BusinessLogicError`); persist only canonical fields |
| `services/api-ts/src/handlers/comms/video-call-v1-invariants.test.ts` | new test file |
| `services/api-ts/src/handlers/comms/joinVideoCall.test.ts` | + capacity-cap describe |
| `services/api-ts/src/handlers/comms/comms-rest-handlers.test.ts` | + capacity-cap + no-recording describes |

### 49.6 Validation (real counts)

- `cd services/api-ts && bun test src/handlers/comms/` → **180 pass / 0 fail** (11 files, 325 expect()).
- New-tests subset → **106 pass / 0 fail** (187 expect()).
- `bunx tsc --noEmit` (api-ts) → **exit 0** (clean). Fixed two `noPropertyAccessFromIndexSignature` errors by switching to bracket access.
- Migration? **No** (no schema column change; helpers + handler logic only; next free migration still `0072`).
- Regen? **No** (no TypeSpec change; `generated/**` untouched).
- memberry FE? **Not touched** (backend-only slice).

### 49.7 Blocked / V2 (not built — honest)

| Item | Label | Why |
| --- | --- | --- |
| Ungate (`comms_video_calls` default-on) | `[BLOCKED BY ENVIRONMENT]` | Flag stays default-off until media infra exists; per prompt, do NOT flip. |
| Lobby / grid / participant-sync UI, call-records productization | `[CROSS-MODULE RISK]` / V2 | Richer video — needs real media + dedicated infra. |
| STUN/TURN/NAT traversal, media server, real peer connections, recording, large rooms | `[BLOCKED BY ENVIRONMENT]` | Environment lacks TURN/media; `:3004` redirects to `/auth/sign-in`, no seeded auth — browser-to-browser media flow cannot be proven here. |
| `peer-connection.ts` multi-party | (do not build) | 1:1 by design — left untouched. |

### 49.8 Completion decision: **PARTIALLY COMPLETE** (expected)

The no-infra V1 slice (capacity cap = 6 + no-recording invariant, both paths, TDD RED→GREEN, typecheck clean, full comms suite green) is **DONE**. The media/TURN/recording/lobby/ungate work remains **V2 / `[BLOCKED BY ENVIRONMENT]`** and was deliberately not built. No migration, no regen.
