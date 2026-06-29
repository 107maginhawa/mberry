# Plan 006: Give the dues dashboard a real error+retry state (no dead-end)

> **Executor instructions**: Follow step by step. Run every verification command and confirm the expected result before moving on. If a "STOP condition" occurs, stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a024135..HEAD -- apps/org/src/features/dues`
> If `DuesView.tsx` or `use-dues.ts` changed, compare the excerpts below to live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Depends on**: none
- **Risk**: LOW
- **Category**: bug
- **Planned at**: commit `4a024135`, 2026-06-29

## Why this matters

The dues page is the product's core money screen. Today, if the **dashboard** query (`useDuesDashboard`) errors, the page shows a permanent dead-end ("Could not load dues data.") with only a link back to the roster — no retry. The Recent-payments and Outstanding-invoices sections already have proper error+retry; the dashboard is the odd one out, and because the container bails on `!stats` it takes the *whole* page down even if payments/invoices loaded fine. Non-technical officers can't recover without a full page refresh. This aligns the dashboard with the existing error+retry pattern already used two sections below it.

## Current state

`apps/org/src/features/dues/use-dues.ts` — `useDuesDashboard` returns NO `refetch` (only `data`/`isLoading`/`isError`):

```ts
export function useDuesDashboard(orgId: string | null): {
  data?: DuesStats
  isLoading: boolean
  isError: boolean
} {
  const q = useQuery({ queryKey: ['dues', 'dashboard', orgId], enabled: !!orgId, retry: false, queryFn: async () => { /* … */ } })
  return { data: q.data, isLoading: q.isLoading, isError: q.isError }
}
```

`apps/org/src/features/dues/DuesView.tsx` — the container destructures only `data`/`isLoading` for stats, and the `!stats` branch is a dead-end:

```tsx
export function Dues() {
  const { orgId } = useSelectedOrg()
  const { data: stats, isLoading: statsLoading } = useDuesDashboard(orgId)             // ← no isError, no refetch
  const { data: payments = [], isLoading: paymentsLoading, isError: paymentsError, refetch: refetchPayments } = useRecentPayments(orgId)
  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useOutstandingInvoices(orgId)

  if (statsLoading || paymentsLoading || invoicesLoading) { /* skeleton */ }

  if (!stats) {                                                                         // ← reached when stats ERRORS; dead-end
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="max-w-lg mx-auto pt-4 p-4">
          <Link to="/" className="inline-flex min-h-tap items-center text-body font-medium text-primary underline">Roster</Link>
          <p className="mt-4 text-body text-muted-foreground">Could not load dues data.</p>
        </div>
      </div>
    )
  }
  /* … renders <DuesView .../> … */
}
```

The pattern to mirror is the payments/invoices error handling already in this file: `<ErrorState message="…" onRetry={…} />` (from `@monobase/ui`, already imported at the top of `DuesView.tsx`), wired to a query `refetch`.

## Commands you will need

| Purpose   | Command                                            | Expected |
|-----------|----------------------------------------------------|----------|
| Typecheck | `bun run --filter @monobase/org typecheck`         | exit 0   |
| Tests     | `bun run --filter @monobase/org test`              | all pass |
| One file  | `bun run --filter @monobase/org test -- use-dues`  | pass     |

Run from repo root `/Users/elad-mini/Desktop/memberry`.

## Scope

**In scope**:
- `apps/org/src/features/dues/use-dues.ts` (add `refetch` to `useDuesDashboard`)
- `apps/org/src/features/dues/DuesView.tsx` (use `isError`/`refetch`, replace the dead-end)
- `apps/org/src/features/dues/use-dues.test.tsx` (add a case for the new `refetch`/error)

**Out of scope**: the other two dues hooks' behavior, the generated SDK, the engine, any other route.

## Git workflow

- Branch: `advisor/006-dues-error-retry`. Conventional commit, e.g. `fix(org): dues dashboard error shows a retry instead of a dead-end`. Do NOT push/PR unless instructed.

## Steps

### Step 1: Expose `refetch` + `isError` from `useDuesDashboard`

In `use-dues.ts`, change the return type and value to also return `refetch`:

```ts
export function useDuesDashboard(orgId: string | null): {
  data?: DuesStats
  isLoading: boolean
  isError: boolean
  refetch: () => void
} {
  const q = useQuery({ /* unchanged */ })
  return { data: q.data, isLoading: q.isLoading, isError: q.isError, refetch: () => void q.refetch() }
}
```

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 2: Wire the dashboard error+retry in the container

In `DuesView.tsx`'s `Dues()` container, destructure the new fields and replace the `!stats` dead-end with a real error state that mirrors the payments/invoices pattern. Keep the loading skeleton as-is. The new logic:

```tsx
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useDuesDashboard(orgId)
  // …payments/invoices unchanged…

  if (statsLoading || paymentsLoading || invoicesLoading) { /* unchanged skeleton */ }

  if (statsError || !stats) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <div className="max-w-lg mx-auto pt-4 p-4 flex flex-col gap-4">
          <h1 className="text-title font-semibold text-foreground">Dues</h1>
          <ErrorState message="We couldn't load the dues summary." onRetry={() => void refetchStats()} />
        </div>
      </div>
    )
  }
```

`ErrorState` is already imported in this file. Do not change the success render.

**Verify**: `bun run --filter @monobase/org typecheck` → exit 0.

### Step 3: Test

Add/extend a case in `use-dues.test.tsx` proving `useDuesDashboard` exposes a callable `refetch` and surfaces `isError` on failure. Model on the existing `useDuesDashboard` tests in that file (same `vi.mock`, `wrapper`, `waitFor`). For the error case, make `getDuesDashboard` reject or return `{ data: undefined }` and assert `isError` becomes true and `typeof result.current.refetch === 'function'`.

**Verify**: `bun run --filter @monobase/org test -- use-dues` → all pass.

## Test plan

- New: `useDuesDashboard` error case (isError true, refetch is a function). Pattern: existing dues hook tests in `use-dues.test.tsx`.
- Full suite stays green.

## Done criteria

- [ ] `bun run --filter @monobase/org typecheck` exits 0
- [ ] `bun run --filter @monobase/org test` exits 0; new dashboard-error/refetch case passes
- [ ] `grep -n "refetch" apps/org/src/features/dues/use-dues.ts` shows `useDuesDashboard` returning refetch
- [ ] `grep -n "Could not load dues data" apps/org/src/features/dues/DuesView.tsx` returns nothing (dead-end removed)
- [ ] Only the 3 in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 006 updated

## STOP conditions

Stop and report if: the excerpts don't match live code (drift); a test fails for an unrelated reason; making the change appears to require touching the other dues hooks or the SDK.

## Maintenance notes

- Reviewer: confirm the loading guard still precedes the error guard (a loading state must not be mistaken for an error). The condition is `statsError || !stats` so a successful-but-empty dashboard (all zeros) still renders normally — verify zeros are a valid success, not an error.
- If e2e plan 004's `dues-flow.spec.ts` already asserts an error+retry on the invoices path, consider adding a dashboard-error case there too (optional, not required here).
