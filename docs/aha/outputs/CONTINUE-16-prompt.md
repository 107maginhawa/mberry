# Continuation prompt — AHA Step 16 (next `04`: Marketplace/Ads/Reviews — **Batch B** marketplace-workflow completion) = pass **A9**

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-16-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). Unlike A8b it is **backend + TypeSpec-first** — it edits `specs/api/src/modules/marketplace.tsp`, regenerates (OpenAPI → routes/validators/handler stubs → SDK), implements handler logic, and proves it with **Bun unit tests + the Hurl contract suite**. **No browser / no memberry app needed.** Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT start Batch C/D, do NOT touch the jobs module (separate pass), do NOT continue to another module after this one. Stop after saving the fix report.
>
> **ENV NOTE:** needs Docker (postgres/minio/mailpit/stripe-mock — already up), the API service, and the regen toolchain. No frontend stack. To run the Hurl contract suite end-to-end, boot a seeded API (a throwaway `SERVER_PORT=7299 bun src/index.ts` is fine) and run `bun run test:contract` against `$API_URL`. If the contract suite genuinely cannot boot, fall back to Bun unit + handler-level proof and mark the live contract step `[BLOCKED BY ENVIRONMENT]` — do NOT claim a contract pass that didn't run.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Marketplace/Ads/Reviews, Batch B (marketplace-workflow completion)**, using TDD (RED→GREEN per fix; flip broken-baseline unit tests RED first; Hurl for the end-to-end purchase/fulfill journey). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (marketplace-advertising)
03-organize-gap-plan-for-fixing.md     # DONE (marketplace-advertising)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Person & Profile — Batch C **frontend** slice (FIX-010 grace banner + FIX-011 id-card org selector), 2026-06-12 — COMPLETE (A8b).** FIX-010 added `DeletionGraceBanner` (`apps/memberry/src/components/layout/`) wired into the `_authenticated` layout — app-wide deletion warning + Cancel CTA; proven by a component test + a live E2E journey (request → dashboard banner → cancel → reload-gone). FIX-011 replaced the `memberships[0]` hardcode on `my/id-card.tsx` with a native `<select>` org switcher (shown when >1 membership; pre-flight confirmed the per-org route `GET /persons/me/id-card/:orgId` exists, hand-wired in `app.ts:508`). Component tests green, app typecheck clean, both pages browsed live. FIX-011 multi-org **E2E** deferred `[BLOCKED BY ENVIRONMENT]` (no 2-org seed). See `docs/aha/module-fix-plans/person-profile-fix-report.md` § "Batch C frontend slice — FIX-010 + FIX-011 (pass A8b)". Person & Profile is now fully done except A8c (FIX-013, Q-7-blocked).
- **`04` Marketplace/Ads/Reviews — Batch A (FIX-001 G-01 + FIX-002 G-14), 2026-06-11 — COMPLETE.** FIX-001 restored the dropped `/association/{marketplace,advertising}` route prefix so `orgContextMiddleware` runs and `organizationId` is present (every write was 500ing). FIX-002 tightened the 500-tolerant Hurl asserts to exact statuses. **Batch B is now unblocked** (org context is reliably present). See `marketplace-advertising-fix-report.md` § "Batch A".

