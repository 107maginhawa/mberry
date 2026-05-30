/**
 * Tests for listSurveys handler
 *
 * Covers:
 * - Returns 401 without session
 * - Happy path: returns paginated list
 * - Returns empty list when no surveys
 * - Passes status/surveyType filters
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { listSurveys } from './listSurveys';

// ─── Fixtures ───────────────────────────────────────────

const surveyList = [
  {
    id: 'survey-1',
    organizationId: 'tenant-1',
    title: 'Survey A',
    status: 'active',
    surveyType: 'general',
    createdAt: new Date(),
  },
  {
    id: 'survey-2',
    organizationId: 'tenant-1',
    title: 'Survey B',
    status: 'draft',
    surveyType: 'nps',
    createdAt: new Date(),
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('listSurveys', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: {},
    });
    await expect(listSurveys(ctx)).rejects.toThrow();
  });

  test('returns paginated list — 200', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      _query: {},
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
    expect((res as any).body.pagination).toBeDefined();
  });

  test('returns empty list when no surveys', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      _query: {},
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(0);
  });

  test('passes query filters to repo', async () => {
    let capturedFilters: any;
    stubRepo(SurveyRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      _query: { status: 'active', surveyType: 'nps', page: '2', limit: '10' },
    });

    await listSurveys(ctx);
    expect(capturedFilters.status).toBe('active');
    expect(capturedFilters.surveyType).toBe('nps');
    expect(capturedFilters.organizationId).toBe('tenant-1');
  });

  test('mine=true routes to findMineWithPagination scoped to current user', async () => {
    let capturedOrg: string | undefined;
    let capturedResponder: string | undefined;
    let manyCalled = false;
    stubRepo(SurveyRepository, {
      findMineWithPagination: async (organizationId: string, responderId: string) => {
        capturedOrg = organizationId;
        capturedResponder = responderId;
        return { data: surveyList, totalCount: 2 };
      },
      findManyWithPagination: async () => {
        manyCalled = true;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      user: { id: 'member-42', role: 'user', twoFactorEnabled: true },
      _query: { mine: true },
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
    expect(capturedOrg).toBe('tenant-1');
    expect(capturedResponder).toBe('member-42');
    expect(manyCalled).toBe(false);
  });

  test('mine falsy keeps officer path (findManyWithPagination)', async () => {
    let mineCalled = false;
    let manyCalled = false;
    stubRepo(SurveyRepository, {
      findMineWithPagination: async () => {
        mineCalled = true;
        return { data: [], totalCount: 0 };
      },
      findManyWithPagination: async () => {
        manyCalled = true;
        return { data: surveyList, totalCount: 2 };
      },
    });

    const ctx = makeCtx({ _query: {} });

    await listSurveys(ctx);
    expect(manyCalled).toBe(true);
    expect(mineCalled).toBe(false);
  });
});
