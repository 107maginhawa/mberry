# Continuation prompt — AHA Step 30 (next gated `04`: documents-credentials Batch A verify-chain, Q1 = reuse credential token)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-30-prompt.md`.

> **Decisions already captured (Step 29) — do NOT re-ask.** Track B membership E2 was RATIFIED + CLOSED (all eng defaults). The 3 standing P0s are decided and recorded in their `*-fix-ready-plan.md` §"Decisions — Step 29": elections G2 = honor `position` FK (Batch F DONE this step), **documents Q1 = reuse the EXISTING credential token (do NOT invent a new `/verify/:token` HMAC route)**, realtime PD-1 = auto-join org channels + officer-only creation. This step runs the next gated `04` pass: **documents-credentials Batch A verify-chain**. Fix-only, TDD, manual, no autorun.

---

Continue the AHA remediation. CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md` and `docs/aha/prompts/04-module-or-group-fix-tdd.md`.
2. `docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` — Batch A / FIX-001/002/012/014 (verify-chain), §"Decisions — Step 29" (Q1 resolved = reuse credential token).
3. `docs/aha/module-gap-plans/documents-credentials-gap-plan.md` — Q1 evidence (`id-card.tsx:82`, `getMyIdCardPdf.ts:181`, `verify/$token.tsx:22`, `app.ts:514`) for context only.
4. Prior fix-report `docs/aha/module-fix-plans/documents-credentials-fix-report.md` (B1/B2 already done) — append, don't overwrite.

## Step 2 — Run documents-credentials Batch A verify-chain (one `04` pass)

Per `04-module-or-group-fix-tdd.md`, execute ONLY Batch A (verify-chain). **Q1 is DECIDED: reuse the existing credential token + existing `verify/$token` route. Do NOT mint a new HMAC `GET /verify/:token` (roadmap §17 "Do Not Build").** Confirm what the ID-card QR/share-link currently resolves to, make the verify endpoint validate the existing credential token, freeze the URL contract on the existing surface.

TDD discipline:
- RED test first (real-DB or contract where practical — match the verify flow, not selectors) → confirm it fails for the expected reason.
- Minimal GREEN. Smallest correct change. No new token system, no schema/migration unless the verify-chain genuinely requires it (Q8 cert re-key is a SEPARATE gated Batch F — out of scope here).
- Run validation (focused test → module tests → typecheck). Don't claim a command passed unless it ran.
- Append a Batch A section to `documents-credentials-fix-report.md` (the `04` §12 structure).

## ENV / discipline

- Working tree intentionally dirty (~recovery-2025-incident). PRESERVE. **FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.** No autorun. No commit unless asked.
- Known-good baselines (do NOT regress): api-ts `bun test` **6173 pass / 1 pre-existing fail (`registerEmailJobs` interval 30000-vs-1000, unrelated) / 3 todo**; `tsc` 0 errors (5/5 workspaces); Hurl 152/155; DB migrated through 0068. Do NOT `--update` `docs/quality/SDK_BASELINE_OPS.json` until milestone Step 6.
- Step 29 added: elections Batch F (FIX-002) DONE — `resolve-election-positions.ts`, createElection/updateElection, seed `layer-3-modules.ts`, shared `make-ctx.ts` additive `.returning()`, `position-identity.integration.test.ts`. Don't regress these.

## Stop condition

After Batch A lands + its fix-report section saved, STOP. Recommend exactly one next gated batch per consolidated-roadmap §8 (next up: **realtime FIX-003/007 channel model, PD-1**). Do NOT auto-chain to another module.

execute systematically
