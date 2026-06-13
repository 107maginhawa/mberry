# Continuation prompt — AHA Step 42 (DECISION-FREE — realtime-comms FIX-006: DM creation UI)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-42-prompt.md`.

> **Decision-free.** FIX-006 (DM creation) is a frontend build, not a product decision. The DM
> page is a dead end today: `dm-list.tsx` exposes an optional `onNewDm` prop but no caller wires
> it, there is no member-picker, and the empty state references an action that does nothing. The
> backend `createChatRoom` already accepts `roomType: 'dm'` (Step 31 channel-model batch). This
> pass builds the member-picker → `createChatRoom({ roomType: 'dm', participants: [me, them] })`
> → DM room opens, with the SDK `createChatRoomMutation`. **No TypeSpec / schema / regen / SDK
> change.** DM **org-scoping strictness (PD-2)** is a SEPARATE product decision and is explicitly
> NOT in this pass — build the create flow org-scoped (both participants from the current org via
> `useOrgProvider().orgId`) but do not change the FIX-008 DM read-filter strictness.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–41) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it).
3. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — **FIX-006 row** (G3, Batch B), **§5 Test-First Plan FIX-006**, **§6 Files To Touch FIX-006**.
4. `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — confirm what already shipped (Steps 31/33/34/41). Do NOT re-do shipped fixes. Note: channel create (FIX-002/003/004/007), org-isolation FE/BE (Steps 33/34), and the `#announcements` officer-post gate (Step 41) are DONE.

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** the vite proxy + toast (`sonner`) + auth + route patterns; `apps/memberry/src/features/comms/components/dm-list.tsx` (the `onNewDm` prop, L18/40/79–83), `apps/memberry/src/routes/_authenticated/org/$orgSlug/messages/dm/index.tsx` (the dead `onNewDm` wiring + empty state), `apps/memberry/src/features/comms/components/create-channel-dialog.tsx` (mirror its `createChatRoomMutation` + `orgId`-prop + `buildChannelCreateBody` pattern for a `buildDmCreateBody`), and a member-listing SDK hook (look for an existing roster/member-list query the org provides — reuse, do not invent an endpoint).

## Step 2 — FIX-006: DM creation flow

Build the smallest correct create-DM journey, mirroring the shipped channel dialog:

- A **member-picker** (dialog or inline) listing the current org's members (reuse the existing roster/member SDK hook found in pre-flight; do NOT add a new API). Exclude self.
- On select → `createChatRoomMutation` with a pure `buildDmCreateBody(myPersonId, targetPersonId, orgId)` → `{ roomType: 'dm', organizationId, participants: [me, them] }` (keep the body-builder pure + unit-testable, exactly like `buildChannelCreateBody`).
- `upsert: true` so re-opening an existing DM returns it instead of erroring (the backend dedups DM/group rooms by participant set — verify in `createChatRoom.ts`).
- Wire `onNewDm` from `messages/dm/index.tsx` to open the picker; pass `useOrgProvider().orgId`. On success → select/open the new room.
- Fix the empty-state copy so it points at the now-real action.

DM creation is **member-allowed** (NOT officer-gated — channels are officer-only, DMs are not). Use `sonner` for toasts. No `/api` prefix.

## Step 3 — TDD (RED first, per protocol)

- **`buildDmCreateBody` unit** (frontend/component): emits `{ roomType:'dm', organizationId, participants:[me,them] }`, excludes duplicates, no `context` hack. Mirror `create-channel-dialog.test.tsx`.
- **DM picker → mutation** (frontend/component): selecting a member calls `createChatRoomMutation` with the valid body and opens the room on success. Use the REAL generated mutation shape (not a hand-faked payload).
- **Backend regression** (optional, only if a gap surfaces): `createChatRoom` with `roomType:'dm'` + 2 participants still 201s and dedups on upsert — likely already covered by `comms-rest-handlers.test.ts`; extend only if missing.
- **E2E** `[BLOCKED BY ENVIRONMENT]` likely (no live stack): member picks a colleague → DM opens. Pin Playwright 1.58.2 per `project_playwright_pin`. If env-blocked, prove via the component + body-builder nets and mark it.

## Step 4 — Validation

- `bunx tsc --noEmit` / `bun run --filter '*' typecheck` (clean across touched workspaces).
- `bun run test` (memberry) for the new dialog/picker + body-builder tests; `bun test src/handlers/comms/` if backend touched.
- Live browse (`/browse`) if dev stack up (API :7213, app :3004): open `/messages` DM tab, create a DM, confirm it opens + persists. Evidence under `docs/aha/evidence/`. If env-blocked, mark `[BLOCKED BY ENVIRONMENT]`.
- No TypeSpec/schema/regen/SDK expected — if you find yourself editing `comms.tsp` or generated files, STOP: FIX-006 is FE-only.

## Stop condition

After DM-create round-trips GREEN (member picks → valid `roomType:'dm'` body → room opens), append a **Step 42 — FIX-006 DM creation** section to `realtime-comms-fix-report.md` (scope, RED→GREEN, files, evidence, completion decision) and update `realtime-comms-fix-ready-plan.md` (FIX-006 → resolved). Then STOP. Do NOT auto-chain.

Remaining realtime work stays separate `/clear` sessions:
- **`[NEEDS PRODUCT DECISION]`**: PD-2 (DM org-scoping strictness — the FIX-008 DM read-filter leg), PD-3 (video V1 scope), CF-1 (FIX-015/018 spec-doc direction).
- **Decision-free shippable**: FIX-011 (gate `video-call-panel.tsx` behind `comms_video_calls` flag — honest state).
- **Newly pending ratification** (eng-defaults shipped): realtime PD-1 channel model — incl. the per-member-row vs implicit-no-rows divergence flagged in fix-report §41.6 — plus the prior pile (documents Q1, elections FIX-002, m09 training-selector seam, Q6 zero-credit certs).

execute systematically
