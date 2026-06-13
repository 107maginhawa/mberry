# Continuation prompt — AHA Step 43 (DECISION-FREE — realtime-comms FIX-011: gate video panel behind flag)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-43-prompt.md`.

> **Decision-free.** FIX-011 gates the misleading video-call panel behind the
> `comms_video_calls` feature flag — an honest-state fix, not a product decision. Today
> `video-call-panel.tsx` ships ungated on the booking-detail page: `joinVideoCall` 404s by
> construction, an error toast fires on every attempt, P2P proceeds untracked (no call
> records), and there is a dead `roomUrl` signal path. The m07 spec marks `comms_video_calls`
> as a **release flag, default false** (`docs/product/modules/m07-communications/MODULE_SPEC.md:392`).
> This pass makes the UI honest: when the flag is OFF (the default), the panel does NOT render
> the join/call UI — it shows a short "video calls unavailable" state instead. **No TypeSpec /
> schema / regen / SDK change.** **Finishing** the start-call flow (lobby, grid, call records,
> token verify) is **PD-3 and explicitly NOT in this pass** — gate only, do not build video.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–42) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it).
3. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — **FIX-011 row** (Batch C video), **§5 Test-First Plan FIX-011**, **§6 Files To Touch FIX-011**, **§8 PD-3** (gate-vs-finish — gate only).
4. `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — confirm what already shipped (Steps 31/33/34/41/42). Do NOT re-do shipped fixes. FIX-006 (DM creation) is DONE (Step 42).

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** the vite proxy + toast (`sonner`) + auth + route patterns; and:
- `apps/memberry/src/features/comms/components/video-call-panel.tsx` (the panel — `joinVideoCallMutation` L52–77, the `active`/`roomUrl` paths, what currently renders).
- `apps/memberry/src/routes/_authenticated/my/bookings/$bookingId.tsx` (the ONLY consumer — make sure gating the panel doesn't break the page layout; keep a graceful fallback).
- `services/api-ts/src/core/feature-flags.ts` — the flag system. Public **`GET /feature-flags`** (hand-wired, NOT in the SDK) returns `parseFeatureFlags()`: env `FF_*` → camelCase keys, value `'true'`/`'1'` → true, **absent/anything-else → false**. So `comms_video_calls` ⇒ env `FF_COMMS_VIDEO_CALLS` ⇒ JSON key **`commsVideoCalls`**, default **false**.
- A small FE data hook + the SDK client base URL helper (`@monobase/sdk-ts/client` `getSdkBaseUrl`, already imported by `video-call-panel.tsx`) — to fetch `/feature-flags` (NO `/api` prefix; the Vite proxy strips it).
- `create-channel-dialog.test.tsx` + `dm-member-picker.test.tsx` — mirror their bun:test + global-SDK-stub patterns for the new component test.

## Step 2 — FIX-011: gate the panel (honest state)

Build the smallest correct gate:

- Add a tiny FE flag read — e.g. `useFeatureFlag('commsVideoCalls')` (or `useFeatureFlags`) that fetches `GET /feature-flags` via TanStack Query and returns the boolean (default **false** when absent / loading / on error — fail closed to the honest state).
- In `VideoCallPanel`: when the flag is **off** (default), do NOT mount the join/call UI, do NOT fire `joinVideoCallMutation`, do NOT construct the peer connection. Render a short honest state instead ("Video calls aren't available yet." — keep copy minimal, no dead buttons). When **on**, render the existing panel unchanged (no behavior change for the flagged-on path).
- Keep the gate FE-only and module-local to comms. Do NOT touch `joinVideoCall.ts`, the WebRTC peer-connection util, TypeSpec, or the SDK. `GET /feature-flags` already exists — do not add a route.

PD-3 (finish-vs-gate) stays open: gate only. Use `sonner` only on the flagged-ON error path (already present). No `/api` prefix.

## Step 3 — TDD (RED first, per protocol)

- **`VideoCallPanel` gated (flag OFF → honest state)** (frontend/component): with `commsVideoCalls` false (default), the panel renders the unavailable state, does NOT render the join/start control, and does NOT call `joinVideoCallMutation`. New: `apps/memberry/src/features/comms/__tests__/video-call-panel.test.tsx`. Use the global SDK stub + prime the flag hook (mock the `/feature-flags` query or the `useFeatureFlag` hook) — follow the bun:test patterns in `dm-member-picker.test.tsx` (shim `vi`, global stub, `mockReturnValue`/`mockImplementation`; assert first mutation arg only since react-query passes `(vars, ctx)`).
- **Flag ON → panel renders** (frontend/component): with `commsVideoCalls` true, the existing join UI mounts (assert the join control is present). Prove the gate is a real branch, not a permanent hide.
- **(Optional) flag-hook unit**: `commsVideoCalls` absent/loading/error ⇒ false (fail-closed). Keep it pure if the hook has a parse/default helper.
- **E2E** `[BLOCKED BY ENVIRONMENT]` likely (no auth/seed — Step 42 confirmed `/browse` redirects to `/auth/sign-in`). Prove via the component nets and mark it. Pin Playwright 1.58.2 per `project_playwright_pin` if you do add a spec.

## Step 4 — Validation

- `bunx tsc --noEmit` (memberry) — clean across touched workspaces.
- `bun test apps/memberry/src/features/comms/` — new panel test + no regressions (Step 42 baseline: 38 pass).
- Live browse (`/browse`) only if a real authed booking-detail page is reachable; otherwise mark `[BLOCKED BY ENVIRONMENT]`. Evidence under `docs/aha/evidence/`.
- No TypeSpec/schema/regen/SDK expected — if you find yourself editing `comms.tsp` or generated files, STOP: FIX-011 is FE-only.

## Stop condition

After the panel is honestly gated GREEN (flag OFF default → unavailable state, no join attempt; flag ON → existing UI), append a **Step 43 — FIX-011 video gate** section to `realtime-comms-fix-report.md` (scope, RED→GREEN, files, evidence, completion decision) and update `realtime-comms-fix-ready-plan.md` (FIX-011 → resolved as gated; PD-3 finish stays deferred). Then STOP. Do NOT auto-chain.

Remaining realtime work stays separate `/clear` sessions:
- **`[NEEDS PRODUCT DECISION]`**: PD-2 (DM org-scoping strictness — FIX-008 DM read-filter leg), PD-3 (video V1 *finish* scope — beyond this gate), CF-1 (FIX-015/018 spec-doc direction).
- **Newly pending ratification** (eng-defaults shipped): realtime PD-1 channel model (per-member-row vs implicit-no-rows, fix-report §41.6) + the prior pile (documents Q1, elections FIX-002, m09 training-selector seam, Q6 zero-credit certs).

execute systematically
