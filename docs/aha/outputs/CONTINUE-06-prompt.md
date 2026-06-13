# Continuation prompt — AHA membership-lifecycle Batch F + E2 (04 TDD pass)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-06-prompt.md`.

> This is a `04-module-or-group-fix-tdd.md` execution pass (NOT an audit). It executes the membership-lifecycle **Batch F migration + Batch E2 state-machine integrity** fixes, which are now **UNBLOCKED**: the six §8 product decisions that gated them were RESOLVED on 2026-06-12 and recorded in `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` (§"Product Decisions — RESOLVED"). Do NOT re-surface or re-decide them.

---

Continue the AHA remediation — execute the membership-lifecycle **Batch F + Batch E2** fixes using 04 TDD discipline. Finish ALL in-scope tasks below, then STOP.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry
MODULE = Membership Lifecycle · slug = `membership-lifecycle`

## Already done — do NOT redo
- Membership **Batch A** (FIX-001 nightly-recompute P0, FIX-002 status-truth) + **Batch B** (FIX-003 cross-org guards, FIX-004 application IDOR, FIX-013 partial) — COMPLETE. See `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md`.
- All prior AHA module 04 batches + cross-cutting F-1/F-2/F-4 + schema R-1/R-2 + env pass — DONE.
- **Cross-cutting F-3/F-5** (this just-completed pass) — DONE. See `docs/aha/module-fix-plans/cross-cutting-platform-fix-report.md`. Key result: generator path-param org-id invariant added (zero output change); NO optional→required flip (org presence = `orgContextMiddleware`); `check:sdk-compat` now additive-tolerant (block only on removed/changed; `--strict` for old behavior).
- The six §8 product decisions gating E2/F — **RESOLVED 2026-06-12** (see below; do not re-decide).

