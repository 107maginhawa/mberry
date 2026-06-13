# Continuation prompt — AHA Step 18 (next `04`: Marketplace/Ads/Reviews — **Batch D** reviews scoping + audit hardening)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-18-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). Mixed change surface: FIX-011 is **handler-only** (org filter); FIX-012 is **TypeSpec-first** (`@extension("x-audit", …)` on 4 existing ops → regen routes/validators → SDK); the bundled `reviewCreative` contract-mismatch fix is **handler-only** (align handler to the existing contract — no new op). Proven by **Bun unit tests + the Hurl contract suite**. **No browser / no memberry app needed.** Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT touch budget/pacing or ad placements, do NOT re-gate on G-06 authority, do NOT implement G-13 (review person-deletion policy — product-blocked), do NOT continue to another module/batch after this one. Stop after saving the fix report.
>
> **ENV NOTE (verified working through Batch C, 2026-06-12):** Docker is up (postgres/minio/mailpit/stripe-mock). The live Hurl contract suite **does** boot. To run it: `cd services/api-ts && SERVER_PORT=7299 bun src/index.ts` (throwaway seeded API), then from repo root `API_URL=http://localhost:7299 bun run test:contract`, or a single file via `hurl --variable api=http://localhost:7299 --variable origin=http://localhost:3004 --variable suffix=x$(date +%s) --variable org_id=ed8e3a96-8126-4341-be42-e6eb7940c562 --test specs/api/tests/contract/reviews-flow.hurl`. Officer seed: `test@memberry.ph` / `TestPass123!`. Kill the throwaway server when done (`lsof -ti tcp:7299 | xargs kill`). `hurl` 8.0.1 installed. **curl/wget are blocked by a hook — use `hurl` or `bun` fetch, NOT curl, to poll readiness; or check `lsof -ti tcp:7299` + the boot log.**

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Marketplace/Ads/Reviews, Batch D (reviews scoping + audit hardening)**, using TDD (RED→GREEN per fix). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (marketplace-advertising)
03-organize-gap-plan-for-fixing.md     # DONE (marketplace-advertising)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS = Batch D)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Marketplace/Ads/Reviews — Batch A (FIX-001 G-01 + FIX-002 G-14), 2026-06-11 — COMPLETE.** Restored dropped `/association/{marketplace,advertising}` route prefix. See fix report § "Batch A".
- **`04` Marketplace/Ads/Reviews — Batch B (FIX-003/004/005/006/007 org-scope half), 2026-06-12 — COMPLETE.** Listing activation, decision-based `verifyVendor`, null-price guard, listOrders/getOrder/cancelOrder, org-scoped order lookups. See fix report § "Batch B".
- **`04` Marketplace/Ads/Reviews — Batch C (FIX-008/009/010 advertising safety rails), 2026-06-12 — COMPLETE.** Opt-out persist + server-side enforce (client flag ignored); real ad-report pipeline (persist + 3-in-7-day window + creative-level auto-pause `approved→pending` + admin notify); campaign status/schedule serve-gating. Plus adversarial-review org-isolation hardening (cross-org `reportAd` guard, org-scoped `findByIds`). No TypeSpec/regen/migration. 24 rewritten advertising-handler tests; full api-ts `bun test` = **6160 pass / 1 fail / 4 todo**; monorepo tsc 5/5; live `advertising-flow.hurl` 19/19. See fix report § "Batch C". **Discovered there:** `reviewCreative` has a pre-existing validator-vs-handler mismatch (tsp `ReviewCreativeRequest{approved, rejectionReason}` vs handler reading `body.decision`/`body.reason`) — folded into THIS pass.

