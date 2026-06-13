# Continuation prompt — AHA Step 17 (next `04`: Marketplace/Ads/Reviews — **Batch C** advertising safety rails)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-17-prompt.md`.

> This is a **`04-module-or-group-fix-tdd.md`** pass (TDD fix, ONE module, decision-free subset). Like Batch B it is **backend + TypeSpec-first** — it edits `specs/api/src/modules/advertising.tsp` where new ops/extensions are needed, regenerates (OpenAPI → routes/validators/handler stubs → SDK), implements handler + repo logic, and proves it with **Bun unit tests + the Hurl contract suite**. **No browser / no memberry app needed.** Follow the fix-ready plan as the primary guide. Do NOT expand scope, do NOT start Batch D (reviews), do NOT touch the jobs module, do NOT re-gate on the G-06 authority model, do NOT continue to another module/batch after this one. Stop after saving the fix report.
>
> **ENV NOTE (verified working in Batch B, 2026-06-12):** Docker is up (postgres/minio/mailpit/stripe-mock). The live Hurl contract suite **does** boot in this environment. To run it: `cd services/api-ts && SERVER_PORT=7299 bun src/index.ts` (throwaway seeded API), then from repo root `API_URL=http://localhost:7299 bun run test:contract`, or a single file via `hurl --variable api=http://localhost:7299 --variable origin=http://localhost:3004 --variable suffix=x$(date +%s) --variable org_id=ed8e3a96-8126-4341-be42-e6eb7940c562 --test specs/api/tests/contract/advertising-flow.hurl`. Officer seed: `test@memberry.ph` / `TestPass123!`. Kill the throwaway server when done (`lsof -ti tcp:7299 | xargs kill`). `hurl` 8.0.1 is installed.

---

Continue the AHA remediation. Execute **`docs/aha/prompts/04-module-or-group-fix-tdd.md`** for **Marketplace/Ads/Reviews, Batch C (advertising safety rails)**, using TDD (RED→GREEN per fix; **flip the broken-baseline unit tests RED first** — `setMemberOptOut.test.ts` and `reportAd.test.ts` currently bless the broken behavior; do NOT preserve a green that blesses the bug). Then STOP after saving the fix report.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## The canonical AHA prompt sequence (do not forget this)

```txt
00-aha-shared-rules.md            # rules (always loaded)
01-platform-discovery-audit-index.md   # DONE
02-module-or-group-audit-gap-plan.md   # DONE (marketplace-advertising)
03-organize-gap-plan-for-fixing.md     # DONE (marketplace-advertising)
04-module-or-group-fix-tdd.md          # RUN ONCE PER MODULE/BATCH — repeats (THIS PASS = Batch C)
05-cross-cutting-pattern-audit.md      # DONE
06-database-schema-audit.md            # DONE (through migration 0066)
07-consolidate-roadmap.md              # DONE + RE-RUN later (Track C)
```

Rules: never run `04` without a `03` fix-ready plan; execute only the SELECTED subset; stop after the fix report.

## What just completed (do NOT redo)

- **`04` Marketplace/Ads/Reviews — Batch A (FIX-001 G-01 + FIX-002 G-14), 2026-06-11 — COMPLETE.** Restored the dropped `/association/{marketplace,advertising}` route prefix (every write was 500ing) + tightened 500-tolerant Hurl asserts. See `marketplace-advertising-fix-report.md` § "Batch A".
- **`04` Marketplace/Ads/Reviews — Batch B (FIX-003/004/005/006/007 org-scope half), 2026-06-12 — COMPLETE.** Listing activation (`updateListing`), decision-based `verifyVendor` (reject/suspend reachable), null-price guard, `listOrders`/`getOrder`/`cancelOrder` (+ wired dead `OrderRepository.cancelOrder`), org-scoped order/listing lookups. 31 new unit tests; full api-ts `bun test` = **6151 pass / 1 fail / 4 todo**; monorepo typecheck 5/5; **live Hurl journey 25 req / 100%**. FIX-007 vendor-ownership half + G-06 authority re-gate left BLOCKED. See `marketplace-advertising-fix-report.md` § "Batch B".

