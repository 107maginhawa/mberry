# Continuation prompt — AHA Step 41 (DECISION-PINNED — realtime-comms PD-1: channel-membership model + channel-create round-trip)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-41-prompt.md`.

> **Decision pinned (engineering default — ship, then FLAG for user ratification).** PD-1 (the last standing realtime P0) is the channel-membership model. `/messages` channels are the primary member surface and are **permanently empty** today: the Create-Channel dialog sends a payload the backend rejects (`participants: []` + a fake `context: 'channel:x'` UUID), the `ChatRoom` TypeSpec contract never modeled channels (`name`/`roomType` absent), and `createDefaultChannels` has **zero production callers**. Per the user's standing deferral, PD-1 is resolved as: **(1) Channel membership = implicit org-scoped** — a `roomType:'channel'` room belongs to an `organizationId` and every ACTIVE member of that org implicitly has access (no per-member join rows for channels → scales; extends the already-shipped FIX-007 OR-check shim). DMs/group rooms keep JSONB `participants`. **(2) Channel creation = officers/admins only** (members cannot create channels). **(3) Default channels = `#general` (open read+write) + `#announcements` (officer-post-only)**, auto-provisioned per org, lazily backfilled for existing orgs. This is a Steps 29–40-style eng-default+ratify session: implement on this decision, then surface it for sign-off — do NOT treat it as final product law.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–40) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it).
3. `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` — **§ batches** (Batch A = FIX-001/002/003; Batch B = FIX-004/005/006/007…), **the FIX rows** (FIX-002 dialog-payload leg, FIX-003 TypeSpec leg, FIX-004 default-channels wiring, FIX-007 OR-check shim — already shipped), and **§ Product Decisions (PD-1)**. PD-1 is now RESOLVED per the header above.
4. `docs/aha/module-fix-plans/realtime-comms-fix-report.md` — confirm what already shipped (Batch A FIX-001 real-time delivery + R-1 migration 0064 + Batch B subset FIX-007 OR-shim + FIX-009 Vite ws:true). Do NOT re-do shipped fixes.

**Pre-flight reads (do these BEFORE any edit — per `feedback_subagent_preflight`):** `specs/api/src/modules/comms.tsp` (ChatRoom / CreateChatRoomRequest models, L35–56 + L335), `services/api-ts/src/handlers/comms/createChatRoom.ts`, `services/api-ts/src/handlers/comms/repos/*default-channel*` (`createDefaultChannels`), `services/api-ts/src/handlers/comms/ws.chat-room.ts` (L74 membership OR-check — the shipped FIX-007 shim), `apps/memberry/src/features/comms/components/create-channel-dialog.tsx` (L54–55 payload), `apps/memberry/src/features/comms/components/channel-list.tsx` (L93–94 empty state).

## Step 2 — FIX-003: model channels in the contract (TypeSpec — gated leg, now unblocked)

Per PD-1. In `specs/api/src/modules/comms.tsp`:
- Add `name?: string` and `roomType: 'channel' | 'dm' | 'group' | 'booking'` (match existing room kinds in code — verify the enum against `comms.schema.ts` `roomType`/`context` usage before finalizing) to `ChatRoom` + `CreateChatRoomRequest`.
- Resolve the `context` typing conflict: today `context` is typed as a UUID but the dialog sends `channel:x` strings. Either widen `context` to a string or drop it from the channel-create path in favor of `roomType` + `organizationId` (prefer the latter — `roomType:'channel'` + org scope replaces the `channel:x` hack).
- Channel-create semantics: creator auto-added as admin; an org-scoped `roomType:'channel'` room does NOT require a `participants` array (implicit org membership per PD-1).
- `@extension("x-require-officer", …)` or `x-require-position` on the channel-create operation so **only officers/admins create channels** (PD-1 decision 2). Use the existing extension pattern (see CLAUDE.md "Audit + officer/position via TypeSpec extensions").

**Regen after the TypeSpec edit (mandatory — stale generated code otherwise):**
`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` then SDK regen if the plan's pipeline requires it. Restart the API server (no hot-reload for new routes).

## Step 3 — FIX-002: fix the Create-Channel dialog payload

`apps/memberry/src/features/comms/components/create-channel-dialog.tsx` (L54–55): send the new valid shape (`name`, `roomType:'channel'`, org scope) — drop `participants: []` and the fake `context:'channel:x'`. Round-trip must pass the REAL generated validator (not a mocked mutation).

