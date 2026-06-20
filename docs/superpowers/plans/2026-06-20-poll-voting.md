# Poll Voting (+ member-survey foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member discover an active poll, vote, and see live aggregated results — by fixing the broken member-survey respond flow (discover + open) and adding a poll results view.

**Architecture:** Small shared backend foundation (a member "active surveys for me incl. unanswered" LEFT-JOIN query + `getSurvey` member-read of active surveys, returning `pollResults` for polls), then frontend poll-results UX in the existing `SurveyFlow`. Vote submission + aggregation already exist server-side and are reused unchanged. The foundation also front-loads the next feature (NPS auto-prompt).

**Tech Stack:** TypeSpec → OpenAPI → generated Hono routes/validators + `@monobase/sdk-ts`; Drizzle/PostgreSQL; Hono handlers; `bun:test`; React + TanStack Router/Query (`apps/memberry`); Hurl contract tests; Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-06-20-poll-voting-design.md`

## Global Constraints

- **Spec-first, never edit generated files.** TypeSpec changes require regen: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → `cd packages/sdk-ts && bun run generate`. Never hand-edit `services/api-ts/src/generated/**` or `packages/sdk-ts/**/generated/**`.
- **No `/api` prefix** in backend route registration. Frontend `api.*` paths use `/api/...` (Vite proxy strips it); SDK hooks handle their own base.
- **Restart API after route changes:** `kill "$(lsof -ti tcp:7213)"; cd services/api-ts && bun src/index.ts >/tmp/api.log 2>&1 &` (no watch).
- **Toasts use `sonner`.** Auth route is `/auth/sign-in`.
- **Test as the MEMBER** (`member@memberry.ph` / `TestPass123!`) for all member-facing verification, not just officer. Org `pda-metro-manila` = `ed8e3a96-8126-4341-be42-e6eb7940c562`.
- **Poll results keying:** `pollResults[].counts` is keyed by **option-label string**; zero-vote options are **absent**. UI iterates `question.options`, defaulting missing labels to `0`. Percentage guards `total === 0`.
- **Polls are always attributed** (ignore `settings.anonymous` for `surveyType === 'poll'`) so vote dedup + already-voted detection work.
- **Branch:** `design/ui-ux-audit`. Commit per task. Do not push/PR until the feature is verified end-to-end.

---

### Task 1: TypeSpec foundation — `available` query param + `PollResult` model + regen (gating)

This is the load-bearing first step. Without it, the strict `ListSurveysQuery` Zod validator drops `available` and the SDK won't send it.

**Files:**
- Modify: `specs/api/src/modules/surveys.tsp` (listSurveys op ~444-454; Survey model ~160-207; add `PollResult` model near other response models ~295)
- Regenerated (do not hand-edit): `services/api-ts/src/generated/openapi/validators.ts`, `routes.ts`; `packages/sdk-ts/**`

**Interfaces:**
- Produces: `ListSurveysQuery` validator gains optional `available?: boolean`; `Survey` response model gains optional `pollResults?: PollResult[]`; SDK `ListSurveysData.query` gains `available`.

- [ ] **Step 1: Add `available` query param to `listSurveys`.** In `surveys.tsp`, inside `listSurveys(...)`, after the `mine` query line (~450):

```tsp
      @doc("Show only my assigned surveys")
      @query mine?: boolean,
      @doc("With mine=true: include active surveys I have NOT answered yet")
      @query available?: boolean,
      ...PaginationQuery
```

- [ ] **Step 2: Add the `PollResult` model.** In `surveys.tsp`, after `DeleteMemberResponsesResult` (~303):

```tsp
@doc("Aggregated vote counts for one poll question")
model PollResult {
  @doc("Question ID these counts belong to")
  questionId: UUID;

  @doc("Vote counts keyed by option-label string (zero-vote options omitted)")
  counts: Record<int32>;

  @doc("Total votes cast for this question")
  total: int32;
}
```

- [ ] **Step 3: Add `pollResults` to the `Survey` model.** In `surveys.tsp`, after `myCompletedAt` (~206):

```tsp
  @doc("Aggregated poll results (only populated for surveyType=poll on getSurvey/poll submit)")
  pollResults?: PollResult[];
```

- [ ] **Step 4: Build + regenerate.**

Run:
```bash
cd specs/api && bun run build && cd ../../services/api-ts && bun run generate && cd ../../packages/sdk-ts && bun run generate
```
Expected: all three succeed, no errors.

- [ ] **Step 5: Verify the generated validator + SDK accept `available`.**

Run:
```bash
grep -n "available" services/api-ts/src/generated/openapi/validators.ts | head
grep -rn "available" packages/sdk-ts/src/generated/types.gen.ts | grep -i survey | head
```
Expected: `available` appears in the `ListSurveysQuery` schema and in the SDK `ListSurveysData` query type.

- [ ] **Step 6: Typecheck + commit.**

Run: `cd services/api-ts && bun run typecheck`
Expected: PASS.

```bash
git add specs/api/src/modules/surveys.tsp specs/api/dist services/api-ts/src/generated packages/sdk-ts
git commit -m "feat(surveys): add available query param + PollResult model (D3 poll-voting)"
```

---

### Task 2: Repo `findAvailableForMember` + `listSurveys` available mode

**Files:**
- Modify: `services/api-ts/src/handlers/surveys/repos/survey.repo.ts` (add method after `findMineWithPagination`, ~136)
- Modify: `services/api-ts/src/handlers/surveys/listSurveys.ts` (branch inside `if (query.mine)`, ~48)
- Create: `services/api-ts/src/handlers/surveys/repos/survey.repo.test.ts`

**Interfaces:**
- Consumes: `surveys`, `surveyResponses`, `and`, `eq`, `count` (already imported in `survey.repo.ts`).
- Produces: `SurveyRepository.findAvailableForMember(organizationId: string, responderId: string, opts: { surveyType?: string; pagination: { limit: number; offset: number } }): Promise<{ data: Array<Survey & { myResponseStatus: string | null; myCompletedAt: Date | null }>; totalCount: number }>`.

- [ ] **Step 1: Write the failing repo test.** Create `survey.repo.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { SurveyRepository } from './survey.repo';

// Minimal fake Drizzle that records the query builder chain and returns canned rows.
function fakeDb(activeRows: any[], countRows: any[]) {
  const calls: any = { leftJoin: false, where: null };
  const chain: any = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => { calls.leftJoin = true; return chain; },
    innerJoin: () => chain,
    where: (w: any) => { calls.where = w; return chain; },
    limit: () => chain,
    offset: () => chain,
    orderBy: () => Promise.resolve(activeRows),
  };
  // count path: select({count}).from().where() resolves directly
  let selectCount = 0;
  const db: any = {
    __calls: calls,
    select: (arg?: any) => {
      if (arg && 'count' in arg) {
        selectCount++;
        return { from: () => ({ where: () => Promise.resolve(countRows) }) };
      }
      return chain;
    },
  };
  return db;
}

describe('findAvailableForMember', () => {
  test('uses a LEFT JOIN and returns active surveys with null status for unanswered', async () => {
    const rows = [
      { survey: { id: 's1', surveyType: 'poll', status: 'active' }, myResponseStatus: null, myCompletedAt: null },
    ];
    const db = fakeDb(rows, [{ count: 1 }]);
    const repo = new SurveyRepository(db);
    const res = await repo.findAvailableForMember('org-1', 'member-1', { pagination: { limit: 20, offset: 0 } });

    expect(db.__calls.leftJoin).toBe(true);
    expect(res.totalCount).toBe(1);
    expect(res.data[0].id).toBe('s1');
    expect(res.data[0].myResponseStatus).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd services/api-ts && bun test src/handlers/surveys/repos/survey.repo.test.ts`
Expected: FAIL — `findAvailableForMember is not a function`.

- [ ] **Step 3: Implement the repo method.** In `survey.repo.ts`, add after `findMineWithPagination` (after line 136):

```ts
  async findAvailableForMember(
    organizationId: string,
    responderId: string,
    opts: { surveyType?: string; pagination: { limit: number; offset: number } }
  ): Promise<{ data: Array<Survey & { myResponseStatus: string | null; myCompletedAt: Date | null }>; totalCount: number }> {
    const conditions: SQL<unknown>[] = [
      eq(surveys.organizationId, organizationId),
      eq(surveys.status, 'active'),
    ];
    if (opts.surveyType) {
      conditions.push(eq(surveys.surveyType, opts.surveyType));
    }
    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select({
          survey: surveys,
          myResponseStatus: surveyResponses.status,
          myCompletedAt: surveyResponses.completedAt,
        })
        .from(surveys)
        // responderId is part of the ON so the join is per-member; unanswered → nulls
        .leftJoin(
          surveyResponses,
          and(
            eq(surveyResponses.surveyId, surveys.id),
            eq(surveyResponses.responderId, responderId),
          ),
        )
        .where(where)
        .limit(opts.pagination.limit)
        .offset(opts.pagination.offset)
        .orderBy(surveys.createdAt),
      this.db
        .select({ count: count() })
        .from(surveys)
        .where(where),
    ]);

    return {
      data: data.map((row) => ({
        ...row.survey,
        myResponseStatus: row.myResponseStatus ?? null,
        myCompletedAt: row.myCompletedAt ?? null,
      })),
      totalCount: Number(countResult[0]?.count ?? 0),
    };
  }
```

- [ ] **Step 4: Run the repo test — passes.**

Run: `cd services/api-ts && bun test src/handlers/surveys/repos/survey.repo.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the `available` mode into `listSurveys`.** In `listSurveys.ts`, replace the `if (query.mine) { ... }` block (lines 48-56) with:

```ts
  if (query.mine) {
    if (query.available) {
      const availResult = await repo.findAvailableForMember(organizationId, userId, {
        surveyType: query.surveyType as string | undefined,
        pagination: { limit, offset },
      });
      return ctx.json({
        data: availResult.data,
        pagination: buildPaginationMeta(availResult.data, availResult.totalCount, limit, offset),
      }, 200);
    }
    const mineResult = await repo.findMineWithPagination(organizationId, userId, {
      pagination: { limit, offset },
    });
    return ctx.json({
      data: mineResult.data,
      pagination: buildPaginationMeta(mineResult.data, mineResult.totalCount, limit, offset),
    }, 200);
  }
```

- [ ] **Step 6: Typecheck + commit.**

Run: `cd services/api-ts && bun run typecheck && bun test src/handlers/surveys`
Expected: PASS.

```bash
git add services/api-ts/src/handlers/surveys/repos/survey.repo.ts services/api-ts/src/handlers/surveys/repos/survey.repo.test.ts services/api-ts/src/handlers/surveys/listSurveys.ts
git commit -m "feat(surveys): findAvailableForMember LEFT JOIN + listSurveys available mode"
```

---

### Task 3: Extract `aggregatePollResults` into a shared util

**Files:**
- Create: `services/api-ts/src/handlers/surveys/utils/poll-results.ts`
- Modify: `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts` (remove local fn ~19-40, import the util)
- Create: `services/api-ts/src/handlers/surveys/utils/poll-results.test.ts`

**Interfaces:**
- Produces: `aggregatePollResults(survey: Survey, responses: SurveyResponseRecord[]): Array<{ questionId: string; counts: Record<string, number>; total: number }>` — pure, behavior identical to the current private fn.

- [ ] **Step 1: Write the failing util test.** Create `utils/poll-results.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { aggregatePollResults } from './poll-results';

const poll: any = {
  questions: [{ id: 'q1', type: 'single_choice', text: 'Pick', options: ['A', 'B'] }],
};

describe('aggregatePollResults', () => {
  test('counts votes by option label, omits zero-vote options', () => {
    const responses: any = [
      { answers: [{ questionId: 'q1', value: 'A' }] },
      { answers: [{ questionId: 'q1', value: 'A' }] },
    ];
    const [r] = aggregatePollResults(poll, responses);
    expect(r.questionId).toBe('q1');
    expect(r.counts).toEqual({ A: 2 });
    expect(r.total).toBe(2);
  });

  test('handles array (multi_choice) answers and empty responses', () => {
    const [empty] = aggregatePollResults(poll, []);
    expect(empty.total).toBe(0);
    const [multi] = aggregatePollResults(poll, [{ answers: [{ questionId: 'q1', value: ['A', 'B'] }] }] as any);
    expect(multi.counts).toEqual({ A: 1, B: 1 });
    expect(multi.total).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd services/api-ts && bun test src/handlers/surveys/utils/poll-results.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the util** (`utils/poll-results.ts`), copying the existing logic verbatim:

```ts
import type { Survey, SurveyResponseRecord, QuestionAnswer, SurveyQuestion } from '../repos/survey.schema';

/**
 * [AC-M18-006] Aggregate inline poll results. Counts each selected value
 * (scalar or array) per question across responses. Keyed by option-label
 * string; zero-vote options are omitted.
 */