## This pass — execute `04` for Marketplace/Ads/Reviews, Batch B

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` (§2 Batch B strategy, §3 rows FIX-003/004/005/006/007, §4 batches, §5 Test-First, §6 files, §7 shared deps, §8/§9 decisions/blocked, §10/§11 deferred/do-not-build).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md`
   - Prior fix report (what's done — APPEND to it, do NOT rewrite): `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md` (Batch A complete).
   - Module slug = `marketplace-advertising`. Readable name = "Marketplace/Ads/Reviews".
3. Invoke `superpowers:test-driven-development` (RED-first). **Critical:** several existing unit tests encode the BROKEN behavior (e.g. `verifyVendor` hardcodes `'verified'`) — flip those RED first, do NOT preserve a green that blesses the bug.
4. **Selected subset — Batch B (marketplace-workflow completion, all TypeSpec-first, reuse `handlers/marketplace/utils/status-transitions.ts`):**
   - **FIX-003 — G-04 listing activation (P1, V1 REQUIRED).** No endpoint moves a listing `draft → active` (or archive) → the member buy flow dead-ends (`createOrder` is active-only). Add an update/activate handler driving `MARKETPLACE_LISTING_VALID_TRANSITIONS` (`status-transitions.ts:120`, currently unconsumed). TypeSpec-first → regen → implement → RED test for the transition.
   - **FIX-004 — G-05 vendor reject/suspend (P1, V1 REQUIRED).** `verifyVendor.ts` hardcodes `'verified'`; reject/suspend are unreachable (approve-only theater). Make the handler honor the requested transition via `status-transitions.ts:113-118`. **Exclude the G-06 authority re-gate** (who-can-verify is a `[NEEDS PRODUCT DECISION]`) — only fix the transition reachability. Update stale `MODULE_SPEC.marketplace.md` §3 verify semantics.
   - **FIX-005 — G-11 null-price → ₱0 order (P2, V1 RECOMMENDED).** `createOrder` does `parseFloat(listing.price ?? '0')` → silent free orders. Guard: reject a null-price listing instead of charging 0. One-liner near the FIX-003 work; RED test for the ₱0 path.
   - **FIX-006 — G-08 order discovery/cancel (P2, V1 RECOMMENDED).** No `listOrders`/`getOrder`/`confirm`/`cancel` endpoints; `OrderRepository.cancelOrder` is dead. Add the endpoints (TypeSpec-first) and wire the existing dead `cancelOrder` repo method. Vendors can't find orders to fulfill; buyers can't cancel.
   - **FIX-007 — G-10 order org-scoping (P2, V1 RECOMMENDED) — ORG-SCOPE HALF ONLY.** `createOrder` (`findOneById(body.listingId)`) and `fulfillOrder` (`findOneById(orderId)`) have no org scoping → cross-org order manipulation. Add `organizationId` scoping to those lookups. **The strict vendor-ownership half is BLOCKED** (`[NEEDS PRODUCT DECISION]` — no vendor↔user link; see fix-report §10) → implement org-scope only, document the ownership half as blocked.
   - Update stale `MODULE_SPEC.marketplace.md` (§3 verify semantics, §9 hurl claim) as part of this batch.
5. **Do NOT implement in this pass (out of subset / blocked / later):**
   - FIX-001 / FIX-002 — already DONE (Batch A). Do not redo.
   - **G-06** (marketplace authority model — who can verify/activate) — `[NEEDS PRODUCT DECISION]`. Excluded; do not re-gate `verifyVendor`/`reviewCreative` on authority.
   - **FIX-007 strict vendor-ownership check** on `fulfillOrder` — `[NEEDS PRODUCT DECISION]` (no vendor↔user link). Org-scope half only.
   - **Batch C** (advertising safety rails: G-02 opt-out persist, G-03 ad-report pipeline, G-09 campaign serve-gating) — later pass. Their existing `setMemberOptOut.test.ts` / `reportAd.test.ts` bless broken behavior — leave for that pass.
   - **Batch D** (reviews: G-12 org-scope `listReviews`, `x-audit` extensions) — later pass; keep reviews untouched here.
   - **Jobs module `/postings`** identical dropped-prefix defect — SEPARATE independent `04` pass (cross-module risk noted in Batch A report §9). Do NOT pull it in.
   - G-13 (review anonymization-vs-block) — `[NEEDS PRODUCT DECISION]`. Everything in §23 (placements/impressions/analytics/versioning, payments/refunds, NPS aggregation, vendor-portal identity) — deferred.
6. TDD / test discipline: write/flip the failing test FIRST per fix (watch it fail for the right reason — FIX-004: a reject/suspend request currently still lands `'verified'`; FIX-005: null-price yields a ₱0 order; FIX-003: no activation path). Implement the smallest correct TypeSpec+handler change, regen, re-run. Reserve the Hurl contract suite for the end-to-end **purchase → activate → order → fulfill/cancel** journey (the browser-proof equivalent here is the contract suite, not Playwright). Do NOT weaken assertions to pass.
7. **Pre-flight reads BEFORE touching code (do not skip):** `handlers/marketplace/` file inventory (which handlers exist vs missing), `handlers/marketplace/utils/status-transitions.ts` (the `MARKETPLACE_LISTING_VALID_TRANSITIONS` + vendor-status transition tables you must reuse — do NOT hand-roll), `handlers/marketplace/repos/order.repo.ts` (the dead `cancelOrder`), `createOrder.ts` / `fulfillOrder.ts` / `verifyVendor.ts` current logic, the existing `verifyVendor`/order unit tests (which encode broken behavior), and `specs/api/src/modules/marketplace.tsp` (where new ops go). Confirm the audit/officer `@extension` conventions (CLAUDE.md P1.5) before adding any new operation — declare audit/position via `@extension`, do NOT hand-call `auditAction`/`requirePosition`.
8. **Regen workflow (TypeSpec-first — REQUIRED this pass):** after editing `marketplace.tsp`: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`. Then implement handler logic in `services/api-ts/src/handlers/marketplace/`. NEVER edit generated files (`generated/openapi/*`). Restart the API after new route registrations (no hot-reload).
9. Validate: focused Bun unit tests per fix (`cd services/api-ts && bun test <files>`) → full api-ts `bun test` (record pass/fail vs the known baseline) → monorepo typecheck (`bun run --filter '*' typecheck`) → the marketplace Hurl flow green against a booted+seeded API (`bun run test:contract`, or `[BLOCKED BY ENVIRONMENT]` if it can't boot). Save the fix report (APPEND a "Batch B — marketplace workflow completion" section to `marketplace-advertising-fix-report.md`; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1 Membership · A2 Elections · A3 Auth/RBAC · A4 Billing · A5 Communications · A6 Documents · A7 Notifications — ✅ DONE.
- A8 Person Batch C **backend** (FIX-007/008/009/012/014) — ✅ DONE (2026-06-12).
- A8b Person Batch C **frontend** (FIX-010 + FIX-011) — ✅ DONE (2026-06-12).
- **A9 Marketplace Batch B (FIX-003/004/005/006/007 org-scope half; exclude FIX-007 vendor-ownership + G-06 authority re-gate) — THIS PASS.**
- A8c Person FIX-013 (`notification_preference` orgId) — after Q-7 eng+product confirmation.
- A10 Platform-admin Batch B subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11 Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).
- (later) Marketplace Batch C (advertising safety rails) + Batch D (reviews org-scope + x-audit) — sequenced after Batch B.

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Jobs module `/postings`** — apply the identical `@route("/association/jobs")` prefix fix (same dropped-prefix defect as marketplace G-01). Independent `04` pass.
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`). Context in `auth-rbac-fix-report.md`.
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls → those payment notifications never fire. `[CROSS-MODULE RISK]`.
- **FIX-008-surfaced (Person):** whether `POST /persons/me/data-export` + the id-card routes should live in the generated registry or stay hand-wired — wire or remove (id-card per-org route confirmed hand-wired in A8b).

**Track B — decision-gated (the bottleneck):**
- B1. Resolve P0 product decisions: elections G2 position-identity → documents Q1 card-verify token → realtime PD-1 channel-membership. Then headline P1s incl. marketplace G-06 (authority model) + G-13 (review-deletion) + vendor-identity (FIX-007 ownership half), person Q-1/Q-4/Q-7. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Person Batch C frontend, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **A9 needs the API + regen toolchain, NOT the frontend.** Start the API (`cd services/api-ts && bun dev` → :7213) for unit/dev, and for the Hurl contract suite boot a seeded impl (`cd services/api-ts && SERVER_PORT=7299 bun src/index.ts`) and run `bun run test:contract` with `API_URL` pointed at it.
- Known-good baselines (AFTER A8b): full `bun test` (api-ts) = **6120 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`). Monorepo `tsc` = **0 errors** (5/5). A8b added frontend component + E2E tests only (api-ts count unchanged). **This pass WILL change the api-ts unit count** (new handlers/tests) and WILL regenerate SDK/OpenAPI — expect new files under `generated/`.
- `check:sdk-compat` exits 1 **by design** (frozen baseline). **Batch B adds NEW operationIds** (listing activate, listOrders/getOrder/cancelOrder, etc.) → the baseline will diverge further. Do NOT `--update` the baseline until milestone Step 6.

## Tree / commit rules

- NOTHING committed; working tree dirty (~290+ files across all prior AHA passes + A8 + A8b). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits `marketplace.tsp`, regen output, marketplace handlers + tests, `MODULE_SPEC.marketplace.md`, and the fix report. No unrelated file deletes. Do not commit unless asked.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Marketplace/Ads/Reviews Batch B (FIX-003/004/005/006/007 org-scope half). Do NOT start Batch C/D, the jobs module, G-06, or FIX-007's vendor-ownership half. Save the fix report and stop.

execute systematically
