# Plan 005: Port officer-flow.spec.ts off the removed password sign-in (email-OTP)

> **Executor instructions**: Follow this plan step by step. Run the verification
> command and confirm the result. If a "STOP condition" occurs, stop and report.
> Do NOT update `plans/README.md` (the reviewer maintains it).
>
> **Drift check (run first)**:
> `git diff --stat d8501e09..HEAD -- apps/org/src/e2e/officer-flow.spec.ts apps/org/src/features/auth`
> If the auth source changed beyond what's described here, read the live files
> before editing.

## Status

- **Priority**: P2
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: tests
- **Planned at**: commit `d8501e09`, 2026-06-29

## Why this matters

`apps/org/src/e2e/officer-flow.spec.ts` is **failing** and has been since the org
app moved to passwordless **email-OTP** sign-in. The spec still drives a Password
field (`getByLabel('Password')`) that no longer exists, so it times out at 30s.
This leaves the org E2E suite with a permanent red and no real coverage of the
officer sign-in → send-pay-link journey. This plan ports the spec's sign-in steps
to the OTP form so the journey is exercised again and the suite goes green.

## Current state

### The app now uses email-OTP (no password field)

`apps/org/src/features/auth/SignInForm.tsx` is a two-step OTP form:
- Step 1: input labelled **"Email address"** (`id="email"`), button **"Send code"**.
- Step 2: input labelled **"6-digit code"** (`id="otp"`), button **"Verify & sign in"**.

`apps/org/src/features/auth/sign-in.ts` calls these CSRF-exempt endpoints:
- request code → `POST /auth/email-otp/send-verification-otp` (body `{ email, type: 'sign-in' }`)
- verify + create session → `POST /auth/sign-in/email-otp` (body `{ email, otp }`)

### The failing scaffold in `officer-flow.spec.ts`

The spec (read the whole file before editing) stubs the OLD password endpoint and
fills a Password field:

```ts
  // Sign-in — raw fetch to /api/auth/sign-in/email (not via SDK; /auth/ is CSRF-exempt).
  await page.route('**/auth/sign-in/email', (r) => {
    signedIn = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
```

```ts
  // ── 1. Visit sign-in page ────────────────────────────────────────────────
  await page.goto('/sign-in')
  await expect(page.getByText('Officer sign in')).toBeVisible()

  // ── 2. Fill credentials (inputs: id="email", id="password" in sign-in.tsx) ──
  await page.getByLabel('Email').fill('officer@test.com')
  await page.getByLabel('Password').fill('secret')          // ← no such field anymore → times out

  // ── 3. Submit form → POST /api/auth/sign-in/email → 200; signedIn=true ──
  await page.getByRole('button', { name: 'Sign in' }).click()

  // ── 4. Wait for redirect to roster (/) ──────────────────────────────────
  await page.waitForURL('/')
```

Everything else in the spec (CSRF stub, memberships 401→200, roster stub, empty
dues-invoices, send-link stub, and steps 5–8 from roster → send pay-link) is
correct and must be **kept unchanged**. The `signedIn` flag pattern stays — it
must now be flipped by the OTP **verify** route, not the password route.

### A working OTP reference

`apps/member/src/e2e/` (if present) and the org sign-in source above show the
exact endpoints. Match the existing stub style in `officer-flow.spec.ts`.

## Commands you will need

| Purpose           | Command                                                   | Expected |
|-------------------|----------------------------------------------------------|----------|
| Run this spec     | `bun run --filter @monobase/org test:e2e -- officer-flow`| pass     |
| Whole e2e suite   | `bun run --filter @monobase/org test:e2e`                | all pass |
| Typecheck         | `bun run --filter @monobase/org typecheck`               | exit 0   |

The org dev server must be running on http://localhost:3005 (it already is in
this environment — do not start another). Run from repo root.

## Scope

**In scope** (edit only):
- `apps/org/src/e2e/officer-flow.spec.ts`

**Out of scope** (do NOT touch):
- Any non-test source, the OTP form/auth source, the other e2e specs, the
  generated SDK, the engine, `apps/member/*`, `plans/README.md`.

## Git workflow

- Branch: stay on the current branch (`advisor/org-improvements`); do not create
  a new one, do not commit/push (the reviewer handles git).

## Steps

### Step 1: Swap the sign-in route stubs

In `officer-flow.spec.ts`, replace the single `**/auth/sign-in/email` route with
the two OTP routes. Keep `let signedIn = false`; flip it on **verify**:

```ts
  // Request OTP — CSRF-exempt /auth/*; just acknowledge.
  await page.route('**/auth/email-otp/send-verification-otp', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) }),
  )

  // Verify OTP — session-creating passwordless sign-in. Flip signedIn here.
  await page.route('**/auth/sign-in/email-otp', (r) => {
    signedIn = true
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
```

### Step 2: Drive the two-step OTP form

Replace the credential-fill + submit block (old steps 2–3) with the OTP flow:

```ts
  // ── 2. Step 1: enter email, request code ─────────────────────────────────
  await page.getByLabel('Email address').fill('officer@test.com')
  await page.getByRole('button', { name: 'Send code' }).click()

  // ── 3. Step 2: enter the 6-digit code, verify → creates session ──────────
  await page.getByLabel('6-digit code').fill('123456')
  await page.getByRole('button', { name: 'Verify & sign in' }).click()
```

Leave step 4 (`await page.waitForURL('/')`) and everything after it unchanged.
Update the now-stale code comments (the `id="password"` / "POST …/sign-in/email"
comments) to describe the OTP flow.

### Step 3: Verify

**Verify**: `bun run --filter @monobase/org test:e2e -- officer-flow` → 1 passed.
Then `bun run --filter @monobase/org test:e2e` → all specs pass.

## Test plan

No new test files — this repairs an existing spec. The same journey (sign-in →
roster → send pay-link) is covered, with sign-in now via OTP. Run the spec twice
to confirm it is not flaky.

## Done criteria

ALL must hold:

- [ ] `bun run --filter @monobase/org test:e2e -- officer-flow` passes
- [ ] `bun run --filter @monobase/org test:e2e` exits 0 (whole org e2e green)
- [ ] `grep -n "getByLabel('Password')" apps/org/src/e2e/officer-flow.spec.ts` returns nothing
- [ ] Only `apps/org/src/e2e/officer-flow.spec.ts` is modified (`git status`)
- [ ] `plans/README.md` NOT modified by you

## STOP conditions

Stop and report if:

- The OTP form labels/buttons differ from "Email address" / "Send code" /
  "6-digit code" / "Verify & sign in" (read `SignInForm.tsx` and report).
- The journey fails after sign-in for a reason unrelated to auth (e.g. the
  roster or send-link stub no longer matches the app) — report; do not rewrite
  unrelated stubs beyond the auth swap.
- The spec is flaky across two runs.

## Maintenance notes

- For a reviewer: confirm `signedIn` flips on **verify** (`/auth/sign-in/email-otp`),
  not on the request-code route — otherwise memberships could turn 200 too early.
- If a shared OTP sign-in helper is later extracted for e2e, fold this spec into it.