export function aggregatePollResults(
  survey: Survey,
  responses: SurveyResponseRecord[],
): Array<{ questionId: string; counts: Record<string, number>; total: number }> {
  const questions = (survey.questions ?? []) as SurveyQuestion[];
  return questions.map((q) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const resp of responses) {
      const answers = (resp.answers ?? []) as QuestionAnswer[];
      const ans = answers.find((a) => a.questionId === q.id);
      if (!ans) continue;
      const values = Array.isArray(ans.value) ? ans.value : [ans.value];
      for (const v of values) {
        const key = String(v);
        counts[key] = (counts[key] ?? 0) + 1;
        total += 1;
      }
    }
    return { questionId: q.id, counts, total };
  });
}
```

- [ ] **Step 4: Replace the local fn in `submitSurveyResponse.ts`.** Delete lines 14-40 (the `aggregatePollResults` fn + its block comment) and add at the top with the other imports:

```ts
import { aggregatePollResults } from './utils/poll-results';
```

- [ ] **Step 5: Run util test + existing submit tests — pass.**

Run: `cd services/api-ts && bun test src/handlers/surveys/utils/poll-results.test.ts src/handlers/surveys/submitSurveyResponse.test.ts`
Expected: PASS (behavior unchanged).

- [ ] **Step 6: Typecheck + commit.**

Run: `cd services/api-ts && bun run typecheck`
Expected: PASS.

```bash
git add services/api-ts/src/handlers/surveys/utils/poll-results.ts services/api-ts/src/handlers/surveys/utils/poll-results.test.ts services/api-ts/src/handlers/surveys/submitSurveyResponse.ts
git commit -m "refactor(surveys): extract aggregatePollResults to shared util"
```

---

### Task 4: `getSurvey` member-read of active surveys (+ pollResults)

**Files:**
- Modify: `services/api-ts/src/handlers/surveys/getSurvey.ts`
- Modify: `services/api-ts/src/handlers/surveys/getSurvey.test.ts` (the two FIX-001 member tests change meaning)

**Interfaces:**
- Consumes: `SurveyResponseRepository` (from `./repos/survey.repo`), `aggregatePollResults` (from `./utils/poll-results`).
- Produces: members receive a 200 sanitized survey for `status==='active'`; non-active → `NotFoundError`; officer/admin unchanged. Poll surveys include `pollResults`.

- [ ] **Step 1: Update the existing tests to the new contract.** In `getSurvey.test.ts`, replace the two `FIX-001 ... non-officer member` tests (lines 82-109) with:

```ts
  // Member read of an ACTIVE survey is now allowed (aligns handler to its `user` spec)
  test('member reads an active survey — 200 sanitized (no targetAudience)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, settings: { deadline: '2099-01-01', anonymous: false, allowReedit: true, targetAudience: { tiers: ['gold'] } } }),
    });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-1' } });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.settings.targetAudience).toBeUndefined();
    expect((res as any).body.settings.deadline).toBe('2099-01-01');
  });

  test('member reading a draft survey — 404 (no existence leak)', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(SurveyRepository, { findById: async () => draftSurvey });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-draft' } });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('member reads an active poll — includes pollResults', async () => {
    stubRepo(OfficerTermRepository, { findActiveByPersonAndOrg: async () => [] });
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, surveyType: 'poll', questions: [{ id: 'q1', type: 'single_choice', text: 'Pick', options: ['A', 'B'], required: true, order: 1 }] }),
    });
    stubRepo(SurveyResponseRepository, { findAllBySurveyId: async () => [{ answers: [{ questionId: 'q1', value: 'A' }] }] });
    const ctx = makeCtx({ user: { id: 'member-1', role: 'user' }, _params: { survey: 'survey-1' } });
    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.pollResults[0]).toEqual({ questionId: 'q1', counts: { A: 1 }, total: 1 });
  });
