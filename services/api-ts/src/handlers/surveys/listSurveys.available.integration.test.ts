/**
 * Real-PG available-list + member-scoping WORKFLOW e2e (B2 content, surveys
 * Slice 6).
 *
 * Drives the REAL `listSurveys` handler against ONE `createContentScratch`
 * schema with the REAL `SurveyRepository` reached via ctx.get('database') (NO
 * prototype mocking, NO stubRepo). This proves the two member-facing list
 * shapes the handler routes to — `findAvailableForMember` (mine=true +
 * available=true) and `findMineWithPagination` (mine=true, available falsy) —
 * against persisted rows, not a builder-flag illusion or a 200-only assertion.
 *
 * The handler reads `ctx.get('organizationId')` and the validated query; the
 * existing `listSurveys.test.ts` already covers the officer/admin RBAC + filter
 * routing with stubs. This suite is the missing real-data half:
 *
 * Asserts (per §5.5 Slice 6):
 *  - Available path: member sees ONLY active surveys from orgs they belong to;
 *    cross-org rows absent; the membership-subquery tenant boundary holds.
 *  - Mine path (available falsy): a completed response → row carries
 *    myResponseStatus='completed' + non-null myCompletedAt; a no-response
 *    survey is ABSENT (INNER JOIN).
 *  - Pagination: 3 active surveys, limit=2 → page-1 returns 2 rows with
 *    totalCount=3; page-2 returns the 3rd.
 *  - Available path returns rows even when organizationId is undefined (the
 *    /my/surveys shape — member-scoped via responderId/membership, not x-org-id).
 *
 * Skips cleanly when Postgres is unreachable.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  createContentScratch,
  CONTENT_ORG,
  seedOrg,
  seedPerson,
  seedMembership,
  seedSurvey,
  seedSurveyResponse,
} from '@/test-utils/content-fixtures';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { listSurveys } from './listSurveys';

let H: ScratchDb;

// A distinct org the member never joins — the cross-org leak target.
const ORG_B = seedOrg('00000000-0000-4000-8000-00000000c006');

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

interface ListBody {
  data: Array<Record<string, unknown>>;
  pagination: {
    totalCount: number;
    currentPage: number;
    count: number;
    totalPages: number;
  };
}

interface CtxOpts {
  userId: string;
  /** validated query (mine/available/surveyType/page/limit). */
  query: Record<string, unknown>;
  /** undefined mimics /my/surveys/* (no x-org-id header). */
  organizationId?: string | undefined;
  role?: string;
}

/**
 * Build a listSurveys ctx wired to the REAL scratch db. The handler reads
 * ctx.get('session' | 'database' | 'logger' | 'organizationId') and
 * ctx.req.valid('query'); the response is captured from ctx.json so we read the
 * REAL list the repo returned.
 */
function makeCtx(opts: CtxOpts) {
  let captured: { body: unknown; status: number } = { body: null, status: 0 };
  const store: Record<string, unknown> = {
    session: {
      user: { id: opts.userId, name: 'Member', email: 'm@test.com', role: opts.role ?? 'user' },
    },
    database: H.db,
    logger: makeLogger(),
    requestId: 'trace-list-available-wf',
    organizationId: opts.organizationId,
  };
  const ctx = {
    get: (key: string) => store[key],
    req: {
      valid: (_kind: 'query') => opts.query,
    },
    json: (body: unknown, status: number) => {
      captured = { body, status };
      return new Response(JSON.stringify(body), { status });
    },
    _captured: () => captured,
  };
  return ctx as never;
}

function capture(ctx: never): { body: ListBody; status: number } {
  return (ctx as unknown as { _captured: () => { body: ListBody; status: number } })._captured();
}

