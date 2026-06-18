import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, makeUser, makeMockDb, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { getNpsTrends } from './getNpsTrends';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';

// ─── Fixtures ───────────────────────────────────────────

const adminUser = makeUser({ id: 'admin-1', role: 'admin' });
const officerUser = makeUser({ id: 'officer-1', role: 'officer' });
const memberUser = makeUser({ id: 'member-1', role: 'member' });

const fakeSurveys = [
  {
    id: 'survey-1',
    title: 'Q1 NPS',
    organizationId: 'tenant-1',
    status: 'active',
    createdAt: '2024-01-15T00:00:00Z',
    analyticsSnapshot: { npsScore: 40, totalResponses: 100 },
  },
  {
    id: 'survey-2',
    title: 'Q2 NPS',
    organizationId: 'tenant-1',
    status: 'active',
    createdAt: '2024-04-15T00:00:00Z',
    analyticsSnapshot: { npsScore: 55, totalResponses: 80 },
  },
  {
    id: 'survey-3',
    title: 'General Survey',
    organizationId: 'tenant-1',
    status: 'closed',
    createdAt: '2024-06-01T00:00:00Z',
    analyticsSnapshot: null, // no NPS — should be excluded
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('getNpsTrends', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('admin — happy path returns NPS trends sorted by date', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: fakeSurveys, totalCount: 3 }),
    });

    const ctx = makeCtx({ user: adminUser });
    const res = await getNpsTrends(ctx);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Only surveys with npsScore (2 out of 3)
    expect(res.body).toHaveLength(2);
  });

  test('trends shape — each item has date, score, surveyTitle, responseCount', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [fakeSurveys[0]!], totalCount: 1 }),
    });

    const ctx = makeCtx({ user: adminUser });
    const res = await getNpsTrends(ctx);

    const item = res.body[0];
    expect(item.date).toBe('2024-01-15T00:00:00Z');
    expect(item.score).toBe(40);
    expect(item.surveyTitle).toBe('Q1 NPS');
    expect(item.responseCount).toBe(100);
  });

  test('trends sorted chronologically (ascending by createdAt)', async () => {
    // Provide surveys in reverse order — handler should sort ascending
    const reversed = [fakeSurveys[1]!, fakeSurveys[0]!];
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: reversed, totalCount: 2 }),
    });

    const ctx = makeCtx({ user: adminUser });
    const res = await getNpsTrends(ctx);

    expect(res.body[0].score).toBe(40);   // Q1 first (earlier date)
    expect(res.body[1].score).toBe(55);   // Q2 second
  });

  test('surveys without npsScore excluded from trends', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: fakeSurveys, totalCount: 3 }),
    });

    const ctx = makeCtx({ user: adminUser });
    const res = await getNpsTrends(ctx);

    // Only 2 of 3 have npsScore
    expect(res.body).toHaveLength(2);
    const ids = res.body.map((t: any) => t.surveyTitle);
    expect(ids).not.toContain('General Survey');
  });

  test('empty result when no surveys have NPS analytics', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({
        data: [{ ...fakeSurveys[0]!, analyticsSnapshot: null }],
        totalCount: 1,
      }),
    });

    const ctx = makeCtx({ user: adminUser });
    const res = await getNpsTrends(ctx);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('officer (non-admin) with active term — allowed', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ id: 'term-1', personId: 'officer-1' }],
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({ user: officerUser });
    const res = await getNpsTrends(ctx);

    expect(res.status).toBe(200);
  });

  test('member with no officer term — throws ForbiddenError', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({ user: memberUser });
    await expect(getNpsTrends(ctx)).rejects.toBeInstanceOf(ForbiddenError);
  });

  test('throws UnauthorizedError when no session', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(getNpsTrends(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
