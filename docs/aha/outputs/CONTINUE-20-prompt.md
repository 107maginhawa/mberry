# Continuation prompt — AHA Step 20 (next `04`: Realtime Comms — **Batch B subset** decision-free: FIX-007 OR-shim + FIX-009 ws:true)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-20-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). Two small, independent fixes: **FIX-007** — a backend **membership-authz OR-shim** (grant chat access if the user is in the legacy JSONB `participants` **OR** the `chat_room_member` join table); pure handler/authz logic, unit-TDD-able, **no TypeSpec/schema/regen**. **FIX-009** — a **verify-then-fix** on the memberry Vite dev proxy: confirm whether `/api/ws/...` actually upgrades through Vite, and only if it is genuinely broken add `ws: true` (one line) to `apps/memberry/vite.config.ts`. Proven by **Bun unit tests** (FIX-007) + a **live dev WS smoke** (FIX-009). Follow the fix-ready plan as the primary guide. Do NOT expand scope. **FIX-007 ships ONLY the OR-check compatibility shim — do NOT build the full join-table canonical membership model (PD-1 product-blocked) and do NOT add any new `ChatRoomMemberRepository` methods.** Do NOT touch `core/ws.ts` (WS envelope — Batch E isolated) or `orgContextOptionalMiddleware`/`middleware/org-context.ts` (9-prefix blast radius — Batch E isolated). Do NOT start FIX-002/003/004/006 (PD-1 / cross-module / DM-UI), FIX-008 route-read filtering, FIX-011..018 (Batch C), or any V2/Do-Not-Build item. Stop after saving the fix report.
>
> **ENV NOTE (verified working 2026-06-12):** Docker up (postgres/minio/mailpit/stripe-mock). DB `localhost:5432/monobase` migrated (incl. realtime R-1 migration `0064` org_id NOT NULL, applied live) + seeded. **FIX-007 needs only `bun test` (no live stack).** **FIX-009 needs a live dev run:** start the API (`cd services/api-ts && bun dev` → port 7213) and the memberry app (`cd apps/memberry && bun dev` → port 3004), then probe the WS upgrade **through the Vite proxy** at `ws://localhost:3004/api/ws/comms/...` using a **Bun WebSocket client** (NOT curl — curl/wget are hook-blocked). Expect HTTP 101 if the proxy upgrades; a failed/closed handshake (or a hang on "Reconnecting…") confirms G8 is real. The chat hook target shape is in `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts` L31–34. The Hurl contract suite still boots per the standard recipe (`cd services/api-ts && SERVER_PORT=7299 bun src/index.ts`, then `API_URL=http://localhost:7299 bun run test:contract`) but is **not central to this pass** (no comms Hurl flow changes). Kill throwaway servers when done (`lsof -ti tcp:7299 | xargs kill`; same for 3004/7213). `hurl` 8.0.1 installed.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Realtime Comms, Batch B subset (decision-free: FIX-007 membership OR-shim + FIX-009 Vite ws:true verify-then-fix)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (realtime-comms)
03-organize-gap-plan-for-fixing.md     # DONE (realtime-comms)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS = realtime-comms Batch B subset)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (re-flag only if schema changes — FIX-007/009 add none)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Platform Admin — Batch B (decision-free P1s + cheap aligns) — COMPLETE (2026-06-12).** FIX-003 (admin invite-claim: new `claimAdminInvite` handler binding userId by verified-email match + hand-wired `POST /platform-admin/claim` + `admin.invited` email consumer + seeded `admin.invite` template; no schema/migration/regen), FIX-006 (ticket priority sort), FIX-007 (impersonate UI super+support gate + `ROUTE_ROLES` nav sync), FIX-012 (ticket reopen-on-officer-reply + in-app notify consumers; email channel deferred), FIX-018 (NAVIGATION_MAP regen). Adversarially verified (3 SOLID, 2 minor → fixed). See `platform-admin-fix-report.md` §B.1–B.16. **NOTE: the platform-admin `FIX-007` is a different fix from the realtime-comms `FIX-007` in THIS pass — do not conflate.**
- **`04` Realtime Comms — Batch A — COMPLETE.** FIX-001 (real-time chat delivery: REST→`publishToChannel` broadcast + client/server frame-contract `{type,data}`⇄`{event,payload}`, killing the `ws.chat-room.test.ts` fake-green) + FIX-005 (upsert admin-escalation guard). See `realtime-comms-fix-report.md` §1–§15.
- **`04` Realtime Comms — R-1 (Batch B+F coupled) — COMPLETE.** FIX-008 **insert-path** org derivation (`chatMessage.repo.ts` `resolveOrgId` closes all 8 callers — WS/REST/video/system; no NULL org insertable) + FIX-010 Batch F migration `0064` (backfill + `SET NOT NULL`, applied + verified on the live booted DB). See `realtime-comms-fix-report.md` "Batch B+F Addendum".
- **`04` Marketplace/Ads/Reviews A–D, Jobs Batch A, Platform Admin Batch D — all COMPLETE** (prior sessions).

