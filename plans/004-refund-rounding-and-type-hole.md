# Plan 004: Fix refund fund-reversal rounding drift + remove `as any` type hole

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report. When done, update the status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpt against the live code before editing; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (money path; the fix changes computed reversal amounts at the cent level)
- **Depends on**: none
- **Category**: bug (money correctness), tech-debt (type safety)
- **Planned at**: commit `dd2ff052`, 2026-06-18

## Why this matters

`processRefund` reverses a payment's fund allocations by computing each fund's
reversal **independently** with `Math.round`. Because each fund is rounded on its
own, the sum of the reversals can differ from the intended refund total by a cent
or more (classic split-rounding drift — e.g. a $100 refund split across 3 funds
can reverse $99.99 or $100.01). On a financial ledger that must reconcile, this
produces audit-trail mismatches that accumulate across refunds.

The same block casts allocations to `any` (`filter((a: any) => …)`,
`map((a: any) => …)`), discarding type safety on a money computation — if the
allocation contract drifts, the compiler won't catch it.

After this plan: the reversal amounts provably sum to the rounded refund total
(one fund absorbs the residual), the `any` casts are gone, and a test pins the
cent-drift case.

## Current state

`services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts:188-202`
```ts
      // --- Reverse fund allocations ---
      const allocations = await txRepo.getFundAllocations(paymentId);
      const originalAllocations = allocations.filter((a: any) => !a.isReversal);

      if (originalAllocations.length > 0) {
        const refundRatio = refundAmount / payment.amount;
        const reversals = originalAllocations.map((a: any) => ({
          paymentId,
          fundId: a.fundId,
          amount: -Math.round(a.amount * refundRatio),
          isReversal: true,
          organizationId: payment.organizationId,
        }));
        await txRepo.createFundAllocations(reversals);
      }
```

`amount` values are integer minor units (cents) — see the forward allocation
path earlier in this same file (the allocation/rounding logic around lines
60-75), which already applies a trailing-fund adjustment so allocations sum
exactly. The refund path independently re-derives reversals and does **not**
apply that adjustment. Mirror the forward path's approach.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0 |
| Run lifecycle tests | `cd services/api-ts && bun test src/handlers/member/membership/` | all pass, incl. new test |
| Lint | `cd services/api-ts && bun run lint` | exit 0 |

## Scope

**In scope**:
- `services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts`
  (the `processRefund` fund-reversal block only).
- A test file under `services/api-ts/src/handlers/member/membership/` covering
  the rounding behavior (new or extend an existing `membership-lifecycle` test).

**Out of scope** (do NOT touch):
- The membership-expiry-reset logic in `processRefund` (lines 208-223) and its
  `persistWithComputedStatus` call — unrelated to this fix.
- The forward allocation path — only read it as the pattern reference.
- `getFundAllocations` / `createFundAllocations` repository signatures — do not
  change the port contract. If the contract is the blocker, that is a STOP
  condition.

## Git workflow

- Branch: `fix/004-refund-rounding` (off `main`).
- Commit message: `fix(dues): make refund fund-reversals sum exactly (rounding drift)`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace per-fund rounding with residual-carrying distribution

Rewrite the `if (originalAllocations.length > 0) { … }` block so the integer
reversals provably sum to the rounded refund total. Preserve the existing
semantics (reversal proportional to `refundAmount / payment.amount`); only fix
the rounding so the last fund absorbs the residual. Also remove the `any` casts.

Target shape:
```ts
      // --- Reverse fund allocations ---
      const allocations = await txRepo.getFundAllocations(paymentId);
      type FundAllocation = Awaited<ReturnType<typeof txRepo.getFundAllocations>>[number];
      const originalAllocations = allocations.filter((a: FundAllocation) => !a.isReversal);

      if (originalAllocations.length > 0) {
        const refundRatio = refundAmount / payment.amount;
        const totalAllocated = originalAllocations.reduce((sum, a) => sum + a.amount, 0);
        // The integer reversals must sum to this rounded total — no per-fund drift.
        const targetTotal = Math.round(totalAllocated * refundRatio);

        let distributed = 0;
        const reversals = originalAllocations.map((a, i) => {
          const isLast = i === originalAllocations.length - 1;
          // Each fund rounds its own share, except the last, which takes the
          // residual so the totals reconcile exactly.
          const share = isLast ? targetTotal - distributed : Math.round(a.amount * refundRatio);
          distributed += share;
          return {
            paymentId,
            fundId: a.fundId,
            amount: -share,
            isReversal: true,
            organizationId: payment.organizationId,
          };
        });
        await txRepo.createFundAllocations(reversals);
      }
```

Notes:
- If the `FundAllocation` type alias causes a typecheck error because
  `getFundAllocations`'s return type lacks `isReversal` / `fundId` / `amount`,
  that reveals a real contract gap — **STOP and report** (do not paper over it
  with `any` again).
- Keep the surrounding code (the `processRefund` signature, status update, expiry
  reset) byte-for-byte unchanged.

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0.

### Step 2: Add a rounding regression test

Add a test that constructs a refund whose proportional split forces rounding
(e.g. a refund of an amount that does not divide evenly across 3 funds) and
asserts that `sum(reversal.amount) === -Math.round(totalAllocated * refundRatio)`
— i.e. exact reconciliation, no lost/extra cents.

**Verify**: `cd services/api-ts && bun test src/handlers/member/membership/` → all pass.

## Test plan

- Model the test after the existing membership-lifecycle tests in
  `services/api-ts/src/handlers/member/membership/` (find the file that already
  exercises `processRefund` or the fund-allocation helpers; reuse its mock
  `paymentPort` / `getFundAllocations` setup).
- Cases:
  - **Exact-split (regression)**: refund evenly divisible across funds → each
    reversal equals the old behavior; total is exact.
  - **Drift case (the fix)**: refund + allocations chosen so independent rounding
    would mis-sum (e.g. three funds of 3334/3333/3333 cents, 50% refund) → assert
    the reversals sum to exactly `-Math.round(totalAllocated * 0.5)`.
  - **Single fund**: one allocation → reversal equals `-Math.round(a.amount * ratio)`.
- Verification: `cd services/api-ts && bun test src/handlers/member/membership/`
  → all pass, including the new drift test.

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun test src/handlers/member/membership/` exits 0; new rounding test exists and passes
- [ ] `grep -n "(a: any)" services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts` returns no matches in the `processRefund` block (the `any` casts are gone)
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Only `membership-lifecycle.ts` and the test file changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The drift check shows the file changed and the excerpt no longer matches.
- Typing the allocation (removing `any`) surfaces that the `getFundAllocations`
  return type lacks the fields used here — report the contract gap; don't restore `any`.
- An existing test asserts the OLD per-fund rounding output exactly (it would
  now fail legitimately) — report it so the maintainer confirms the corrected
  amounts before you change the assertion.
- Tests fail twice after a reasonable fix attempt.

## Maintenance notes

- The last fund absorbs the rounding residual by design — a reviewer should
  confirm that is acceptable for the ledger (it is the same convention the
  forward allocation path uses).
- If refunds ever become multi-currency or per-fund refundable independently,
  this proportional model needs revisiting.
- Follow-up deferred: the broader `processRefund` concurrency concern
  (`persistWithComputedStatus` read-merge-write without a row lock) is a separate,
  larger issue — not addressed here.
