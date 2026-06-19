# Plan 007: Fix month-end overflow in membership expiry date math (use date-fns)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. When done, update
> the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 23a91932..HEAD -- services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before editing; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (date math correctness)
- **Planned at**: commit `23a91932`, 2026-06-19

## Why this matters

`computeNewExpiry` extends a member's `dues_expiry_date` by a billing cycle using
hand-rolled `Date.prototype.setMonth` arithmetic. `setMonth` overflows on
month-end dates: adding months to e.g. Aug 31 lands on a day that doesn't exist
in the target month and JS rolls it forward (Aug 31 + 6 months → "Feb 31" →
Mar 2/3). So a member whose expiry falls on the 29th–31st can receive an expiry
1–3 days off the intended date, and the "severely lapsed" threshold
(`subtractMonths`) drifts the same way, occasionally misclassifying a lapse at a
month boundary. `date-fns` (already a dependency, `^4.1.0`, used elsewhere in the
codebase) provides `addMonths`/`subMonths` which clamp to the last valid day of
the target month (Aug 31 + 6 → Feb 28/29). The fix is a drop-in swap of two
helpers, preserving every comparison and branch.

## Current state

`services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` —
full file is 66 lines. The two hand-rolled helpers and their use:

```ts
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

export function computeNewExpiry(input: ExpiryExtensionInput): Date {
  const today = input.today ?? new Date();
  const cycleMonths = getCycleMonths(input.billingCycle, input.customMonths);

  // No existing expiry (e.g. first payment) → today + one cycle
  if (!input.currentExpiry) {
    return addMonths(today, cycleMonths);
  }

  // Check if severely lapsed: expiry is MORE THAN one billing cycle in the past
  const severeLapseThreshold = subtractMonths(today, cycleMonths);

  if (input.currentExpiry < severeLapseThreshold) {
    // Severely lapsed → reset from today
    return addMonths(today, cycleMonths);
  }

  // Standard: extend from current expiry
  return addMonths(input.currentExpiry, cycleMonths);
}
```

Repo convention: `date-fns` is imported as named functions, e.g.
`import { addMonths } from 'date-fns'` — see existing usage in
`services/api-ts/src/handlers/booking/listEventSlots.ts` and
`services/api-ts/src/handlers/booking/repos/scheduleException.repo.ts`.

There is an existing test: `expiry-extension.test.ts` in the same directory —
use it as the structural pattern and extend it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Drift check | `git diff --stat 23a91932..HEAD -- services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` | empty or matching excerpt |
| Confirm date-fns dep | `grep -n '"date-fns"' services/api-ts/package.json` | `"date-fns": "^4.1.0"` |
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0 |
| Run expiry + renewal tests | `cd services/api-ts && bun test src/handlers/member/membership/` | all pass |
| Lint | `cd services/api-ts && bun run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` —
  replace the two local helpers with `date-fns`; do not change `computeNewExpiry`'s
  control flow.
- `services/api-ts/src/handlers/member/membership/utils/expiry-extension.test.ts`
  — add month-end cases.

**Out of scope** (do NOT touch):
- The branch logic, comparisons (`<`), or the "exactly one cycle ago uses
  standard extension" semantics — they stay identical; only the underlying
  add/subtract-months implementation changes.
- `getCycleMonths`, the `BillingCycle` type, or `ExpiryExtensionInput`.
- Any caller of `computeNewExpiry` (`renewMembership`, `markDuesInvoicePaid`,
  `membership-lifecycle.ts`) — the function signature and return type are unchanged.

## Git workflow

- Branch: `fix/007-expiry-month-end-overflow` (off the current branch).
- Commit message: `fix(membership): clamp month-end expiry dates via date-fns (was setMonth overflow)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace the local helpers with date-fns

Add `import { addMonths, subMonths } from 'date-fns';` at the top of
`expiry-extension.ts`, then delete the local `addMonths` and `subtractMonths`
functions. Replace the single call `subtractMonths(today, cycleMonths)` inside
`computeNewExpiry` with `subMonths(today, cycleMonths)`. The local `addMonths`
name matches the date-fns export, so the existing `addMonths(...)` call sites
inside `computeNewExpiry` resolve to the import once the local function is
removed — confirm there is no remaining local `function addMonths`.

Leave every comparison, branch, and comment in `computeNewExpiry` unchanged.

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `grep -n "setMonth" services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` → no matches

### Step 2: Add month-end regression tests

Extend `expiry-extension.test.ts` with cases that the old `setMonth` arithmetic
got wrong and date-fns gets right:
- **annual, month-end expiry**: `currentExpiry = 2025-08-31`, `billingCycle =
  'annual'`, not lapsed → result is `2026-08-31` (a real date; the old code would
  also land here since +12 months preserves the month, but assert it to lock it in).
- **semi-annual, month-end overflow**: `currentExpiry = 2025-08-31`,
  `billingCycle = 'semi-annual'` (6 months) → result clamps to `2026-02-28`
  (2026 is not a leap year), NOT March. This is the case the old code got wrong.
- **leap-year clamp** (result lands in a leap February): `currentExpiry =
  2023-08-31`, `'semi-annual'` (6 months) → `2024-02-29` (2024 is a leap year, so
  the clamp is the 29th, not the 28th).
- **first payment (no expiry)** and **severely lapsed** cases near a month
  boundary, using the injectable `today` field, to confirm the threshold path
  still behaves.

Assert on the date's year/month/day components (avoid raw timezone-sensitive
`toISOString()` equality unless the existing tests already do that — match the
existing test's assertion style).

**Verify**: `cd services/api-ts && bun test src/handlers/member/membership/` → all pass, including the new cases.

## Test plan

- Extend `services/api-ts/src/handlers/member/membership/utils/expiry-extension.test.ts`
  (model new cases on the existing ones there — same import, same `today`
  injection pattern).
- Cases: annual month-end, semi-annual month-end overflow (the regression),
  leap-year Feb clamp, first-payment, severely-lapsed-at-boundary.
- Verification: `cd services/api-ts && bun test src/handlers/member/membership/` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `grep -n "setMonth" services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` → no matches
- [ ] `grep -n "from 'date-fns'" services/api-ts/src/handlers/member/membership/utils/expiry-extension.ts` → shows `addMonths, subMonths`
- [ ] `cd services/api-ts && bun test src/handlers/member/membership/` exits 0; the new month-end cases pass
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Only `expiry-extension.ts` and `expiry-extension.test.ts` changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows the file changed and the excerpt no longer matches.
- An existing test in `expiry-extension.test.ts` asserts the OLD overflowed
  behavior (e.g. expects a March date from an Aug 31 + 6mo input) — report it
  before changing it; it may encode a deliberate (if surprising) business rule.
- `date-fns` `addMonths`/`subMonths` are not resolvable (the dep is missing or a
  major version with a different API) — report; do not hand-roll a clamp.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- For a reviewer: confirm no behavioral branch changed — the only intended
  difference is month-end day clamping. Diff `computeNewExpiry`'s body; only the
  `subtractMonths`→`subMonths` rename should appear there.
- If `customMonths` ever allows non-integer or very large values, re-verify
  date-fns handles them as expected.
- The same `setMonth`-overflow pattern may exist in other date helpers; this plan
  fixes only `expiry-extension.ts`. A follow-up sweep
  (`grep -rn "setMonth\|setDate" services/api-ts/src/handlers`) could catch
  siblings, but is out of scope here.
