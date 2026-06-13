# Continuation prompt — AHA Step 48 (AUTONOMOUS drain of the 3 remaining P1 product-decision gates: platform-admin → notifications → realtime)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-48-prompt.md`.

> **The decision-free AHA track is drained and Step 47 closed the training gates (TC-DEC-01 proof-of-payment + TC-DEC-02 verification gate). Three P1 product-decision gates remain — platform-admin, notifications, realtime. Drain them AUTONOMOUSLY, one full module-vertical at a time, applying the engineering-recommended default for every decision. NO approval gates, NO AskUserQuestion — the user has pre-authorized recommended defaults for all of them (per `feedback_defer_decisions`).**
>
> Build only the unblocked, module-local slice per each module's fix-ready plan, TDD (RED→GREEN). When a chosen option crosses into another module, capture the decision, build only the local part, and mark the cross-module slice `[CROSS-MODULE RISK]` → its own later `04`. Do NOT half-build. Real tests only — no fake-green `_body` hand-builds (FIX-006 lesson). After each module: validate, append its `*-fix-report.md`, update its `*-fix-ready-plan.md` (gates → decided) + roadmap. Then proceed to the next module WITHOUT stopping. Run `docs/aha/prompts/07-consolidate-roadmap.md` once all three land.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun script. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–47) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Ground rules (read once, apply throughout)

