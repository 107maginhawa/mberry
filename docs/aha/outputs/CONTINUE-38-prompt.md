# Continuation prompt — AHA Step 38 (decision session — gated backlog ratification, START with Q8)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-38-prompt.md`.

> **NOT decision-free.** The decision-free engineering queue is drained (Step 37 closed the last item: FIX-012 follow-up). Every remaining AHA item is gated on a product/eng decision. This session SURFACES those decisions and gets the user's ruling BEFORE any code. Do NOT bake unilateral choices.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–37) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/module-fix-plans/documents-credentials-fix-report.md` §D2.10 (the gated-backlog list) and §D.9/§D2 (just-closed FIX-012 follow-up).
3. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — **Q8** (cert-schema backfill), **FIX-005 / FIX-006 / FIX-015** (Batch C, gated on Q8).

## Step 2 — Surface Q8 first (highest unlock)

**Q8 = cert-schema backfill.** It blocks the entire certificates Batch C/F chain (FIX-005/006/015 = certificates PDF generation + real `trainingId` migration). Read the FIX-005/006/015 rows + the Q8 root-cause in the ready-plan, then present the user a tight decision:

- What the gap is (in 2–3 lines): existing certificate rows lack a real `trainingId` linkage; the schema needs a backfill strategy before PDF gen / migration can land.
- The realistic options (e.g. backfill-from-credit-entry vs nullable-with-lazy-link vs require-reissue), each with cost + blast radius.
- Your recommendation + why.

Use AskUserQuestion. Get a ruling. Do NOT start the migration this session unless the user explicitly says go.

## Step 3 — Remaining ratification-pending items (only if user wants them this session)

Surface for ratify-or-change, each one a short AskUserQuestion:
- **documents Q1** (card-verify token) — shipped as engineering-default, ratification-pending.
- **elections FIX-002** position-identity — shipped as engineering-default, ratification-pending.
- **elections FIX-004** cancelled-election vote retention — soft-void vs hard-delete.
- **realtime PD-1/PD-2**, **surveys PD-1/2/3**, **platform-admin enforcement Q1–Q4/Q8**, **notifs Q1/Q2/Q3** — product calls, no eng default yet.

## Stop condition

After the user rules on Q8 (and any others they pick up), record each decision in the relevant fix-report/ready-plan, then STOP. Spin a NEW decision-free continuation prompt only for whatever the ruling unblocked (e.g. Batch C migration). Do NOT auto-chain into implementation.

execute systematically
