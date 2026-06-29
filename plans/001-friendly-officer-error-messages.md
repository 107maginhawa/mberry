# Plan 001: Stop showing raw server error strings to officers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat d8501e09..HEAD -- apps/org/src/features/payment-settings apps/org/src/features/paylink`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / docs (UX correctness — design-law compliance)
- **Planned at**: commit `d8501e09`, 2026-06-29

## Why this matters

`apps/org` is the officer app used by **non-technical older dentists** (target
user per `DESIGN.md`). When a PayMongo connect/test/disconnect or a pay-link
send fails, the app currently surfaces the **raw server error string** straight
to the user via a toast or inline alert. These strings are technical (e.g. HTTP
status text, validator messages, gateway error bodies) and violate the project's
design law: *"error messages must be plain language with a clear next step,
never raw API/technical strings."* The sister app `apps/member` already solved
this with a `friendlyAuthError` mapper. This plan adds the equivalent mapper for
the officer app and routes the leaking sites through it — without regressing the
messages that are already friendly.

## Current state

Files involved:

- `apps/org/src/features/payment-settings/use-gateway-config.ts` — data hooks for
  PayMongo connect/test/disconnect; throws errors whose `.message` is the raw
  server string.
- `apps/org/src/features/payment-settings/PaymentSettings.tsx` — renders those
  errors; one site shows a raw server message directly.
- `apps/org/src/features/paylink/use-send-link.ts` — pay-link mint + revoke;
  passes raw server strings through to the UI alert.

### The leak (verbatim excerpts)

`apps/org/src/features/payment-settings/use-gateway-config.ts:9-15` — the helper
that extracts the raw server string and returns it unchanged:

```ts
function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}
```

This raw value is thrown at `use-gateway-config.ts:55`, `:65`, `:75`, e.g.:

```ts
if (!data) throw new Error(serverError(error) ?? 'Could not save credentials.')
```

`apps/org/src/features/payment-settings/PaymentSettings.tsx:51-62` — `onTest`
shows the raw server message on the failure branch (line 57):

```ts
  async function onTest() {
    try {
      const data = await test.mutateAsync()
      if (data?.success) {
        toast.success(data.message ?? 'Connection test passed.')
      } else {
        toast.error(data?.message ?? 'Connection test failed.')   // ← line 57: raw server message
      }
    } catch (err) {
      toast.error((err as Error).message ?? 'Connection test failed.')
    }
  }
```

`apps/org/src/features/paylink/use-send-link.ts:45-51` — pay-link mint passes the
raw server string straight into the error state (shown in an `Alert` in
`SendLink.tsx:107`):

```ts
      const serverMsg = (error as any)?.error ?? (error as any)?.message ?? (data as any)?.error
      const msg = typeof serverMsg === 'string'
        ? serverMsg                                              // ← raw server string to UI
        : response.status === 403
          ? 'You are not an officer of this organization.'
          : 'Could not create the pay-link.'
      throw new Error(msg)
```

`apps/org/src/features/paylink/use-send-link.ts:67` — revoke, same class:

```ts
      throw new Error((error as any)?.error ?? (error as any)?.message ?? (data as any)?.error ?? 'Could not revoke the link.')
```

### The exemplar to mirror

`apps/member/src/features/auth/sign-in.ts:7-22` already implements this exact
pattern for the member app. **Read it and match its structure** (plain-language,
substring-matched, generic fallback):

```ts
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('origin') || m.includes('csrf') || m.includes('forbidden'))
    return "We couldn't verify this device. Refresh the page and try again."
  if (m.includes('expired'))
    return 'That code expired. Tap "Resend code" to get a new one.'
  if (m.includes('otp') || m.includes('code'))
    return "That code didn't match. Check it and try again, or resend a new code."
  if (m.includes('too many') || m.includes('rate'))
    return 'Too many tries. Please wait a minute, then try again.'
  if (m.includes('not found') || m.includes('no account') || m.includes('no user'))
    return "We couldn't find an account with that email. Check the spelling, or contact your chapter officer."
  return 'Something went wrong. Please try again.'
}
```

### Key design constraint (do NOT regress)