```

Add `SurveyResponseRepository` to the existing import and `restoreRepo(SurveyResponseRepository)` in `afterEach`:

```ts
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
```

- [ ] **Step 2: Run to verify the new tests fail.**

Run: `cd services/api-ts && bun test src/handlers/surveys/getSurvey.test.ts`
Expected: FAIL (member still gets Forbidden; no sanitization/pollResults).

- [ ] **Step 3: Rewrite `getSurvey.ts`** body (replace lines 27-59):

```ts
export async function getSurvey(
  ctx: ValidatedContext<never, never, GetSurveyParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;
  const surveyId = ctx.req.param('survey')!;

  const repo = new SurveyRepository(db, logger);
  const survey = await repo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  // Officers/admins get the full officer-facing detail (any status).
  let isPrivileged = hasRole(session.user, 'admin');
  if (!isPrivileged) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    isPrivileged = terms.length > 0;
  }
  if (isPrivileged) {
    return ctx.json(survey, 200);
  }

  // Member read: only active surveys, sanitized (no drafts, no targetAudience/internals).
  if (survey.status !== 'active') {
    throw new NotFoundError('Survey not found');
  }
  const s = (survey.settings ?? {}) as { deadline?: string; anonymous?: boolean; allowReedit?: boolean };
  const sanitized = {
    id: survey.id,
    organizationId: survey.organizationId,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    surveyType: survey.surveyType,
    questions: survey.questions,
    settings: { deadline: s.deadline, anonymous: s.anonymous, allowReedit: s.allowReedit },
  };

  if (survey.surveyType === 'poll') {
    const responseRepo = new SurveyResponseRepository(db, logger);
    const all = await responseRepo.findAllBySurveyId(surveyId);
    return ctx.json({ ...sanitized, pollResults: aggregatePollResults(survey, all) }, 200);
  }

  return ctx.json(sanitized, 200);
}
```

Update imports at the top of `getSurvey.ts`:

```ts
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { aggregatePollResults } from './utils/poll-results';
```

(Remove the now-unused `ForbiddenError` import.)

- [ ] **Step 4: Run tests — pass.**

Run: `cd services/api-ts && bun test src/handlers/surveys/getSurvey.test.ts`
Expected: PASS (all member + officer + admin cases).

- [ ] **Step 5: Typecheck + commit.**

Run: `cd services/api-ts && bun run typecheck`
Expected: PASS.

```bash
git add services/api-ts/src/handlers/surveys/getSurvey.ts services/api-ts/src/handlers/surveys/getSurvey.test.ts
git commit -m "feat(surveys): getSurvey member-read of active surveys + pollResults (aligns to user spec)"
```

---

### Task 5: Polls are always attributed (anonymous double-vote guard)

**Files:**
- Modify: `services/api-ts/src/handlers/surveys/submitSurveyResponse.ts:149`
- Modify: `services/api-ts/src/handlers/surveys/submitSurveyResponse.test.ts`

**Interfaces:**
- Produces: for `surveyType === 'poll'`, `responderId` is always the member id even if `settings.anonymous` — so the 409 dedup applies.

- [ ] **Step 1: Write the failing test.** In `submitSurveyResponse.test.ts`, add:

```ts
  test('poll vote is attributed even when survey is anonymous (enables dedup)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, surveyType: 'poll', settings: { anonymous: true } }),
    });
    const captured: any = {};
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async (data: any) => { Object.assign(captured, data); return { id: 'r1', ...data }; },
      findAllBySurveyId: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'member-9', role: 'user' },
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'A' }] },
    });
    await submitSurveyResponse(ctx);
    expect(captured.responderId).toBe('member-9'); // NOT null
  });
