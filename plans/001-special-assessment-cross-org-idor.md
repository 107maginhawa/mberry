# Plan 001: Scope special-assessment lookups by organization (fix cross-org IDOR)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat dd2ff052..HEAD -- services/api-ts/src/handlers/member/duesspecialassessments services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (IDOR / multi-tenant isolation), bug
- **Planned at**: commit `dd2ff052`, 2026-06-18

## Why this matters

Memberry is multi-tenant by `organizationId`. Special assessments generate dues
invoices for an org's members — a money path. Four handlers fetch an assessment
by its raw id (`repo.findById(params.id)`) and act on it **without ever checking
the assessment belongs to the caller's organization**. The position gate
(`requirePosition([TREASURER, PRESIDENT])`) confirms the caller is an officer
*in their own org*, but not that the assessment id they passed belongs to that
org. A treasurer in org A who knows/guesses an assessment id from org B can
read its collection metrics, edit it, soft-delete it, or apply it (generating
invoices). This is a classic cross-tenant IDOR on a financial resource.

After this plan: every special-assessment lookup is scoped to the caller's
`organizationId`; a mismatched id returns 404 (no existence leak), and a
regression test proves cross-org access is blocked.

## Current state

The repository's `findById` is **not** org-scoped, while `listByOrg` right
below it shows the correct pattern:

`services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts:22`
```ts
  async findById(id: string) {
    const [result] = await this.db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.id, id));
    return result ?? null;
  }

  async listByOrg(organizationId: string) {
    return this.db
      .select()
      .from(specialAssessments)
      .where(eq(specialAssessments.organizationId, organizationId))
      .orderBy(desc(specialAssessments.createdAt));
  }
```

The table HAS an `organizationId` column (so scoping is cheap and indexed):
`services/api-ts/src/handlers/association:member/repos/special-assessments.schema.ts:39`
```ts
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  // ...
  orgIdx: index('special_assessment_org_idx').on(table.organizationId),
```

Four handlers call `findById(params.id)` with no org check:

1. `services/api-ts/src/handlers/member/duesspecialassessments/applySpecialAssessment.ts:31`
   — already has `const organizationId = ctx.get('organizationId') as string;` in scope.
2. `services/api-ts/src/handlers/member/duesspecialassessments/deleteSpecialAssessment.ts:27`
   — does NOT currently read `organizationId`.
3. `services/api-ts/src/handlers/member/duesspecialassessments/updateSpecialAssessment.ts:28`
   — does NOT currently read `organizationId`.
4. `services/api-ts/src/handlers/member/duesspecialassessments/getSpecialAssessmentCollection.ts:27`
   — does NOT currently read `organizationId`.

Example of the vulnerable pattern (`deleteSpecialAssessment.ts:22-28`):
```ts
  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const existing = await repo.findById(params.id);
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);
```

**Convention for org context**: officer-gated handlers read the org from
context via `ctx.get('organizationId') as string` — see the working example in
`applySpecialAssessment.ts:26`. `requirePosition` (called earlier in each
handler) resolves and validates the caller's org, so `organizationId` is
populated in context by the time the handler body runs.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck API | `cd services/api-ts && bun run typecheck` | exit 0, no errors |
| Run SA tests | `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` | all pass, incl. new tests |
| Lint (staged) | `cd services/api-ts && bun run lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `services/api-ts/src/handlers/association:member/repos/special-assessments.repo.ts` (add one method)
- `services/api-ts/src/handlers/member/duesspecialassessments/applySpecialAssessment.ts`
- `services/api-ts/src/handlers/member/duesspecialassessments/deleteSpecialAssessment.ts`
- `services/api-ts/src/handlers/member/duesspecialassessments/updateSpecialAssessment.ts`
- `services/api-ts/src/handlers/member/duesspecialassessments/getSpecialAssessmentCollection.ts`
- A new or existing test file under `services/api-ts/src/handlers/member/duesspecialassessments/` (see Test plan)

**Out of scope** (do NOT touch):
- The TypeSpec specs / generated routes — the route signatures don't change.
- `findById` callers OUTSIDE these four handlers (e.g. `repo.findById` used
  internally inside the repo at line ~121 for `getCollectionMetrics`) — those
  run after the handler has already org-scoped the lookup, so leave them.
- Any change to the HTTP response shape or status codes other than the
  not-found → 404 behavior described below.

## Git workflow

- Branch: `fix/001-special-assessment-org-scope` (off `main`).
- Conventional commits, matching repo style (see `git log`): e.g.
  `fix(dues): scope special-assessment lookups by org (cross-org IDOR)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an org-scoped lookup to the repository

