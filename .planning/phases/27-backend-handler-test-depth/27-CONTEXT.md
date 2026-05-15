# Phase 27: Backend Handler Test Depth (T2) - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous — grey areas auto-resolved)

<domain>
## Phase Boundary

Every handler test calls its real handler function — no pure-function stubs remain. Specifically:
1. `br-33.election-integrity.test.ts` imports and calls real election handlers with makeCtx+stubRepo
2. `br-34.nomination-eligibility.test.ts` imports and calls real nomination handlers
3. `br-p2-gap.test.ts` calls real handlers instead of asserting on hardcoded objects
4. Zero tests define and assert on inline functions without importing production code

</domain>

<decisions>
## Implementation Decisions

### D1: Test Rewrite Strategy
**Decision:** Rewrite each test file to import the actual handler functions (castVote, createNominee, updateElectionStatus, etc.) and use makeCtx+stubRepo pattern from `services/api-ts/src/test-utils/make-ctx.ts`. Keep the same business rule assertions but route them through handler execution.
**Rationale:** Pure-function stubs test logic that doesn't exist in production code. Handler-level tests verify real code paths.

### D2: stubRepo Pattern
**Decision:** Use the established stubRepo pattern: stub the repository methods each handler calls, then invoke the handler with makeCtx, assert on the Response. Use restoreRepo in beforeEach to avoid cross-test pollution (Bun parallel execution issue).
**Rationale:** Pattern already proven in platformadmin tests (6 files use it). No new patterns needed.

### D3: BR-33 Test Scope
**Decision:** Rewrite BR-33 tests to call castVote handler (double-vote prevention), updateElectionStatus (results visibility), createNominee (minimum candidates check). Each current pure-function test maps to a handler call.
**Affected files:**
- `services/api-ts/src/handlers/elections/br-33.election-integrity.test.ts`
- `services/api-ts/src/handlers/elections/castVote.ts` (handler under test)
- `services/api-ts/src/handlers/elections/updateElectionStatus.ts` (handler under test)
- `services/api-ts/src/handlers/elections/repos/` (repo to stub)

### D4: BR-34 Test Scope
**Decision:** Rewrite BR-34 tests to call createNominee handler with eligibility scenarios. The inline `checkNominationEligibility` function currently tested should be replaced by the real handler's eligibility check path.
**Affected files:**
- `services/api-ts/src/handlers/elections/br-34.nomination-eligibility.test.ts`
- `services/api-ts/src/handlers/elections/createNominee.ts` (handler under test)
- `services/api-ts/src/handlers/elections/repos/` (repo to stub)

### D5: BR-P2 Gap Test Scope
**Decision:** Rewrite br-p2-gap tests to import real handlers. Identify which handlers the P2 tests cover and route assertions through those handlers.

### D6: Preserving Test Coverage
**Decision:** Keep all existing test scenarios — same BR edge cases, same assertions on business outcomes. Only change HOW the assertions are reached (through handler calls instead of inline functions).
**Rationale:** Rewriting should not reduce coverage. Every current `test()` block maps to at least one handler call.

</decisions>

<code_context>
## Existing Code Insights

### Test Helper Infrastructure
- `services/api-ts/src/test-utils/make-ctx.ts` — makeCtx, stubRepo, restoreRepo, makeUser, makeOfficer, makeMember, expectUnauthorized, expectForbidden
- Pattern: `const ctx = makeCtx({ _body: {...}, organizationId: 'org-1' }); const response = await handler(ctx);`
- stubRepo: `const mocks = stubRepo(RepoClass, { methodName: async () => returnValue })`

### Current Problem Files
- `br-33.election-integrity.test.ts` — 9 tests, all pure-function (inline Map/Set operations, no imports from handlers)
- `br-34.nomination-eligibility.test.ts` — ~10 tests, defines `checkNominationEligibility` inline (never imports from production)
- `br-p2-gap.test.ts` — tests assert on hardcoded objects

### Election Handlers Available
- castVote.ts, createElection.ts, createNominee.ts, getElection.ts, listElections.ts, updateElectionStatus.ts
- repos/ directory with election repository

### Existing Handler Tests (correct pattern)
- platformadmin/*.test.ts — all use makeCtx+stubRepo pattern (6 files)
- events/listRegistrations.test.ts — uses makeCtx
- middleware/auth.test.ts — uses makeCtx

</code_context>

<specifics>
## Specific Ideas

- Each handler exports a default function `(ctx) => Response` that can be called directly
- stubRepo stubs prototype methods, so `new Repo(db)` inside handler gets stubbed methods
- Tests must call restoreRepo in beforeEach to prevent Bun parallel pollution

</specifics>

<deferred>
## Deferred Ideas

- Deepening BR-32/33/34 edge cases beyond handler-level (Phase 28 scope)
- Shrinking KNOWN_INCOMPLETE list (Phase 28 scope)

</deferred>
