/**
 * Real-PG submit-response WORKFLOW e2e (B2 content, surveys Slice 5).
 *
 * Drives the REAL `submitSurveyResponse` handler against ONE
 * `createContentScratch` schema, with the REAL `SurveyRepository` /
 * `SurveyResponseRepository` / `MembershipRepository` reached via
 * ctx.get('database') (NO prototype mocking). This is the member's full
 * submit lifecycle: anonymity strip, poll attribution-always, the deadline
 * gate, the re-edit gate, the dedup ConflictError, and the non-member tenant
 * boundary — each asserted against a row read back via H.scopedPool (the row
 * that was/wasn't persisted), never a 200-only/toBeDefined tautology.
 *
 * Asserts (per §5.5 Slice 5):
 *  - First attributed submit → 201, persisted row status='completed',
 *    completed_at set, responder_id=member, answers round-tripped; count=1.
 *  - Anonymous survey (settings.anonymous=true, non-poll): row responder_id IS
 *    NULL, answers retained.
 *  - Poll survey with anonymous=true: KEEPS responder_id=member (polls always
 *    attributed so vote dedup works).
 *  - Second attributed submit without allowReedit → ConflictError, only ONE row.
 *  - settings.allowReedit=true: second submit UPDATES the same row id (new
 *    answers), count stays 1.
 *  - Past settings.deadline → BusinessLogicError, NO row.
 *  - Non-member → NotFoundError, NO row (personBelongsToOrg gate).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedOrg,
  seedPerson,
  seedMembership,
  seedSurvey,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { submitSurveyResponse } from './submitSurveyResponse';

let H: ScratchDb;

beforeAll(async () => {
  H = await createContentScratch();
});
afterAll(async () => {
  await H?.teardown();
});

/** A no-op pino-shaped logger (logger.child must self-return). */
function makeLogger(): Record<string, (...a: unknown[]) => unknown> {
  const l: Record<string, (...a: unknown[]) => unknown> = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  l['child'] = () => l;
  return l;
}

interface CtxOpts {
  userId: string;
  surveyId: string;
  answers?: unknown[];
  /** undefined mimics /my/surveys/* (no x-org-id header). */
  organizationId?: string | undefined;
}

/**
 * Build a submitSurveyResponse ctx wired to the REAL scratch db. The handler
 * reads ctx.req.param('survey') (a function call) and ctx.req.valid('json'),
 * plus session / database / logger / requestId / organizationId / jobs.
 * `jobs` is left undefined so the (unregistered) analytics trigger is skipped.
 */
