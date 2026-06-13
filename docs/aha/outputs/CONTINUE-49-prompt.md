# Continuation prompt — CONTINUE-49 (commit session work, then build re-scoped task 7: platform subscription billing)

Paste after `/clear`, or run: `execute docs/aha/outputs/CONTINUE-49-prompt.md`.
(context-mode knowledge base is preserved across /clear.)

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Caveman mode active.

---

## Where we are (CONTINUE-48 fully drained + carry-forwards executed)

The 3 P1 product-decision gates (platform-admin, notifications, realtime) were drained, then the standing P0s + cross-module `04` carry-forwards were executed. Net status of the 8-task backlog:

1. ✅ documents ID-card verify chain (Q1: unify `/verify/$id` + HMAC) — already shipped Step 40; closed residual fake-green AC-M11-006. 230 tests green.
2. ✅ elections G2 position identity (reference real `position(id)`) — already shipped Step 29/35; re-verified GREEN vs local pg. 126+6 green.
3. ✅ platform-admin FIX-009 feature-flag enforcement — BUILT `featureFlagGate` middleware + precedence (org>assoc>tier, fail-open) + route-walk. 15+700 green.
4. ✅ platform-admin FIX-010/016 impersonation — BUILT read-path nav audit (both ids) + fixed impersonate search (→`listPersons`). Identity-swap = V2. 293+48 green.
5. ✅ platform-admin FIX-011 TypeSpec migration — MIGRATED 13 hand-wired admin ops to TypeSpec + regen + SDK hooks. `createTicket` kept public. 434 green, tsc clean ×4.
6. ✅ notifications FIX-004 delivery enforcement — BUILT `type→category` resolver + `NotificationPreferencePort` + per-category gate, in-app-always + fail-open. 15+515+552 green. (`[NEEDS CONFIRMATION]`: topic↔category vocabulary split.)
7. ⏳ **billing — RE-SCOPED, NOT YET BUILT (this is the next build).** See below.
8. ✅ realtime PD-3 video V1 — BUILT no-infra slice: capacity cap (6) + no-recording invariant. 180 green. Media/TURN/ungate = V2 (flag stays default-off).

No migrations were needed in any pass — **next free migration = `0072`**. Working tree preserved; **no commits yet**.

## Founder decisions locked this session (apply, do NOT re-ask)
- **Elections G2** → reference real governance `position(id)` rows. (done)
- **Documents Q1** → unify id-card verify on the existing credential `/verify/$id` + HMAC family. (done)
- **Billing fee model** → platform fee = **tiered SaaS subscription**: a `pricing_tier` covers up to `maxMembers` for a flat monthly/annual price; **the org pays the platform**. Tier prices are admin DATA (via `createPricingTier`), not code.
- **Stripe Connect model** → **per-org direct charges**: member dues are collected on each org's OWN Stripe account (org = merchant of record). The platform takes **NO application_fee / skim** on member dues — so `payInvoice.ts platformAmount = 0` is **correct by design**, NOT a gap. Platform revenue = the subscription only. (Orgs needing dues collection must onboard their own Stripe Connect account — that onboarding flow is a separate future item, NOT this task.)
- **Refund-fee netting** → N/A (no per-transaction skim under this model).

---

## STEP 1 — commit the session work systematically (do this FIRST)

The tree is large and mixes this session's verified work with a big pre-existing uncommitted backlog (recovery-2025 + AHA Steps 31–47) that was NOT created or reviewed this session. At last check: ~521 changed files (≈285 already-staged, ≈117 unstaged, ≈273 untracked), branch = `main`.