In `special-assessments.repo.ts`, add a `findByIdAndOrg` method next to
`findById` (keep `findById` — it is still used internally by the repo):

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

`and` and `eq` are already imported at the top of the file (line 5:
`import { eq, and, sql, desc } from 'drizzle-orm';`).

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0.

### Step 2: Org-scope the four handlers

In each of the four handlers, read the org from context and use the new method.
The pattern (shown for `deleteSpecialAssessment.ts`):

Replace:
```ts
  const params = ctx.req.valid('param');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const existing = await repo.findById(params.id);
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);
```
with:
```ts
  const params = ctx.req.valid('param');
  const organizationId = ctx.get('organizationId') as string;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new SpecialAssessmentRepository(db);

  const existing = await repo.findByIdAndOrg(params.id, organizationId);
  if (!existing) return ctx.json({ error: 'Assessment not found' }, 404);
```

Apply the equivalent change in all four:
- `applySpecialAssessment.ts` — it already has `organizationId` in scope (line 26);
  just change `repo.findById(params.id)` → `repo.findByIdAndOrg(params.id, organizationId)`.
- `deleteSpecialAssessment.ts` — add the `organizationId` line, change the call,
  keep the `existing` variable name.
- `updateSpecialAssessment.ts` — add the `organizationId` line, change the call,
  keep the `existing` variable name.
- `getSpecialAssessmentCollection.ts` — add the `organizationId` line, change
  `assessment` to come from `findByIdAndOrg`.

Returning 404 (not 403) on a cross-org id is deliberate: it does not reveal that
the assessment exists in another org.

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0.

### Step 3: Add regression tests

See Test plan. Write a test that proves a caller scoped to org A cannot reach an
assessment owned by org B (expect 404), and that same-org access still works.

**Verify**: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` → all pass.

## Test plan

- Find the existing test pattern: look for a sibling test in
  `services/api-ts/src/handlers/member/duesspecialassessments/*.test.ts`
  (e.g. an existing `applySpecialAssessment.test.ts` or repository test) and
  model fixtures/setup after it. If none exists, model after any handler test
  under `services/api-ts/src/handlers/member/` that seeds two organizations.
- New test cases (one file, e.g. `special-assessment-org-isolation.test.ts`):
  - **Cross-org blocked**: seed assessment in org B; call each of the four
    handlers as a treasurer of org A with org B's assessment id → expect 404.
  - **Same-org allowed**: seed assessment in org A; call as treasurer of org A
    → expect the normal success path (200 / existing behavior).
  - **Not-found unchanged**: random id in caller's own org → 404 (regression).
- Verification: `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/`
  → all pass, including the new cross-org tests.

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun test src/handlers/member/duesspecialassessments/` exits 0; new cross-org isolation tests exist and pass
- [ ] `grep -rn "repo.findById(params.id)" services/api-ts/src/handlers/member/duesspecialassessments/` returns no matches (all four switched to `findByIdAndOrg`)
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows any in-scope file changed since `dd2ff052` and the
  "Current state" excerpts no longer match.
- `ctx.get('organizationId')` is `undefined` at runtime in any of the four
  handlers (i.e. the org is not in context for these routes) — the fix then
  needs a different org source (path param / body), which is a design decision
  to escalate, not guess.
- A handler turns out to already scope by org through some other mechanism you
  discover (then that handler is not vulnerable — note it and skip it).
- Tests fail twice after a reasonable fix attempt.

## Maintenance notes

- Any NEW handler in `member/duesspecialassessments/` that loads an assessment
  by id MUST use `findByIdAndOrg`, not `findById`. Consider this the canonical
  lookup for request-scoped access.
- A reviewer should confirm the 404 (not 403) choice is intentional and that no
  test asserts a 403 for cross-org access.
- Follow-up deferred: audit other `member/` repos (chapters, governance,
  credentials, credits, directory) for the same `findById`-without-org pattern.
  Out of scope here to keep the change reviewable; track separately if desired.
