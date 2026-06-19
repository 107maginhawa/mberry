# GOAL: Execute advisor improvement plans 001–005

> **For the executor**: This is a single self-contained work order covering five
> independent improvements. Do them **in order**. After EACH task: run its
> verification, and if green, **commit** before starting the next (so every task
> is independently revertable). If any STOP condition fires, stop and report —
> do not improvise or continue to the next task. Update the status table at the
> bottom as you go.
>
> You have zero prior context — everything you need is in this file. Do not read
> the other files in `plans/` unless told to; they are the same content split up.
>
> **Global preconditions** (run once, before Task 1):
> - `git rev-parse --short HEAD` — record it. This plan was written against `dd2ff052`.
> - `git status` — working tree should be clean. If not, STOP and report.
> - Each task has a "Drift check" — run it first; if the cited code no longer
>   matches the excerpt, STOP and report that task.
>
> **Repo facts** (verified):
> - Package manager: **bun**. Conventional commits (e.g. `fix(dues): …`).
> - Money amounts are integer minor units (cents).
> - Multi-tenant by `organizationId`.
> - Verification commands are per-task below; all are read-safe.

---

## Task 1 — Fix special-assessment cross-org IDOR  (P1, security, effort M)

**Why**: Four handlers load a special assessment by raw id and act on it (read
metrics / edit / soft-delete / apply → generates dues invoices) **without
checking it belongs to the caller's org**. A treasurer in org A can reach org
B's assessment by id. Money path + tenant breach.

**Drift check**:
`git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/member/duesspecialassessments services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts`

**Current state** — `services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts:22`:
```ts
  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.id, id));
    return result ?? null;
  }
```
The table has an indexed `organizationId` column (`special-assessments.schema.ts:39`).
`and`, `eq` are already imported in the repo file.

Four handlers call `findById(params.id)` with no org check:
- `member/duesspecialassessments/applySpecialAssessment.ts:31` (already has `const organizationId = ctx.get('organizationId') as string;`)
- `member/duesspecialassessments/deleteSpecialAssessment.ts:27` (no org read yet)
- `member/duesspecialassessments/updateSpecialAssessment.ts:28` (no org read yet)
- `member/duesspecialassessments/getSpecialAssessmentCollection.ts:27` (no org read yet)