The leaking sites all have a pattern `serverString ?? 'Local friendly fallback.'`.
You must map **only the server-originated string**, never the local fallback
literal. If you naively run the local fallback (e.g. `'Could not save
credentials.'`) through the mapper, it would be downgraded to the generic
`'Something went wrong.'` — a regression. Apply the mapper at the point where the
**raw server value** is read, and leave the `?? 'Local fallback.'` literals
untouched.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Typecheck | `bun run --filter @monobase/org typecheck`| exit 0, no errors   |
| Unit test | `bun run --filter @monobase/org test`     | all pass            |
| One file  | `bun run --filter @monobase/org test -- friendly-error` | new tests pass |

All commands run from the repo root `/Users/elad-mini/Desktop/memberry`.

## Scope

**In scope** (the only files you may modify or create):
- `apps/org/src/lib/friendly-error.ts` (create)
- `apps/org/src/lib/friendly-error.test.ts` (create)
- `apps/org/src/features/payment-settings/use-gateway-config.ts` (edit)
- `apps/org/src/features/payment-settings/PaymentSettings.tsx` (edit, one line)
- `apps/org/src/features/paylink/use-send-link.ts` (edit, two sites)

**Out of scope** (do NOT touch):
- `apps/member/*` — the exemplar; read only, never edit.
- The generated SDK (`@monobase/sdk-ts`) — never edit generated code.
- The engine (`services/api-ts`) — it is FROZEN; do not change server error text.
- The success-message branches (e.g. `PaymentSettings.tsx:55`
  `toast.success(data.message …)`) — a positive confirmation is fine as-is.
- Any change to the local fallback literals (`'Could not save credentials.'`,
  `'Could not create the pay-link.'`, etc.) — keep them verbatim.

## Git workflow

- Branch: `advisor/001-friendly-officer-errors`
- Commit style: conventional commits (repo uses them, e.g.
  `fix(org): map raw server errors to plain language on money screens`).
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Create the mapper

Create `apps/org/src/lib/friendly-error.ts`. Mirror the member app's structure,
but tuned for the officer money screens (PayMongo, pay-links, officer authz).
Export a single function `friendlyApiError(raw: string): string`:

```ts
// Officer-facing error mapper. Older, non-technical users must never see raw
// API/validator/gateway strings (DESIGN.md plain-language law). Map known
// technical causes to plain language with a next step; fall back to a friendly
// generic. Mirrors apps/member/src/features/auth/sign-in.ts:friendlyAuthError.
export function friendlyApiError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('origin') || m.includes('csrf') || m.includes('forbidden'))
    return "We couldn't verify this device. Refresh the page and try again."
  if (m.includes('403') || m.includes('officer') || m.includes('permission') || m.includes('not authorized') || m.includes('unauthorized'))
    return 'You need Treasurer or President access (with two-factor enabled) to do this.'
  if (m.includes('paymongo') || m.includes('gateway') || m.includes('api key') || m.includes('api_key') || m.includes('credential') || m.includes('invalid key'))
    return "We couldn't reach the payment provider. Double-check your PayMongo keys and try again."
  if (m.includes('too many') || m.includes('rate'))
    return 'Too many tries. Please wait a minute, then try again.'
  if (m.includes('network') || m.includes('timeout') || m.includes('fetch') || m.includes('502') || m.includes('503') || m.includes('504'))
    return "We couldn't reach the server. Check your connection and try again."
  return 'Something went wrong. Please try again.'
}
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2: Map server strings inside `use-gateway-config.ts`

In `apps/org/src/features/payment-settings/use-gateway-config.ts`, add the import
at the top (match the existing import style):

```ts
import { friendlyApiError } from '@/lib/friendly-error'
```

Then change ONLY the `serverError` helper (lines 9-15) so the extracted raw
string is mapped before it is returned. Leave its `undefined` return path and
all the `?? 'Local fallback.'` call sites unchanged:

```ts
function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return friendlyApiError(e)
  }
  return undefined
}
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3: Map the test-failure message in `PaymentSettings.tsx`

In `apps/org/src/features/payment-settings/PaymentSettings.tsx`, add the import:

```ts
import { friendlyApiError } from '@/lib/friendly-error'
```

Change ONLY line 57 (the `else` failure branch of `onTest`) so a server-provided
`data.message` is mapped. The success branch (line 55) and the `catch` (line 60)
stay unchanged (the catch already receives a hook-thrown, now-mapped message):

