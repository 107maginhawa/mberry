# Phase 9: Test Infrastructure Hardening - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Eliminate hardcoded credentials from tests, wire all workspace unit tests into CI, and expand pre-commit to run full verification. Requirements: TEST-02, TEST-03, TEST-08.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/memberry/tests/e2e/helpers/auth.ts` — signUp/signIn helpers with dynamic emails, hardcoded API_BASE and password
- `apps/memberry/tests/e2e/helpers/fixtures.ts` — createTestUser/createTestOrg/createTestMember with hardcoded API_BASE
- `.husky/pre-commit` — currently only runs `bunx lint-staged`
- `.github/workflows/ci.yml` — has unit-tests job running api-ts + memberry only

### Established Patterns
- CI uses Bun 1.2.21, postgres:16-alpine, minio services
- E2E helpers use `page.evaluate()` for API calls with `credentials: 'include'`
- Dynamic test data: timestamp-based emails, random suffixes

### Integration Points
- CI `unit-tests` job needs additional workspace test commands
- Pre-commit hook at `.husky/pre-commit` — replace `bunx lint-staged` or add steps
- E2E helpers need API_BASE from env or config, not hardcoded `localhost:7213`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