```

(Use whatever `activeSurvey`/fixture name the existing test file already defines; mirror its `makeCtx`/`stubRepo` setup.)

- [ ] **Step 2: Run to verify it fails.**

Run: `cd services/api-ts && bun test src/handlers/surveys/submitSurveyResponse.test.ts`
Expected: FAIL — `responderId` is `null` for the anonymous poll.

- [ ] **Step 3: Apply the one-line guard.** In `submitSurveyResponse.ts`, change line 149:

```ts
    // Polls are always attributed so vote dedup + already-voted detection work.
    responderId: isAnonymous && survey.surveyType !== 'poll' ? null : userId,
```

- [ ] **Step 4: Run tests — pass.**

Run: `cd services/api-ts && bun test src/handlers/surveys/submitSurveyResponse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add services/api-ts/src/handlers/surveys/submitSurveyResponse.ts services/api-ts/src/handlers/surveys/submitSurveyResponse.test.ts
git commit -m "fix(surveys): always attribute poll votes (anonymous double-vote guard)"
```

---

### Task 6: Contract tests (Hurl) — member survey access + poll vote

**Files:**
- Modify: `specs/api/tests/contract/surveys-flow.hurl`

**Interfaces:**
- Consumes: running API on `$API_URL`; existing officer sign-in flow in the file.

- [ ] **Step 1: Add a member sign-in + assertions.** Append to `surveys-flow.hurl` (after the officer creates + publishes a poll survey — reuse the file's existing publish flow; capture its id as `{{poll_id}}`):

```hurl
# ── Member: sign in ──────────────────────────────────────
POST {{base_url}}/auth/sign-in/email
Content-Type: application/json
{ "email": "member@memberry.ph", "password": "TestPass123!" }
HTTP 200
[Captures]
member_token: cookie "better-auth.session_token"