function makeCtx(opts: CtxOpts) {
  let captured: { data: unknown; status: number } = { data: null, status: 0 };
  const store: Record<string, unknown> = {
    session: { user: { id: opts.userId, name: 'Member', email: 'm@test.com', role: 'user' } },
    database: H.db,
    logger: makeLogger(),
    requestId: 'trace-submit-wf',
    organizationId: opts.organizationId,
    jobs: undefined,
  };
  const ctx = {
    get: (key: string) => store[key],
    req: {
      param: (k: string) => (k === 'survey' ? opts.surveyId : undefined),
      valid: (_kind: 'json') => ({ answers: opts.answers ?? [] }),
    },
    json: (data: unknown, status: number) => {
      captured = { data, status };
      return new Response(JSON.stringify(data), { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}

function capture(ctx: never): { data: unknown; status: number } {
  return (ctx as unknown as { _captured: () => { data: unknown; status: number } })._captured();
}

async function responsesForSurvey(surveyId: string): Promise<
  Array<{ id: string; responder_id: string | null; status: string; completed_at: Date | null; answers: unknown }>
> {
  const { rows } = await H.scopedPool.query(
    `SELECT id, responder_id, status, completed_at, answers
       FROM "${H.schema}".survey_response WHERE survey_id=$1`,
    [surveyId],
  );
  return rows;
}

describe('submitSurveyResponse workflow — anonymity / deadline / re-edit / dedup on real PG', () => {
  test('first attributed submit persists completed row with responder_id + answers', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
    });

    const answers = [{ questionId: 'q1', value: 'great service' }];
    const ctx = makeCtx({ userId: member, surveyId, answers, organizationId: CONTENT_ORG });
    await submitSurveyResponse(ctx);
    const res = capture(ctx);
    expect(res.status).toBe(201);

    const rows = await responsesForSurvey(surveyId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].completed_at).not.toBeNull();
    expect(rows[0].responder_id).toBe(member);
    expect(rows[0].answers).toEqual(answers);
  });

  test('anonymous non-poll survey strips responder_id but retains answers', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
      settings: { anonymous: true },
    });

    const answers = [{ questionId: 'q1', value: 'anonymous feedback' }];
    const ctx = makeCtx({ userId: member, surveyId, answers, organizationId: CONTENT_ORG });
    await submitSurveyResponse(ctx);
    expect(capture(ctx).status).toBe(201);

    const rows = await responsesForSurvey(surveyId);
    expect(rows).toHaveLength(1);
    // P0 privacy: responderId stripped to NULL for anonymous non-poll surveys
    expect(rows[0].responder_id).toBeNull();
    // BR: the answers payload is retained even though attribution is dropped
    expect(rows[0].answers).toEqual(answers);
  });

  test('anonymous POLL survey keeps responder_id (polls always attributed for dedup)', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'poll',
      settings: { anonymous: true },
    });

    const ctx = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'A' }],
      organizationId: CONTENT_ORG,
    });
    await submitSurveyResponse(ctx);
    expect(capture(ctx).status).toBe(201);

    const rows = await responsesForSurvey(surveyId);
    expect(rows).toHaveLength(1);
    // poll path overrides anonymity: attribution kept so vote dedup works
    expect(rows[0].responder_id).toBe(member);
  });

  test('second attributed submit without allowReedit → ConflictError, only ONE row', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
      // settings: {} — allowReedit undefined
    });

    const ctx1 = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'first' }],
      organizationId: CONTENT_ORG,
    });
    await submitSurveyResponse(ctx1);
    expect(capture(ctx1).status).toBe(201);

    const ctx2 = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'second' }],
      organizationId: CONTENT_ORG,
    });
    await expect(submitSurveyResponse(ctx2)).rejects.toThrow('You have already responded');

    const rows = await responsesForSurvey(surveyId);
    expect(rows).toHaveLength(1);
    // original answer untouched (no clobber)
    expect(rows[0].answers).toEqual([{ questionId: 'q1', value: 'first' }]);
  });

  test('allowReedit=true: second submit UPDATES the same row id, count stays 1', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
      settings: { allowReedit: true },
    });

    const ctx1 = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'before' }],
      organizationId: CONTENT_ORG,
    });
    await submitSurveyResponse(ctx1);
    expect(capture(ctx1).status).toBe(201);
    const firstRows = await responsesForSurvey(surveyId);
    expect(firstRows).toHaveLength(1);
    const originalId = firstRows[0].id;

    const ctx2 = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'after' }],
      organizationId: CONTENT_ORG,
    });
    await submitSurveyResponse(ctx2);
    // re-edit returns 200 (update), not 201 (create)
    expect(capture(ctx2).status).toBe(200);

    const rows = await responsesForSurvey(surveyId);
    expect(rows).toHaveLength(1);
    // SAME row mutated in place — same id, new answers
    expect(rows[0].id).toBe(originalId);
    expect(rows[0].answers).toEqual([{ questionId: 'q1', value: 'after' }]);
  });

  test('past deadline → BusinessLogicError and NO row persisted', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: CONTENT_ORG,
      status: 'active',
      surveyType: 'feedback',
      settings: { deadline: new Date(Date.now() - 86_400_000).toISOString() },
    });

    const ctx = makeCtx({
      userId: member,
      surveyId,
      answers: [{ questionId: 'q1', value: 'too late' }],
      organizationId: CONTENT_ORG,
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('deadline has passed');

    expect(await responsesForSurvey(surveyId)).toHaveLength(0);
  });

  test('non-member → NotFoundError and NO row (personBelongsToOrg gate)', async () => {
    if (!H.dbReachable) return;
    // a distinct org the survey lives in; the caller has NO membership in it
    const otherOrg = seedOrg(crypto.randomUUID());
    const outsider = (await seedPerson(H)).id;
    // seed a membership in a DIFFERENT org to prove presence-in-the-survey-org is required
    await seedMembership(H, { personId: outsider, organizationId: CONTENT_ORG });
    const { id: surveyId } = await seedSurvey(H, {
      organizationId: otherOrg,
      status: 'active',
      surveyType: 'feedback',
    });

    // /my/surveys/* shape: no x-org-id header → organizationId undefined; the
    // survey's own org is the authority, and the caller is not a member of it.
    const ctx = makeCtx({
      userId: outsider,
      surveyId,
      answers: [{ questionId: 'q1', value: 'hacking attempt' }],
      organizationId: undefined,
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey not found');

    expect(await responsesForSurvey(surveyId)).toHaveLength(0);
  });
});
