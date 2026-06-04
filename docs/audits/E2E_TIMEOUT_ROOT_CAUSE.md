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

1. ~~**(30 min)** Drop `pressSequentially` `delay: 10` in `signUp` / `signIn`. Use `.fill()`. Quick 27s win.~~ ✅ commit `213b1ce8` — 12 occurrences across 6 files, typecheck clean.
2. ~~**(1-2h)** Auth helper fast-path — drop `waitForTimeout(2000)` + trailing `waitForLoadState('networkidle')` in `signIn`/`signUp`, replace with explicit URL wait covering both happy path and verify-email gate. Also dropped the redundant POST /persons block (sign-up auto-creates).~~ ✅ commit `68cc76c4` — auth.spec.ts 95s → 58.9s (-38%).
3. ~~**(2-3h)** Mass-strip 513 redundant post-`goto` `networkidle` waits across 105 spec files via `scripts/audit/strip-redundant-waits.ts` (idempotent, only strips when directly preceded by `goto`).~~ ✅ commit `4dd36e89` — auth.spec.ts 58.9s → 53.0s (-10% additional).
4. ~~**(1h)** SDK transport CSRF mirror.~~ ✅ verified already in place — `packages/sdk-ts/src/csrf.ts`, `transport.ts:55`, `react/provider.tsx:161-171` interceptor + `:184` `seedCsrfToken` on mount. No action needed.
5. **(2-4h, deferred)** `workers: 4` + `fullyParallel: true`. Needs per-spec audit: specs that mutate shared `SEED_*` users (officer/member) race in parallel. Move mutation specs to fresh `signUp` users first; read-only specs are safe to parallelize as-is.
6. **(1-2h, deferred)** Storage-state setup project — sign each persona in once, save `.auth/<role>.json`, declare `test.use({ storageState })` per spec. Eliminates ~166 UI sign-in round-trips. Largest single remaining win.

## Measured impact (this session)

| Stage | auth.spec.ts wall | per-test |
|---|---|---|
| Baseline | ~95s projected (9.5s/test from prior 57/540s) | 9.5s |
| After fix 1+2 (commits 213b1ce8 + 68cc76c4) | 58.9s | 5.9s |
| After fix 3 (commit 4dd36e89) | 53.0s | 5.3s |
| **Cumulative reduction** | **-44%** | — |

Projection for full memberry E2E (598 tests): **~95 min → ~50 min** based on this ratio. With fix 5 (workers=4): **~13 min** target. With fix 6 (storageState): floor near **~8 min**.

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
