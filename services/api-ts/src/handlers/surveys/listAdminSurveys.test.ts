import { describe, test, expect } from 'bun:test';
import { makeCtx, makeUser, makeMockDb } from '@/test-utils/make-ctx';
import { listAdminSurveys } from './listAdminSurveys';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';

/**
 * listAdminSurveys reads ctx.req.url to parse query params (limit, offset, status, surveyType).
 * makeCtx doesn't set req.url, so we patch it here.
 */
function makeAdminCtx(overrides: Record<string, any> = {}, urlParams = '') {
  const ctx = makeCtx(overrides) as any;
  const url = `http://localhost/admin/surveys${urlParams ? `?${urlParams}` : ''}`;
  ctx.req = { ...ctx.req, url };
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Build a custom mock db that sequences through provided result arrays.
 * listAdminSurveys calls db.select() three times (Promise.all returns two,
 * then a third for stats). Each call to db.select() pulls the next batch
 * from the queue.
 *
 * Call order:
 *   1st  — survey rows (data array)
 *   2nd  — count result [{ count: N }]
 *   3rd  — stats result [{ totalSurveys, activeSurveys }]
 */
function makeSequencedDb(batches: any[][]) {
  let callIndex = 0;
  function makeSelectChain(rows: any[]) {
    // Every method returns the same chain so any drizzle fluent chain works.
    // The chain is also thenable so Promise.all / await resolves it to rows.
    const chain: any = {
      from: (_t: any) => chain,
      where: (_c: any) => chain,
      limit: (_n: any) => chain,
      offset: (_n: any) => chain,
      orderBy: (..._a: any[]) => chain,
      groupBy: (..._a: any[]) => chain,
      then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }
  const base = makeMockDb();
  return {
    ...base,
    select: (..._a: any[]) => {
      const rows = batches[callIndex] ?? [];
      callIndex++;
      return makeSelectChain(rows);
    },
  };
}

const fakeSurvey = {
  id: 'survey-1',
  title: 'NPS Survey Q1',
  organizationId: 'tenant-1',
  surveyType: 'nps',
  status: 'active',
  questions: [{ id: 'q1' }, { id: 'q2' }],
  analyticsSnapshot: { npsScore: 45, totalResponses: 120, completionRate: 0.82 },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const adminUser = makeUser({ id: 'admin-1', role: 'admin' });

// ─── Tests ──────────────────────────────────────────────

describe('listAdminSurveys', () => {
  test('happy path — returns formatted data + stats', async () => {
    const db = makeSequencedDb([
      [fakeSurvey],                                   // 1st select: survey rows
      [{ count: 1 }],                                 // 2nd select: total count
      [{ totalSurveys: 5, activeSurveys: 3 }],        // 3rd select: stats
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const row = res.body.data[0];
    expect(row.id).toBe('survey-1');
    expect(row.title).toBe('NPS Survey Q1');
    expect(row.surveyType).toBe('nps');
    expect(row.status).toBe('active');
    expect(row.responseCount).toBe(120);
    expect(row.questionCount).toBe(2);
    expect(row.npsScore).toBe(45);
  });

  test('stats block populated from db result', async () => {
    const db = makeSequencedDb([
      [fakeSurvey],
      [{ count: 1 }],
      [{ totalSurveys: 10, activeSurveys: 4 }],
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.body.stats.totalSurveys).toBe(10);
    expect(res.body.stats.activeSurveys).toBe(4);
    expect(res.body.total).toBe(1);
  });

  test('avgNps computed correctly from survey analyticsSnapshot', async () => {
    const survey2 = { ...fakeSurvey, id: 'survey-2', analyticsSnapshot: { npsScore: 55, totalResponses: 50, completionRate: 0.7 } };
    const db = makeSequencedDb([
      [fakeSurvey, survey2],   // npsScore 45 + 55 → avg 50
      [{ count: 2 }],
      [{ totalSurveys: 2, activeSurveys: 2 }],
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.body.stats.avgNps).toBe(50);
  });

  test('avgNps is null when no surveys have npsScore', async () => {
    const surveyNoNps = { ...fakeSurvey, analyticsSnapshot: null };
    const db = makeSequencedDb([
      [surveyNoNps],
      [{ count: 1 }],
      [{ totalSurveys: 1, activeSurveys: 1 }],
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.body.stats.avgNps).toBeNull();
  });

  test('empty result — returns data:[] total:0 with zeroed stats', async () => {
    const db = makeSequencedDb([
      [],
      [{ count: 0 }],
      [{ totalSurveys: 0, activeSurveys: 0 }],
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
    expect(res.body.stats.totalSurveys).toBe(0);
    expect(res.body.stats.avgNps).toBeNull();
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeAdminCtx({ user: null, session: null });
    await expect(listAdminSurveys(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('throws ForbiddenError when user is not admin', async () => {
    const ctx = makeAdminCtx({ user: makeUser({ role: 'member' }) });
    await expect(listAdminSurveys(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('questionCount is 0 when questions is not an array', async () => {
    const surveyNoQ = { ...fakeSurvey, questions: null };
    const db = makeSequencedDb([
      [surveyNoQ],
      [{ count: 1 }],
      [{ totalSurveys: 1, activeSurveys: 0 }],
    ]);

    const ctx = makeAdminCtx({ user: adminUser, database: db });
    const res = await listAdminSurveys(ctx);

    expect(res.body.data[0].questionCount).toBe(0);
  });
});