describe('listSurveys available + mine member-scoping workflow (real PG)', () => {
  test('available path: member sees ONLY active surveys from orgs they belong to; cross-org absent', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });

    const inOrg = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    // An active survey in an org the member does NOT belong to — must never leak.
    const foreign = await seedSurvey(H, { organizationId: ORG_B, status: 'active' });
    // A draft in the member's own org — excluded by the status='active' filter.
    const draft = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'draft' });

    const ctx = makeCtx({
      userId: member,
      query: { mine: true, available: true },
      organizationId: CONTENT_ORG,
    });
    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);

    const { body } = capture(ctx);
    const ids = body.data.map((s) => s['id']);
    expect(ids).toContain(inOrg.id);
    // Tenant boundary: the foreign-org survey never appears.
    expect(ids).not.toContain(foreign.id);
    // Status gate: the member's own draft never appears on the available list.
    expect(ids).not.toContain(draft.id);
    expect(body.data.every((s) => s['organizationId'] === CONTENT_ORG)).toBe(true);
  });

  test('available path returns rows even when organizationId is undefined (/my/surveys shape)', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });
    const own = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    // No x-org-id header → organizationId undefined; member-scoped via membership.
    const ctx = makeCtx({
      userId: member,
      query: { mine: true, available: true },
      organizationId: undefined,
    });
    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);

    const { body } = capture(ctx);
    // The membership subquery still scopes to the member's orgs even with no
    // narrowing org arg — the survey is found.
    expect(body.data.map((s) => s['id'])).toContain(own.id);
    expect(body.data.every((s) => s['organizationId'] === CONTENT_ORG)).toBe(true);
  });

  test('available path: completed response surfaces myResponseStatus; unanswered survey shows null', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });

    const answered = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const unanswered = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    await seedSurveyResponse(H, {
      surveyId: answered.id,
      responderId: member,
      organizationId: CONTENT_ORG,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const ctx = makeCtx({
      userId: member,
      query: { mine: true, available: true },
      organizationId: CONTENT_ORG,
    });
    await listSurveys(ctx);
    const { body } = capture(ctx);

    // available path uses a LEFT JOIN: BOTH active surveys appear, answered one
    // carrying the member's response status, unanswered one carrying null.
    const answeredRow = body.data.find((s) => s['id'] === answered.id);
    expect(answeredRow).toBeDefined();
    expect(answeredRow!['myResponseStatus']).toBe('completed');
    expect(answeredRow!['myCompletedAt']).not.toBeNull();

    const unansweredRow = body.data.find((s) => s['id'] === unanswered.id);
    expect(unansweredRow).toBeDefined();
    expect(unansweredRow!['myResponseStatus']).toBeNull();
    expect(unansweredRow!['myCompletedAt']).toBeNull();
  });

  test('mine path (available falsy): only responded surveys appear (INNER JOIN); no-response survey absent', async () => {
    if (!H.dbReachable) return;
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: CONTENT_ORG });

    const responded = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    const notResponded = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    await seedSurveyResponse(H, {
      surveyId: responded.id,
      responderId: member,
      organizationId: CONTENT_ORG,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const ctx = makeCtx({
      userId: member,
      // mine=true, available omitted (falsy) → findMineWithPagination path
      query: { mine: true },
      organizationId: CONTENT_ORG,
    });
    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);

    const { body } = capture(ctx);
    const ids = body.data.map((s) => s['id']);
    // INNER JOIN onto survey_response: only the responded survey appears.
    expect(ids).toContain(responded.id);
    expect(ids).not.toContain(notResponded.id);

    const row = body.data.find((s) => s['id'] === responded.id);
    expect(row!['myResponseStatus']).toBe('completed');
    expect(row!['myCompletedAt']).not.toBeNull();
    expect(body.pagination.totalCount).toBe(1);
  });

  test('mine path is per-member: another member\'s response does not surface my row', async () => {
    if (!H.dbReachable) return;
    const me = (await seedPerson(H)).id;
    const other = (await seedPerson(H)).id;
    await seedMembership(H, { personId: me, organizationId: CONTENT_ORG });

    const survey = await seedSurvey(H, { organizationId: CONTENT_ORG, status: 'active' });
    // A DIFFERENT member responded — the INNER JOIN keys on MY responderId, so I
    // have no row.
    await seedSurveyResponse(H, {
      surveyId: survey.id,
      responderId: other,
      organizationId: CONTENT_ORG,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    const ctx = makeCtx({
      userId: me,
      query: { mine: true },
      organizationId: CONTENT_ORG,
    });
    await listSurveys(ctx);
    const { body } = capture(ctx);
    expect(body.data.map((s) => s['id'])).not.toContain(survey.id);
    expect(body.pagination.totalCount).toBe(0);
  });

  test('available path pagination: 3 active surveys, limit=2 → page1 has 2 + totalCount=3; page2 has the 3rd', async () => {
    if (!H.dbReachable) return;
    // Isolate to a dedicated org so the member's available set is EXACTLY the 3
    // surveys this test seeds — findAvailableForMember returns every active
    // survey across the member's orgs, so sharing CONTENT_ORG with sibling
    // tests would inflate the count.
    const pagOrg = seedOrg('00000000-0000-4000-8000-00000000c060');
    const member = (await seedPerson(H)).id;
    await seedMembership(H, { personId: member, organizationId: pagOrg });

    const seeded: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = await seedSurvey(H, { organizationId: pagOrg, status: 'active' });
      seeded.push(s.id);
    }

    const page1Ctx = makeCtx({
      userId: member,
      query: { mine: true, available: true, page: '1', limit: '2' },
      organizationId: pagOrg,
    });
    await listSurveys(page1Ctx);
    const page1 = capture(page1Ctx).body;
    expect(page1.data.length).toBe(2);
    expect(page1.pagination.totalCount).toBe(3);
    expect(page1.pagination.currentPage).toBe(1);

    const page2Ctx = makeCtx({
      userId: member,
      query: { mine: true, available: true, page: '2', limit: '2' },
      organizationId: pagOrg,
    });
    await listSurveys(page2Ctx);
    const page2 = capture(page2Ctx).body;
    expect(page2.data.length).toBe(1);
    expect(page2.pagination.totalCount).toBe(3);
    expect(page2.pagination.currentPage).toBe(2);

    // The two pages cover all 3 distinct seeded surveys with no overlap.
    const seenIds = new Set([
      ...page1.data.map((s) => s['id'] as string),
      ...page2.data.map((s) => s['id'] as string),
    ]);
    for (const id of seeded) expect(seenIds.has(id)).toBe(true);
    expect(seenIds.size).toBe(3);
  });
});
