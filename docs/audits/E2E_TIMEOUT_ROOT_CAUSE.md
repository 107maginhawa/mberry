# E2E_TIMEOUT_ROOT_CAUSE.md

**Investigated:** 2026-06-05
**Trigger:** Memberry E2E run killed at 540s (9 min cap) — reached 57 of ~598 tests.

## Quantified cause

| Factor | Value | Impact |
|---|---|---|
| Spec files (chromium + mobile, non-stub) | 118 | — |
| `test(...)` blocks total | 598 | — |
| `signUp` / `signIn*` invocations across specs | 166 | each costs 3-5s of UI auth |
| Playwright `workers` (CI + local) | **1** | strictly serial |
| Playwright `fullyParallel` | **false** | no within-file parallelism either |
| Default test `timeout` | 30 000ms | budget per test |
| `expect` timeout | 10 000ms | budget per assertion |
| CI `retries` | 1 | doubles cost of any failing test |
| Average observed time / test | ~9.5s | derived: 57 tests / 540s |
| Projected full-run wall time | **~95 min** | 598 × 9.5s |

That projection is the floor: the last partial run was full of cascading 403 failures (memberry SDK predates the CSRF/Origin fix landed in the API), which inflate per-test time via retries (each fail re-runs once = 19s/test for the failing cohort).

## Root causes (in order of leverage)

### 1. No `storageState` reuse — biggest fix

Every authenticated test does `signIn(page, EMAIL, PASSWORD)` via the UI in `test.beforeEach`. That flow is:

```
page.goto('/auth/sign-in')          ~0.5s
page.waitForLoadState('networkidle') 0.5-2s   ← networkidle waits 500ms quiet
fill 3 inputs                        ~0.3s
click submit                         ~0.1s
wait for navigation                  1-3s
```

≈ **3-5s per test × 166 calls = 8-14 minutes spent only on auth.**

The Playwright-recommended pattern is a **setup project** that signs each persona in **once**, dumps the cookie jar to `.auth/<role>.json`, then each spec declares `use: { storageState: '.auth/officer.json' }`. Restoring state takes < 100ms.

Memory recall: `feedback_subagent_preflight` already names the auth flow as a hot spot — fix has been pending.

### 2. `workers: 1` + `fullyParallel: false` — second-biggest

Strictly serial. Modern CI runners are 2–4 cores; we're using one. `workers: 4` ≈ 4× speedup for non-conflicting tests.

Blocker: many specs use **shared SEED_* users** (`signInAsMember`, `signInAsOfficer`, …). Two parallel workers as the same officer would race on mutations. Pattern fix: each spec creates a fresh user (`signUp` returns a unique email) and a fresh org context, then runs in its own worker.

The lower-friction path: combine with storageState — sign in shared seed users in a setup project that writes per-role auth files. The actual specs only do read-only or scoped mutations.

### 3. `waitForLoadState('networkidle')` after every navigation

Each occurrence waits **500ms of network silence**. Pages with WebSockets, OneSignal beacons, or LogRocket-style telemetry never go idle → 30s timeout. The signUp helper uses it; many specs do too. Memory recall: `feedback_root_cause_layers` — these waits are often masking real bugs.

Replacement pattern:
```ts
// instead of page.waitForLoadState('networkidle'):
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
```

Wait for a **specific visible element**, not network silence.

### 4. UI password entry uses `pressSequentially(..., { delay: 10 })`

```ts
await passwordInput.pressSequentially(password, { delay: 10 })
```

16-char password × 10ms = 160ms artificial keystroke delay. Per call: trivial. Across 166 calls: **~27s** of compounded wait. The delay is unnecessary — `.fill()` is instant and triggers the same React state updates.

### 5. Mobile project nearly empty but still adds work

`apps/memberry/playwright.config.ts` projects:
- `chromium` (`testIgnore: ['**/mobile/**']`) → runs ~584 tests
- `mobile` (`testMatch: '**/mobile/**'`) → runs only 14 tests (2 files)

Each project boots a separate browser. The mobile project's value is low at this size — could be folded into chromium with a viewport `describe.configure` per spec, or moved to its own opt-in script (e.g. `test:e2e:mobile`).

### 6. Cascading 403s from pre-CSRF-fix SDK calls

The CSRF + Origin fix landed in the contract scenarios this session. The memberry SDK (`packages/sdk-ts`) probably still doesn't mirror CSRF tokens into the `x-csrf-token` header from page context — `apiAs` helper does, but production code paths may not. Each test that hits a state-changing API endpoint via the UI then 403s, retries (×1 in CI), re-403s, and consumes 19s instead of 9.5s.

Verify: grep `packages/sdk-ts/src` for `csrf-token` reuse. If missing, add a transport interceptor that mirrors the cookie into the header on POST/PUT/PATCH/DELETE.

## Recommended fix sequence (effort-ordered)

1. **(30 min)** Drop `pressSequentially` `delay: 10` in `signUp` / `signIn`. Use `.fill()`. Quick 27s win.
2. **(1-2h)** Storage-state setup project. Sign in each SEED_* persona once at suite start; save to `.auth/<role>.json`. Update `signInAsX` helpers to be no-ops when `storageState` is already loaded (or remove `beforeEach` signIn altogether). Expected: 8-14 min wall-time saved.
3. **(2-3h)** Replace `waitForLoadState('networkidle')` calls with element-presence waits. Use grep to find all occurrences. Verify each replacement on the actual page.
4. **(1h)** Verify SDK transport mirrors CSRF cookie → header. If missing, add it (transport interceptor in `packages/sdk-ts/src/client`). This should clear the 403 cascade independently.
5. **(2-4h)** Set `workers: 2` then `workers: 4` in CI; flush out test-isolation bugs that surface. Each spec that mutates shared seed-user state must move to fresh `signUp` users.
6. **(optional)** Split mobile project to its own opt-in script.

After step 5, projected wall time: **~25 min** (4× speedup × 75% slower-baseline reduction).

## Next test action

Before any rewrite work, validate the analysis empirically:

```bash
# 1. Boot api + apps
cd services/api-ts && bun dev &
cd apps/memberry && bun dev &

# 2. Run a subset to confirm avg per-test time still ~9s
cd apps/memberry && bun run test:e2e tests/e2e/member/org-home.spec.ts -- --reporter=line

# 3. After applying fix #1+#2, re-run the same subset and compare
```

If subset wall time drops by ≥50%, the fix path is validated.
