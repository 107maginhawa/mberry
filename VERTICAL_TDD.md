# Vertical TDD Development Protocol

**Scope**: New product slices following the TypeSpec → api-ts → sdk-ts → app path.

Auth (Better-Auth), WebSocket signaling, Rust crates (cadence, api-ts-embedded), and Tauri have their own testing patterns — see [Rust & Native Testing](#rust--native-testing) below.

Existing base modules are the reference target. They demonstrate production-quality patterns. When the testing infrastructure is in place, they should be retrofitted with tests. **New modules MUST follow this protocol from the start.**

---

## Two Rules

### Rule 1: Tests Before Code, Always

For every unit of work — new module, new endpoint, new component, bugfix — tests are written FIRST. Implementation comes second.

**Why**: Tests written after implementation only confirm your assumptions. Tests written before implementation define the contract, catch design mistakes early, and ensure edge cases are covered before you write a line of production code.

### Rule 2: Vertical Slices, Never Horizontal Layers

Each module is built end-to-end (API contract → backend tests → backend → SDK regen → frontend tests → frontend → E2E → verify) before touching the next module. Never batch work horizontally ("all migrations first", "all handlers first", "all frontends last").

**Why**: Horizontal phases hide integration failures until the end. Frontend work routinely reveals API design gaps — discovering them after 6 backends are "done" means reworking all 6.

---

## Per-Module Sequence (11 Steps)

Every module follows this exact sequence. Do NOT skip steps. Do NOT reorder.

```
Step 1:  TypeSpec        → Define API contract in specs/api/src/modules/{module}.tsp
Step 2:  Codegen         → cd specs/api && bun run build
                         → cd services/api-ts && bun run generate  (includes db:generate)
Step 3:  Backend Tests   → Write FAILING unit tests (RED)
Step 4:  Backend Impl    → Implement schemas, repos, handlers until tests PASS (GREEN)
Step 5:  Contract Tests  → Write FAILING Hurl scenarios (RED)
Step 6:  Contract Impl   → Fix endpoints until Hurl tests PASS (GREEN)
Step 7:  SDK Regen       → cd specs/api && bun run build
                         → cd packages/sdk-ts && bun run generate
Step 8:  Frontend Tests  → Write FAILING component + hook tests (RED)
Step 9:  Frontend Impl   → Implement components + hooks until tests PASS (GREEN)
Step 10: E2E Test        → Write Playwright spec for the module's critical user journey
Step 11: Verify Gate     → ALL green before next module (see Gate Enforcement)
```

**Skip rules:**
- Backend-only work (audit, email, notifs, storage): skip steps 7-10
- Frontend-only work (API exists): skip steps 1-6
- Bug fix: may only need steps 3-4 or 8-9, but ALWAYS write the failing test first
- Modules with no user-facing journey: skip step 10

---

## TDD Red-Green-Refactor Cycle

For each test file:

1. **RED**: Write test cases that describe the expected behavior (from PRD, wireframes, or business rules). Run them. They MUST fail. If they pass, your tests aren't testing anything useful.

2. **GREEN**: Write the minimum production-quality implementation to make the tests pass. In a boilerplate, this means reference-quality code — not throwaway code. Tests should be comprehensive enough that passing them produces implementations worth copying.

3. **REFACTOR**: Clean up the implementation while keeping tests green. Re-run after every change.

---

## Test Layers

| Layer | Tool | Location | What It Tests |
|-------|------|----------|---------------|
| **Backend unit** | `bun:test` | `services/api-ts/src/handlers/{module}/repos/{entity}.repo.test.ts` | Repos (CRUD, validation, edge cases) |
| **Backend unit** | `bun:test` | `services/api-ts/src/handlers/{module}/{handler}.test.ts` | Handlers (I/O, auth, errors) |
| **Contract** | Hurl | `specs/api/tests/contract/{scenario}.hurl` | Full HTTP request/response per journey |
| **Frontend unit** | `bun:test` | `apps/{app}/src/features/{module}/components/{component}.test.tsx` | Components, hooks, schemas |
| **E2E** | Playwright | `apps/{app}/tests/e2e/{journey}.spec.ts` | Critical user journeys end-to-end |

### Contract Test Organization

Hurl tests are organized **per user journey or feature flow**, not per module. A module may have multiple scenario files. Follow existing patterns in `specs/api/tests/contract/README.md` and `COVERAGE.md`.

**Prerequisites**: Contract tests require a running API + supporting services:
```bash
# Start dependencies (Mailpit, stripe-mock, etc.)
cd services/api-ts && docker compose -f docker-compose.deps.yml up -d

# Start the API
cd services/api-ts && bun dev

# Run contract tests
bun run test:contract
```

Tests start from a clean DB and capture auth tokens via `[Captures]` — no fixtures needed.

### Generated Files — Do Not Test

Never write tests for generated files:
- `services/api-ts/src/generated/*` (routes, validators, registry)
- `packages/sdk-ts/src/generated/*` (client, types)

Test the integration points where your code consumes generated code.

---

## Gate Enforcement

A module is NOT complete until all applicable checks pass:

```bash
# Backend unit tests
cd services/api-ts && bun test

# Contract tests
bun run test:contract

# Frontend unit tests (if frontend work was done)
cd apps/account && bun test

# Type checking
cd services/api-ts && bun run typecheck
cd apps/account && bun run typecheck

# E2E (if user-facing journey exists)
cd apps/account && bun run test:e2e
```

**Do NOT start the next module until the current module passes ALL applicable gates.**

No regressions: verify previously completed modules still pass.

### CI Coverage

Current CI (`.github/workflows/contract.yml`) runs OpenAPI build, api-ts codegen, Hurl contract tests, and Schemathesis fuzzing. It does NOT run unit tests, frontend tests, or typecheck. Full gate enforcement is currently manual — CI expansion is a separate initiative.

---

## What Tests Should Cover

### Backend tests — derive from:
- **TypeSpec definition**: declared error codes → test each one
- **PRD business rules**: edge cases → test each one
- **Data model constraints**: required fields, enums, FKs, status machines → test transitions and boundaries
- **Auth requirements**: which roles can access → test allowed and denied

### Frontend tests — derive from:
- **Wireframes**: what renders, what's interactive, what's hidden → test render and interaction
- **User journeys**: PRD user journey descriptions → test the UI flow
- **Design system**: visual states, empty states, loading states, error states → test each
- **Accessibility**: keyboard nav, screen reader labels, focus management → test a11y

### Contract tests — derive from:
- **OpenAPI spec**: status codes, response shapes, required fields → validate the wire format
- **Auth requirements**: which endpoints need auth, which roles → test 401/403 paths
- **End-to-end flows**: multi-step API workflows → test the full sequence
- Keep tests implementation-agnostic — no assumptions about handler internals, log lines, or DB row counts

---

## Rust & Native Testing

### Rust Crates (cadence, api-ts-embedded)

- Test framework: `cargo test`
- Tests: `#[cfg(test)] mod tests` in same file, or `tests/` directory
- Cadence full suite needs Postgres + Valkey: `cd services/cadence && docker compose -f docker-compose.deps.yml up -d`
- Run: `cd services/cadence && cargo test`
- Run: `cd services/api-ts-embedded && cargo test`

### Tauri App (apps/account/src-tauri)

- Rust compilation check: `cd apps/account/src-tauri && cargo check`
- No separate test suite currently — tested via contract + E2E

### iOS (when apps/ios/ exists)

- Unit: XCTest in `apps/ios/MonobaseTests/`
- UI: Maestro YAML flows in `apps/ios/.maestro/`
- Run: `maestro test apps/ios/.maestro/`

---

## Dependency Ordering

When multiple modules are in scope, process them in dependency order. If Module B references Module A's types, complete Module A's full pass first.

```
Example: organization → person → booking → billing
Complete each fully before starting the next.
```

---

## Rationalizations to Reject

These thoughts mean STOP — you are about to violate the protocol:

| Rationalization | Why It's Wrong |
|----------------|----------------|
| "I'll do all migrations first, then all handlers" | Each migration is validated by its handler tests. Batching hides failures. |
| "I'll batch similar handlers" | Each handler has unique business rules needing unique test coverage. |
| "I'll write all tests at the end" | Tests written after implementation confirm assumptions, not correctness. |
| "I'll add tests in a follow-up" | There is no follow-up. Tests are part of the work, not a separate task. |
| "This is too simple to need tests" | Simple code has simple tests. Write them. They take 2 minutes. |
| "I'll test it manually" | Manual testing doesn't persist. The next developer gets no safety net. |
| "Let me just get the frontend working first" | Frontend without backend tests means you're building on unverified foundations. |
| "I know this works, I've done it before" | Your confidence is not a test suite. Write the test. |
| "The generated code doesn't need tests" | Generated code is consumed by your code. Test the integration points. |

---

## Example: Adding a "Reviews" Module

```
1. TypeSpec → create specs/api/src/modules/reviews.tsp

2. Codegen:
   cd specs/api && bun run build
   cd services/api-ts && bun run generate

3. Backend Tests (RED):
   - Write services/api-ts/src/handlers/reviews/repos/review.repo.test.ts
     → CRUD, star rating 1-5 validation, one review per person per entity
   - Write services/api-ts/src/handlers/reviews/createReview.test.ts
     → 201 on valid, 400 on missing fields, 409 on duplicate
   - Run: cd services/api-ts && bun test src/handlers/reviews/ → ALL FAIL

4. Backend Impl (GREEN):
   - Write review.schema.ts, review.repo.ts, createReview.ts
   - Run: bun test src/handlers/reviews/ → ALL PASS

5. Contract Tests (RED):
   - Write specs/api/tests/contract/submit-review.hurl
   - Run: bun run test:contract → FAILS on review endpoints

6. Contract Impl (GREEN):
   - Fix routing/validation → Hurl PASSES

7. SDK Regen:
   cd specs/api && bun run build
   cd packages/sdk-ts && bun run generate

8. Frontend Tests (RED):
   - Write apps/account/src/features/reviews/components/review-form.test.tsx
     → renders star selector, validates required fields, submits mutation
   - Write apps/account/src/features/reviews/components/review-list.test.tsx
     → renders reviews, shows empty state, handles loading
   - Run: cd apps/account && bun test src/features/reviews/ → ALL FAIL

9. Frontend Impl (GREEN):
   - Write review-form.tsx, review-list.tsx, schema.ts
   - Run: bun test src/features/reviews/ → ALL PASS

10. E2E:
    - Write apps/account/tests/e2e/submit-review.spec.ts
    - Run: bun run test:e2e → PASSES

11. Verify Gate:
    cd services/api-ts && bun test           → ALL PASS (no regressions)
    cd apps/account && bun test              → ALL PASS
    bun run test:contract                    → ALL PASS
    cd services/api-ts && bun run typecheck  → CLEAN
    cd apps/account && bun run typecheck     → CLEAN
    Module complete. Proceed to next module.
```

---

## Enforcement Across Tools

This protocol is referenced by:
- `CLAUDE.md` — Claude Code sessions
- `CONTRIBUTING.md` — All developers
- `/develop` skill — Orchestrator dispatches skills in this order
- `/handler` skill — Backend TDD workflow
- `/frontend-module` skill — Frontend implementation (must include tests)
- `/pre-commit` skill — Runs typecheck + tests before commit
- `/module-review` skill — Validates completeness post-implementation
- `/test-contract` skill — Runs Hurl contract suite

If any tool, skill, or agent attempts to skip tests or batch horizontally, the protocol takes precedence.
