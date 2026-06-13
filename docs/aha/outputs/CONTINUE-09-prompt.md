# Continuation prompt — AHA Step 09 (next `04`: auth-rbac Batch E + Batch B cleanup)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-09-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). It modifies source + tests. Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch other modules, do NOT run another batch after this one. Stop after saving the fix report.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **auth-rbac, Batch E (FIX-010) + Batch B cleanup (decision-free subset)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (15 *-gap-plan.md)
03-organize-gap-plan-for-fixing.md     # DONE (15 *-fix-ready-plan.md)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Elections-Governance Batch B (2026-06-12)** — COMPLETE. FIX-003 (ballot secrecy: `listBallots` anonymised + org-scoped, NEW member-scoped `myBallots` op for the own-ballot self-check) + FIX-005 (`updateElection` immutability guard: published/cancelled → 422 `ELECTION_IMMUTABLE`; positions frozen once non-draft → 422 `ELECTION_POSITIONS_LOCKED`) landed RED→GREEN. FIX-002 (P0) + FIX-004 left **Blocked** on product decisions. See `docs/aha/module-fix-plans/elections-governance-fix-report.md` § "Batch B". A NEW `myBallots` TypeSpec op was added → OpenAPI/routes/validators + SDK regenerated (idempotent, additive).
- **auth-rbac prior passes (2026-06-11)** — Batch D (FIX-005/007 tests) + Batch A (FIX-001/002/003 enforcement) + Batch G (FIX-004 matrix rewrite) **COMPLETE**, plus a **Batch C Addendum** that landed the decision-free subset **FIX-006** (bulkImportMembers title+2FA gate) and **FIX-009** (public-path exact/boundary match). See `docs/aha/module-fix-plans/auth-rbac-fix-report.md`. **FIX-008** (analyst tier-aware bypass) was left **Blocked** (product decision). **FIX-010** (Batch E) and the **Batch B cleanup** are the remaining decision-free work — THIS PASS.

