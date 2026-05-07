# Phase 0: Test Retrofit & CI Foundation - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the test coverage safety net so all existing features have passing tests, enabling safe refactoring in later phases. This phase does NOT build new features — it tests what exists, stubs what doesn't, and wires CI/pre-commit infrastructure.

</domain>

<decisions>
## Implementation Decisions

### BR Coverage Strategy
- **D-01:** Test what exists, stub the rest. Write E2E tests for BRs with working features. For unimplemented BRs (BR-34 through BR-40), write contract-level tests that verify the API returns correct errors/stubs. This achieves 40/40 coverage without building new features in Phase 0.
- **D-02:** The 7 missing BRs are: BR-34 (Nomination Eligibility), BR-35 (Feed Content Moderation), BR-36 (National Dashboard Access), BR-37 (Job Posting Expiry), BR-38 (Marketplace Referral Disclosure), BR-39 (Committee Dissolution), BR-40 (Survey Anonymity).

### CI Pipeline Design
- **D-03:** Single `ci.yml` workflow with parallel jobs: lint+typecheck, unit tests, E2E tests (memberry app), contract tests. Triggers on push to main + pull requests.
- **D-04:** Keep existing `contract.yml` as-is or merge into the unified ci.yml — researcher should evaluate which is cleaner.

### Deterministic Fixtures
- **D-05:** Create shared test helper functions (`createTestUser`, `createTestOrg`, etc.) that generate fresh data per test suite. Each suite sets up what it needs in `beforeAll`, tears down in `afterAll`. No global seed dependency for tests.
- **D-06:** Existing seed.ts/seed-modules.ts remain for local dev — test helpers are a separate layer used only by test suites.

### Pre-commit Gate
- **D-07:** Wire Husky + lint-staged for typecheck + lint only (~15-30s). Fast enough to not slow developer flow. Unit/E2E tests run in CI only.
- **D-08:** The existing `/pre-commit` skill continues as the comprehensive manual check. Husky hook is the automated fast gate.

### Claude's Discretion
- Gray area selection and depth of exploration — user deferred to Claude's judgment on what matters most.
- Implementation details for test helpers (exact API shape, shared vs per-module helpers) — left to planner/researcher.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Testing Protocol
- `VERTICAL_TDD.md` — Test-first vertical slice protocol. Phase 0 tests must follow this pattern.
- `docs/ver-3/business/br-registry.json` — BR coverage registry. Shows which 33 BRs are complete and which 7 are missing.
- `docs/ver-3/business/business-rules.md` — Full BR definitions for all 40 business rules.

### Existing Test Infrastructure
- `apps/memberry/tests/e2e/` — 33 existing E2E spec files (Playwright). Follow these patterns for new tests.
- `apps/memberry/playwright.config.ts` — Playwright config (Chromium-only, 30s timeout, sequential).
- `specs/api/tests/contract/` — 40 Hurl contract test files. Follow existing patterns.
- `.github/workflows/contract.yml` — Existing CI workflow. Reference for service setup (Postgres, MinIO).

### Seed & Fixtures
- `services/api-ts/src/seed.ts` — Current seed script (to be supplemented, not replaced, by test helpers).
- `services/api-ts/src/seed-modules.ts` — Module-specific seed data.

### Project Requirements
- `.planning/REQUIREMENTS.md` — TEST-01 through TEST-08 requirements mapped to this phase.
- `.planning/ROADMAP.md` — Phase 0 success criteria (5 items).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/memberry/tests/e2e/helpers/` — Existing test helpers and action utilities. Extend these for new test helpers.
- `apps/memberry/tests/e2e/actions/` — Reusable Playwright action functions for member/officer flows.
- `specs/api/tests/contract/*.hurl` — 40 contract scenarios with auth flow patterns to follow.

### Established Patterns
- Sequential Playwright execution (1 worker) — tests may have implicit ordering dependencies. New tests should be independent.
- Hurl contract tests use hardcoded test secrets (`AUTH_SECRET: contract-test-secret-do-not-use-in-prod`) — CI services provision Postgres + MinIO with fixed creds.
- Bun native test runner for unit tests (`bun test src/**/*.test.ts`).

### Integration Points
- `.github/workflows/` — New ci.yml goes here alongside existing contract.yml.
- `package.json` (root) — Add lint/typecheck scripts if missing.
- `.husky/pre-commit` — New file for pre-commit hook.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User deferred implementation details to Claude's discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 0-Test Retrofit & CI Foundation*
*Context gathered: 2026-05-06*