1. `docs/aha/prompts/00-aha-shared-rules.md` + `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — this IS a build pass, follow it for every module).
2. **Pre-flight reads BEFORE any edit** (per `feedback_subagent_preflight`): vite proxy + toast (`sonner`) + auth + route patterns, plus the exact files each module's fix-ready plan §6 names.
3. **Decision policy:** for every `[NEEDS PRODUCT DECISION]` / `[NEEDS CONFIRMATION]`, apply the **"Recommended Action"** from that module's fix-ready plan §8 (or the bake-ins below) WITHOUT asking. Capture each applied decision verbatim in the fix-report.
4. **Migrations are hand-written** in this repo (snapshots stop at 0060; later migrations are hand-authored + journal-edited). Do NOT run `db:generate`. Latest applied = `0071`. Next = `0072`. Mirror existing migration format (`--> statement-breakpoint`), add the `meta/_journal.json` entry, and verify against local pg `monobase` (psql, trust auth, no password) — the files must be idempotent (`IF NOT EXISTS` / `DROP … IF EXISTS`).
5. Regenerate ONLY if TypeSpec changed: `cd specs/api && bun run build` → `cd ../../services/api-ts && bun run generate`. Never hand-edit `services/api-ts/src/generated/**` except the migration `.sql` + `_journal.json`.
6. **E2E is `[BLOCKED BY ENVIRONMENT]`** (`:3004` redirects to `/auth/sign-in`, no seeded auth) — prove via handler/repo/DB nets and mark it. Pin Playwright `1.58.2` if you add a spec (`project_playwright_pin`).
7. Validation per module: `cd services/api-ts && bun test <touched dirs>` green + no regressions; `bunx tsc --noEmit` clean across touched workspaces; contract suite only if TypeSpec changed (else `[BLOCKED BY ENVIRONMENT]`). The pre-existing `email/jobs/index.test.ts` failure (`.env` `EMAIL_PROCESSOR_INTERVAL_MS=1000` vs default 30000) is NOT yours — ignore it.

---

## Module 1 — platform-admin (gate: Q1 + Q8 → FIX-005 + FIX-008)

Load `docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md` (§3 scope, §8 decisions). **Batch D honest baseline + Batch B already landed**, so FIX-008 is real TDD now.

**Decisions (apply, do not ask):**
- **Q1** → canonicalize the role taxonomy on the **code enum `super/support/analyst`** (`platform-admin.schema.ts adminRoleEnum`); FIX-005 = sync the `MODULE_SPEC §6` doc text (`docs/product/modules/m03-platform-admin/MODULE_SPEC.md`) to those names (pure doc edit).
- **Q8** → `analyst` = **read-only** (national/revenue analytics + all reads); NO mutations, NO impersonation.
- **Q2** → feature-flag enforcement = opt-in API middleware keyed by module name + frontend visibility → **FIX-009 is its own later `04`** `[CROSS-MODULE RISK]`; do NOT build it here.
- **Q3** → impersonation V1 = read-only data console acceptable (defer identity-swap) → **FIX-010 deferred** `[CROSS-MODULE RISK]`.
- **Q4/Q7** → defer support-inbox/pricing/subscription V1 UIs + member-merge to **V2** (3-person ops runs via API/seed) → FIX-011/013 not in this pass.

**Build this pass (module-local only): FIX-005 + FIX-008.**
- Create `core/auth/admin-tier.ts`: `AdminRole = 'super'|'support'|'analyst'`; `requireAdminTier(ctx, allowed: AdminRole[]): Response | null` (mirror `requirePosition`'s return-Response-or-null; reads `ctx.get('platformAdmin').role`, 403 if missing/not-allowed); export groups `SUPER_ONLY`, `SUPPORT_OR_SUPER`.
- Matrix → apply the guard at the top of each MUTATING handler:
  - **SUPER_ONLY:** createAssociation, updateAssociation, deleteAssociation, createOrganization, updateOrganization, transitionOrgStatus, setFeatureFlag, deleteFeatureFlag, inviteAdmin, updateAdmin, revokeAdmin, createPricingTier, updatePricingTier, cancelSubscription.
  - **SUPPORT_OR_SUPER:** createTicket, addTicketComment, updateTicketStatus, reportBreach, updateBreachStatus, startImpersonation, endImpersonation.
  - **analyst** = reads only → all `get*`/`list*`/`export*` stay membership-only (no tier guard).
- Replace the existing ad-hoc `callerAdmin.role !== 'super'` checks (setFeatureFlag, deleteFeatureFlag, create/delete/updateAssociation, create/updateOrganization, transitionOrgStatus, inviteAdmin, updateAdmin, revokeAdmin) with the helper for consistency.
- **CAUTION (verify first):** confirm each guarded handler is actually behind `platformAdminAuthMiddleware` (which sets `ctx.platformAdmin`) — grep `app.ts` `/admin/*` mounting + generated routes. If a mutating handler is NOT behind it, `requireAdminTier` would 403 it always → wire the middleware or set platformAdmin there first. Do a route-walk regression.
- **Tests (RED→GREEN):** a real RBAC suite driving the actual handlers — each tier allowed/denied on a representative SUPER_ONLY + SUPPORT_OR_SUPER + read handler; analyst denied on all mutations; support denied on SUPER_ONLY, allowed on tickets/impersonation. Extend the (now-honest) `ac-m03.platform-admin.test.ts` net, don't re-fake it.

Report → `platform-admin-fix-report.md`; mark Q1/Q5/Q8 decided + FIX-005/FIX-008 built; FIX-009/010/011 = deferred `[CROSS-MODULE RISK]`/V2. Update roadmap §13 platform-admin row. **Then proceed to Module 2 — do not stop.**

## Module 2 — notifications-email (gate: Q3 + Q1; also Q2)

Load `docs/aha/module-fix-plans/notifications-email-fix-ready-plan.md` (§8). Batch C subset already done.

**Decisions (apply):**
- **Q3 (pref store-of-record)** → the **DB person-subscriptions table is canonical**; OneSignal is a delivery mirror, not the source of truth. Reads/writes of preference go through the DB; sync to OneSignal on change.
- **Q1 (web-push descope)** → **descope web-push for V1**; channels = OneSignal mobile/app push + email + in-app. Remove/guard the web-push paths behind a disabled flag, don't delete the schema.
- **Q2 (provider/env)** → keep **OneSignal** (already integrated, app-agnostic per CLAUDE.md), env-driven app id.

Build the module-local slice the fix-ready plan marks unblocked by these (its FIX-003/004/005/006 — load §3 for the exact IDs), TDD. Anything that needs a running OneSignal/SMTP → `[BLOCKED BY ENVIRONMENT]`. Migration if the pref store needs a column → hand-write `0072+`. Report + roadmap. **Then Module 3 — do not stop.**

## Module 3 — realtime-comms (gate: PD-1 P0 + PD-2 + PD-3)

Load `docs/aha/module-fix-plans/realtime-comms-fix-ready-plan.md` (§8). OR-shim + `ws:true` already shipped.

**Decisions (apply):**
- **PD-1 (channel-membership model — P0; `/messages` empty until decided)** → **org-scoped membership**: members of an org auto-see that org's public channels; a `channel_member` table backs private/explicit channels. This unblocks the empty `/messages`.
- **PD-2 (DM org-scoping)** → DMs are **scoped within the same org** (no cross-org DM); enforce org match at send + list.
- **PD-3 (video V1)** → V1 = **1:1 + small-group** over the existing WS signaling, capacity-capped, **no recording**; richer video (recording, large rooms, TURN infra) = V2 `[CROSS-MODULE RISK]`/`[BLOCKED BY ENVIRONMENT]`.

Build PD-1 channel model + PD-2 DM org-scoping module-local TDD (these make `/messages` real). PD-3 video: build the V1-local signaling/state slice; mark anything needing media-server/TURN infra `[CROSS-MODULE RISK]`. Migration for `channel_member` → hand-write `0073+`, verify on local pg. Report + roadmap.

## Stop condition (after all three)

Run `docs/aha/prompts/07-consolidate-roadmap.md` to reconcile. The roadmap should then show the P1 product-decision track DRAINED — remaining items are explicit V2 deferrals + cross-module `04` carry-forwards (billing-stripe Stripe fee path, platform-admin FIX-009/010/011, realtime video V2, documents Q1, elections G2). Write a final summary of what built, what deferred + why, and any new migrations. Then STOP.

execute systematically — apply recommendations, do not ask, do not half-build, verify before claiming done.