## This pass — execute `04` for auth-rbac, Batch E + Batch B cleanup

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/auth-rbac-fix-ready-plan.md`
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/auth-rbac-gap-plan.md`
   - Prior fix report (what's already done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/auth-rbac-fix-report.md` (Batch D+A+G + Batch C Addendum complete).
3. Invoke `superpowers:test-driven-development` (RED-first per fix).
4. **Selected subset — decision-free only:**
   - **FIX-010 / Batch E** — `INVITE_TOKEN_SECRET` fail-fast. `handlers/invite/createInvite.ts:40` falls back to `'dev-secret-change-in-production'`; a misconfigured prod = forgeable invite tokens. Fix: add production validation in `services/api-ts/src/core/config.ts` so the server **refuses to boot** when `NODE_ENV==='production'` and `INVITE_TOKEN_SECRET` is unset or equals the dev default. **Mirror the EXISTING prod fail-fast pattern already in `core/config.ts`** (`if (env.NODE_ENV === 'production') { ... throw new Error('Required in production') }` block ≈ lines 207–279; `INTERNAL_SERVICE_TOKEN` ≈ line 191 is the closest analog — do NOT invent a new validation style). RED-first test in `core/config.test.ts`: prod + default/unset → throws; prod + real secret → ok; non-prod → ok (dev fallback retained). Then have `createInvite.ts` consume the validated secret. **Decision-free.** `[SHARED DEPENDENCY: core/config.ts]` — keep the change minimal; config validation runs at boot for all consumers.
   - **Batch B cleanup** — delete dead code the matrix (FIX-004) no longer documents as live:
     - dead `officerAuthMiddleware` (`services/api-ts/src/middleware/officer-auth.ts`) + its ~155-line test (zero mounts — verify `grep -rn officerAuthMiddleware` shows no `app.use`/route mount before deleting);
     - dead `requireOrgRole` / `hasMinimumRole` exports in `services/api-ts/src/utils/org-auth.ts` (zero callers — **confirm with grep first**, and also check `requireActiveStatus` / `requireTenantAccess` callers per fix-ready §10 before touching those).
     - This is delete-only cleanup: removing the dead-middleware test is expected (it covered dead code now deleted, replaced by the live `requireOfficer`/`requirePosition` + inline checks which keep their own tests). The full-suite test count will drop by exactly those obsolete tests — that is NOT a regression; note it explicitly in the report. **Decision-free**, unblocked now that FIX-004 landed.
5. **Do NOT** implement in this pass (gated / out of subset):
   - **FIX-008** (analyst tier-aware org-context bypass) — `[NEEDS PRODUCT DECISION]` (analyst data-access scope). **Excluded.**
   - **G3** (provision session roles `association:admin/staff/platform_admin/national_officer` onto `user.role` **vs** strip `x-security-required-roles` from accredited-providers + national-dashboard ops) — `[NEEDS PRODUCT DECISION]`; needs a TypeSpec + regen pass. **Excluded.**
   - Impersonation role alignment (super vs support), 403 security-event audit stream — `[NEEDS PRODUCT DECISION]`. **Excluded.**
   - Matrix §5 hierarchy / `hasMinimumRole` wiring, generic policy engine, `client`/`host`/`:owner` expansion — **DO NOT BUILD** (§11). (Cleanup DELETES `hasMinimumRole`; it does NOT wire it.)
6. TDD: write the failing test FIRST for FIX-010 (watch it fail for the right reason — prod boot does not yet throw on the default secret), implement the smallest correct fix, re-run. For Batch B cleanup, drive by grep-proving zero callers, delete, then prove build+typecheck+suite stay green. Do not weaken assertions or fake-green.
7. Validate: focused tests → `core/config.test.ts` → affected dirs (`invite`, `core`, `middleware`, `utils`) → full `bun test` (api-ts) → `bun run --filter '*' typecheck`. Save the fix report (APPEND a "Batch E + Batch B cleanup" section to `auth-rbac-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes (run one per session, in roadmap §8 order):**
- A1. Membership Batch C — ✅ DONE.
- A2. Elections Batch B (FIX-003 + FIX-005) — ✅ DONE (2026-06-12).
- **A3. Auth/RBAC Batch E (FIX-010 INVITE_TOKEN_SECRET) + Batch B cleanup — THIS PASS.**
- A4. Billing Batch B remainder (FIX-007 updateInvoice txn, FIX-008 void path).
- A5. Communications Batch B (FIX-006 RBAC, FIX-007 tenant, FIX-008 stats + confirm DEC-COMMS-05 scoping).
- A6. Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer).
- A7. Notifications Batch C subset (FIX-007 suppression DELETE, FIX-010 queue-lifecycle hurl, FIX-012 orgId guard).
- A8. Person Batch C decision-free subset (FIX-007…014; exclude Q-1/Q-4).
- A9. Marketplace Batch B (FIX-003/004/005/006/007; exclude reviewCreative/verifyVendor re-gate → G-06).
- A10. Platform-admin Batch B decision-free subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11. Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12. Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13. Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Track B — decision-gated (the bottleneck):**
- B1. **Resolve the 3 P0 product decisions:** elections **G2 position-identity** → documents **Q1 card-verify token** → realtime **PD-1 channel-membership model**. Then headline P1s (training TC-DEC-01/02, person Q-4+Q-1, documents Q8, notifs Q3) **plus the auth-rbac gated set: FIX-008 analyst bypass + G3 session-role model + impersonation/403-logging**. Full ranked agenda in roadmap §13.
- B2. Per-module gated `04` passes once unblocked (jobs needs jobs-D1 eng-confirm; surveys needs PD-1/2/3).

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Elections Batch B, 2026-06-12)

- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **FIX-010 is config-only; Batch B cleanup is delete-only — neither needs a migration or generator regen** (auth-rbac fixes touch `core/config.ts` + dead-code deletion). Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase`.
- Known-good baselines (current, AFTER Elections Batch B): full `bun test` (api-ts) = **6078 pass / 1 fail / 4 todo** (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, 30000 vs 1000). Full monorepo `tsc` (`bun run --filter '*' typecheck`) = **0 errors**. After this pass, expect: +N for the new `config.test.ts` case(s), **minus** the deleted dead `officerAuthMiddleware` test (~the 155-line file) — net change explained by the cleanup, NOT a regression. `check:sdk-compat` exits 1 **by design** — frozen baseline `docs/quality/SDK_BASELINE_OPS.json` must **NOT** be `--update`d until milestone Step 6.
- `core/config.ts` ALREADY has the production fail-fast convention to copy (production block at ≈207–279 with `throw new Error('Invalid environment configuration: …')` and per-field `Required in production`; `INTERNAL_SERVICE_TOKEN` random-UUID-dev-fallback at ≈191 is the closest pattern to `INVITE_TOKEN_SECRET`). Confirm exact line numbers at runtime — they drift.
- A test-only `makeMockDb` helper in `services/api-ts/src/test-utils/make-ctx.ts` exposes an additive `insert(...).values()` capture + `_inserted` array — reuse if a handler write needs asserting (unlikely for config-only FIX-010).

## Tree / commit rules

- NOTHING committed; working tree dirty (~241 files across all prior AHA passes + Elections Batch B, incl. the regenerated `governance.tsp` + generated OpenAPI/SDK from the new `myBallots` op). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. Deleting the specific dead files in Batch B cleanup is in-scope (use targeted `git rm`/file delete on `middleware/officer-auth.ts` + its test only — never a broad clean). Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY auth-rbac Batch E (FIX-010) + Batch B cleanup (decision-free subset). Do NOT continue to another batch or module. Save the fix report and stop.

execute systematically
