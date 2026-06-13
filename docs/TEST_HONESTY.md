# Test Honesty Convention

> A green test suite is only worth what its assertions prove. This one page is
> the rule against **fake-green** tests, plus the automated gate that enforces
> it. Sibling to [VERTICAL_TDD.md](../VERTICAL_TDD.md).

## The problem: fake-green

A *fake-green* test passes regardless of whether the production code is correct.
It inflates coverage and survives RED → GREEN review, but protects nothing. The
codebase audit (P-3) found four modules that had accumulated them
(platform-admin, documents, notifications-email, auth-rbac — now repaired). The
gate below stops the class from regrowing.

### Anti-patterns

| Anti-pattern | Why it's fake-green | Fix |
|---|---|---|
| **Assertion-free body** — `test('x', () => { doThing(); })` with no `expect` | Stays green no matter what `doThing` does | Assert the observable result |
| **Tautology** — `expect(true).toBe(true)`, `expect(x).toBe(x)` | Asserts nothing about the code | Assert real output |
| **Mock-only** — the only assertion is `expect(spy).toHaveBeenCalled()` and the spy stands in for the code under test | Verifies the test's own mock, not behavior | Assert on the real return value / DB row / response, in addition to (or instead of) the call |
| **Self-fixture** — the test feeds the code a fixture it itself shaped, then asserts the shape it chose (each side tested only against itself) | Round-trips the fixture, never the contract | Assert against the spec/contract shape, not the fixture |

## The rule

**Every `test()` / `it()` must make at least one assertion.** An assertion is:

- `expect(...)` — the standard matcher.
- An **`expect*` / `assert*`-named helper** — e.g. `expectValidationError(res)`,
  `expectBlocked(res)`. Shared assertion helpers are fine and encouraged;
  **name them `expect*` or `assert*`** so the gate recognizes the delegation.
- `assert(...)` / `assert.*` — node:assert style.
- A **conditional `throw`** — meta/guard tests that collect violations then
  `throw new Error(...)` (see `src/test-utils/empty-response-guard.test.ts`).
- `.toMatchSnapshot()`.

`test.skip` / `test.todo` are exempt — they don't run; they're explicitly pending.

### Mock discipline

`expect(spy).toHaveBeenCalledWith(...)` is a *real* behavioral assertion when the
spy is a genuine collaborator (a side effect you must prove happened). It is
**not** sufficient when the spy replaces the very code under test — then assert
on the real output too. The gate does not auto-block mock-only tests (too many
false positives); reviewers enforce it.

## The automated gate

`services/api-ts/src/handlers/__tests__/test-honesty-gate.test.ts` statically
scans every `services/api-ts/src/**/*.test.ts` and fails if any test block has
no assertion signal.

- **Scope:** the api-ts unit/integration suite. Frontend Playwright E2E
  (`apps/**`) is a different honesty model — real user flows over a live page —
  and is governed by E2E real-flow review, not this static gate.
- **Baseline ratchet:** `BASELINE_ALLOWLIST` in that file holds the
  assertion-free tests that existed when the gate landed (intentional "completes
  without throwing" smoke tests). It may only **shrink**. A new assertion-free
  test is not in it → the gate goes RED.
- **Stale guard:** if an allowlisted test later gains an assertion, the gate
  tells you to remove its allowlist entry, so the ratchet keeps tightening.

### When the gate trips

1. **Preferred:** add a real assertion to the offending test.
2. **Only if the test is a deliberate "does not throw" smoke test:** add its key
   (`<relpath> :: <test name>`) to `BASELINE_ALLOWLIST` with a one-line reason.
   This is a conscious, reviewed edit — that's the forcing function.
3. If you wrote a legitimate assertion helper with a non-conforming name, rename
   it to `expect*` / `assert*` (preferred) or allowlist the test.

## Related guards

- `__tests__/generated-route-integrity.test.ts` — codegen route/middleware integrity (F-2).
- `test-utils/empty-response-guard.test.ts` — no handler returns empty `{}` with 2xx.