# Member can read an ACTIVE survey detail (was 403 before this change)
GET {{base_url}}/surveys/{{poll_id}}
Cookie: better-auth.session_token={{member_token}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{poll_id}}"
jsonpath "$.settings.targetAudience" not exists

# Member discovery: available mode lists active unanswered surveys
GET {{base_url}}/surveys?mine=true&available=true
Cookie: better-auth.session_token={{member_token}}
HTTP 200
[Asserts]
jsonpath "$.data" count >= 1

# Member votes; response echoes pollResults
POST {{base_url}}/surveys/{{poll_id}}/responses
Cookie: better-auth.session_token={{member_token}}
Content-Type: application/json
{ "answers": [{ "questionId": "{{poll_q_id}}", "value": "A" }] }
HTTP 201
[Asserts]
jsonpath "$.pollResults" exists
jsonpath "$.pollResults[0].total" >= 1
```

> The poll survey created earlier must have one `single_choice` question with options including `"A"`; capture its question id as `{{poll_q_id}}` from the create/publish response.

- [ ] **Step 2: Boot the API and run the contract suite.**

Run (the runner executes the whole Hurl suite; it filters only mailpit/stripe skip-guards, not by name — for fast single-file iteration use the `test-contract` skill or run `hurl` directly on the one file):
```bash
kill "$(lsof -ti tcp:7213)" 2>/dev/null; cd services/api-ts && bun src/index.ts >/tmp/api.log 2>&1 &
sleep 4
cd /Users/elad-mini/Desktop/memberry && API_URL=http://localhost:7213 bun scripts/run-contract-tests.ts
```
Expected: PASS — including the new `surveys-flow.hurl` member assertions (200 detail, available list, poll vote echoes results).

- [ ] **Step 3: Commit.**

```bash
git add specs/api/tests/contract/surveys-flow.hurl
git commit -m "test(contract): member survey read + available list + poll vote (D3)"
```

---

### Task 7: Frontend — `SurveyFlow` captures the response and renders poll results

**Files:**
- Modify: `apps/memberry/src/features/surveys/components/survey-flow.tsx`

**Interfaces:**
- Consumes: `api.post` returns the raw response body `{ ...response, pollResults? }`; `survey.pollResults` may arrive pre-populated for an already-voted poll.
- Produces: a `PollResults` view rendered when `survey.surveyType === 'poll'` after submit (or on load if `survey.pollResults` present).

- [ ] **Step 1: Extend the `Survey` type.** In `survey-flow.tsx`, update the interface (lines 26-31):

```ts
export interface PollResult {
  questionId: string
  counts: Record<string, number>
  total: number
}

