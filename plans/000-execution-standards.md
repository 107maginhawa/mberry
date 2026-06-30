# 000 — Execution Standards (membership-management build)

Per-slice protocol + scope locks for the `apps/org` membership-management build.
Every slice plan (`plans/011-…` onward) references this file instead of repeating it.
Authoritative sources: [`/CLAUDE.md`](../CLAUDE.md) "Execution Standards", [`/VERTICAL_TDD.md`](../VERTICAL_TDD.md),
[`/DESIGN.md`](../DESIGN.md), [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md) (locked design).

Process governed by **superpowers**: design/brainstorming is DONE (the design doc) — do not
re-brainstorm. Execution uses **test-driven-development**, **subagent-driven-development**,
**verification-before-completion**, **requesting-code-review**, **systematic-debugging** for any bug.

---

## Per-slice protocol

For each slice, in order:

**a. Plan.** `/persona-audit` the slice, then write `plans/0NN-membership-<slice>.md` (next number)
linking back to the design doc — task breakdown only, no redesign.

**b. Implement — classify the slice:**

- **Frontend-only** (over an already-frozen endpoint — nav shell, directory list, certificate
  over existing API, events polish):
  `/frontend-design` (on `packages/ui` + DESIGN.md) → frontend component tests + an **E2E test
  exercising the real user flow** (not selectors) → `/module-review` → **requesting-code-review**
  (or `/review` / codex) → `/pre-commit` → `/commit`.

- **Net-new or unverified endpoint** (money or member data moves — add-single-member,
  record-payment void/edit, renew, record-check-in, mark-paid): run the **full chain,
  vertical-slice, never horizontal layers** (spec → RED test → handler GREEN → UI):
  `/br-extract` (rules → br-registry) → `/typespec` (`specs/api/src`) →
  `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` →
  **write a FAILING real-PG integration test first via the `createScratch` harness (RED —
  mandatory, money/member data moves)** → `/handler` (GREEN) →
  `/db-migrate` IF schema changes (edit `*.schema.ts` → `bun run db:generate` → review SQL;
  keep `DELETE`+`WHERE` on one line; reference `docs/security/MIGRATION_SAFETY_CHECKLIST.md` in
  the PR) → `/test-api` → regen SDK (`bun run --filter @monobase/sdk-ts generate`, or CI
  git-diff gate fails) → `/contract-scaffold` → `/test-contract` (Hurl) → `/frontend-design` →
  E2E real-flow test → `/module-review` → **requesting-code-review** → `/pre-commit` → `/commit`.

**c. Polish.** Run `/impeccable` on each new screen once it renders in the browser; fold fixes back.

**d. Verify (verification-before-completion).** Actually run `apps/org` (`bun dev`) and exercise
the flow per the design doc's Verification section; run the gates (contract suite,
migration-safety, br-coverage, coverage-matrix, lint:no-skips/shallow). **Green gates = done.
Never claim done without running evidence.**

**e. Commit + CHECKPOINT.** Commit the slice (conventional message + `Co-Authored-By: Claude Opus
4.8 (1M context) <noreply@anthropic.com>`). Post a green/red summary (shipped, test/typecheck/gate
status, screenshots) and **STOP for go/no-go before the next slice.**

---

## Scope locks (hard)

- **Engine `services/api-ts` is FROZEN — ADDITIVE ONLY.** Never break existing handlers/schemas.
  **Never delete handler files to fix type errors** — fix types to match
  `@/generated/openapi/validators`. Net-new code goes behind existing seams; cross-module side
  effects travel the **domain event bus** (`core/domain-events.ts`), not inline orchestrators.
  **Never edit generated files.**
- **Spec-first / API-first** for every net-new endpoint (TypeSpec = single source of truth).
  Frontends import types from `@monobase/api-spec`.
- **Drift guard:** anchor mocks to real **HANDLER** shapes, not generated SDK types; add typecheck
  test files. (Generated SDK types drift from frozen handlers — green mocks have broken prod.)
- **Real-PG (`createScratch`) integration tests wherever money or member data moves** — not just
  unit mocks.
- **DESIGN.md is law:** 18px base, ≥48px tap targets, labeled icons (no icon-only), status =
  text+color via `StatusBadge`, single-column mobile-first, PHP via `centavosToPhp`, confirmation
  step at every money action. No per-app component forks. No new abstractions / smallest diff.
- **Verify before relying** (flagged in the design doc): `create-single-member` handler,
  `record-manual-payment` void/edit, `renewMembership` handler, `record-check-in` endpoint name.
  If missing, surface at the checkpoint — **never invent or silently stub a money path.**
- **Gotchas:** restart the API after adding route registrations (no hot-reload for routes); no
  `/api` prefix in route registration (Vite proxy strips it); `sonner` for toasts; auth route is
  `/auth/sign-in`.

## Stop and ask before

deleting any file, adding any dependency, any DB schema/migration change, any money-path engine
change, or anything outside the current slice. Also stop at every inter-slice checkpoint (e).
