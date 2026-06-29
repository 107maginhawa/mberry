# Plan 008: Harden the auth/session flow (4 small fixes)

> **Executor instructions**: Follow step by step. Each fix has its own verification. If a "STOP condition" occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a024135..HEAD -- apps/org/src/routes/__root.tsx apps/org/src/features/auth apps/org/src/features/org/use-org.ts apps/org/src/lib/api.ts`
> If any changed, compare to the excerpts below before editing; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: bug (correctness + UX integrity)
- **Planned at**: commit `4a024135`, 2026-06-29

## Why this matters

Four small, independent gaps in the officer sign-in/session flow, bundled because each is a few lines and they share files. None is catastrophic, but together they make the auth flow brittle for non-technical users: a failed sign-out silently "succeeds", an already-signed-in officer can re-auth as someone else, there's no way back from the OTP code step to fix a mistyped email, and a private-mode browser can crash the app on load.

## Current state

**Fix 1 — sign-out ignores its result.** `apps/org/src/routes/__root.tsx`:

```tsx
  async function onSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut(API_BASE)                          // returns { ok: boolean; error? } — result ignored
    await qc.invalidateQueries({ queryKey: ['session'] })
    navigate({ to: '/sign-in' })
  }
```

`signOut` (in `apps/org/src/features/auth/sign-in.ts`) returns `{ ok: true } | { ok: false; error: string }`.

**Fix 2 — already-authed user not redirected from /sign-in.** Same file, `RootGate`:

```tsx
  // Public sign-in page renders bare (no app chrome).
  if (pathname === '/sign-in') return <Outlet />            // no check: an authed user sees the sign-in form
```

The redirect effect only handles the unauthed case:

```tsx
  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
  }, [status, pathname, navigate])
```

**Fix 3 — no "back to email" on OTP step 2.** `apps/org/src/features/auth/SignInForm.tsx` step-2 form has only "Verify & sign in" and "Resend code"; once on the code step, the user can't return to step 1 to correct a wrong email (they must reload).

**Fix 4 — unguarded localStorage (private-mode crash).** `apps/org/src/features/org/use-org.ts:17` reads `localStorage.getItem(STORAGE_KEY)` in a `useState` initializer, and writes via `setItem`/`removeItem` in effects/callbacks; `apps/org/src/lib/api.ts:88` reads `localStorage.getItem('org.selectedOrgId')` in the request interceptor. In Safari Private Mode (and locked-down browsers) `setItem` can throw, and any throw in the `useState` initializer crashes the whole app on load.

## Commands you will need

| Purpose   | Command                                          | Expected |
|-----------|--------------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`       | exit 0   |
| Tests     | `bun run --filter @monobase/org test`            | all pass |
| E2E       | `bun run --filter @monobase/org test:e2e`        | all pass (dev server on :3005) |

Run from repo root.

## Scope

**In scope**:
- `apps/org/src/routes/__root.tsx` (fixes 1, 2)
- `apps/org/src/features/auth/SignInForm.tsx` (fix 3)
- `apps/org/src/features/org/use-org.ts` (fix 4)
- `apps/org/src/lib/api.ts` (fix 4)
- the matching `*.test.ts(x)` for files you change (add/adjust cases)