## This pass — execute `04` for Marketplace/Ads/Reviews, Batch D

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` (§2 Batch D strategy "keep reviews slice tiny", §3 rows FIX-011/FIX-012, §6 files, §7 shared deps).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` (G-12, §15 x-audit).
   - Prior fix report (what's done — **APPEND** a "Batch D" section, do NOT rewrite Batch A/B/C): `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md`.
   - Module slug = `marketplace-advertising`. Readable name = "Marketplace/Ads/Reviews".
3. Invoke `superpowers:test-driven-development` (RED-first). Reviews is the only HEALTHY sub-module — keep changes tiny (fix-ready §2 risk #3).
4. **Selected subset — Batch D (reviews scoping + audit hardening + the reviewCreative mismatch):**
   - **FIX-011 — G-12 org-scope `listReviews` (P2, V1 RECOMMENDED).** `handlers/reviews/listReviews.ts` builds filters but never applies `organizationId`, so platform-admin queries can return cross-org reviews and officers lack an org-scoped view. The column + index already exist (`review.schema.ts:26` `organizationId notNull`, `:49` `reviews_org_idx`). Add the org filter from `ctx.get('organizationId')` (match how other list handlers scope; confirm officer-vs-admin semantics — admins may legitimately need cross-org, so gate on role/ctx as the existing pattern does). RED: `listReviews` scoped to caller's org; cross-org reviews not returned — extend `handlers/reviews/listReviews.test.ts`.
   - **FIX-012 — §15 `x-audit` extensions (P2, V1 RECOMMENDED, TypeSpec-first).** No audit trail on 4 trust-sensitive ops. Add `@extension("x-audit", #{ action, resourceType, … })` per CLAUDE.md P1.5 to: `verifyVendor` + `fulfillOrder` (marketplace.tsp), `reviewCreative` (advertising.tsp), `deleteReview` (reviews.tsp). Copy the exact shape from an existing example — `specs/api/src/modules/person-custom.tsp`, `email.tsp`, or `dues-custom.tsp`. These are EXISTING ops (no new operationId), so the generated **client SDK shape is unchanged** — x-audit only emits server audit middleware in `routes.ts`. RED/proof: follow the `audit-side-effects.hurl` pattern (assert an audit event is emitted after each op) and/or a unit-level audit assertion if one exists.
   - **reviewCreative contract-mismatch (bundled, handler-only).** `advertising.tsp` `ReviewCreativeRequest` = `{ approved: boolean, rejectionReason? }` but `handlers/advertising/reviewCreative.ts` reads `body.decision` / `body.reason` → the op cannot be satisfied end-to-end. **Smallest correct fix = align the HANDLER to the existing contract** (read `body.approved` boolean + `body.rejectionReason`; require reason when `approved===false`) — NO TypeSpec change, NO regen. (Alternative — change the tsp to a decision-string to match Batch B's `verifyVendor` — is MORE churn + regen + SDK divergence; prefer the handler fix unless the plan says otherwise.) RED: extend `reviewCreative.test.ts` — `{approved:true}` approves a pending creative; `{approved:false, rejectionReason:"x"}` rejects; `{approved:false}` (no reason) → 400. This unblocks the Batch-C deferred live auto-pause proof — OPTIONAL bonus: once green, extend `advertising-flow.hurl` with approve→report×3→creative auto-paused-to-pending.
   - Update any stale reviews/marketplace spec/doc lines touched (e.g. `MODULE_SPEC.marketplace.md` §9 "Zero Hurl contract tests" doc-only line if still present).
5. **Do NOT implement in this pass (out of subset / blocked / later):**
   - FIX-001..FIX-010 (Batches A/B/C) — already DONE. Do not redo.
   - **G-13** — reviews subscriber for `person.deleted` (anonymize-vs-delete-vs-block) — `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]`. Do NOT add the subscriber or change the FK RESTRICT.
   - **G-06** authority model (platform-admin vs association-admin for verify/review) — `[NEEDS PRODUCT DECISION]`. Do NOT re-gate.
   - **FIX-007 strict vendor-ownership half** — `[NEEDS PRODUCT DECISION]` (vendor identity).
   - **Review editing/update endpoint** (immutability is deliberate), **NPS aggregation in reviews** (owned by surveys), **behavioral/member-level ad analytics**, **budget/pacing/spend**, **ad placements/impressions/analytics/versioning**, **advertiser portal**, **member marketplace UI**, **payments/refunds** — all `DO NOT ADD` / `V2 DEFERRED` per fix-ready §10/§11.
   - **Jobs module `/postings`** dropped-prefix defect — SEPARATE independent `04` pass.
6. TDD / test discipline: write/flip the failing test FIRST per fix (watch it fail for the right reason). Implement the smallest correct change. **FIX-012 changes TypeSpec → regenerate** (see §8). Reserve Hurl for the audit-side-effect + (optional) reviewCreative→report end-to-end journeys. Do NOT weaken assertions.
7. **Pre-flight reads BEFORE touching code (do not skip):** `handlers/reviews/` inventory; `listReviews.ts` (filters built, no org applied — line ~74 `findManyWithPagination(filters)`), `repos/review.repo.ts` + `review.schema.ts` (confirm `organizationId` + `reviews_org_idx`); `reviewCreative.ts` (reads `body.decision`/`body.reason`) vs `advertising.tsp` `ReviewCreativeRequest`; the 4 target ops in `marketplace.tsp` (`verifyVendor`, `fulfillOrder`), `advertising.tsp` (`reviewCreative`), `reviews.tsp` (`deleteReview`); an existing `@extension("x-audit", …)` example (`person-custom.tsp` / `email.tsp` / `dues-custom.tsp`) for the exact shape + how the handler sets `ctx.set('auditResourceId', …)`; the generated audit middleware chain (CLAUDE.md P1.5); and `specs/api/tests/contract/audit-side-effects.hurl` for the assertion pattern. Match each op's existing `@extension("x-security-required-roles", …)` — do NOT change roles.
8. **Regen workflow (FIX-012 only — it edits TypeSpec):** after editing `marketplace.tsp` / `advertising.tsp` / `reviews.tsp`: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`, then `cd packages/sdk-ts && bun run generate`. NEVER edit generated files. Restart the API after new route middleware. FIX-011 and the reviewCreative handler fix are pure handler logic — no regen.
9. Validate: focused Bun unit tests per fix → full api-ts `bun test` (record vs the **6160 pass / 1 fail / 4 todo** baseline; the 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs`) → monorepo typecheck (`bun run --filter '*' typecheck`, expect 5/5) → the reviews + audit Hurl flows green against a booted+seeded API (boot per ENV NOTE; the full suite has **3 known pre-existing non-marketplace failures** — `impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow` — do NOT attribute them to this batch). If FIX-012 emits new audit middleware, re-run `audit-side-effects.hurl` + `reviews-flow.hurl`. Save the fix report (APPEND a "Batch D — reviews scoping + audit hardening" section; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1–A7 (Membership, Elections, Auth/RBAC, Billing, Communications, Documents, Notifications) — ✅ DONE.
- A8 Person Batch C backend + A8b frontend — ✅ DONE.
- A9 Marketplace **Batch B** — ✅ DONE. A-next Marketplace **Batch C** — ✅ DONE (2026-06-12).
- **A-next Marketplace Batch D (FIX-011 reviews org-scope + FIX-012 x-audit + reviewCreative mismatch) — THIS PASS.**
- A8c Person FIX-013 (`notification_preference` orgId) — after Q-7 eng+product confirmation.
- A10 Platform-admin Batch B subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11 Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Jobs module `/postings`** — apply the identical `@route("/association/jobs")` prefix fix (same dropped-prefix defect as marketplace G-01). Independent `04` pass.
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`).
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls. `[CROSS-MODULE RISK]`.
- **3 pre-existing non-marketplace contract failures** (impersonation / governance position-crud / platformadmin committees authority drift) — address in those modules' own passes.

**Track B — decision-gated (the bottleneck):**
- B1. P0 product decisions (elections G2 → documents Q1 → realtime PD-1), then headline P1s incl. marketplace **G-06** (advertising/vendor authority model) + **G-13** (review person-deletion policy) + **vendor-identity** (FIX-007 ownership half), person Q-1/Q-4/Q-7. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Marketplace Batch C, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **Batch D needs the API + regen toolchain, NOT the frontend.**
- Known-good baselines (AFTER Batch C): full `bun test` (api-ts) = **6160 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`). Monorepo `tsc` = **0 errors (5/5)**. Full Hurl suite = **152/155 files** (3 pre-existing non-marketplace fails); `advertising-flow.hurl` = green (19 req). **This pass MAY change the api-ts unit count** (new reviews + reviewCreative tests) and, via FIX-012 regen, `routes.ts`/audit middleware.
- `check:sdk-compat` exits 1 **by design** (frozen baseline). FIX-012 x-audit on existing ops should NOT add operationIds, so client SDK shape is unchanged — but **do NOT `--update` until milestone Step 6** regardless.

## Tree / commit rules

- NOTHING committed; working tree dirty (~300+ files across all prior AHA passes + A8/A8b + Marketplace Batch A/B/C). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits the reviews handler + tests, the 3 `.tsp` files (FIX-012) + their regen output, `reviewCreative.ts` + test, audit/reviews Hurl flows, any stale doc, and the fix report. No unrelated file deletes. Do not commit unless asked. NOTE: two files dirty from a prior membership-lifecycle pass (`core/domain-events.registry.ts`, `member/membership/utils/status-transitions.ts`) are NOT yours — leave them.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Marketplace/Ads/Reviews Batch D (FIX-011, FIX-012, + reviewCreative mismatch). Do NOT start the jobs module, G-06/G-13 product re-gates, or any other module. Save the fix report and stop.

execute systematically