## This pass — execute `04` for Realtime Comms, Batch B subset (decision-free)

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` (§3 FIX-007/FIX-009 rows; §4 Batch B; §5 test-first; §6 files; §7 shared deps; §8 PD-1/CF-3; §11 Do-Not-Build; §12 root-cause).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/realtime-comms-gap-plan.md` (G5 membership dual-source-of-truth; G8 Vite WS proxy).
   - Prior fix report (what's done — **APPEND** a "Batch B subset" section; do NOT rewrite the Batch-A or R-1 sections): `docs/aha/module-fix-plans/realtime-comms-fix-report.md`.
   - Module slug = `realtime-comms`. Readable name = "Realtime Comms".
3. Invoke `superpowers:test-driven-development` (RED-first). FIX-007 flips an honest RED (a join-table-only member is currently denied) → GREEN. FIX-009 is verify-then-fix (live dev smoke first).
4. **Selected subset — Batch B decision-free (2 fixes):**
   - **FIX-007 — G5 membership compatibility shim (P1, V1 REQUIRED).** The chat membership/authz check honors ONLY the legacy JSONB `participants` array (`ws.chat-room.ts:74`, `getChatRoom.ts:61`, and the message-read path), so a member tracked in the `chat_room_member` join table (`chatRoomMember.repo.ts` — currently **zero callers**) is wrongly denied WS + REST access. Fix: grant access if the user is in JSONB `participants` **OR** in `chat_room_member` for that room (an OR-check shim). **Ship ONLY the shim.** Do NOT replace JSONB as the canonical source, do NOT migrate to the join-table model (PD-1 blocked), do NOT add new repo methods — call the existing read on `chatRoomMember.repo.ts`. RED: a join-table member (NOT in JSONB participants) is granted WS+REST access — extend `handlers/comms/comms-rest-handlers.test.ts` + `handlers/comms/ws.chat-room.test.ts`.
   - **FIX-009 — G8 Vite dev WS proxy (P1, V1 REQUIRED, verify-then-fix).** `apps/memberry/vite.config.ts` (L9–15) `/api` proxy is missing `ws: true`; the chat hook targets `/api/ws/comms/...`. **VERIFY FIRST (CF-3):** boot API (7213) + memberry dev (3004) and probe `ws://localhost:3004/api/ws/comms/...` with a Bun WS client (per ENV NOTE). If the upgrade genuinely fails → add `ws: true` to the proxy (one-line) and re-probe to confirm 101/connected. If it already upgrades (e.g. a separate WS route handles it) → document that G8 is NOT a real outage and make NO change. Classify the root cause from the live result (the plan marks it `[NEEDS CONFIRMATION]`). Capture the before/after probe result as evidence.
5. **Do NOT implement in this pass (out of subset / gated / later):**
   - FIX-001, FIX-005 (Batch A), FIX-008 insert leg, FIX-010 (R-1) — already DONE. Do not redo.
   - **FIX-002 / FIX-003** (channel creation: dialog payload + TypeSpec `name`/`roomType`) — `[NEEDS PRODUCT DECISION] PD-1` (channel membership/auto-join + who-may-create). Do NOT touch.
   - **FIX-004** (default-channels wiring) — cross-module (`association:member` chapter creation) + PD-1. Do NOT touch.
   - **FIX-006** (DM creation UI: member picker + `onNewDm` wiring) — Batch B but a frontend build; out of THIS decision-free subset (PD-2 affects DM org-scoping strictness). Do NOT build here.
   - **FIX-008 route-READ filtering leg** (reads currently unfiltered by org) — separate from the insert-path fix already done; out of this subset.
   - **FIX-011** (video panel gating) — Batch C + PD-3. **FIX-012..018** — Batch C. Do NOT touch.
   - The full **G5 join-table canonical membership model**, **multi-party video**, **Redis caching**, **message edit/delete**, **threading/reactions/read-state**, **comms-specific rate limits**, any **JSONB→join-table big-bang migration**, any new **comms org-context middleware**, and any expansion of `ChatRoomMemberRepository` — §11 Do-Not-Build / §10 Deferred.
   - **Batch E isolation:** do NOT modify `core/ws.ts` (WS envelope) or `orgContextOptionalMiddleware`/`middleware/org-context.ts` (shared by 9 prefixes: billing/booking/comms/communications/storage/reviews/audit/persons/surveys).
6. TDD / test discipline: write/flip the failing test FIRST for FIX-007 (watch a join-table-only member get denied for the right reason, then granted). FIX-009 is verify-then-fix — capture the live probe RED (failed upgrade) before the one-line change, then GREEN (101/connected); if the probe shows it already works, document that and skip the change (do NOT add `ws:true` blindly). Do NOT weaken assertions. Neither fix regenerates anything (FIX-007 handler-local; FIX-009 config).
7. **Pre-flight reads BEFORE touching code (do not skip):** `handlers/comms/ws.chat-room.ts` (membership check ~L74) + `getChatRoom.ts:61` + the message-read path (`getChatMessages.ts`) for the JSONB-only authz; `handlers/comms/repos/chatRoomMember.repo.ts` (the existing join-table read you will call — confirm its method signature; add NOTHING); `handlers/comms/comms-rest-handlers.test.ts` + `ws.chat-room.test.ts` (the baselines you will extend; note the R-1 ctx `_ws()` helper); `apps/memberry/vite.config.ts` (L9–15 proxy) + `apps/memberry/src/features/comms/hooks/use-chat-websocket.ts` (L31–34 WS URL) for FIX-009; the `realtime-comms-fix-report.md` Batch-A + R-1 sections (so you APPEND, not overwrite).
8. **Regen workflow:** NONE this pass. FIX-007 is handler/authz-local (no TypeSpec/schema). FIX-009 is a dev-config one-liner (no regen, no migration). If you discover FIX-007 needs a schema/contract change, STOP and document it as blocked — do not expand into a TypeSpec/migration change in this decision-free subset.
9. Validate: focused Bun unit tests for FIX-007 (`bun test src/handlers/comms/comms-rest-handlers.test.ts src/handlers/comms/ws.chat-room.test.ts`) → full comms backend suite → full api-ts `bun test` (record vs the **6181 pass / 1 fail / 4 todo** baseline; the 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs`, and `getNextBookableTime` is a separate booking clock-boundary-flaky test — do NOT attribute either to this batch) → monorepo typecheck (`bun run --filter '*' typecheck`, expect 5/5) → for FIX-009, the live dev WS smoke (before/after probe through the Vite proxy). The full Hurl suite has **3 known pre-existing failures** (`impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow`) — none are comms; do NOT attribute them to this batch and do NOT expect this pass to flip them. Save the fix report (APPEND a "Batch B subset — FIX-007 + FIX-009" section). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1–A9 + A8/A8b/A8c (Membership, Elections, Auth/RBAC, Billing, Communications, Documents, Notifications, Person, Marketplace A/B/C/D) — ✅ DONE.
- Jobs Batch A (`/postings` prefix P0) — ✅ DONE.
- A10 Platform-admin Batch B (FIX-003/006/007/012/018) — ✅ DONE.
- **A11 Realtime Comms Batch B subset (FIX-007 membership OR-shim, FIX-009 Vite ws:true verify-then-fix) — THIS PASS.**
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Realtime FIX-006** (DM creation UI) — decision-free but a frontend build; slot as its own A11b or a comms-UI pass.
- **Jobs Batch B** — handler-org-trust hardening (`createJobPosting` body-org, `searchJobPostings` org-scope default).
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`).
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls. `[CROSS-MODULE RISK]`.
- **3 pre-existing contract failures** (impersonation / governance position-crud / platformadmin committees authority drift) — addressed in those modules' RBAC-gated passes, NOT decision-free.

**Track B — decision-gated (the bottleneck):**
- B1. P0/P1 product decisions, incl. **realtime PD-1 (channel membership/auto-join model → FIX-002/003/004 + full FIX-007 model), PD-2 (DM org-scoping → FIX-006/008 read-filter), PD-3 (video V1 scope → FIX-011)**, plus platform-admin Q1–Q4, elections G2, documents Q1, marketplace G-06/G-13/vendor-identity, person Q-1/Q-4/Q-7. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after platform-admin Batch B, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB migrated (incl. realtime R-1 `0064`) + seeded. **This pass needs: `bun test` (FIX-007); the API + memberry dev servers for the FIX-009 live WS probe. No regen toolchain, no migration.**
- Known-good baselines (current): full `bun test` (api-ts) = **6181 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`; `getNextBookableTime` is a separate booking clock-boundary-flaky test, also out of scope). Monorepo `tsc` = **0 errors (5/5)**. Admin app = **61 pass / 0 fail**. Full Hurl suite = **152/155 files** (3 pre-existing fails: `impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow`). Realtime comms suite is green from Batch A + R-1 (comms backend, comms FE, `ws-frame-contract` 7/7). **This pass MAY add a few comms unit tests (FIX-007); FIX-009 adds at most one `vite.config.ts` line.**
- `check:sdk-compat` exits 1 **by design** (frozen baseline). Neither FIX-007 nor FIX-009 adds an operationId — no SDK change. Do NOT `--update` until milestone Step 6.

## Tree / commit rules

- NOTHING committed; working tree dirty (~300+ files across all prior AHA passes incl. platform-admin Batch B, realtime Batch A + R-1). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits ONLY: the comms membership-authz files (`ws.chat-room.ts`, `getChatRoom.ts`, `getChatMessages.ts`) + their tests for FIX-007; at most `apps/memberry/vite.config.ts` for FIX-009; and the fix report. No `core/ws.ts`, no `org-context.ts`, no TypeSpec, no schema, no migration, no SDK. Prior-pass dirty files are NOT yours — leave them. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY the Realtime Comms Batch B decision-free subset (FIX-007 OR-shim, FIX-009 verify-then-fix). Do NOT start PD-1/PD-2/PD-3-gated fixes, FIX-006 DM UI, FIX-008 read-filter, Batch C, Batch E shared files, or any other module. Save the fix report and stop.

execute systematically