## This pass — execute `04` for Marketplace/Ads/Reviews, Batch C

1. Load + strictly follow `docs/aha/prompts/00-aha-shared-rules.md`, then `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. Inputs:
   - Fix-ready plan (PRIMARY): `docs/aha/module-fix-plans/marketplace-advertising-fix-ready-plan.md` (§2 Batch C strategy, §3 rows FIX-008/009/010, §4 batches, §5 Test-First, §6 files, §7 shared deps incl. notifs, §8/§9 decisions/blocked, §10/§11 deferred/do-not-build).
   - Raw gap plan (CONTEXT): `docs/aha/module-gap-plans/marketplace-advertising-gap-plan.md` (G-02, G-03, G-09; m16 §4 member-safety).
   - Prior fix report (what's done — **APPEND** a "Batch C" section, do NOT rewrite Batch A/B): `docs/aha/module-fix-plans/marketplace-advertising-fix-report.md`.
   - Module slug = `marketplace-advertising`. Readable name = "Marketplace/Ads/Reviews".
3. Invoke `superpowers:test-driven-development` (RED-first). **Critical:** `setMemberOptOut.test.ts` (no-op opt-out blessed) and `reportAd.test.ts` (threshold-5 "simulated", no persistence blessed) encode the BROKEN behavior — rewrite them RED first.
4. **Selected subset — Batch C (advertising safety rails, all TypeSpec-first where new ops/extensions are needed; reuse existing `member_ad_opt_out` + `ad_report` tables — NO migration):**
   - **FIX-008 — G-02 opt-out persist + server-side enforce (P1, V1 REQUIRED).** `setMemberOptOut` persists nothing (returns misleading success); `getAdForPlacement` trusts a client `query.optedOut` flag (trivially bypassable; AC-M16-004 violated). Persist the opt-out row to the unused `member_ad_opt_out` table; make `getAdForPlacement` read the opt-out server-side (return generic/no-ad for an opted-out person WITHOUT any client flag). Rewrite `setMemberOptOut.test.ts` RED; extend `getAdForPlacement.test.ts`.
   - **FIX-009 — G-03 real ad-report pipeline (P1, V1 REQUIRED for persist+threshold+window; admin notify = V1 RECOMMENDED).** `reportAd` never inserts (it's "simulated"); threshold is 5 (spec m16 §4 = **3**); no 7-day rolling window; it pauses the **campaign** not the **creative**; no admin alert. Persist each report to the unused `ad_report` table; count reports in a **rolling 7-day window**; at **3** within 7 days, **pause the creative** (not the campaign); fire an admin notification via the existing `notificationRepo.createNotificationForModule` pattern (`[CROSS-MODULE RISK]` notifs — keep minimal). Rewrite `reportAd.test.ts` RED (3 reports within 7 days persist rows + stop serving the creative; 3 reports across 8 days do NOT trigger).
   - **FIX-010 — G-09 campaign-state serve gating (P1, V1 REQUIRED for status+date window; budget pacing DEFERRED).** `getAdForPlacement` only does `findMany({ organizationId, status: 'approved' })` on creatives — it never reads `ad_campaign.status` / `starts_at` / `ends_at`, so paused/expired/draft campaigns still serve (violates M16-R6). Gate serving on campaign `status === 'active'` + within the `starts_at..ends_at` date window. **FIX-010 must land WITH/BEFORE FIX-009** — otherwise FIX-009's auto-paused creative still serves. Extend `getAdForPlacement.test.ts` RED (paused/expired/draft campaign's approved creative is NOT served).
   - Update any stale advertising spec/doc lines touched by these (e.g. `MODULE_SPEC.advertising.md` if it claims no opt-out persistence / threshold 5) as part of this batch.
5. **Do NOT implement in this pass (out of subset / blocked / later):**
   - FIX-001/002 (Batch A), FIX-003/004/005/006/007 (Batch B) — already DONE. Do not redo.
   - **Budget/pacing/spend** (`spent_cents`, CPM caps) — `V2 DEFERRED` (`[DO NOT OVERBUILD]`). FIX-010 is status+date-window only.
   - **Batch D** (reviews G-12 org-scope `listReviews` + `x-audit` extensions on verifyVendor/reviewCreative/fulfillOrder/deleteReview) — later pass. Keep reviews untouched here.
   - **G-06** (advertising authority model — who can verify/review/serve) — `[NEEDS PRODUCT DECISION]`. Do NOT re-gate `reviewCreative`/`setMemberOptOut` on authority.
   - **Jobs module `/postings`** dropped-prefix defect — SEPARATE independent `04` pass.
   - Everything in fix-ready §10/§11: ad placements/impressions/analytics/versioning, advertiser self-service portal + suspension cascade, behavioral targeting, member-level ad analytics, creative review-history — deferred / DO NOT ADD.
6. TDD / test discipline: write/flip the failing test FIRST per fix (watch it fail for the right reason — FIX-008: opt-out is a no-op + serve trusts the client flag; FIX-009: report not persisted, threshold 5, campaign-level pause, no window; FIX-010: paused/expired campaign still serves). Implement the smallest correct change, regen if TypeSpec changed, re-run. Reserve the Hurl contract suite for the end-to-end **opt-out-then-no-serve / report-to-auto-pause / paused-campaign-not-served** journeys (extend `advertising-flow.hurl`). Do NOT weaken assertions to pass.
7. **Pre-flight reads BEFORE touching code (do not skip):** `handlers/advertising/` file inventory; `setMemberOptOut.ts` (no DB write), `getAdForPlacement.ts` (`query.optedOut` trust + `findMany({status:'approved'})` only), `reportAd.ts` (`REPORT_THRESHOLD = 5`, "simulated"); the advertising repos (`creative.repo.ts countReports`, campaign repo, opt-out/report repos if any) + `advertising.schema.ts` (confirm `member_ad_opt_out`, `ad_report`, `ad_campaign.status/starts_at/ends_at` columns exist — they do); the existing `setMemberOptOut.test.ts` / `reportAd.test.ts` / `getAdForPlacement.test.ts` (which bless broken behavior); `specs/api/src/modules/advertising.tsp`; and the notifs `createNotificationForModule` pattern (CLAUDE.md OneSignal section) for the FIX-009 admin alert. Confirm the audit/officer `@extension` conventions (CLAUDE.md P1.5) before adding any new operation — but note **x-audit additions are Batch D, NOT this pass**; match the module's existing `@extension("x-security-required-roles", …)` convention for any new op.
8. **Regen workflow (only if TypeSpec changes):** after editing `advertising.tsp`: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`, then `cd packages/sdk-ts && bun run generate`. NEVER edit generated files. Restart the API after new route registrations (no hot-reload). If a fix is purely handler/repo logic with no new endpoint (likely for FIX-008/009/010 — they mostly fix existing handlers), no TypeSpec change is needed.
9. Validate: focused Bun unit tests per fix → full api-ts `bun test` (record pass/fail vs the **6151 pass / 1 fail / 4 todo** baseline; the 1 fail is the PRE-EXISTING + UNRELATED `registerEmailJobs`) → monorepo typecheck (`bun run --filter '*' typecheck`, expect 5/5) → the advertising Hurl flow green against a booted+seeded API (boot per ENV NOTE; the full suite has **3 known pre-existing non-advertising failures** — `impersonation-flow`, `member/governance/position-crud`, `platformadmin-extended-flow` — do NOT attribute them to this batch). Save the fix report (APPEND a "Batch C — advertising safety rails" section; do not rewrite prior sections). STOP.

