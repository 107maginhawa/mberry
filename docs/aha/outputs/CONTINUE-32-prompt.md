# Continuation prompt — AHA Step 32 (next gated `04`: realtime-comms Batch C decision-free completeness/trust subset)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-32-prompt.md`.

> **Decisions already captured — do NOT re-ask.** Step 31 (channel-model batch) is DONE and in the dirty tree: **FIX-003** (comms.tsp `ChatRoomType` enum + `name`/`roomType` on ChatRoom+CreateChatRoomRequest + `context` UUID→string, regenerated — DB columns pre-existed, no migration), **FIX-002** (Create-Channel dialog → `buildChannelCreateBody` org-scoped payload, dropped `channel:x` hack), **FIX-007** (officer-only channel create gate + creator auto-add + `chat_room_member` populate; OR-shim read path retained), **FIX-004** (`autoJoinOrgChannels` + 3 comms domain-event consumers: `organization.created`→`createDefaultChannels`, `membership.created`/`.imported`→auto-join). All recorded in `realtime-comms-fix-report.md` §"Channel-Model Batch". PD-1 (auto-join + officer-only) is RESOLVED+EXECUTED. **Still product-gated, do NOT touch: DM org-scoping PD-2, video PD-3, doc CF-1.** This step runs the next gated `04`: **realtime-comms Batch C — decision-free completeness/trust subset.** Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — Batch C rows: **FIX-012** (archived rooms reject new messages REST+WS), **FIX-013** (`listChatRooms` filter/pagination bugs — context filter applied after slice, `withParticipant` totals wrong, in-memory pagination), **FIX-014** (race: non-atomic `messageCount` increment, check-then-set active-call, upsert dup-room no unique constraint), **FIX-016** (mount the unwired `MessageSearch` component), **FIX-017** (`x-audit` on createChatRoom/endVideoCall).
3. Prior fix-report `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — **append, don't overwrite** (A real-time delivery + B subset + R-1 org NOT NULL + Step 31 channel-model all done).

## Step 2 — Run realtime-comms Batch C decision-free subset (one `04` pass)

Execute the **decision-free** Batch C items only:
- **FIX-012** — block sends to `status === 'archived'` rooms on BOTH `sendChatMessage` (REST) and `ws.chat-room.ts` chat.message path (documented read-only semantics).
- **FIX-013** — push `listChatRooms` context/withParticipant filtering + pagination into SQL (the booking page + the now-provisioned channels look rooms up by `context`; wrong-page slice hides them).
- **FIX-014** — atomic `messageCount` increment (SQL-side `+ 1`), guarded active-call set (check-then-set → conditional UPDATE), and the upsert dup-room guard.
- **FIX-016** — mount `MessageSearch` in the messages page (backend search done + tested; zero consumer today).
- **FIX-017** — declare `@extension("x-audit", …)` on `createChatRoom` + `endVideoCall` in `comms.tsp` (privileged actions currently leave only pino logs); regen.

**Explicitly OUT of scope (gated — do NOT touch):** FIX-011 video panel gating (PD-3), FIX-015 WS inbound spec-vs-impl direction (CF-1/needs-confirmation; co-lands with a spec decision), FIX-018 `comms.md` doc cleanup (CF-1), FIX-008 read-path org filter for **DMs** (PD-2). Channel/list org read-filtering may proceed if trivially decision-free, but DM strictness stays PD-2-gated. No threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build).

TDD discipline:
- RED first (archived-send rejection REST+WS; `listChatRooms` context filter found regardless of page; concurrent active-call start → one 409 + SQL-side count; `MessageSearch` renders + queries; `x-audit` emits on createChatRoom/endVideoCall) → confirm each fails for the expected reason.
- Minimal GREEN. FIX-017 touches `comms.tsp` → **regen**: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`. Do NOT hand-edit `generated/**`.
- Run validation (focused → module tests → typecheck). Don't claim a command passed unless it ran.
- Append a Batch C section to `realtime-comms-fix-report.md` (the `04` §12 structure).

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2 + Step 31 channel-model). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6196 pass / 1 pre-existing fail (`registerEmailJobs` interval 30000-vs-1000, unrelated) / 3 todo** (drifted up from 6185 via Step 31 channel-model = +11); `tsc` 0 errors (5/5 workspaces); memberry `bun run test` **670 pass / 0 fail** (+1 from Step 31). DB migrated through 0068 (no new migration in Step 31).
- `check:sdk-compat` already exits 1 from **pre-existing** advertising/jobs/marketplace `/association/*` path-move baseline drift (zero comms ops). Step 31 + a FIX-017 TypeSpec change ADD comms x-audit metadata (additive/field-level) — expected; do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.
- Step 31 added (don't regress): `comms.tsp` channel modeling + regen; `handlers/comms/createChatRoom.ts` (officer gate + auto-add + join populate); `handlers/comms/default-channels.ts` (`autoJoinOrgChannels`); `core/domain-event-consumers.ts` (3 comms consumers); `apps/memberry/.../create-channel-dialog.tsx` (`buildChannelCreateBody`) + officer messages page `orgId` wiring.

## Stop condition

After the Batch C decision-free subset lands + its fix-report section saved, STOP. Recommend exactly one next gated batch per consolidated-roadmap §8 (candidates: realtime FIX-008 DM read-filter + DM PD-2, video PD-3 gate FIX-011, spec-direction FIX-015/018 CF-1; or surveys PD-1/2/3; or documents Batch C certificates gated on Q8). Do NOT auto-chain to another module.

execute systematically
