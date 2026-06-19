# Plan 005: Collapse dues-metrics trailing-rates N+1 into a single query

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before editing; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: performance
- **Planned at**: commit `dd2ff052`, 2026-06-18

## Why this matters

`computeTrailingRates` issues one database query per time window inside a `for`
loop (30/90/365 days) — three sequential round-trips to compute one metrics
object that loads on the dues dashboard. The three queries scan the same table
with the same org filter and differ only by date cutoff, so they collapse
cleanly into a single query with three conditional aggregates. This removes two
round-trips per dashboard load with no behavior change.

It is a small, low-risk, fully test-able win — a good warm-up task with a clean
verification story.

## Current state

`services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` (around line 410):
```ts
  private async computeTrailingRates(organizationId: string, windows: number[]) {
    const results: Record<string, number> = {};

    for (const days of windows) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const [stats] = await this.db
        .select({
          collected: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' AND ${duesPayments.paidAt} >= ${cutoff} THEN amount ELSE 0 END), 0)::int`,
          total: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.createdAt} >= ${cutoff} THEN amount ELSE 0 END), 0)::int`,
        })
        .from(duesPayments)
        .where(eq(duesPayments.organizationId, organizationId));

      const collected = stats?.collected ?? 0;
      const total = stats?.total ?? 0;
      results[`days${days}`] = total > 0 ? Math.round((collected / total) * 100) : 0;
    }

    return results as { days30: number; days90: number; days365: number };
  }
```

The return type fixes the windows to `days30 / days90 / days365`. Confirm the
caller passes `[30, 90, 365]` (search `computeTrailingRates(` in the same file).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Find caller | `grep -n 'computeTrailingRates' services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` | the call site + the windows passed |
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0 |
| Run dues tests | `cd services/api-ts && bun test src/handlers/dues/` | all pass |
| Lint | `cd services/api-ts && bun run lint` | exit 0 |

## Scope

**In scope**:
- `services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts` —
  `computeTrailingRates` only.
- A test under `services/api-ts/src/handlers/dues/` proving the metrics are
  unchanged (new or extend existing).

**Out of scope** (do NOT touch):
- `computeMonthlyBreakdown`, `computeStatusDistribution`, `computeTopUnpaid`, or
  the `computeDuesMetrics` orchestrator — only the trailing-rates method changes.
- The return shape `{ days30, days90, days365 }` and the percentage rounding
  semantics — they must stay identical.

## Git workflow

- Branch: `perf/005-dues-trailing-rates-query` (off `main`).
- Commit message: `perf(dues): compute trailing rates in one query (was 3)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Compute the three cutoffs, then one query

Replace the loop with three precomputed cutoff dates and a single `select` that
emits a collected/total pair per window using conditional aggregates. Preserve
the exact percentage math and return shape:

```ts
  private async computeTrailingRates(organizationId: string, windows: number[]) {
    const cutoff = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d;
    };
    const [c30, c90, c365] = [cutoff(30), cutoff(90), cutoff(365)];

    const [stats] = await this.db
      .select({
        collected30: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' AND ${duesPayments.paidAt} >= ${c30} THEN amount ELSE 0 END), 0)::int`,
        total30: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.createdAt} >= ${c30} THEN amount ELSE 0 END), 0)::int`,
        collected90: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' AND ${duesPayments.paidAt} >= ${c90} THEN amount ELSE 0 END), 0)::int`,
        total90: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.createdAt} >= ${c90} THEN amount ELSE 0 END), 0)::int`,
        collected365: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' AND ${duesPayments.paidAt} >= ${c365} THEN amount ELSE 0 END), 0)::int`,
        total365: sql<number>`COALESCE(SUM(CASE WHEN ${duesPayments.createdAt} >= ${c365} THEN amount ELSE 0 END), 0)::int`,
      })
      .from(duesPayments)
      .where(eq(duesPayments.organizationId, organizationId));

    const pct = (collected: number, total: number) => (total > 0 ? Math.round((collected / total) * 100) : 0);

    return {
      days30: pct(stats?.collected30 ?? 0, stats?.total30 ?? 0),
      days90: pct(stats?.collected90 ?? 0, stats?.total90 ?? 0),
      days365: pct(stats?.collected365 ?? 0, stats?.total365 ?? 0),
    };
  }
```

The `windows` parameter becomes effectively fixed to 30/90/365 (it already was,
via the return type). Keep the parameter in the signature to avoid touching the
caller, OR if the caller is the only one and passes `[30,90,365]`, you may leave
it unused — do not change the call site.

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0.

### Step 2: Prove the metrics are unchanged

Add/extend a test that seeds dues payments across the three windows and asserts
the same `{ days30, days90, days365 }` percentages the old loop produced.

**Verify**: `cd services/api-ts && bun test src/handlers/dues/` → all pass.

## Test plan

- Model after any existing repo/handler test under
  `services/api-ts/src/handlers/dues/` that seeds `duesPayments` rows.
- Seed payments with `paidAt`/`createdAt`/`status`/`amount` spanning the three
  windows; assert the returned percentages match hand-computed expectations.
- Include an empty-data case → all three rates `0` (the `total > 0 ? … : 0` path).
- Verification: `cd services/api-ts && bun test src/handlers/dues/` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun test src/handlers/dues/` exits 0; the metrics test passes
- [ ] `computeTrailingRates` issues exactly one `this.db.select(...)` (no `for` loop with an awaited query inside it) — confirm by reading the method
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Only `dues-payments.repo.ts` and the test file changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The drift check shows the file changed and the excerpt no longer matches.
- The caller passes windows other than `[30, 90, 365]` (then the hardcoded
  three-window query is wrong — report it; a dynamic version is a bigger change).
- The metrics test produces different percentages than the old implementation
  for the same seed data (a real behavior change — investigate before asserting).

## Maintenance notes

- If a fourth trailing window is ever needed, this query must add another
  collected/total pair and the return shape must grow — at that point consider
  a generated-per-window approach instead of hardcoded columns.
- A reviewer should confirm the `paidAt` vs `createdAt` columns in each
  conditional aggregate match the original exactly (collected uses `paidAt`,
  total uses `createdAt`).
