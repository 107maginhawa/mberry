# Continuation prompt — AHA Step 33 (next gated `04`: realtime-comms FIX-008 read-path org-scoping — decision-free non-DM subset)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-33-prompt.md`.

> **Decisions already captured — do NOT re-ask.** Step 32 (realtime-comms **Batch C decision-free subset**) is DONE and in the dirty tree: **FIX-012** (archived rooms reject sends — REST `sendChatMessage` `BusinessLogicError('…archived…','ROOM_ARCHIVED')` + WS `ws.chat-room` chat.message error-frame, no persist), **FIX-013** (`listChatRooms` filter+pagination pushed into SQL — new `ChatRoomFilters.withParticipants` AND-filter + `ChatRoomRepository.findUserRoomsPage` returning true total), **FIX-014** (atomic `messageCount + 1` SQL-side + conditional active-call claim `WHERE active_video_call_message IS NULL` → `ConflictError` + orphan retirement; **upsert dup-room constraint leg DEFERRED to Batch F**), **FIX-016** (mounted unwired `MessageSearch` in member messages page), **FIX-017** (`x-audit` on createChatRoom `create`/`chat-room` + endVideoCall `complete`/`video-call`, regenerated; createChatRoom sets `auditResourceId`). All recorded in `realtime-comms-fix-report.md` §"Batch C" (D.1–D.12). **Still product-gated, do NOT touch: DM org-scoping strictness PD-2, video PD-3 (FIX-011), spec-direction CF-1 (FIX-015/018).** Prior decisions still hold: PD-1 (auto-join + officer-only channels) RESOLVED+EXECUTED (Step 31). This step runs the next gated `04`: **realtime-comms FIX-008 read-path org-scoping — decision-free non-DM subset.** Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — **FIX-008** (G4 handler/middleware leg): "Tenant isolation unenforced … reads unfiltered" + §7 (shared dep: do NOT touch `orgContextOptionalMiddleware`, 9-prefix blast radius) + §8 PD-2 (DM org-scoping). The **insert-path** leg of FIX-008 + FIX-010 migration are already DONE (Batch B+F, report §"Batch B+F Addendum"); only the **read-path org filter** remains.
3. Prior fix-report `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — **append, don't overwrite** (Batch A + B subset + R-1 org NOT NULL + channel-model Step 31 + Batch C Step 32 all done).

## Step 2 — Run realtime-comms FIX-008 read-path org-scoping (decision-free non-DM subset, one `04` pass)

Enforce org isolation on comms **reads** for org-scoped rooms (channels / booking / group), deriving orgId from the loaded room row or `ctx.get('organizationId')` — **module-local, do NOT modify `orgContextOptionalMiddleware`** (verified shared by 9 prefixes):
- `getChatRoom` / `getChatMessages` — a caller from a different org must not read a room whose `organizationId` differs (in addition to the existing participant/`chat_room_member` OR-shim). Reject cross-org with `ForbiddenError`/`NotFoundError`.
- `listChatRooms` / `searchChatMessages` — scope results to the caller's org (the room/message `organization_id`). `listChatRooms` already filters by participant (FIX-013); add org as a SQL filter where decision-free.

**Explicitly OUT of scope (gated — do NOT touch):**
- **DM org-scoping strictness (PD-2)** — DMs are org-agnostic for participant rooms; whether DMs are org-scoped or cross-org is `[NEEDS PRODUCT DECISION] PD-2`. Apply org strictness ONLY to non-DM org-scoped rooms (channel/booking/group). For `roomType === 'dm'` rooms, preserve current participant-based access — do NOT add org strictness this pass.
- FIX-011 video PD-3, FIX-015/018 spec-direction CF-1, FIX-014 upsert dup-room constraint (→ Batch F), `core/ws.ts` + `orgContextOptionalMiddleware` (Batch E). No threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build).

If the non-DM-vs-DM split is NOT cleanly separable in a read path without a PD-2 call, STOP that leg, mark it `[NEEDS PRODUCT DECISION] PD-2`, and ship only the trivially-decision-free legs (e.g. list/search org filter that doesn't change DM semantics).

TDD discipline:
- RED first (cross-org getChatRoom/getChatMessages on a channel → denied; listChatRooms/searchChatMessages omit other-org rooms; DM rooms unchanged) → confirm each fails for the expected reason.
- Minimal GREEN. Derive orgId from the room row (root, not a header workaround). No TypeSpec change expected (no regen) unless a query param is added — if so, **regen**: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`; never hand-edit `generated/**`.
- Run validation (focused → comms module → full api-ts → typecheck → memberry). Don't claim a command passed unless it ran.
- Append a FIX-008-read section to `realtime-comms-fix-report.md` (the `04` §12 structure).

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2 + Step 31 channel-model + Step 32 Batch C). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6208 pass / 1 pre-existing fail (`registerEmailJobs` interval 30000-vs-1000, unrelated) / 3 todo / 93 skip** (drifted up from 6196 via Step 32 Batch C = +12); `tsc` 0 errors (5/5 workspaces); memberry `bun run test` **674 pass / 0 fail** (+4 from Step 32). DB migrated through 0068 (no new migration in Step 32).
- `check:sdk-compat` already exits 1 from **pre-existing** advertising/jobs/marketplace `/association/*` path-move baseline drift (zero comms ops). Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.
- Step 32 added (don't regress): `sendChatMessage.ts`/`ws.chat-room.ts` archived guards; `listChatRooms.ts` + `chatRoom.repo.ts` (`withParticipants`, `findUserRoomsPage`, SQL `messageCount + 1`, conditional active-call claim) + `comms.schema.ts` (`withParticipants`); `createChatRoom.ts` `auditResourceId`; `comms.tsp` x-audit + regen; `apps/memberry/.../messages/index.tsx` MessageSearch mount; new tests `repos/chatRoom.repo.test.ts`, `handlers/__tests__/comms-audit.test.ts`, `apps/memberry/.../messages-search-mount.test.tsx`.

## Stop condition

After the FIX-008 read-path decision-free subset lands + its fix-report section saved, STOP. Recommend exactly one next gated batch per consolidated-roadmap §8 (candidates: DM PD-2 strictness, video PD-3 gate FIX-011, spec-direction FIX-015/018 CF-1; or surveys PD-1/2/3; or documents Batch C certificates gated on Q8). Do NOT auto-chain to another module.

execute systematically