## Remaining-work sequence (the todolist — keep in this order)

**Track A — decision-free `04` passes:**
- A1 Membership · A2 Elections · A3 Auth/RBAC · A4 Billing · A5 Communications · A6 Documents · A7 Notifications — ✅ DONE.
- A8 Person Batch C **backend** — ✅ DONE. A8b Person Batch C **frontend** — ✅ DONE.
- A9 Marketplace **Batch B** — ✅ DONE (2026-06-12).
- **A-next Marketplace Batch C (FIX-008/009/010 advertising safety rails) — THIS PASS.**
- A8c Person FIX-013 (`notification_preference` orgId) — after Q-7 eng+product confirmation.
- A10 Platform-admin Batch B subset (FIX-003 invite, FIX-006 sort, FIX-007 impersonate UI).
- A11 Realtime Batch B subset (FIX-007 OR-shim, FIX-009 ws:true verify-then-fix).
- A12 Dues Batch B subset (FIX-004 position-gate, FIX-005 fund-splits, FIX-006 self-scope).
- A13 Training Batch E (FIX-014 real E2E proof of P0 credit journey).
- (after Batch C) Marketplace **Batch D** (reviews org-scope `listReviews` + `x-audit` on verifyVendor/reviewCreative/fulfillOrder/deleteReview).

