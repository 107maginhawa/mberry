# Continuation prompt — AHA Prompt 04 automated sequential fix run

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-04-prompt.md`.

---

Continue the AHA codebase audit — prompt 04, automated SEQUENTIAL batch run (fix per module/group, one at a time, TDD).

Context:
- CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry
- Prompt 03 complete: all 14 fix-ready plans exist at docs/aha/module-fix-plans/<slug>-fix-ready-plan.md. Run log: docs/aha/outputs/prompt-03-run-log.md (per-module organizer decision, active-fix count, recommended first-batch name, blocked/product-decision counts).
- All 14 modules = PARTIALLY READY. Each has ONE unblocked recommended first batch (§13 of its fix-ready plan). Later batches are gated by product decisions, shared/platform (Batch E), db/schema (Batch F), or environment blockers — those are OUT of scope for this run.
- Ground rules: docs/aha/prompts/00-aha-shared-rules.md. Prompt to execute: docs/aha/prompts/04-module-or-group-fix-tdd.md. Raw gap plans: docs/aha/module-gap-plans/<slug>-gap-plan.md. Audit index: docs/aha/outputs/module-audit-index.md. KG: docs/aha/kg/.

Task:
Execute docs/aha/prompts/04-module-or-group-fix-tdd.md SEQUENTIALLY for all 14 modules in queue order, one module at a time. NOT parallel — these subagents edit the shared working tree, run validation, and some touch shared files/migrations, so concurrent runs would collide/corrupt. Each module's 04 must FULLY finish (fix-report written + validation run) before the next module starts. One general-purpose subagent per module; invoke /using-superpowers before implementing (04 §3). Fully automated, no approval stops between modules.

Per module, the subagent must:
1. Load its fix-ready plan (PRIMARY guide), raw gap plan (context only), shared rules, audit index, kg.
2. Execute ONLY the §13 "Recommended First Fix Batch" — plus any immediately-following batch that the fix-ready plan §4 marks "run in current 04 pass" with NO gate. STOP the module at the first batch marked later / requires product decision / requires shared-platform fix / requires db-schema fix / blocked by environment. Do NOT run gated/deferred/unselected batches.
3. TDD per 04 §6 + the plan's §5 Test-First Plan: write/extend the failing test FIRST, confirm it fails for the right reason (RED), implement the smallest correct root-cause fix, confirm GREEN, run relevant validation (typecheck + focused tests — actually run them; never fake-green, never weaken/delete assertions to pass). Prefer extending existing tests; E2E/Playwright for core journeys only.
4. Git safety (04 §5): check working tree first; minimal targeted edits; NO destructive git (no reset --hard / checkout . / clean -fd / restore . / rm -rf); preserve unrelated changes; NO commits.
5. Write ONLY docs/aha/module-fix-plans/<slug>-fix-report.md using the full 15-section template in 04 §12. Stop after writing.

Hard constraints:
- Fix only P0 / P1 / selected P2 / V1 REQUIRED / selected V1 RECOMMENDED items inside the selected batch(es). NEVER implement V2 DEFERRED, DO NOT ADD, deferred, blocked, or later-unselected-batch items — even if they look easy.
- NEVER make a product decision. If a fix needs one ([NEEDS PRODUCT DECISION] / [BLOCKED BY MISSING SPEC] / [BLOCKED BY ENVIRONMENT]), skip it, mark it Blocked in the report, and continue. Do not guess, do not stub a fake answer.
- Shared/platform (Batch E) and db/schema (Batch F) changes are gated to later batches in every plan — do NOT pull them into the first-batch run unless the fix-ready plan's §13 names that batch as the recommended first batch (e.g. marketplace-advertising Batch A is a shared generated-route fix). When a shared/platform/schema change is in scope, keep it minimal and label [SHARED DEPENDENCY] / [CROSS-MODULE RISK] in the report.
- Do NOT commit. Do NOT run prompt 05 or 06. A subagent must NOT advance to another module — only the orchestrator advances to the next module in the queue.

Queue order (slug) — remediation priority (P0 modules first):
membership-lifecycle, dues-payments, billing-stripe, training-credits, elections-governance, communications, realtime-comms, platform-admin, person-profile, documents-credentials, marketplace-advertising, notifications-email, auth-rbac, surveys-polls

On subagent failure: retry once, then mark the module [BLOCKED] and continue to the next. Session-limit recovery: if subagent_tokens returns 0 (account session limit), the killed subagent wrote nothing usable — re-dispatch it after the reset. Verify each <slug>-fix-report.md exists and ends with §15 (Recommended Next Step) before marking the module done; capture its §14 Completion Decision (COMPLETE / PARTIALLY COMPLETE / BLOCKED / FAILED).

After all 14: write docs/aha/outputs/prompt-04-run-log.md (per module: slug, batch executed, completion decision, counts of fixes Fixed/Partially-Fixed/Not-Fixed/Blocked, tests added/updated, validation result pass/fail/blocked, remaining-gap count, report path) and report a summary + recommended next step. Likely next step: a product-decision pass (resolve the [NEEDS PRODUCT DECISION] items the plans surfaced) to unblock the gated later batches, then a second 04 pass for those batches; plus prompt 05 (cross-cutting) / 06 (db-schema) now that several Batch E/F dependencies are visible. Do not commit. Do not run those automatically — stop and recommend.

Notes vs the 03 run: (1) 04 is SEQUENTIAL (not parallel) because it mutates the shared codebase; (2) 04 does real TDD implementation + validation, so this run is heavier and longer than 03's doc-organize; (3) per-module scope is the recommended FIRST batch only — later/gated batches are intentionally deferred to follow-up passes after product decisions.

execute systematically