**Step 1.1** — add an org-scoped lookup to the repo (keep `findById`; it's used internally elsewhere):
```ts
  async findByIdAndOrg(id: string, organizationId: string) {
    const [result] = await this.db
      .select()
      .from(specialAssessments)
      .where(
        and(
          eq(specialAssessments.id, id),
          eq(specialAssessments.organizationId, organizationId),
        ),
      );
    return result ?? null;
  }
```

**Step 1.2** — in each of the four handlers, ensure `organizationId` is read
from context and switch the lookup. Pattern:
```ts
  const organizationId = ctx.get('organizationId') as string; // add where missing
  // ...
  const existing = await repo.findByIdAndOrg(params.id, organizationId); // was repo.findById(params.id)
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);
```
(In `applySpecialAssessment.ts` the `organizationId` line already exists; just
change the call. Keep each handler's existing variable name — `existing` or
`assessment`.) Return 404 (not 403) on cross-org id — no existence leak.

**Step 1.3** — add a regression test under
`services/api-ts/src/handlers/member/duesspecialassessments/` (model after a
sibling test that seeds two orgs): caller in org A + org B's assessment id →
404 for all four handlers; same-org → normal success.

**Verify** (all must pass):
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` → all pass
- `grep -rn "repo.findById(params.id)" services/api-ts/src/handlers/member/duesspecialassessments/` → no matches

**Commit**: `fix(dues): scope special-assessment lookups by org (cross-org IDOR)`

**STOP if**: `ctx.get('organizationId')` is undefined at runtime for any handler
(org not in context → different fix needed); a handler already scopes by org via
another mechanism (skip it, note it); tests fail twice.

---

## Task 2 — Bump vulnerable dependencies  (P1, security, effort S)

**Why**: `bun audit` flags hono `4.12.22` (`<4.12.25`; HIGH CORS reflect
GHSA-88fw-hqm2-52qc + 3 moderate), form-data (`<4.0.6`; HIGH CRLF
GHSA-hmw2-7cc7-3qxx), @opentelemetry/core (`<2.8.0`; moderate DoS). All on the
runtime/build path.

**Drift check**: `bun audit` — confirm these advisories still appear. If already
clean, mark Task 2 REJECTED (someone fixed it) and skip to Task 3.

**Step 2.1** — `cd /Users/elad-mini/Desktop/memberry && bun update hono`.
Confirm installed `>=4.12.25` (`cat services/api-ts/node_modules/hono/package.json | grep '"version"'`,
or root `node_modules/hono/...` if hoisted). If it doesn't reach 4.12.25, set
`"hono": "^4.12.25"` in `services/api-ts/package.json` and `bun install`.

**Step 2.2** — for the transitive `form-data` and `@opentelemetry/core`, try
`bun update` first; if the advisory persists, extend the **existing** `overrides`
block in root `package.json`:
```jsonc
"form-data": ">=4.0.6",
"@opentelemetry/core": ">=2.8.0"
```
then `bun install`.

**Verify**:
- `bun audit` → no HIGH/moderate for hono, form-data, @opentelemetry/core
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun test` → all pass
- `cd services/api-ts && bun run build` → exit 0

**Commit**: `chore(deps): bump hono/form-data/@opentelemetry to patched versions`

**STOP if**: a bump forces a breaking source change (do NOT edit source — report);
an `overrides` entry causes an unresolvable peer conflict.

---

## Task 3 — Correct CLAUDE.md handler-topology drift  (P2, docs, effort S)

**Why**: `CLAUDE.md` "Business Domain Modules" says handlers live under
`services/api-ts/src/handlers/association:member/` (~193). Actually handlers
moved to `handlers/member/<sub>/` (decomposition closed 2026-06-07, see ROADMAP);
`association:member/` now holds only shared repos/schemas; standalone
`membership/` and `dues/` also exist. Stale doc misleads every agent/dev.

**Drift check**: `git diff --stat dd2ff052..HEAD -- CLAUDE.md`

**Step 3.1** — establish ground truth:
- `ls -d services/api-ts/src/handlers/member/*/` (expect: certificates, chapters,
  credentials, credits, directory, duesspecialassessments, governance, membership)
- `ls services/api-ts/src/handlers/association:member/` (expect: `repos/` + maybe more)
- `find services/api-ts/src/handlers/member -name '*.ts' -not -name '*.test.ts' | wc -l` (a current count to cite)

**Step 3.2** — in `CLAUDE.md` (`grep -n 'Business Domain Modules' CLAUDE.md`),
rewrite the stale `association:member` / `association:operations` description to
state: (1) handler entrypoints now live under `handlers/member/<sub>/` — list the
real subdirs; (2) `handlers/association:member/` still holds shared repos/schemas
(imported via `@/handlers/association:member/repos/...`); (3) standalone
`membership/` and `dues/` remain; (4) cite ROADMAP for history. Keep the file's
markdown style + the "numbers may drift — re-run …" hedge for counts.

**Verify**:
- `grep -n 'association:member' CLAUDE.md` → every remaining mention refers to
  repos/schemas, not where handlers live
- every directory path named in the edited section resolves on disk

**Commit**: `docs: correct CLAUDE.md handler topology post-decomposition`

**STOP if**: actual layout doesn't match Step 3.1 (report real layout).

---

## Task 4 — Fix refund fund-reversal rounding + remove `as any`  (P2, money bug, effort S, risk MED)

**Why**: `processRefund` rounds each fund's reversal independently → the
reversals can mis-sum vs the refund total (cent drift on a ledger). Also casts
allocations to `any`.

**Drift check**:
`git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts`

**Current state** — `membership-lifecycle.ts:188-202`:
```ts
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

**Step 4.1** — replace with residual-carrying distribution (last fund absorbs
the rounding residual so totals reconcile) and drop the `any`:
```ts
      const allocations = await txRepo.getFundAllocations(paymentId);
      type FundAllocation = Awaited<ReturnType<typeof txRepo.getFundAllocations>>[number];
      const originalAllocations = allocations.filter((a: FundAllocation) => !a.isReversal);

      if (originalAllocations.length > 0) {
        const refundRatio = refundAmount / payment.amount;
        const totalAllocated = originalAllocations.reduce((sum, a) => sum + a.amount, 0);
        const targetTotal = Math.round(totalAllocated * refundRatio);

        let distributed = 0;
        const reversals = originalAllocations.map((a, i) => {
          const isLast = i === originalAllocations.length - 1;
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
Leave the rest of `processRefund` (status update, expiry reset) unchanged.

**Step 4.2** — add a rounding test under
`services/api-ts/src/handlers/member/membership/` (model after the existing test
that exercises `processRefund`): a refund + allocations where independent
rounding would mis-sum (e.g. funds 3334/3333/3333 cents, 50% refund) → assert
`sum(reversal.amount) === -Math.round(totalAllocated * refundRatio)`.

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun test src/handlers/member/membership/` → all pass
- `grep -n "(a: any)" services/api-ts/src/handlers/member/membership/utils/membership-lifecycle.ts` → no matches in the refund block

**Commit**: `fix(dues): make refund fund-reversals sum exactly (rounding drift)`

**STOP if**: removing `any` reveals `getFundAllocations` return type lacks
`isReversal`/`fundId`/`amount` (report the contract gap, don't restore `any`); an
existing test asserts the OLD per-fund amounts (report before changing it).

---

## Task 5 — Collapse dues-metrics trailing-rates N+1  (P3, perf, effort S)

**Why**: `computeTrailingRates` runs one query per window (30/90/365) in a loop —
3 round-trips per dues-dashboard load. Collapse to one query, no behavior change.

**Drift check**:
`git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts`

**Current state** — `dues-payments.repo.ts` (~line 410): a `for (const days of windows)`
loop, each iteration awaiting a `this.db.select(...)` over `duesPayments`,
returning `{ days30, days90, days365 }`. Confirm caller passes `[30,90,365]`
(`grep -n 'computeTrailingRates' services/api-ts/src/handlers/dues/repos/dues-payments.repo.ts`).

**Step 5.1** — replace the loop with one query (six conditional aggregates) +
the same percentage math:
```ts
  private async computeTrailingRates(organizationId: string, windows: number[]) {
    const cutoff = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d; };
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
    const pct = (c: number, t: number) => (t > 0 ? Math.round((c / t) * 100) : 0);
    return {
      days30: pct(stats?.collected30 ?? 0, stats?.total30 ?? 0),
      days90: pct(stats?.collected90 ?? 0, stats?.total90 ?? 0),
      days365: pct(stats?.collected365 ?? 0, stats?.total365 ?? 0),
    };
  }
```
Do not change the caller. Note: `collected` uses `paidAt`, `total` uses `createdAt`
— keep that exactly.

**Step 5.2** — add/extend a test under `services/api-ts/src/handlers/dues/`
seeding payments across the windows; assert the same percentages the loop gave,
plus empty-data → all `0`.

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun test src/handlers/dues/` → all pass
- `computeTrailingRates` has exactly one `this.db.select(...)` and no awaited query inside a loop

**Commit**: `perf(dues): compute trailing rates in one query (was 3)`

**STOP if**: caller passes windows other than `[30,90,365]`; metrics differ from
the old impl for the same seed data.

---

## Final gate (after all tasks)

- [ ] `cd services/api-ts && bun run typecheck` → exit 0
- [ ] `cd services/api-ts && bun test` → all pass
- [ ] `bun audit` → no HIGH/moderate for hono/form-data/@opentelemetry/core
- [ ] `cd services/api-ts && bun run build` → exit 0
- [ ] `git log --oneline -6` shows the five commits (one per task)
- [ ] `git status` clean

## Status table (update as you go)

| Task | Title | Status |
|------|-------|--------|
| 1 | SA cross-org IDOR | DONE (50b27292) |
| 2 | Bump vulnerable deps | DONE (1f13f76b) — audit env-blocked, verified via lockfile; build/test pre-existing fails proven baseline-identical |
| 3 | CLAUDE.md topology | DONE (d098fcb0) |
| 4 | Refund rounding | DONE (0ae885dc) |
| 5 | Dues-metrics N+1 | DONE (23a91932) |

Status: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason)
