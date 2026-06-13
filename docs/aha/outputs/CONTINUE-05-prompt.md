# Continuation prompt — AHA cross-cutting / platform FIX pass (post-05 audit)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-05-prompt.md`.

> Note: prompt 05 (the cross-cutting *audit*) and prompt 06 (db-schema audit) are ALREADY COMPLETE — `docs/aha/outputs/cross-cutting-pattern-audit.md` + `database-schema-audit.md` exist. This run executes the cross-cutting FIXES that audit surfaced (04 TDD discipline on platform/generator code), it does NOT re-run the audit.

---

Continue the AHA codebase audit — execute the remaining CROSS-CUTTING / PLATFORM FIXES surfaced by the prompt-05 cross-cutting audit. Finish ALL in-scope tasks below, then STOP.

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry

## Already done — do NOT redo
- Cross-cutting fixes F-1 (jobs `@route` P0), F-2 (unified generated-route integrity suite → `services/api-ts/src/handlers/__tests__/generated-route-integrity.test.ts`), F-4 (fake-green CI gate + `docs/TEST_HONESTY.md`) — DONE.
- Schema R-1 (comms `chat_room`/`chat_message` org_id backfill + NOT NULL → migration `0064`, applied + verified live), R-2 (surveys `person.deleted` anonymization) — DONE.
- 04 decision-free batches: billing-stripe Batch B (FIX-003/004/005/006), auth-rbac FIX-006/009, notifications-email FIX-008, surveys-polls Batch C (FIX-007/008/009), realtime-comms R-1. See each `docs/aha/module-fix-plans/<slug>-fix-report.md`.
- Env validation pass: `docs/aha/outputs/env-validation-pass.md`.
- Membership-lifecycle 6 product decisions RESOLVED + recorded in `docs/aha/module-fix-plans/membership-lifecycle-fix-ready-plan.md` (§Product Decisions — RESOLVED). Membership Batch E2/F is now unblocked but is a SEPARATE 04 pass — NOT in this run's scope.

## Task list — execute in order, 04 TDD discipline (RED test first, smallest correct root-cause change, regen-not-hand-edit, preserve tree). Use superpowers:test-driven-development.

1. **F-3 / P-2 / R-6 — generator emits non-optional `organizationId` for org-required ops** (PRIMARY). Source: `cross-cutting-pattern-audit.md` P-2 / §F-3; roadmap §10 F-3 + §11 R-6.
   - Problem: `services/api-ts/src/generated/openapi/validators.ts` has 30+ `organizationId: z.string().optional()` / `.uuid().optional()` lines for ops that require org context; the Zod validator field is silently org-skippable, so handlers must defensively re-check.
   - Step A (discovery — this is `[NEEDS CONFIRMATION]`, an engineering trace, NOT a product decision): determine the required-vs-optional org-id op set. Cross-reference which ops are org-scoped (mounted under `app.use('/association/*', … orgContextMiddleware())` in `app.ts`, or otherwise require `ctx.get('organizationId')`) vs ops where org id is genuinely optional (public/discovery/webhook/cross-org-admin). Produce the required-op list as evidence. Where a specific op is genuinely ambiguous, CONSERVATIVELY keep it optional and note it — do NOT flip a genuinely-optional op to required.
   - Step B (fix at the generator, NEVER hand-edit generated files): modify the TypeSpec→Zod emission in `services/api-ts/scripts/generate.ts` (zod emission ~L918-988; `.optional()` decision logic) so org-required path/body `organizationId`/`orgId` fields emit `z.string().uuid()` (non-optional) for the confirmed required set. Then regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.
   - Step C (test + regression): write a generator/validator unit test FIRST (RED) asserting the required-org ops emit non-optional org id (and that a known genuinely-optional op stays optional). Then GREEN. Run the F-2 net (`generated-route-integrity.test.ts`) + full `bun test` + tsc as the platform regression net (generator changes are platform-wide). Boot the API + run `scripts/run-contract-tests.ts` ($API_URL=:7213) to confirm no contract regression from the stricter validators. Medium risk — the regression nets are mandatory here.
   - If, after tracing, the required-op set cannot be determined safely for the bulk of ops, fall back to the audit's documented alternative: keep the generator as-is and add a one-line doc note that `orgContextMiddleware` is the sole org-presence authority and the validator field is advisory — then mark F-3 as documented-not-flipped. (Prefer the real generator fix if the trace is conclusive.)

2. **F-5 — `check:sdk-compat` additive-vs-breaking discrimination** (P3, DX, OPTIONAL — only if time/budget permits after F-3). Source: P-9 / §F-5; `SDK_BASELINE_OPS.json` (~1366 ops). Make the SDK-compat check distinguish additive (new ops) from breaking (removed/changed ops) instead of flagging both. Low risk, DX-only. If skipped, note it as deferred-P3.

## STOP / out of scope
- Do NOT re-run the 05 or 06 AUDIT (already complete).
- Do NOT touch P-7 (promote `assert-record-org` to `core/`) — `[DO NOT OVERBUILD]`, evidence is 1 strong + 1 partial; revisit only if a 3rd module needs the identical assertion.
- Do NOT touch P-8 (domain-event bus retry/aggregation) — V2, high blast radius, dedicated core-platform audit.
- Do NOT implement membership-lifecycle Batch E2/F (separate 04 pass against the recorded decisions), dues Batch C, or any product-decision-gated / Batch-E / later-batch work.
- Never make a product decision; never hand-edit `services/api-ts/src/generated/**` (regenerate via the pipeline).

## Env state
- Docker up (postgres+mailpit+minio+stripe-mock). DB `localhost:5432/monobase` migrated through `0064` + seeded. Query DB via `bun -e` against `DATABASE_URL=postgres://postgres:password@localhost:5432/monobase` (NOT docker compose exec). Boot API for live checks: `cd services/api-ts && PORT=7213 bun src/index.ts > /tmp/memberry-api.log 2>&1 &` (an instance may already be running on :7213).
- Known-good baseline AFTER the 04+env session: full `bun test` = 6001 pass / 1 fail / 4 todo (the 1 fail is PRE-EXISTING + UNRELATED: `registerEmailJobs > registers email.processor as interval job`, interval 30000 vs 1000). Hurl = 153/155 (2 pre-existing: impersonation 403→400, platformadmin committees 403→200; `member/governance/position-crud.hurl` is flaky/intermittent, governance area, not a regression). tsc: 0 errors.

## Tree / commit rules
- NOTHING committed; working tree dirty (~190+ files across prior AHA passes + this session). PRESERVE it. FORBIDDEN: `git reset --hard`, `checkout .`, `clean -fd`, `restore .`, `rm -rf`. Do not commit unless asked.

## Output
- Write a fix report at `docs/aha/module-fix-plans/cross-cutting-platform-fix-report.md` (use the 04 §12 15-section template; module/group = "Cross-Cutting / Platform", slug = "cross-cutting-platform"). Record F-3 (and F-5 if done): RED→GREEN evidence, required-op trace, regen confirmation, regression results (F-2 suite + full bun test + Hurl deltas vs the baseline above), and any [NEEDS CONFIRMATION] items left conservative.
- Then STOP and recommend the next step (likely: a product-decision pass to unblock the remaining gated batches — membership E2/F, dues Batch C, etc. — then a second 04 pass for those).

## Ground rules
- Follow `docs/aha/prompts/00-aha-shared-rules.md`. Reference `docs/aha/outputs/cross-cutting-pattern-audit.md` (§F-3/P-2), `database-schema-audit.md` (R-6), and `consolidated-remediation-roadmap.md` §10/§11.

execute systematically
