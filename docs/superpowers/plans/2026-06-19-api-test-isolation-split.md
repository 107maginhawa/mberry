# API Test Isolation: Split Unit vs Integration Execution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `*.integration.test.ts` (real-DB) tests from sharing a Bun process with the `mock.module`/`stubRepo` unit tests, eliminating the non-deterministic `unit-tests` CI failures on `advisor/round4-landed`.

**Architecture:** The api-ts unit suite mutates shared global state — `mock.module()` swaps whole repo modules process-wide (e.g. `core/auth.test.ts` replaces `platform-admin.repo` with a 1-method stub), and `stubRepo()` mutates repo prototypes. Bun's `mock.module` is process-global and its best-effort `afterAll` restore is incomplete, so a leaked stub lands a method as `undefined` in whatever real-DB integration test runs after it: `repo.create is not a function`. The fix is process isolation: run mocked unit tests in one `bun test` invocation and real-DB integration tests in a separate one. No mock polluter is ever loaded in the integration process. This is standard unit-vs-integration separation, not a per-victim patch.

**Tech Stack:** Bun test runner, package.json scripts, GitHub Actions (`.github/workflows/ci.yml`).

## Global Constraints

- Bun version: `1.2.21` (matches CI `oven-sh/setup-bun@v2`).
- Integration tests are identified by the filename suffix `*.integration.test.ts` (28 files under `services/api-ts/src/`). This convention already exists; do not rename files.
- Do NOT edit generated files (`src/generated/**`). Do NOT change test bodies in this plan — this is an execution-topology change only.
- **Coordination:** `.github/workflows/ci.yml` is being actively edited by a parallel session (audit/coverage work). Task 2 edits one step in the `unit-tests` job — rebase onto their latest `advisor/round4-landed` before pushing and confirm no overlap with their hunks.

## Validation already performed (evidence)

Run from `services/api-ts/` against the local `monobase` Postgres:

- `bun test $(find src -name '*.test.ts' -not -name '*.integration.test.ts')` → **7733 pass, 0 fail, stable across 2 runs.**
- `bun test $(find src -name '*.integration.test.ts')` → **~223 pass**, plus one unrelated pre-existing flake `ChatRoomMemberRepository (real DB) > markRead` (1-then-0; intra-integration, out of scope — see Follow-ups).
- Baseline `bun test` (all together) → non-deterministic **11 (CI) / 3 / 2** fails, all real-DB victims.

---

### Task 1: Split the api-ts test scripts

**Files:**
- Modify: `services/api-ts/package.json` (the `scripts` block, lines ~20-24)

**Interfaces:**
- Produces: npm scripts `test:unit` (mocked, no real-DB files) and `test:integration` (real-DB only), each a single isolated `bun test` process. `test` runs both sequentially for local convenience.

- [ ] **Step 1: Read the current scripts block**

Run: `cd services/api-ts && grep -nE '"test"|"test:unit"|"test:integration"' package.json`
Expected current values:
```
"test": "bun test src/**/*.test.ts",
"test:unit": "bun test src/**/*.test.ts",
"test:integration": "bun test src/tests/",
```

- [ ] **Step 2: Replace the three scripts**

Set them to (exact strings):
```json
"test": "bun run test:unit && bun run test:integration",
"test:unit": "bun test $(find src -name '*.test.ts' -not -name '*.integration.test.ts' | sort)",
"test:integration": "bun test $(find src -name '*.integration.test.ts' | sort)",
```
Notes: `| sort` makes file order deterministic (reduces ordering noise). The old `test:integration` pointed at `src/tests/` only and missed the 28 `*.integration.test.ts` files under `src/handlers/**` — that is the bug being corrected.

- [ ] **Step 3: Verify the unit split is green and stable**

Run: `cd services/api-ts && bun run test:unit && bun run test:unit`
Expected: both runs end `0 fail` (~7733 pass). If any `*.integration.test.ts` name appears in output, the exclude glob is wrong — fix before continuing.

- [ ] **Step 4: Verify the integration split runs in its own process**

Run: `cd services/api-ts && bun run test:integration`
Expected: real-DB tests run; ~223 pass. A transient `ChatRoomMemberRepository markRead` fail is the known pre-existing flake (Follow-up 1), not a regression — re-run once to confirm it passes.

- [ ] **Step 5: Commit**

```bash
git add services/api-ts/package.json
git commit -m "test(api): split unit vs integration test execution into separate bun processes

Real-DB *.integration.test.ts ran in the same bun process as the
mock.module/stubRepo unit tests; the process-global mock leakage landed
repo methods as undefined in integration tests (repo.create is not a
function), failing unit-tests non-deterministically. Run them as two
isolated processes so no mock polluter is loaded for the real-DB tests."
```

---

### Task 2: Run the two suites as separate CI steps

**Files:**
- Modify: `.github/workflows/ci.yml` — the `unit-tests` job's "Run unit tests" step (currently `cd services/api-ts && bun test`, ~line 64)

**Interfaces:**
- Consumes: the `test:unit` / `test:integration` scripts from Task 1.
- Produces: two CI steps, each a fresh `bun test` process. The Postgres service + migrations the job already sets up serve the integration step.

- [ ] **Step 1: Confirm the current step**

Run: `grep -n "Run unit tests" .github/workflows/ci.yml`
Expected nearby:
```yaml
      - name: Run unit tests
        run: cd services/api-ts && bun test
```

- [ ] **Step 2: Replace that single step with two**

```yaml
      - name: Run unit tests (mocked, isolated process)
        run: cd services/api-ts && bun run test:unit
      - name: Run integration tests (real DB, isolated process)
        run: cd services/api-ts && bun run test:integration
```
Leave the surrounding "Run frontend unit tests" / "Run SDK unit tests" steps unchanged.

- [ ] **Step 3: Rebase + coordinate before pushing**

```bash
git fetch origin advisor/round4-landed
git rebase origin/advisor/round4-landed
```
Confirm the parallel session has not rewritten the same `unit-tests` hunk. Resolve in favor of keeping both their step changes and the split.

- [ ] **Step 4: Verify on CI**

Push, then: `gh pr checks <pr> --watch`
Expected: `unit-tests` gate green (both steps pass). The split is the fix — if `unit-tests` still flakes, a real-DB test is also being polluted by another real-DB test (intra-integration), which is Follow-up 1's territory, not this plan's.

---

## Follow-ups (NOT in this plan — separate, smaller work)

1. **`ChatRoomMemberRepository (real DB) > markRead` flake** — fails ~1-in-2 even isolated to the integration process. Intra-integration ordering/data race, not mock pollution. Investigate `chatRoomMember` repo test setup/teardown separately.
2. **`contract` gate** — `mailpit unreachable` (CI service didn't start) + `cors.hurl` origin assertion. CI-infra/env, not code; owned by the CI/infra track.
3. **Deeper refactor (optional, large):** migrate `stubRepo`/`mock.module` repo tests to dependency-injected fakes so no shared global state is mutated at all. The process-split above removes the CI pain without this; revisit only if intra-unit pollution resurfaces.

## Self-Review

- **Coverage:** Task 1 fixes the script split (root mechanism); Task 2 makes CI use it. Both halves are required for the gate to go green — neither alone changes CI behavior. Covered.
- **Placeholders:** none — every command and script value is literal and validated.
- **Type consistency:** script names `test:unit` / `test:integration` are used identically in Task 1 (definition) and Task 2 (invocation).
