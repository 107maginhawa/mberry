# Continuation prompt — AHA Step 47 (DECISION + BUILD — Training & Credits: TC-DEC-01 paid-training fee path + TC-DEC-02 manual-entry verification gate)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-47-prompt.md`.

> **Training & Credits has two unresolved P1 gates — both product decisions, both block the module's monetization + credit-counting correctness.**
> (1) **TC-DEC-01** — paid trainings currently dead-end: the fee path throws `PAYMENT_REQUIRED` instead of charging. Decide whether V1 supports paid trainings at all, and if so via **proof-of-payment** (manual/offline confirm) or **Stripe** (Connect charge). (2) **TC-DEC-02** — when a member adds a **manual** CPD/credit entry, does it count toward their total **immediately**, or sit **behind a verification gate** (officer/admin approval) until confirmed? This decides the FIX-005 aggregate filter values (which entry statuses sum into the member's credit total).
> This is a Steps 40/44/45/46-style **decision+build** session: capture the 2 decisions, then build ONLY the unblocked, module-local slice, TDD. If a chosen option crosses into another module (e.g. TC-DEC-01 = Stripe pulls in billing-stripe), capture the decision, build only the training-local part, and mark the cross-module slice `[CROSS-MODULE RISK]` — do NOT half-build it.
>
> **Context:** Training decision-free batches A/B/C/D/E are DONE (+ Step 26/27 + the FIX-004 5th-path completion + a real-browser Batch E proof). The only training items left are exactly TC-DEC-01 and TC-DEC-02. Person Step 46 just landed (Q-4 gender scrub shipped; Q-1 G-02 enforcement carried to a cross-module chapters-directory `04`).

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–46) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it; this IS a build pass).
3. `docs/aha/module-fix-plans/training-credits-fix-ready-plan.md` — the **TC-DEC-01 / TC-DEC-02** decision entries, the **Batch B (paid-training)** scope, and **FIX-005** (the manual-entry aggregate filter).
4. `docs/aha/module-fix-plans/training-credits-fix-report.md` — confirm what already shipped (A/B/C/D/E + Step 26/27 + FIX-004 5th-path). Do NOT re-do shipped fixes.

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** vite proxy + toast (`sonner`) + auth + route patterns; and the exact training fee path (the `PAYMENT_REQUIRED` throw site), the credit-entry schema + status enum, the manual-entry create handler, and the credit-total aggregate (FIX-005). Determine for each decision whether the build is **module-local** (training/credit handlers) or **cross-module** (billing-stripe for a Stripe fee path).

## Step 2 — Capture the 2 decisions (TC-DEC-01, TC-DEC-02)

Use `AskUserQuestion` (one question per decision; default = the engineering recommendation marked "(Recommended)"). Capture answers verbatim. Per `feedback_defer_decisions`, if the user defers ("your call"), apply the recommended option.

| ID | Decision | Options (eng recommendation first) |
| --- | --- | --- |
| TC-DEC-01 | **Paid trainings in V1? If so, fee path?** | (a) **Proof-of-payment (Recommended)** — module-local: member submits proof, officer confirms, enrollment unlocks; no Stripe dependency; matches the existing dues proof-of-payment pattern. vs (b) **Stripe Connect charge** — cross-module (billing-stripe); richer but pulls in a coordinated billing pass. vs (c) **No paid trainings in V1** — remove the dead `PAYMENT_REQUIRED` path; all trainings free. |
| TC-DEC-02 | **Manual member credit entries: count immediately or behind a verification gate?** | (a) **Verification gate (Recommended)** — manual entries enter `pending` and only count once an officer/admin verifies; protects CPD integrity; FIX-005 aggregate sums only verified+auto entries. vs (b) **Count immediately** — manual entries count on submit (status `self-reported`); lighter, but unverified credits inflate totals. |

## Step 3 — Build the unblocked slice (TDD, per prompt 04)

- **TC-DEC-02 is module-local regardless of option** — build it: set the manual-entry status on create + make the FIX-005 credit-total aggregate filter on the decided status set. RED first (a member's manual entry does/does not count per the decision), then GREEN.
- **TC-DEC-01:** if (a) proof-of-payment or (c) no-paid → module-local, build it TDD. If (b) Stripe → capture the decision, build only the training-local enrollment/fee-state part, mark the charge integration `[CROSS-MODULE RISK]` → coordinated billing-stripe `04`; do NOT half-build the Stripe charge.
- Regenerate ONLY if TypeSpec changed: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate`. Never hand-edit generated files.

## Step 4 — TDD (RED first)

- Validator-inclusive backend/unit tests (kill any fake-green `_body` hand-build per the FIX-006 lesson). Prove the real behavior: fee-state transition + credit-total inclusion/exclusion by status.
- **E2E** likely `[BLOCKED BY ENVIRONMENT]` (no seeded auth; `:3004` redirects to `/auth/sign-in`) — prove via handler + aggregate nets and mark it. Pin Playwright 1.58.2 per `project_playwright_pin` if you add a spec.

## Step 5 — Validation

- `cd services/api-ts && bun test` (training/credit handlers + aggregate) — green; no regressions.
- `cd services/api-ts && bunx tsc --noEmit` (and `cd apps/memberry && bunx tsc --noEmit` if frontend touched) — clean across touched workspaces.
- Contract suite only if TypeSpec changed (or mark `[BLOCKED BY ENVIRONMENT]`).

## Stop condition

- After the unblocked slice is GREEN, append a **Step 47 — Training & Credits (TC-DEC-01 + TC-DEC-02)** section to `training-credits-fix-report.md` (decisions captured verbatim, RED→GREEN, files, cross-module notes, evidence, completion) and update `training-credits-fix-ready-plan.md` (TC-DEC-01/02 → decided; paid-training + FIX-005 → built-or-cross-module-deferred) + roadmap §13/§8 (mark the gates closed or note the cross-module carry-forward). Then STOP. Do NOT auto-chain to another gated module.

After training: the next P1 gates are **platform-admin Q1/Q8** (admin tier taxonomy) → **notifications Q3/Q1** (pref store of record + web-push descope) → **realtime PD-2/PD-3** (DM org-scoping + video V1) — each its own `[NEEDS PRODUCT DECISION]` session. Re-run `07-consolidate-roadmap.md` once a few land. The training G-02-style carry-forward, if any (e.g. a Stripe fee path), slots into billing-stripe's next `04`.

execute systematically