**Carry-forward loose ends (small, eng-confirm — slot anytime):**
- **Jobs module `/postings`** — apply the identical `@route("/association/jobs")` prefix fix (same dropped-prefix defect as marketplace G-01). Independent `04` pass.
- **Auth/RBAC `officerAuthMiddleware` dead-triplet** — decide delete-vs-amend (`/codex`).
- **Notifications stripe-webhook silent-fail** — `handlers/billing/handleStripeWebhook.ts` omits `organizationId` on 5 `createNotification` calls. `[CROSS-MODULE RISK]`.
- **3 pre-existing non-marketplace contract failures** surfaced by Batch B's full-suite run (impersonation / governance position-crud / platformadmin committees authority drift) — address in those modules' own passes.

**Track B — decision-gated (the bottleneck):**
- B1. P0 product decisions (elections G2 → documents Q1 → realtime PD-1), then headline P1s incl. marketplace **G-06** (advertising/vendor authority model) + **G-13** (review-deletion) + **vendor-identity** (FIX-007 ownership half), person Q-1/Q-4/Q-7. Full agenda in roadmap §13.

**Track C — consolidate + ship (after A + B land):**
- C1. Re-run `07-consolidate-roadmap.md`.
- C2. Milestone Step 6: `--update` the frozen `check:sdk-compat` baseline, then commit/PR the working tree.

## Env state (after Marketplace Batch B, 2026-06-12)

- Docker up (postgres + mailpit + minio + stripe-mock). DB `localhost:5432/monobase` migrated through **0066** + seeded. **Batch C needs the API + regen toolchain, NOT the frontend.**
- Live contract env **confirmed working** this pass: boot `cd services/api-ts && SERVER_PORT=7299 bun src/index.ts`, run `API_URL=http://localhost:7299 bun run test:contract` (or single-file `hurl` with the vars in the ENV NOTE). `hurl` 8.0.1 installed.
- Known-good baselines (AFTER Batch B): full `bun test` (api-ts) = **6151 pass / 1 fail / 4 todo** (the 1 fail PRE-EXISTING + UNRELATED: `registerEmailJobs`). Monorepo `tsc` = **0 errors (5/5)**. Full Hurl suite = **152/155 files** (3 pre-existing non-advertising fails). **This pass WILL change the api-ts unit count** (rewritten + new advertising tests).
- `check:sdk-compat` exits 1 **by design** (frozen baseline). If FIX-009/010 add NEW operationIds the baseline diverges further. **Do NOT `--update` until milestone Step 6.**

## Tree / commit rules

- NOTHING committed; working tree dirty (~290+ files across all prior AHA passes + A8/A8b + Marketplace Batch A/B). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. This pass ADDS/edits `advertising.tsp` (if needed), regen output, advertising handlers + repos + tests, `advertising-flow.hurl`, any stale advertising doc, and the fix report. No unrelated file deletes. Do not commit unless asked. NOTE: two files dirty from a prior membership-lifecycle pass (`core/domain-events.registry.ts`, `member/membership/utils/status-transitions.ts`) are NOT yours — leave them.

## Ground rules

- Follow `docs/aha/prompts/00-aha-shared-rules.md` (§2 sequence, §20 fix/TDD rules, §23 stop conditions). Primary guide: `docs/aha/prompts/04-module-or-group-fix-tdd.md`. Execute ONLY Marketplace/Ads/Reviews Batch C (FIX-008/009/010). Do NOT start Batch D, the jobs module, or any G-06 authority re-gate. Save the fix report and stop.

execute systematically