export interface Survey {
  id: string
  title: string
  description?: string
  surveyType?: string
  questions: SurveyQuestion[]
  pollResults?: PollResult[]
}
```

- [ ] **Step 2: Capture the submit response + track poll results.** In `handleSubmit` (line 184-207), replace the `await api.post(...)` line and add state. Add near the other `useState` (line 139):

```ts
  const [pollResults, setPollResults] = useState<PollResult[] | undefined>(survey.pollResults)
```

Replace line 197:

```ts
      const res = await api.post<{ pollResults?: PollResult[] }>(
        `/api/surveys/${survey.id}/responses`,
        { answers: formattedAnswers },
      )
      if (res?.pollResults) setPollResults(res.pollResults)
```

- [ ] **Step 3: Add a `PollResults` render + show it on the completion screen for polls.** Add this component above `SurveyFlow` (after line 120):

```tsx
function PollResults({ questions, results }: { questions: SurveyQuestion[]; results: PollResult[] }) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {questions.map((q) => {
        const r = results.find((x) => x.questionId === q.id)
        const total = r?.total ?? 0
        return (
          <div key={q.id} className="space-y-3">
            <h3 className="text-h4 text-[var(--color-text)]">{q.text}</h3>
            {total === 0 ? (
              <p className="text-body-sm text-[var(--color-muted)]">No votes yet</p>
            ) : (
              (q.options ?? []).map((opt) => {
                const cnt = r?.counts[opt] ?? 0
                const pct = Math.round((cnt / total) * 100)
                return (
                  <div key={opt} className="space-y-1">
                    <div className="flex justify-between text-body-sm">
                      <span className="text-[var(--color-text)]">{opt}</span>
                      <span className="text-[var(--color-muted)]">{cnt} · {pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--color-surface-elevated)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}
```

In the completion screen branch (`if (completed)`, line 232) and in an already-voted case, render results for polls. At the very start of the component body, after computing `completed`, add an early return for an already-voted poll:

```ts
  const isPoll = survey.surveyType === 'poll'
  const showResults = isPoll && (completed || (pollResults && pollResults.length > 0))
```

Then inside the `if (completed)` block, when `isPoll && pollResults`, render `<PollResults questions={questions} results={pollResults} />` above the "Thank you" copy. And add, before the progress-bar return (line 261), a read-only results short-circuit:

```tsx
  if (showResults && !completed && pollResults) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center">
        <p className="text-center text-body-sm text-[var(--color-muted)] mb-6">You've already voted — here are the results.</p>
        <PollResults questions={questions} results={pollResults} />
      </div>
    )
  }
```

- [ ] **Step 4: Typecheck.**

Run: `cd apps/memberry && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/memberry/src/features/surveys/components/survey-flow.tsx
git commit -m "feat(surveys): SurveyFlow renders poll results after vote / on load"
```

---

### Task 8: Frontend — `my/surveys` Available section + clickable completed polls

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/my/surveys/index.tsx`

**Interfaces:**
- Consumes: `listSurveysOptions({ query: { mine: true, available: true } })` (now valid after Task 1 regen) returning active surveys with `myResponseStatus` of `null | 'pending' | 'completed'`.

- [ ] **Step 1: Switch the query to available mode + bucket by status.** Replace the `useQuery(...)` and bucket lines (52-58):

```ts
  const { data, isLoading, error } = useQuery(
    listSurveysOptions({ query: { mine: true, available: true } }),
  )

  const allSurveys = ((data?.data ?? []) as unknown as SurveyListItem[])
  const available = allSurveys.filter((s) => s.myResponseStatus == null)
  const pending = allSurveys.filter((s) => s.myResponseStatus === 'pending')
  const completed = allSurveys.filter((s) => s.myResponseStatus === 'completed')
```

Update `SurveyListItem` (line 21) so `myResponseStatus` allows null: `myResponseStatus?: string | null`.

> Single-query simplification (deviation from spec's two-query note): the page now sources Available/Pending/Completed from the active-survey set. Closed-survey history drops off the active list — acceptable for v1 (closed surveys aren't actionable).

- [ ] **Step 2: Render an "Available" section.** Add a section above the existing "Pending" block (before line 94's `{pending.length > 0 && ...}`), reusing the same card markup but with an "Available" badge and the same `Link to="/my/surveys/$surveyId"`:

```tsx
          {/* Available */}
          {available.length > 0 && (
            <section>
              <h2 className="text-h4 text-[var(--color-text)] mb-3 flex items-center gap-2">
                <ClipboardList size={16} className="text-[var(--color-primary)]" />
                Available ({available.length})
              </h2>
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {available.map((survey) => (
                  <StaggerItem key={survey.id}>
                    <Link to="/my/surveys/$surveyId" params={{ surveyId: survey.id }} className="block">
                      <GlassCard className="p-5 hover:bg-[var(--color-surface-elevated-hover)] transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge variant="info">{formatSurveyType(survey.surveyType)}</StatusBadge>
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">{survey.title}</h3>
                            {survey.description && (
                              <p className="text-xs text-[var(--color-muted)] line-clamp-2">{survey.description}</p>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-[var(--color-muted)] group-hover:text-[var(--color-primary)] transition-colors shrink-0 mt-1" />
                        </div>
                      </GlassCard>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            </section>
          )}
```

(`StatusBadge` supports `variant="info"` — confirmed in `components/patterns/status-badge.tsx`.)

- [ ] **Step 3: Make completed polls clickable to view results.** Wrap the completed-card markup (lines 159-180) in a `Link` **only when** `survey.surveyType === 'poll'`:

```tsx
                {completed.map((survey) => {
                  const card = (
                    <GlassCard className="p-5 opacity-80">
                      {/* ...existing completed card inner markup unchanged... */}
                    </GlassCard>
                  )
                  return (
                    <StaggerItem key={survey.id}>
                      {survey.surveyType === 'poll' ? (
                        <Link to="/my/surveys/$surveyId" params={{ surveyId: survey.id }} className="block">{card}</Link>
                      ) : card}
                    </StaggerItem>
                  )
                })}
```

- [ ] **Step 4: Update the empty-state condition** so it accounts for the new bucket: the existing `allSurveys.length === 0` check already covers it — no change needed. Verify Available renders before Pending.

- [ ] **Step 5: Typecheck + commit.**

Run: `cd apps/memberry && bun run typecheck`
Expected: PASS.

```bash
git add apps/memberry/src/routes/_authenticated/my/surveys/index.tsx
git commit -m "feat(surveys): my/surveys Available section + clickable completed polls"
```

---

### Task 9: Delete dead `PollCard` + live verification (browse) + E2E

**Files:**
- Delete: `apps/memberry/src/features/surveys/components/poll-card.tsx`, `apps/memberry/src/features/surveys/components/poll-card.test.tsx`
- Create: `apps/memberry/tests/e2e/member-poll-vote.spec.ts` (mirror an existing member E2E in `apps/memberry/tests/e2e/`)

- [ ] **Step 1: Delete dead PollCard + its test, confirm nothing imports it.**

Run:
```bash
grep -rn "poll-card\|PollCard" apps/memberry/src | grep -v "poll-card.tsx\|poll-card.test.tsx"
```
Expected: no matches (confirms dead). Then:
```bash
git rm apps/memberry/src/features/surveys/components/poll-card.tsx apps/memberry/src/features/surveys/components/poll-card.test.tsx
```

- [ ] **Step 2: Live verification with the `/browse` skill (the real acceptance gate).** With API (7213) + memberry (3004) running, invoke `/browse` to dogfood as the **member**:
  1. Sign in `member@memberry.ph` / `TestPass123!`.
  2. Go to `/my/surveys` → confirm an **Available** poll appears (officer must have published one; if none, create+publish a poll as `test@memberry.ph` first).
  3. Click it → detail loads (no "Survey not found"), renders the poll question.
  4. Vote → result bars appear with the chosen option counted.
  5. Revisit the poll → shows results read-only ("You've already voted").

  Capture a screenshot of the results state. This is the click-through gate — file existence ≠ feature works.

- [ ] **Step 3: Write a Playwright E2E.** Create `member-poll-vote.spec.ts` mirroring an existing member spec's auth helper; it logs in as member, opens an available poll, votes, asserts a result bar / percentage is visible, reloads, asserts read-only results. (Use real flows, not selectors-only — assert the voted option's count text.)

- [ ] **Step 4: Run E2E.**

Run: `cd apps/memberry && bun run test:e2e member-poll-vote`
Expected: PASS.

- [ ] **Step 5: Final gate + commit.**

Run: `cd apps/memberry && bun run typecheck && cd ../../services/api-ts && bun test src/handlers/surveys`
Expected: PASS.

```bash
git add apps/memberry/tests/e2e/member-poll-vote.spec.ts
git commit -m "test(e2e): member poll vote + results; remove dead PollCard (D3)"
```

---

## Self-Review

**Spec coverage:**
- Foundation 1a (available LEFT-JOIN query) → Tasks 1, 2. ✓
- Foundation 1b (getSurvey member-read + pollResults) → Tasks 1, 4. ✓
- Foundation 1c (extract aggregatePollResults) → Task 3. ✓
- Anonymous double-vote guard → Task 5. ✓
- Poll UX (SurveyFlow results, Available section, clickable completed, delete PollCard) → Tasks 7, 8, 9. ✓
- Contract + E2E + browse → Tasks 6, 9. ✓
- TypeSpec regen gating → Task 1. ✓

**Deviations from spec (intentional, noted):** Task 8 uses one `available` query for the page instead of the spec's two queries — loses closed-survey history from the list (acceptable v1; flagged in-task).

**Type consistency:** `findAvailableForMember` signature identical in Task 2 (def) and Task 2 Step 5 (use). `aggregatePollResults` signature identical across Tasks 3, 4. `PollResult { questionId; counts; total }` consistent across TypeSpec (Task 1), frontend type (Task 7), and PollResults render (Task 7). `myResponseStatus` nullable handled in repo (Task 2), list page (Task 8).

**Placeholder scan:** none — all steps carry real code/commands. E2E (Task 9 Step 3) references "mirror an existing member spec's auth helper" rather than inlining an unknown helper; that is a deliberate pointer to the repo's established pattern, verified to exist under `apps/memberry/tests/e2e/`.
