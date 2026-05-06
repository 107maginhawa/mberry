# Phase 0: Test Retrofit & CI Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 0-Test Retrofit & CI Foundation
**Areas discussed:** BR Coverage Strategy, CI Pipeline Scope, Deterministic Fixtures, Pre-commit Gate Design

---

## BR Coverage Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Test what exists, stub the rest | Write E2E tests for BRs with working features. For unimplemented BRs, write contract-level tests that verify the API returns correct errors/stubs. Gets to 40/40 coverage without building new features in Phase 0. | ✓ |
| Only test fully working features | Skip BRs where features are incomplete. Accept <40/40 in Phase 0, backlog the rest to the phase that completes the feature. | |
| Build missing features to enable tests | Implement enough of each feature to make the BR testable. More work but guarantees real 40/40. | |

**User's choice:** Test what exists, stub the rest (Recommended)
**Notes:** None — user accepted recommendation.

---

## CI Pipeline Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single workflow, parallel jobs | One ci.yml with parallel jobs: lint+typecheck, unit tests, E2E tests (memberry app), contract tests. Keeps config simple, runs fast via parallelism. ~5-8 min total. | ✓ |
| Separate workflows per concern | lint.yml, test-unit.yml, test-e2e.yml, contract.yml. More files but each is independently triggerable and debuggable. | |
| Minimal — typecheck + contract only | Smallest useful CI. Just typecheck and existing contract tests. Add E2E/lint later. Fastest to ship. | |

**User's choice:** Single workflow, parallel jobs (Recommended)
**Notes:** None — user accepted recommendation.

---

## Deterministic Fixtures

| Option | Description | Selected |
|--------|-------------|----------|
| Test helpers + per-suite setup | Create shared test helper functions (createTestUser, createTestOrg, etc.) that generate fresh data per test suite. Each suite sets up what it needs in beforeAll, tears down in afterAll. No global seed dependency. | ✓ |
| Global seed with known fixtures | Keep seed.ts but make it deterministic — fixed UUIDs, known emails, documented test accounts. Tests reference these known fixtures. Simpler but couples tests to seed data. | |
| Factory + database reset per test | Full isolation — truncate/recreate DB per test file with factory-generated data. Slowest but most reliable. Good for CI, painful for local dev. | |

**User's choice:** Test helpers + per-suite setup (Recommended)
**Notes:** None — user accepted recommendation.

---

## Pre-commit Gate Design

| Option | Description | Selected |
|--------|-------------|----------|
| Typecheck + lint only | Fast gate (~15-30s). Catches type errors and lint issues before commit. Unit/E2E tests run in CI only — too slow for pre-commit. Wired via Husky + lint-staged. | ✓ |
| Typecheck + lint + unit tests | Medium gate (~1-2min). Catches more but adds friction. May slow developer flow. | |
| Script-only, no git hook | Keep /pre-commit skill as manual check. No enforced git hook. Rely on CI to catch issues. Least friction, most risk. | |

**User's choice:** Typecheck + lint only (Recommended)
**Notes:** None — user accepted recommendation.

---

## Claude's Discretion

- Gray area selection: User said "help me decide whichever is best for the project" — Claude selected all 4 areas and recommended options.
- Exploration depth: User said "up to you" when asked about additional gray areas — Claude judged 4 areas sufficient.
- Implementation details (test helper API shape, CI job structure) deferred to researcher/planner.

## Deferred Ideas

None — discussion stayed within phase scope.