```ts
      } else {
        toast.error(data?.message ? friendlyApiError(data.message) : 'Connection test failed.')
      }
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 4: Map server strings in `use-send-link.ts` (two sites)

In `apps/org/src/features/paylink/use-send-link.ts`, add the import:

```ts
import { friendlyApiError } from '@/lib/friendly-error'
```

**Mint** (lines 45-51) — map `serverMsg` when it is a string:

```ts
      const serverMsg = (error as any)?.error ?? (error as any)?.message ?? (data as any)?.error
      const msg = typeof serverMsg === 'string'
        ? friendlyApiError(serverMsg)
        : response.status === 403
          ? 'You are not an officer of this organization.'
          : 'Could not create the pay-link.'
      throw new Error(msg)
```

**Revoke** (line 67) — extract the server value, map it if it's a string, keep
the local fallback:

```ts
      const revokeMsg = (error as any)?.error ?? (error as any)?.message ?? (data as any)?.error
      throw new Error((typeof revokeMsg === 'string' ? friendlyApiError(revokeMsg) : undefined) ?? 'Could not revoke the link.')
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 5: Run the full org test suite

Make sure no existing test asserted on a now-changed raw string.

**Verify**: `bun run --filter @monobase/org test` → all pass. If a pre-existing
test fails because it asserted on a raw server string that is now mapped, update
that test's expectation to the new friendly string (this is in scope — it is the
test for the code you changed). If a test fails for any *other* reason, treat it
as a STOP condition.

## Test plan

Create `apps/org/src/lib/friendly-error.test.ts`, modeled structurally after any
existing `*.test.ts` in `apps/org` (plain `vitest` `describe`/`it`/`expect`, no
React). Cover:

- Each mapped category returns its plain-language string (one case each:
  csrf/origin, 403/officer, paymongo/gateway, rate, network/502).
- An unknown technical string (e.g. `'TypeError: Cannot read properties of
  undefined'`) returns the generic `'Something went wrong. Please try again.'`.
- Matching is case-insensitive (e.g. `'PayMongo API KEY invalid'` maps to the
  gateway message).
- The output never contains the raw input substring for a mapped case (assert
  the gateway case does NOT include `'api key'`).

Example shape:

```ts
import { describe, it, expect } from 'vitest'
import { friendlyApiError } from './friendly-error'

describe('friendlyApiError', () => {
  it('maps gateway/key errors to a plain message', () => {
    const out = friendlyApiError('PayMongo API key invalid (401)')
    expect(out).toMatch(/payment provider/i)
    expect(out.toLowerCase()).not.toContain('api key')
  })
  it('falls back to a generic message for unknown strings', () => {
    expect(friendlyApiError('TypeError: undefined is not a function'))
      .toBe('Something went wrong. Please try again.')
  })
  // …one case per mapped category
})
```

**Verify**: `bun run --filter @monobase/org test -- friendly-error` → new tests
pass.

## Done criteria

ALL must hold:

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; `friendly-error.test.ts`
      exists and its cases pass
- [ ] `apps/org/src/lib/friendly-error.ts` exports `friendlyApiError`
- [ ] `grep -n "friendlyApiError" apps/org/src/features/payment-settings/use-gateway-config.ts apps/org/src/features/payment-settings/PaymentSettings.tsx apps/org/src/features/paylink/use-send-link.ts` returns 4 lines (one import each + the usages)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report (do not improvise) if:

- The "Current state" excerpts don't match the live code (drift since `d8501e09`).
- A test fails for a reason other than an updated expected error string.
- You find a server-error display site **not** listed here that also leaks raw
  strings — report it; don't expand scope silently.
- The member exemplar at `apps/member/src/features/auth/sign-in.ts` no longer
  contains `friendlyAuthError` (the pattern may have moved).

## Maintenance notes

- For a reviewer: confirm only **server-originated** strings flow through
  `friendlyApiError`, and the local `?? '…'` fallbacks are untouched (the
  regression risk is mapping an already-friendly literal to the generic).
- When new officer-facing money screens are added (e.g. refunds), route their
  server errors through `friendlyApiError` too.
- Plan 004 (e2e money flows) will assert on these friendly strings — keep the
  exact wording stable, or update 004's expectations together.
- Deferred: a fully shared cross-app error mapper in `@monobase/ui` was NOT done
  here (member and org have slightly different vocabularies); revisit only if a
  third app needs it.