Rules:
- **Branch off `main` first** — do NOT commit AHA/session work directly to `main`. e.g. `git switch -c aha/continue-49-subscription-billing` (pick a clear name).
- Do NOT use `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.
- Recommended approach (pick one, state which): EITHER
  (a) **Snapshot commit on the branch** — `git add -A` then ONE clear commit capturing the whole verified-green session state (simplest, safe on a branch; honest that it bundles prior uncommitted work), OR
  (b) **Grouped commits** — stage by concern (platform-admin RBAC+flag+impersonation+typespec; notifications; realtime; elections; documents; docs/aha reports; generated/sdk) and commit each with a conventional message. More work; cleaner history. Note the ~285 already-staged files include prior-session work you didn't make — disclose that in the commit body.
- End each commit message with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Run `cd services/api-ts && bunx tsc --noEmit` (expect exit 0) before committing as a sanity gate. The pre-existing `email/jobs/index.test.ts` `.env` failure (interval 1000 vs 30000) is NOT yours — ignore it.
- Do NOT push, do NOT open a PR (not asked).

## STEP 2 — build re-scoped task 7: platform subscription billing (TDD)

Update task #7 in_progress. Then run a `04`-style TDD pass.

**Existing (reuse, do NOT rebuild):** `handlers/platformadmin/repos/platform-admin.schema.ts` → `pricingTiers` (monthlyPrice/annualPrice/`maxMembers` null=unlimited/currency/features/isActive/sortOrder) + `subscriptions` (organizationId, pricingTierId, status enum trial/active/past_due/cancelled/expired, billingCycle monthly/annual, stripeSubscriptionId, unique-per-org). Handlers present: createPricingTier, updatePricingTier, listPricingTiers, getSubscription, listSubscriptions, cancelSubscription. Member-count source: `getPlatformSummary.ts` `activeMembers` (find the repo/query it uses). `handlers/billing/handleStripeWebhook.ts` exists.

**MISSING — build (TDD RED→GREEN):**
1. `createSubscription` handler (org → tier). Mirror the sibling subscription handlers' route + auth shape (NOTE: FIX-011 just moved ticket/breach/pricing/subscription **read** ops to TypeSpec — check whether subscriptions are now TypeSpec-modeled; if so add `createSubscription` to the TypeSpec module + full regen `specs/api build → api-ts generate → SDK regen`; if still hand-wired, hand-wire it). Enforce unique-per-org. Apply the platform-admin tier RBAC guard (`requireAdminTier`) consistent with siblings.
2. **Member-count → tier validation** (pure helper): chosen tier's `maxMembers === null` (unlimited) always OK; else org `activeMembers <= maxMembers`, else reject with a clear error. Optionally pick the cheapest covering tier when none chosen — only if clean.
3. **Stripe subscription wiring** populating `stripeSubscriptionId`: wire `stripe.subscriptions.create` behind the existing Stripe client wrapper; **STUB the Stripe SDK in tests** (Mock-Classification: APPROPRIATE — external gateway); live call = `[BLOCKED BY ENVIRONMENT]`. Prove the wiring with a stub returning a fake `sub_...` id and assert it persists. If real wiring is too entangled without live keys, persist the row correctly + leave `stripeSubscriptionId` null with a `[BLOCKED BY ENVIRONMENT]` TODO — but the row + member-count validation MUST work.
4. **Verify `past_due` transition** on payment-failure in `handleStripeWebhook.ts` (`invoice.payment_failed` → `past_due`); add/extend a test; add the minimal branch if missing.

**Do NOT build:** the dropped application_fee/Connect skim (per-org direct charges, no skim — `platformAmount=0` stays); org Stripe-Connect-onboarding flow (separate future item); member-dues changes.

**Ground rules:** TDD RED→GREEN, no fake-green/`_body` hand-builds; pre-flight reads (vite proxy no `/api`, `sonner`, auth, route patterns, sibling handlers); migrations hand-written (no `db:generate`, next `0072`, idempotent + journal + verify on local pg `monobase`) — likely NONE needed; regen only if TypeSpec changed (never hand-edit `generated/**` except migrations); preserve dirty tree, no destructive git, no commit unless asked; E2E/live-Stripe `[BLOCKED BY ENVIRONMENT]`; ignore the email/jobs `.env` fail.

**Validate:** `cd services/api-ts && bun test src/handlers/platformadmin/ src/handlers/billing/` green + no regressions; `bunx tsc --noEmit` clean across touched workspaces (incl. sdk-ts/admin/memberry if SDK regenerated); paste REAL counts. Append a dated fix-report section to `docs/aha/module-fix-plans/billing-stripe-fix-report.md`; mark the re-scoped item in the billing-stripe fix-ready plan; mark task #7 complete. Then reconcile the roadmap (note billing subscription-billing done; member-dues = per-org direct charges, no skim).

## STEP 3 — close out
After task 7: all 8 backlog tasks resolved. Surface anything still `[NEEDS CONFIRMATION]`/V2 (notifications topic↔category vocab; realtime video media/TURN; platform-admin FIX-013 admin UI now unblocked; impersonation identity-swap V2; org Stripe-Connect-onboarding). Recommend whether to commit task-7 work + open a PR. STOP — do not auto-start new modules without the user.

execute systematically — apply locked decisions, do not re-ask, TDD, do not half-build, verify before claiming done.
