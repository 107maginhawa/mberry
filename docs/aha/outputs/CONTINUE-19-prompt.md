# Continuation prompt — AHA Step 19 (next `04`: Platform Admin — **Batch B** decision-free P1s + cheap aligns)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-19-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). Mixed change surface: **backend handlers** (FIX-003 invite-claim, FIX-006 ticket sort, FIX-012 ticket reopen/notify), one **admin-app frontend** gate (FIX-007 impersonate UI), and **doc-only** regen (FIX-018 NAVIGATION_MAP). FIX-003 is the heaviest — it adds an `admin.invited` domain-event consumer (cross-module email) and **may** need a small `platform_admin` claim-token/email column migration and/or a claim endpoint; determine the exact shape from gap-plan G4 + the existing `invite` module before touching TypeSpec/schema. Proven by **Bun unit tests + an admin-app component test + the Hurl contract suite**. Follow the fix-ready plan as the primary guide. Do NOT expand scope; do NOT touch the Q1–Q4-gated items (FIX-008 RBAC, FIX-009 flag enforcement, FIX-010 impersonation slice, FIX-011 TypeSpec migration, FIX-013 UI); do NOT touch FIX-004 MFA (shared Better-Auth, Batch E) or FIX-005 (needs Q1); do NOT continue to another module/batch after this one. Stop after saving the fix report.
>
> **ENV NOTE (verified working through marketplace Batch D, 2026-06-12):** Docker is up (postgres/minio/mailpit/stripe-mock). The live Hurl contract suite **does** boot. To run it: `cd services/api-ts && SERVER_PORT=7299 bun src/index.ts` (throwaway seeded API), then from repo root `API_URL=http://localhost:7299 bun run test:contract`, or a single file via `hurl --variable api=http://localhost:7299 --variable origin=http://localhost:3004 --variable suffix=x$(date +%s) --variable org_id=ed8e3a96-8126-4341-be42-e6eb7940c562 --variable admin_email=admin@contract-tests.local --variable admin_password='AdminContractTest!1' --variable seed_officer_email=test@memberry.ph --variable seed_officer_password='TestPass123!' --test specs/api/tests/contract/platformadmin-extended-flow.hurl`. Officer seed: `test@memberry.ph` / `TestPass123!`. Kill the throwaway server when done (`lsof -ti tcp:7299 | xargs kill`). `hurl` 8.0.1 installed. **curl/wget are blocked by a hook — use `hurl` or `bun` fetch, NOT curl, to poll readiness; or check `lsof -ti tcp:7299` + the boot log.** The **admin app** runs on **port 3003** (`cd apps/admin && bun dev`) — needed only if FIX-007 wants a live browse beyond the component test.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Platform Admin (+ admin app), Batch B (decision-free P1s + cheap aligns)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (platform-admin)
03-organize-gap-plan-for-fixing.md     # DONE (platform-admin)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS = platform-admin Batch B)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066) — re-flag if FIX-003 adds a column
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Marketplace/Ads/Reviews — Batches A/B/C/D — ALL COMPLETE (through 2026-06-12).** Batch D (FIX-011 reviews org-scope, FIX-012 x-audit on 4 ops, + the reviewCreative `{approved}` contract-mismatch fix) closed the module's decision-free work. Remaining marketplace items (G-06 authority, G-13 review person-deletion, FIX-007 vendor-ownership) are all product-decision-gated (Track B). See `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md` § "Batch D".
- **`04` Platform Admin — Batch D (test hardening / honest baseline) — COMPLETE.** FIX-001 (rewrote the fake-green `ac-m03` AC suite to assert real production code), FIX-002 (backfilled 9 genuinely-untested handlers), FIX-017 contract-tightening portion (route-walk guard test + tightened the 2 tolerant platformadmin Hurl flows). Decision = PARTIALLY COMPLETE by design (test-hardening only). The honest RED/GREEN baseline now exists, which is the precondition for THIS pass. See `platform-admin-fix-report.md` §1–§15.
- **`04` Jobs — Batch A (`/postings` dropped-prefix P0) — COMPLETE + runtime-confirmed.** The G-01 twin defect is closed (all 7 jobs ops now under `/association/jobs/*`). Only jobs **Batch B** (handler-org-trust hardening: `createJobPosting` body-org, `searchJobPostings` org-scope) remains as a separate later pass.