## Resolved decisions driving this pass (from fix-ready-plan §"Product Decisions — RESOLVED")
1. **Reinstate = lapsed-only.** REMOVED (resigned/terminated/deceased) is terminal + irreversible; SUSPENDED restored via dedicated **unsuspend** op (not reinstate); terminal re-entry goes through re-application (#5). → FIX-008/007/019.
2. **RESIGNED actor = officer-recorded only (V1).** No member self-resign route/UI. → FIX-007 (no self-resign route).
3. **EXPIRED = dropped from V1.** Remove from docs/labels/analytics; no threshold/job. → FIX-009/018/019.
4. **Expulsion = deferred to V2.** Leave `createDisciplinaryAction` unrouted; do NOT add `expelled_at`. → FIX-009 (no expel sibling).
5. **Re-application = reuse existing row.** Re-approval after terminal flips the existing `(organizationId, personId)` row through a proper transition + writes a status-history row. NO unique-index change. → FIX-010.
6. **delete\* = remove officer-facing op.** `deleteMembership`/`deleteMembershipApplication` removed from officer surface; officers use terminal states. Any hard delete stays platform-admin-only + soft/guarded. → FIX-011 becomes route/op removal.

## Task list — execute in order (04 TDD: RED test first, smallest correct root-cause change, regen-not-hand-edit, preserve tree). Use superpowers:test-driven-development.

1. **Batch F — `resigned_at` additive migration** (`[SHARED DEPENDENCY]`, do FIRST — E2 handlers depend on it).
   - Schema: add `resigned_at` (timestamp, nullable) to `membership` at `services/api-ts/src/handlers/association:member/repos/membership.schema.ts`. **Additive only**, no renames, no index change, do NOT add `expelled_at`. `computeMembershipStatus` signature stays additive (most-imported util in the mega-module — verify no signature break).
   - Migration: `cd services/api-ts && bun run db:generate`; review SQL in `src/generated/migrations/` (expect next seq after `0064`); backfill `resigned_at` from `removed_at` where `status = 'resigned'`. Migrations apply on server start.
   - RED→GREEN: FIX-001-style **real-schema data test** against live Postgres (`DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`) asserting the column exists, is nullable, and backfill populated existing resigned rows.

2. **Batch E2 — state-machine integrity** (after Batch F lands):
   - **FIX-007** — resign handler stores `resigned_at`; reinstate rejects terminal states. No new self-resign route (decision #2).
   - **FIX-008** — reinstate allowlist = **lapsed-only**. Align ALL FOUR artifacts: reinstate handler allowlist, `status-transitions.ts` (`status-transitions` matrix), `membership.tsp` (TypeSpec), `STATE_MACHINES.md` (FIX-019). TypeSpec edit → regen pipeline (`cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`).
   - **FIX-009** — add **suspend/unsuspend** op only. NO expired sibling (decision #3), NO expel sibling (decision #4). TypeSpec new op → regen.
   - **FIX-010** — reuse-row re-application (flip existing row through a proper transition + status-history write). NO unique-index change (decision #5).
   - **FIX-011** — remove officer `deleteMembership`/`deleteMembershipApplication` op from the officer surface (route/op removal; keep platform-admin-only hard delete soft/guarded if present). TypeSpec op removal → regen.
   - **FIX-019** — reconcile `STATE_MACHINES.md` to the decided semantics (reinstate=lapsed-only, no EXPIRED, no expulsion-V1, suspend/unsuspend present, terminal-irreversible).
   - Each fix: RED test first (handler/transition unit + cross-state 403/409 matrix where applicable), then smallest correct change, then GREEN.

3. **FIX-013 self-binding** (adjacent `[NEEDS PRODUCT DECISION]`, OPTIONAL — only if clean): `createMembershipApplication` does not bind `body.personId` to the session user. Conservative engineering-judgment default (user defers to judgment): **gate `personId !== user.id` behind an officer/position check** — preserves the legitimate officer-on-behalf flow, closes the self-apply IDOR. If it expands scope, defer and note it. Do NOT block self-apply outright.

## TypeSpec / generator discipline (this pass DOES touch TypeSpec)
- FIX-008/009/011 change operations → after editing `.tsp`, run the regen pipeline, then run the platform nets: **F-2** (`generated-route-integrity.test.ts`), `bun run check:sdk-compat` (now additive-tolerant — new `unsuspend`/`suspend` ops are ADDITIVE and won't block; a REMOVED `deleteMembership` op IS breaking and will exit 1 — that removal is intentional, so refresh the baseline only if instructed, or note the expected breaking entry; do NOT `--update` the baseline without confirmation since it is frozen until milestone Step 6).
- NEVER hand-edit `services/api-ts/src/generated/**` or `specs/api/dist/**` — regenerate.

## STOP / out of scope
- Do NOT add `expelled_at`, EXPIRED state, self-resign route, or a unique-index change (decisions #2/#3/#4/#5).
- Do NOT implement membership **Batch C** (FIX-005/006/012/014/015/016/017/018/020) or **Batch D-docs** beyond FIX-019 — separate later batches.
- Do NOT touch other modules (training, elections G2, person gender Q-4, documents Q8, marketplace, surveys, etc.) — they remain product-decision-gated.
- Never make a NEW product decision beyond the recorded six + the FIX-013 conservative default; never hand-edit generated files.

## Env state
- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through `0064` + seeded. Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`. Boot API for live checks: `cd services/api-ts && PORT=7213 bun src/index.ts > /tmp/memberry-api.log 2>&1 &` (an instance may already be running on :7213; **restart it after the migration + regen** — no hot-reload for new routes/migrations).
- Known-good baseline AFTER the F-3/F-5 session: full `bun test` (api-ts) = **6009 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, interval 30000 vs 1000). Full monorepo tsc (`bun run --filter '*' typecheck`) = **0 errors** (ui/admin/sdk-ts/api-ts/memberry). Hurl = **152–153/155** (pre-existing: impersonation 403→400, platformadmin committees 403→200; `member/governance/position-crud.hurl` flaky/intermittent). F-3 test 8 pass, F-5 test 7 pass. Generated artifacts byte-identical to pre-regen.

## Tree / commit rules
- NOTHING committed; working tree dirty (~190+ files across prior AHA passes + the F-3/F-5 session). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. Do not commit unless asked. (This pass WILL legitimately add: a new migration under `src/generated/migrations/`, schema edit, TypeSpec edits, regenerated `generated/**`, handler/test files — that is expected, not a tree violation.)

## Output
- **Update** `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md`: append a clearly-labeled, dated **"Batch F + E2 (2026-..)"** section (reuse the 04 §12 15-section structure for the new batch) recording per-fix RED→GREEN evidence, the migration SQL + real-schema backfill verification, regen confirmation + the four-artifact alignment for FIX-008, and regression deltas vs the baseline above (F-2 suite + full bun test + tsc + Hurl + check:sdk-compat). Note any item left conservative/deferred (FIX-013, expulsion-V2, the adjacent "applications without accounts" decision).
- Then STOP and recommend the next step (likely: a dedicated **product-decision pass** to clear the remaining ~106 gated decisions across the other modules — prioritize the P0/P1 ones: elections G2 position-identity P0, training paid-training/manual-entry, person gender-scrub Q-4, documents Q8/cert — then per-module 04 passes; then re-run `07-consolidate-roadmap.md`).

## Ground rules
- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§20 Fix/TDD rules, §23 stop conditions). Primary guide: `membership-lifecycle-fix-ready-plan.md` (esp. §"Product Decisions — RESOLVED", §"Recommended E2/F execution order"). Context: `membership-lifecycle-gap-plan.md` (raw), `membership-lifecycle-fix-report.md` (prior batches), `database-schema-audit.md` R-5 (resigned_at), `consolidated-remediation-roadmap.md` §11/§13.

execute systematically
