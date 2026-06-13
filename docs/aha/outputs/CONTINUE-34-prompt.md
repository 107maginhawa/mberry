# Continuation prompt — AHA Step 34 (decision-free: activate FIX-008 read-path org-scoping in the memberry chat UI — wire `x-org-id` onto comms reads)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-34-prompt.md`.

> **Decisions already captured — do NOT re-ask.** Step 33 (realtime-comms **FIX-008 read-path org-scoping — decision-free non-DM subset**) is DONE and in the dirty tree: the 4 REST reads now enforce org isolation for **non-DM** rooms (channel/booking/group), deriving caller org from `ctx.get('organizationId')` + the loaded room row — module-local, `orgContextOptionalMiddleware`/`core/ws.ts` untouched. **getChatRoom/getChatMessages** reject a cross-org caller on a non-DM room (`ForbiddenError`); **listChatRooms/searchChatMessages** scope to `(organization_id = callerOrg OR room_type = 'dm')` when org context known. DM rooms are exempt (PD-2 preserved). New `ChatRoomFilters.organizationIdOrDm` + repo branch + `findUserRoomsPage` org opt. All recorded in `realtime-comms-fix-report.md` §"FIX-008 read-path org-scoping" (E.1–E.13). **The one honest caveat (E.9): the memberry chat UI does NOT yet send `x-org-id` on comms reads, so the new backend guard/filter is dormant for that surface.** This step is the **decision-free FE activation**: wire `x-org-id` onto the comms read calls so the Step-33 backend enforcement goes live. **Still product-gated, do NOT touch: DM org-scoping strictness PD-2, video PD-3 (FIX-011), spec-direction CF-1 (FIX-015/018).** Prior decisions still hold: PD-1 (auto-join + officer-only channels) RESOLVED+EXECUTED (Step 31); FIX-008 insert-leg + FIX-010 NOT NULL (Batch B+F); Batch C decision-free subset (Step 32). Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — **FIX-008** + §7 (shared dep) + §8 PD-2 (DM org-scoping, still gated).
3. Prior fix-report `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — **append, don't overwrite**. Read §"FIX-008 read-path org-scoping" E.9 (this step's gap) + E.1–E.13.

## Step 2 — Activate FIX-008 read-path in the memberry chat UI (decision-free, one `04` pass)

The Step-33 backend guard keys off `ctx.get('organizationId')`, which `orgContextOptionalMiddleware` only sets when the request carries org context. The memberry comms components call the reads **without** an org header, so the guard is dormant. Make it live by sending `x-org-id` (the org slug→id is already available via `useOrgProvider().orgId`) on the comms read calls:

- `listChatRooms` callers: `apps/memberry/src/features/comms/components/channel-list.tsx` + `dm-list.tsx` — thread `orgId` in (prop from the org-scoped messages route pages `org/$orgSlug/messages/index.tsx` + `org/$orgSlug/officer/messages/index.tsx`, which already have `orgId`) and pass `headers: { 'x-org-id': orgId }` into `listChatRoomsOptions({ ..., headers })`.
- `getChatMessages` caller: `apps/memberry/src/features/comms/components/chat-view.tsx` (+ `chat-thread.tsx`/`thread-panel.tsx` if they read messages) — thread `orgId` into `getChatMessagesOptions({ ..., headers: { 'x-org-id': orgId } })`.
- `getChatRoom` caller (if any FE call site exists) — same `x-org-id`.

Mirror the existing pattern already used by dues/chapters components (e.g. `dues-invoice-list.tsx` `headers: { 'x-org-id': tenantId }`).

**Correctness to preserve (verify, don't break):**
- `DmList` filters DMs client-side from the SAME `listChatRooms` query — the backend `(org OR dm)` filter still returns DM rooms, so DMs must keep showing. Confirm.
- A member viewing their own org: `orgContextOptionalMiddleware` sets `ctx.organizationId` only for active members → guard passes for same-org, scopes out other orgs. Confirm no regression for the pilot single-org case.
- Do NOT change DM semantics (PD-2): DM access stays participant-based.

**Explicitly OUT of scope (gated / deferred — do NOT touch):**
- **DM org-scoping strictness (PD-2)**, FIX-011 video PD-3, FIX-015/018 spec-direction CF-1, FIX-014 upsert dup-room constraint (→ Batch F), `core/ws.ts` + `orgContextOptionalMiddleware` (Batch E), WS `onConnect` org guard. No threading/reactions/read-state/mute/multi-party-video/Redis/edit-delete/rate-limits (Deferred / Do Not Build).
- No backend change expected (the guard/filter already exist from Step 33). If a backend gap surfaces, STOP that leg and document it — do not broaden.

TDD discipline:
- RED first (component tests asserting `listChatRooms`/`getChatMessages` options are built WITH `headers['x-org-id'] === orgId`; and the existing channel-list/dm-list/chat-view tests still pass) → confirm each new assertion fails before wiring.
- Minimal GREEN. Thread `orgId` as a prop; do not refactor unrelated component internals. Reuse `useOrgProvider`.
- No TypeSpec/regen/schema/SDK change (the SDK already supports per-call `headers`).
- Run validation (focused comms component tests → full memberry `bun run test` → monorepo typecheck → api-ts comms module sanity). Don't claim a command passed unless it ran.
- Append a FIX-008-activation section to `realtime-comms-fix-report.md` (the `04` §12 structure).

If threading `orgId` cleanly into a given read call is NOT separable without a larger refactor, ship the call sites that ARE clean (at minimum `listChatRooms` via channel-list/dm-list) and mark the rest a remaining gap — do not force a broad chat-component refactor.

## ENV / discipline

- Working tree intentionally dirty (recovery-2025 + prior AHA passes incl. documents Batch A/A2 + Step 31 channel-model + Step 32 Batch C + Step 33 FIX-008 read-leg). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6217 pass / 2 fail / 3 todo / 93 skip** — both fails PRE-EXISTING + UNRELATED: (1) `registerEmailJobs` interval 30000-vs-1000 (known), (2) `getNextBookableTime > returns a time in the future` (booking slot-rounding, **wall-clock-dependent** — asserts `result ≥ Date.now()`; may pass on other dates; zero booking files involved). Drifted up from 6208 via Step 33 = +10 new comms tests minus the date-flake flip. comms module **162 pass / 0 fail** (11 files). `tsc` **5/5** workspaces clean. memberry `bun run test` **674 pass / 0 fail** (this step SHOULD increase it via the new wiring tests). DB migrated through 0068 (no new migration in Step 33/34 expected).
- `check:sdk-compat` already exits 1 from **pre-existing** advertising/jobs/marketplace `/association/*` path-move baseline drift (zero comms ops). Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.
- Step 33 added (don't regress): backend read-leg guards in `getChatRoom.ts`/`getChatMessages.ts`/`listChatRooms.ts`/`searchChatMessages.ts`; `chatRoom.repo.ts` (`organizationIdOrDm` branch + `findUserRoomsPage` org opt) + `comms.schema.ts` (`ChatRoomFilters.organizationIdOrDm`); tests in `comms-rest-handlers.test.ts`, `repos/chatRoom.repo.test.ts`, `searchChatMessages.test.ts`.

## Stop condition

After the FIX-008 FE-activation lands + its fix-report section saved, STOP. Recommend exactly one next gated batch per consolidated-roadmap §8 (candidates: DM PD-2 strictness, video PD-3 gate FIX-011, spec-direction FIX-015/018 CF-1; or surveys PD-1/2/3; or documents Batch C certificates gated on Q8). Do NOT auto-chain to another module.

execute systematically