**Out of scope**: the engine, the generated SDK, the member app, the CSRF/x-org-id logic itself (only wrap its localStorage access in try/catch — don't change behavior). Do NOT alter `RootGate`'s loading/spinner branch.

## Git workflow

- Branch: `advisor/008-auth-hardening`. Conventional commit(s), e.g. `fix(org): harden sign-out, re-auth redirect, OTP back, localStorage guards`. No push/PR unless instructed.

## Steps

### Step 1 (Fix 1): Check the sign-out result

In `__root.tsx` `onSignOut`, inspect the result; on failure show a toast (`sonner` is already used app-wide — import `toast`) and stop. Always clear the in-flight flag:

```tsx
  async function onSignOut() {
    if (signingOut) return
    setSigningOut(true)
    const res = await signOut(API_BASE)
    if (!res.ok) { toast.error(res.error); setSigningOut(false); return }
    await qc.invalidateQueries({ queryKey: ['session'] })
    navigate({ to: '/sign-in' })
  }
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2 (Fix 2): Redirect authed users away from /sign-in

In `RootGate`, fold the authed-on-sign-in case into the redirect effect, and guard the bare-render line. Add to the effect:

```tsx
  useEffect(() => {
    if (status === 'unauthed' && pathname !== '/sign-in') navigate({ to: '/sign-in' })
    else if (status === 'authed' && pathname === '/sign-in') navigate({ to: '/' })
  }, [status, pathname, navigate])
```

Keep `if (pathname === '/sign-in') return <Outlet />` for the unauthed/loading case — the effect will redirect an authed user on the next tick, so this is safe (the bare form may flash for one frame; acceptable). If you prefer no flash, return the loading skeleton when `status === 'authed' && pathname === '/sign-in'`.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3 (Fix 3): "Back to email" on the OTP step

In `SignInForm.tsx`, on the step-2 (code) form, add a button that resets to step 1 and clears the entered code:

```tsx
            <button type="button" onClick={() => { setStep('email'); setOtp(''); setError('') }}
              className="min-h-tap w-full text-body text-primary underline">
              Use a different email
            </button>
```

Place it alongside "Resend code". Match the existing button styling in that file.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 4 (Fix 4): Guard localStorage

Add a tiny safe wrapper and use it for every localStorage access in the two files. Either inline try/catch at each call site, or a small helper (e.g. in `use-org.ts` and reused). Required behavior: a throw from getItem yields `null`; a throw from setItem/removeItem is swallowed (best-effort persistence). Example shape:

```ts
const safeGet = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const safeRemove = (k: string): void => { try { localStorage.removeItem(k) } catch { /* private mode */ } }
```

Replace the raw calls in `use-org.ts` (useState initializer + the two effects + `setOrgId`) and the `localStorage.getItem` call in `api.ts`'s request interceptor. Do not change any other behavior — the app must still select/persist orgs identically when storage works.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 5: Tests + full suite

Add/adjust tests for the behavior you changed, modeling on existing tests:
- sign-out failure path (mock `signOut` → `{ ok: false, error }`, assert no navigation; model on `apps/org/src/features/auth/sign-in.test.ts` / any `__root` test if present).
- OTP "back to email" returns to step 1 (component test on `SignInForm`, model on `SignInForm.test.tsx`).
- `useSelectedOrg` survives a throwing `localStorage` (mock `localStorage.getItem`/`setItem` to throw; assert no crash, falls back to null). Model on `use-org.test.tsx`.

**Verify**: `bun run --filter @monobase/org test` → all pass. Then `bun run --filter @monobase/org test:e2e` → all pass (sign-in/sign-out e2e must still work; the new redirect must not break the OTP flow in `officer-flow.spec.ts`).

## Test plan

New/changed cases: sign-out failure (no nav), authed→/sign-in redirect, OTP back-to-email, localStorage-throws resilience. Patterns: existing auth + org tests in the same folders.

## Done criteria

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; the 3+ new cases pass
- [ ] `bun run --filter @monobase/org test:e2e` exits 0
- [ ] `grep -n "res.ok\|!res.ok" apps/org/src/routes/__root.tsx` shows the sign-out result is checked
- [ ] `grep -n "status === 'authed' && pathname === '/sign-in'" apps/org/src/routes/__root.tsx` returns a match
- [ ] `grep -rn "try {" apps/org/src/features/org/use-org.ts` shows localStorage is guarded; same intent in `api.ts`
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 008 updated

## STOP conditions

Stop and report if: excerpts don't match live code; the new authed→/sign-in redirect causes a loop or breaks the OTP e2e; guarding localStorage changes org-selection behavior in any test.

## Maintenance notes

- Reviewer: verify the authed→/sign-in redirect can't loop with RootGate's existing unauthed redirect (they guard on opposite `status` values, so they shouldn't). Verify the localStorage guard is behavior-preserving when storage works (the common case).
- These are defensive; the localStorage guard especially has low day-to-day visibility but prevents a hard crash class on private-mode browsers.
