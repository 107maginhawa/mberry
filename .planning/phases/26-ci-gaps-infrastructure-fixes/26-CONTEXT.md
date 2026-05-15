# Phase 26: CI Gaps + Infrastructure Fixes (T1) - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — grey areas auto-resolved)

<domain>
## Phase Boundary

All test quality gates are wired into CI — no regressions can slip through undetected. Three deliverables:
1. Wire `test:registry` into CI coverage-gate job
2. Eliminate meaningless `expect(true).toBe(true)` assertions from codebase
3. Add `test:br` script to root package.json for local BR coverage checks

</domain>

<decisions>
## Implementation Decisions

### D1: CI Integration Approach
**Decision:** Add `test:registry` as a step in the existing `contract.yml` workflow, running after contract tests pass. No separate workflow needed — keeps CI simple.
**Rationale:** Single CI workflow reduces maintenance overhead. Registry check is fast and belongs with quality gates.

### D2: Meaningless Assertion Fix Strategy
**Decision:** Replace `expect(true).toBe(true)` with real assertions that test actual behavior. If the test genuinely has no meaningful assertion (sentinel/placeholder), convert to a TODO comment and `.todo()` test marker so it's visible in test output.
**Affected files:**
- `services/api-ts/src/core/jobs.test.ts`
- `services/api-ts/src/tests/route-protection-association.test.ts`
- `services/api-ts/src/handlers/booking/jobs/slotGenerator.test.ts`
**Rationale:** Just deleting the assertion leaves tests passing vacuously. Real assertions or explicit `.todo()` markers make gaps visible.

### D3: test:br Script
**Decision:** Add `"test:br": "bun run scripts/br-coverage.ts"` to root package.json. No flags by default — `--ci` is for CI gate use only.
**Rationale:** Matches existing pattern (`test:registry`, `test:contract`). Developers run locally without flags; CI adds `--ci` for regression detection.

### D4: CI Coverage Gate Job
**Decision:** Add a `coverage-gate` job (or step block) to contract.yml that runs `test:registry` and `test:br --ci`. Both must pass for CI green.
**Rationale:** Separate from contract tests since these are static analysis, not HTTP tests. But can be same workflow to avoid repo complexity.

</decisions>

<code_context>
## Existing Code Insights

### CI Workflow
- `.github/workflows/contract.yml` — only workflow, runs Hurl + Schemathesis against live API
- No coverage-gate job exists yet
- Uses Bun, Postgres, MinIO services

### Test Scripts (root package.json)
- `test:registry` → `bun run testing/registry/report.ts` (exists)
- `test:contract` → `bun scripts/run-contract-tests.ts` (exists)
- `test:br` → MISSING (needs to be added)
- `lint:no-skips` → `bun scripts/lint-no-skips.ts` (exists, similar pattern)

### BR Coverage
- `scripts/br-coverage.ts` exists with `--ci` flag for regression gate
- Reads `docs/ver-3/business/br-registry.json`
- KNOWN_INCOMPLETE: BR-01, BR-03, BR-32, BR-33, BR-34 (5 items)

### Meaningless Assertions (3 files)
- `services/api-ts/src/core/jobs.test.ts`
- `services/api-ts/src/tests/route-protection-association.test.ts`
- `services/api-ts/src/handlers/booking/jobs/slotGenerator.test.ts`

</code_context>

<specifics>
## Specific Ideas

- The coverage-gate job doesn't need a running API — it's pure static analysis, so skip Postgres/MinIO services
- `test:br --ci` should be the CI command (exits non-zero on regression)
- Consider also adding `lint:no-skips` to CI if not already there

</specifics>

<deferred>
## Deferred Ideas

- Adding Vitest coverage thresholds (Phase 33 scope)
- Shallow-test lint script (Phase 33 scope)

</deferred>
