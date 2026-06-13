# Continuation prompt — AHA Step 29 (Track B gate: capture the membership E2 + P0 product decisions, then run the unblocked `04` passes)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-29-prompt.md`.

> **This is the product-decision gate.** Step 28 refreshed `consolidated-remediation-roadmap.md` and concluded `BLOCKED BY PRODUCT DECISION`: the decision-free fix track is drained; all remaining non-deferred work needs product input. This step CAPTURES the user's decisions (Track B membership E2 ratification + the 3 standing P0s), records them, and THEN runs the now-unblocked `04` fix passes in §8 order. **Do NOT auto-decide the Track B / P0 questions — ASK the user.** Decision-capture + fix, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/outputs/consolidated-remediation-roadmap.md` — **§13 (Product Decisions Needed)**, **§8 (Recommended Fix Sequence — the gated order)**, **§18/§19**.
3. `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` §8 + its "Product Decisions — RESOLVED (2026-06-12)" addendum (the engineering defaults already implemented for Track B).

## Step 2 — ASK the user (do NOT decide for them)

Use `AskUserQuestion` to capture answers. Present the **engineering default** for each so the user can ratify-as-is or override.

**Track B — Membership E2 ratification** (E2/F already implemented on these defaults via migrations 0065/0066; user must ratify):
- TB-1 Reinstate semantics — default: **LAPSED-ONLY** (REMOVED terminal/irreversible)
- TB-2 RESIGNED actor — default: **OFFICER-RECORDED ONLY** (no member self-resign in V1)
- TB-3 EXPIRED threshold — default: **DROPPED from V1 vocabulary**
- TB-4 Expulsion-V1 — default: **DEFERRED TO V2** ⚠️ user previously signaled interest ("2?"); if they want it in V1 this REOPENS build work (route + `expelled_at` migration + M04 integration)
- TB-5 Re-application strategy — default: **REUSE EXISTING ROW** (no index change)

**Standing P0s** (each unblocks a gated `04`):
- elections **G2/FIX-002** — position identity: governance `position` FK vs module-local jsonb slots
- documents **Q1** — card-verify token/URL: reuse credential token vs new HMAC `GET /verify/:token`
- realtime **PD-1** — channel membership: auto-join vs explicit join; who may create channels

(Optionally also capture the headline P1s in §13 if the user wants to clear more in one sitting: training TC-DEC-01/02, person Q-1/Q-4, notifications Q3.)

## Step 3 — Record the decisions

Append a dated "Decisions — Step 29" section to the relevant `*-fix-ready-plan.md` files (membership Track B ratification outcome; elections G2; documents Q1; realtime PD-1). Decision-recording only — do NOT rewrite the existing plan body. (If the user ratifies all Track B defaults as-is, note "Track B CLOSED — defaults ratified, no reopen.")

## Step 4 — Run the unblocked `04` passes (one batch, then STOP per pass)

Per `04-module-or-group-fix-tdd.md`, execute ONLY the passes the answered decisions unblock, in §8 gated order. Highest-value first:
1. If TB-4 reopened → membership E2.1 (route + `expelled_at` migration + M04). Else skip.
2. elections Batch F (G2/FIX-002) — schema/migration/seed/FE, after confirming runtime 5xx via FIX-007.
3. documents Batch A (Q1) verify-chain.
4. realtime FIX-003/007 (PD-1) channel model.

TDD discipline: RED test first → minimal GREEN → run validation → save a `*-fix-report.md` section per batch. **Do one batch per `04` pass; STOP after each and report; do not chain to the next module without the user.**

## ENV / discipline

- Working tree intentionally dirty (~recovery-2025-incident). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do not regress): api-ts `bun test` 6030 pass / 1 pre-existing fail / 4 todo; `tsc` 0 errors (5/5 workspaces); Hurl 152/155; DB migrated through 0068. Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.

## Stop condition

After capturing decisions + running the first unblocked batch (one `04` pass), save its fix-report section and STOP. Recommend exactly one next action (next gated batch, or re-run `07` to re-sequence). Do NOT auto-decide remaining product questions.

execute systematically
