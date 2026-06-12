/**
 * Tests for listSurveys handler
 *
 * Covers:
 * - Returns 401 without session
 * - Happy path: returns paginated list (officer/admin)
 * - Returns empty list when no surveys
 * - Passes status/surveyType filters
 * - FIX-002 (M18 read-auth): non-officer member cannot list org surveys
 *   (incl. ?status=draft) on the non-`mine` path; member is restricted to
 *   the mine=true view
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
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
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _query: {},
    });
    await expect(listSurveys(ctx)).rejects.toThrow();
  });

  // FIX-002 — RBAC read-auth gate on the non-`mine` path (RED before fix)
  test('FIX-002: non-officer member listing all surveys (non-mine) is forbidden', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      _query: {},
    });

    await expect(listSurveys(ctx)).rejects.toThrow('Only officers or admins can list organization surveys');
  });

  test('FIX-002: non-officer member listing drafts (?status=draft, non-mine) is forbidden', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      _query: { status: 'draft' },
    });

    await expect(listSurveys(ctx)).rejects.toThrow('Only officers or admins can list organization surveys');
  });

  test('FIX-002: member with mine=true is allowed (no officer gate on assigned view)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findMineWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      _query: { mine: true },
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
  });

  test('FIX-002: officer (active term) can list all org surveys — 200', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _query: {},
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
  });

  test('returns paginated list (admin) — 200', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: surveyList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      _query: {},
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
    expect((res as any).body.pagination).toBeDefined();
  });

  test('returns empty list when no surveys (admin)', async () => {
    stubRepo(SurveyRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
      _query: {},
    });

    const res = await listSurveys(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(0);
  });

  test('passes query filters to repo (admin)', async () => {
    let capturedFilters: any;
    stubRepo(SurveyRepository, {
      findManyWithPagination: async (filters: any) => {
        capturedFilters = filters;
        return { data: [], totalCount: 0 };
      },
    });

    const ctx = makeCtx({
      user: { id: 'admin-1', role: 'admin' },
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

    const ctx = makeCtx({ user: { id: 'admin-1', role: 'admin' }, _query: {} });

    await listSurveys(ctx);
    expect(manyCalled).toBe(true);
    expect(mineCalled).toBe(false);
  });
});