## This pass — execute `04` for Platform Admin, Batch B (decision-free subset)

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/platform-admin-fix-ready-plan.md` (§4 Batch B row; §3 FIX-003/006/007/012/018 rows; §5 test-first plan; §6 files; §7 shared deps; §8 Q1–Q4 decisions; §13 batch-D out-of-scope note).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/platform-admin-gap-plan.md` (G4 invite, G17 sort, G12 ticket reopen/notify, §5 impersonate UI row, G16 nav-map).
   - Prior fix report (what's done — **APPEND** a "Batch B" section, do NOT rewrite the Batch-D section): `docs/aha/module-fix-plans/platform-admin-fix-report.md`.
   - Module slug = `platform-admin`. Readable name = "Platform Admin (+ admin app)".
3. Invoke `superpowers:test-driven-development` (RED-first). The Batch-D pass already made the AC suite + the 9 backfilled handlers assert real code, so these fixes flip honest RED→GREEN.
4. **Selected subset — Batch B decision-free (5 fixes):**
   - **FIX-003 — G4 admin invite dead end (P1, V1 REQUIRED).** `inviteAdmin` inserts `userId: crypto.randomUUID()` (a placeholder) and emits `admin.invited` with **no subscriber** → no email, no claim, the invitee can never pass `platformAdminAuthMiddleware.findByUserId`. Fix: add the `admin.invited` consumer in `core/domain-event-consumers.ts` (per CLAUDE.md P1.6) that sends the invite email, and a **claim flow** that binds the invitee's real Better-Auth `userId` on accept so they can reach `/admin`. **Determine from gap-plan G4 + the existing `invite` module** whether to (a) reuse the generic invite/claim infra or (b) add a `claimAdminInvite` TypeSpec op + a `platform_admin` claim-token/email column. **If a new op → TypeSpec-first → regen (see §8). If a new column → `db:generate`, isolate the migration, flag it to the `06` schema audit.** RED: `inviteAdmin.claim.test.ts` — invited admin binds a real userId on claim and can then access `/admin`; `admin.invited` triggers the email consumer (extend `inviteAdmin.test.ts` for the emit assertion).
   - **FIX-006 — G17 listTickets sort (P3→active, V1 RECOMMENDED).** `handlers/platformadmin/listTickets.ts:61` orders by `createdAt` only. Fix: priority-desc then createdAt-asc (PA-8 inbox correctness). One-liner. RED: extend `listTickets.test.ts` (created in FIX-002) to assert the order.
   - **FIX-007 — impersonate UI gate (P3→active, V1 RECOMMENDED).** `apps/admin/src/routes/impersonate/index.tsx:15` gates `['super']` but PRD + backend (`IMPERSONATION_ALLOWED_ROLES=['super','support']`, `startImpersonation.ts`) allow super+support. Fix: align the UI gate to super+support. RED: an admin-app component test under `apps/admin/src/test/routes/` — the impersonate page renders for a `support`-role user. (Optional live browse on `apps/admin` :3003 only if the component test is insufficient.)
   - **FIX-012 — G12 ticket reopen + reply notify (P2, V1 RECOMMENDED).** `addTicketComment.ts` is insert-only; `updateTicketStatus.ts` does not notify. Fix per M3-R12: an officer reply reopens a resolved ticket + emits notifications (in-app + email, via the established notifs/email pattern). RED: extend `addTicketComment.test.ts` + `updateTicketStatus.test.ts` (from FIX-002) — reopen transition + notify emit. Its FIX-002 baseline already exists.
   - **FIX-018 — G16 NAVIGATION_MAP regen (P3→active, doc-only).** `docs/product/modules/m03-platform-admin/NAVIGATION_MAP.md` frontmatter is stale (7 routes vs 15 real route groups, header `INFERRED — needs human review`). Fix: regenerate from the 15 real route groups. No test.
5. **Do NOT implement in this pass (out of subset / gated / later):**
   - FIX-001, FIX-002, FIX-017 (Batch D) — already DONE. Do not redo.
   - **FIX-004** MFA enforcement (G5) — decision-free in spec but **HELD**: the gate couples to Better-Auth `twoFactor` wiring (shared `core/auth.ts`, Batch E) — coordinate with the auth-rbac audit; do NOT wire it here.
   - **FIX-005** (G13 role-name spec-sync) — `[NEEDS PRODUCT DECISION]` Q1 (role taxonomy). Do NOT sync the doc until Q1 lands.
   - **FIX-008** (G1 RBAC tiers) — Q1. **FIX-009** (G2 flag enforcement) — Q2. **FIX-010** (G3 impersonation identity-swap) — Q3. **FIX-011** (G7 TypeSpec migration of hand-wired ticket/breach/pricing/subscription routes) — Q4. **FIX-013** (G6 admin UI screens) — Q4 + FIX-011. All `[NEEDS PRODUCT DECISION]`/`[NEEDS CONFIRMATION]` — do NOT touch.
   - Everything in fix-ready §11 Do-Not-Build (LaunchDarkly-style flag targeting, SLA analytics bar, configurable SLA matrices, impersonation extensions, committee/national relocation, mobile admin layouts, a third RBAC mechanism) and §10 deferred (member account merge — Q7, env-var FF replacement).
   - **Do NOT expect or attribute the 2 pre-existing platform-admin Hurl failures** (`impersonation-flow.hurl`, `platformadmin-extended-flow.hurl`) to this pass — they fail on **RBAC/impersonation (Q1/Q3-gated)** behavior (`/admin/committees` 200-vs-403 authority drift; impersonation 401/403), which is explicitly OUT of this decision-free subset. They will still fail after this pass; that is expected.
6. TDD / test discipline: write/flip the failing test FIRST per fix (watch it fail for the right reason). Implement the smallest correct change. FIX-006/FIX-007/FIX-012 are pure handler/UI logic — no regen. FIX-003 **only** regenerates if it adds a TypeSpec op (and/or a migration). FIX-018 is doc-only. Do NOT weaken assertions; do NOT promote any gated/deferred item.
7. **Pre-flight reads BEFORE touching code (do not skip):** `handlers/platformadmin/` inventory; `inviteAdmin.ts` (verify `crypto.randomUUID()` placeholder + `admin.invited` emit) and `core/domain-events.registry.ts:471` (registry entry, no consumer) + `core/domain-event-consumers.ts` (where the new subscriber goes — match an existing `domainEvents.on(...)` block); the existing `invite` module + `handlers/email/` invite-email pattern (to decide reuse-vs-new for FIX-003); `listTickets.ts:61` (the ORDER BY); `addTicketComment.ts` + `updateTicketStatus.ts` (insert-only / no-notify) + the notifs/email emit pattern (`NotificationRepository.createNotificationForModule`, CLAUDE.md); `apps/admin/src/routes/impersonate/index.tsx:15` + `startImpersonation.ts` (`IMPERSONATION_ALLOWED_ROLES`) for the role allow-list; an existing `apps/admin/src/test/routes/` component test for the FIX-007 test shape; `platform-admin.schema.ts` (does a claim column already exist?); and the FIX-002-created `listTickets.test.ts` / `addTicketComment.test.ts` / `updateTicketStatus.test.ts` baselines you will extend.
8. **Regen workflow (FIX-003 only, and only IF it adds TypeSpec/schema):** after editing a `.tsp`: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`, then `cd packages/sdk-ts && bun run generate`. After editing a `*.schema.ts`: `cd services/api-ts && bun run db:generate` (review SQL in `src/generated/migrations/`; migrations run on server start). NEVER edit generated files. Restart the API after new route middleware. FIX-006/007/012/018 need no regen.
9. Validate: focused Bun unit tests per fix → admin-app component test for FIX-007 (`cd apps/admin && bun test …` or the workspace's vitest runner) → full api-ts `bun test` (record vs the **6167 pass / 1 fail / 4 todo** baseline; the 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs`, and `getNextBookableTime` is a separate booking clock-boundary-flaky test — do NOT attribute either to this batch) → monorepo typecheck (`bun run --filter '*' typecheck`, expect 5/5) → the platformadmin + admin Hurl flows against a booted+seeded API (boot per ENV NOTE). The full Hurl suite has **3 known pre-existing failures** — `impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow` — **2 of which are platform-admin (RBAC/Q-gated)**; do NOT attribute them to this batch and do NOT expect this pass to flip them green. If FIX-012 emits notifications, prove the emit at unit level (and optionally a live admin-flow assertion). Save the fix report (APPEND a "Batch B — decision-free P1s + cheap aligns" section; do not rewrite the Batch-D section). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1–A9 + A8/A8b/A8c (Membership, Elections, Auth/RBAC, Billing, Communications, Documents, Notifications, Person, Marketplace A/B/C/D) — ✅ DONE.
- Jobs Batch A (`/postings` prefix P0) — ✅ DONE.
- **A10 Platform-admin Batch B (FIX-003 invite-claim, FIX-006 sort, FIX-007 impersonate UI, FIX-012 ticket reopen/notify, FIX-018 nav-map) — THIS PASS.**
- A11 Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Jobs Batch B** — handler-org-trust hardening (`createJobPosting` body-org, `searchJobPostings` org-scope default). Independent `04` pass.
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`).
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls. `[CROSS-MODULE RISK]`.
- **3 pre-existing non-marketplace contract failures** (impersonation / governance position-crud / platformadmin committees authority drift) — addressed in those modules' RBAC-gated passes, NOT decision-free.

**Track B — decision-gated (the bottleneck):**
- B1. P0/P1 product decisions, incl. **platform-admin Q1 (role taxonomy → FIX-008/005), Q2 (flag enforcement → FIX-009), Q3 (impersonation scope → FIX-010), Q4 (V1 UI scope → FIX-011/013)**, plus elections G2, documents Q1, realtime PD-1, marketplace G-06/G-13/vendor-identity, person Q-1/Q-4/Q-7. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after marketplace Batch D, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **This pass needs the API + admin app (port 3003 for FIX-007) + regen toolchain (only if FIX-003 adds TypeSpec/schema).**
- Known-good baselines (AFTER marketplace Batch D): full `bun test` (api-ts) = **6167 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`; `getNextBookableTime` is a separate booking clock-boundary-flaky test, also out of scope). Monorepo `tsc` = **0 errors (5/5)**. Full Hurl suite = **152/155 files** (3 pre-existing fails: `impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow`). **This pass MAY change the api-ts unit count** (new platformadmin + admin-component tests) and, IF FIX-003 adds an op/column, `routes.ts`/migrations.
- `check:sdk-compat` exits 1 **by design** (frozen baseline). If FIX-003 adds a `claimAdminInvite` op it WILL add an operationId — that is acceptable, but **do NOT `--update` until milestone Step 6**.

## Tree / commit rules

- NOTHING committed; working tree dirty (~300+ files across all prior AHA passes incl. marketplace A/B/C/D, platform-admin Batch D, jobs Batch A). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits the platformadmin handlers + tests, `core/domain-event-consumers.ts` (FIX-003 subscriber), the admin impersonate route + its component test (FIX-007), the 2 nav/doc files, and the fix report; PLUS — only if FIX-003 needs them — a `.tsp` + its regen output and/or a `*.schema.ts` + one migration. No unrelated file deletes. Do not commit unless asked. NOTE: prior-pass dirty files (`core/domain-events.registry.ts`, `member/membership/utils/status-transitions.ts`, marketplace/advertising/reviews edits) are NOT yours — leave them.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Platform Admin Batch B decision-free subset (FIX-003, FIX-006, FIX-007, FIX-012, FIX-018). Do NOT start the Q1–Q4-gated fixes, FIX-004/FIX-005, jobs Batch B, or any other module. Save the fix report and stop.

execute systematically
