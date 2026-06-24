# CLAUDE.md

AI guidance for Claude Code working on **Memberry (lean launch)**.

> These instructions override default behavior. Follow them exactly.

## What Memberry is

A deliberately small healthcare **Association Management System** for PH dental
chapters. The wedge is **money** — dues + renewals collection over PH payment
rails (GCash / bank transfer via PayMongo) — sold to one beachhead chapter
(Dr. Olive). Everything else is deferred until a chapter is paying.

Strategy + scope are LOCKED. The design source of truth is **[DESIGN.md](./DESIGN.md)**
and the full plan lives in the office-hours design doc (see memory
`lean-launch-strategy`).

## Architecture: thin apps over a frozen, tested engine

```
services/api-ts/   ← THE ENGINE. Hono + Drizzle, ~8000 tests, contract-gated.
                     FROZEN: additive-only. Do NOT break existing handlers/schemas.
                     The PH-payment (PayMongo) adapter is net-new code behind the
                     billing seam — additive, no breaking changes.
specs/api/         ← TypeSpec → OpenAPI (single source of truth) → types + routes.
packages/
  sdk-ts/          ← generated typed client (regenerate after any TypeSpec change).
  ui/              ← shared design system. ALL apps build on this — no per-app forks.
  eslint-config, typescript-config, vitest-test-shim
apps/              ← (empty — the lean apps are built next, NOT yet present)
  org/             ← PLANNED. Officer app: roster import, dues, renewals, events+pay.
  member/          ← PLANNED. Thin member dashboard + login-free pay-link page.
  console/         ← PLANNED. Basic platform-operator app: list/create orgs + stats.
```

The previous full platform (`apps/memberry`, `apps/admin`, 26-module product
docs) was **deleted** in the lean cleanup — full reference preserved at
`/desktop/memberry-full`. Do not resurrect it. The "module diet" (deleting
unused API handler modules) is **deferred, test-guarded, NOT in scope** — the
handler graph is coupled (shared `association:member` repos, dual dues repo,
domain-event consumers).

## Current phase

Cleanup (T1–T4) is **done**. Next, in order (see the design doc's Execution Sequence):
1. **Paperwork clock (external, START NOW):** G1 business entity, G2 PayMongo
   platform account, G3 PH SMS sender. The 90-day critical path — not code.
2. **T8** design tokens/components in `packages/ui` (`/design-consultation` → DESIGN.md).
3. **T9** spec/BR/workflow each lean feature (re-point coverage gates at lean content).
4. **T7** PayMongo connected-accounts adapter (test mode) behind the billing seam.
5. Build **apps/org + the login-free pay-link page first** (first peso), then
   apps/member + apps/console.

Do NOT build all three apps before earning the first dollar.

## Execution Standards (non-negotiable — lean ≠ undisciplined)

Every feature is built the same way. This is the persistence mechanism — it
survives because it's written here.

1. **Process-first (superpowers):** invoke skills before acting. `brainstorming`
   before any new feature; `test-driven-development` before implementation code;
   `systematic-debugging` for any bug (root cause, no guess-patch);
   `verification-before-completion` — never claim done without running evidence;
   `requesting-code-review` before merge.
2. **Spec-first / API-first:** TypeSpec (`specs/api/src/`) → `cd specs/api &&
   bun run build` → `cd services/api-ts && bun run generate` → implement handler
   logic → **regenerate the SDK** (`bun run --filter @monobase/sdk-ts generate`,
   or CI's git-diff gate fails). Frontends import generated types from
   `@monobase/api-spec`. **Never edit generated files.**
3. **Vertical-slice TDD** ([VERTICAL_TDD.md](./VERTICAL_TDD.md)): per feature,
   vertical slice (spec → test RED → handler GREEN → UI), never horizontal layers.
   **Real-PG integration tests where money or member data moves** (`createScratch`
   harness). E2E tests exercise real user flows, not selectors.
4. **Domain-driven:** business rules extracted per feature (`/br-extract` →
   `br-registry`); cross-module side effects travel the **domain event bus**
   (`core/domain-events.ts`), not inline orchestrators; repos + Zod schemas per
   domain; handler-verb conventions (get/list/create/update/…); audit / officer /
   position via TypeSpec `@extension`, not hand-calls.
5. **Project skill chain (per feature):** `/persona-audit` → `/typespec` →
   `/handler` → `/db-migrate` → `/test-api` → `/contract-scaffold` →
   `/test-contract` → `/frontend-design` (UI on `packages/ui` + DESIGN.md) →
   `/module-review` → `/pre-commit` → `/commit` → `/ship`.
6. **Verification gates (CI, re-pointed at lean):** contract suite,
   `migration-safety`, re-pointed `br-coverage` + `coverage-matrix`,
   `lint:no-skips` / `lint:shallow`. Green gates are the definition of done.
7. **Design discipline:** [DESIGN.md](./DESIGN.md) is law — all UI on `packages/ui`
   tokens/components; accessibility baseline for older users (18px base / ≥48px
   tap targets / WCAG AA-AAA / labeled icons, no icon-only); one primary task per
   screen; touch-first, mobile-first. No per-app component forks.

## Lean money/scope rules (locked)

- Currency = **PHP** (existing schema is USD/Stripe-shaped — a real delta to spike).
- Dues flow through **each org's own PayMongo connected account** — the founder is
  NOT in the dues money flow (no payouts/escrow/MTL scope). Two money flows only:
  member→org dues (org's account) and org→founder subscription (founder Stripe).
- **Payment is login-free** (tokenized pay-link, single-use, TTL, idempotent —
  double-tap must never double-charge). Signup is an optional post-value upsell
  (passwordless OTP, phone-first).
- Refunds = officer-initiated manual v1; overpayment = clamped/rejected; late
  fees + partial dues = out of scope v1; PWA online-only.

## Key conventions / gotchas

- No `/api` prefix in backend route registration (Vite proxy strips it).
- Use `sonner` for toasts. Auth route is `/auth/sign-in`.
- Restart the API after adding route registrations (no hot-reload for routes).
- **NEVER delete handler files to fix type errors** — fix the types to match the
  generated validators (`@/generated/openapi/validators`).
- Migrations: edit `*.schema.ts` → `bun run db:generate` → review SQL → runs on
  start. Migration-safety lint requires `DELETE`+`WHERE` on one line; schema PRs
  must reference `docs/security/MIGRATION_SAFETY_CHECKLIST.md` (CI gate).

## Commands

```bash
bun install
cd specs/api && bun run build                 # OpenAPI + types
cd services/api-ts && bun run generate         # routes/validators
cd services/api-ts && bun dev                  # API on 7213
bun run typecheck                              # all workspaces
cd services/api-ts && bun test                 # engine tests
bun run test:contract                          # Hurl contract suite
```

## When in doubt

[DESIGN.md](./DESIGN.md) (design law) · [VERTICAL_TDD.md](./VERTICAL_TDD.md)
(test protocol) · [CONTRIBUTING.md](./CONTRIBUTING.md) (engine dev patterns) ·
`specs/api/dist/openapi/openapi.json` (API contract) · memory
`lean-launch-strategy`. Reference existing handlers in
`services/api-ts/src/handlers/` for patterns.