## Step 4 — FIX-004: provision default channels (#general + #announcements)

`createDefaultChannels` has zero callers. Wire it so every org has `#general` (open read+write) + `#announcements` (officer-post-only) — PD-1 decision 3. `[CROSS-MODULE RISK]`: the trigger lives at association:member chapter/org creation. For EXISTING orgs, provision lazily (idempotent — on first `/messages` load or a one-shot backfill); do NOT big-bang migrate. Members of an org implicitly see/read these via the implicit-org-scoped access model — extend the FIX-007 OR-check so `roomType:'channel'` + active org membership ⇒ access (no per-member join rows for channels).

## Step 5 — TDD (RED first, per protocol)

- **FIX-003/002 channel-create round-trip** (integration): a valid channel-create body (`name`/`roomType`, creator auto-added, no fake `channel:x`) is accepted by the **real generated validator** and creates a room; a member (non-officer) is **rejected** (PD-1 decision 2). Extend `apps/memberry/src/features/comms/__tests__/create-channel-dialog.test.tsx` against the real schema + backend `chat-rooms-stabilization.test.ts` / `chat-rooms-stabilization`-style handler test.
- **FIX-004 default-channels** (integration): creating an org provisions `#general` + `#announcements` visible to its members; idempotent on re-provision. `[CROSS-MODULE RISK]` — alongside the association:member chapter-creation test.
- **Implicit-membership access** (backend/unit + RBAC): an active org member NOT in any JSONB `participants` array is granted WS+REST access to that org's `roomType:'channel'` room; a non-member of the org is denied. Extend `handlers/comms/comms-rest-handlers.test.ts` + `ws.chat-room.test.ts`.
- **Two-session chat E2E** (only after channels create + the already-shipped FIX-001 broadcast): two members in `#general` see each other's messages live. `apps/memberry/tests/e2e/comms/` — pin Playwright per `project_playwright_pin` (1.58.2). If the live WS stack can't run in this env, mark `[BLOCKED BY ENVIRONMENT]` and prove the contract via the integration + unit nets instead.

Do NOT promote the full JSONB→join-table big-bang membership migration — `[DO NOT OVERBUILD]`. Implicit org-scoped access + the existing OR-check shim is the V1 model.

## Step 6 — Validation

- `cd specs/api && bun run build` (TypeSpec compiles) + `cd services/api-ts && bun run generate` (clean regen, no drift).
- `bunx tsc --noEmit` across touched workspaces (clean).
- `bun test` for touched files: comms handler tests, `create-channel-dialog.test.tsx`, default-channels test, `ws.chat-room.test.ts`.
- Live browse (`/browse` gstack) if the dev stack is up (API :7213, app :3004): create a channel as an officer, confirm it appears in `channel-list.tsx` (no "No channels yet"), post a message. Save evidence under `docs/aha/evidence/screenshots/` or `playwright-findings/`. If env-blocked, mark `[BLOCKED BY ENVIRONMENT]`.
- Note: `check:sdk-compat` will likely flag the additive ChatRoom fields — that is EXPECTED additive drift from this TypeSpec change (not the pre-existing path-rename noise). Document it; do NOT `--update` the SDK baseline (deferred to milestone Step 6).

## Stop condition

After channel-create round-trips GREEN (officer creates, member blocked, default channels provisioned, implicit-org access proven), append a **Step 41 — PD-1 channel-model** section to `realtime-comms-fix-report.md` (scope, the pinned PD-1 decision + that it is an eng-default awaiting ratification, RED→GREEN, E2E evidence, completion decision) and update `realtime-comms-fix-ready-plan.md` (FIX-002/003/004 → resolved; PD-1 → resolved-pending-ratification). Then STOP.

Do NOT auto-chain. Remaining work stays separate `/clear` decision sessions:
- **Newly pending ratification** (eng-defaults shipped): realtime **PD-1 channel model** (this session), plus the prior pile (documents Q1, elections FIX-002, m09 training-selector seam, Q6 zero-credit certs).
- **Still genuinely undecided** `[NEEDS PRODUCT DECISION]`: realtime PD-2 (DM org-scoping) / PD-3 (video V1 scope), surveys PD-1/2/3, platform-admin Q1–Q4/Q8, notifs Q1/2/3, elections FIX-004 (cancelled-election vote retention), training TC-DEC-01/02, person Q-1/Q-4, dues Q-PD6/7/8, marketplace G-06.

execute systematically
