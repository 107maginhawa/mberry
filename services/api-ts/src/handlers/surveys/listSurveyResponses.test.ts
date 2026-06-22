/**
 * Tests for listSurveyResponses handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin (M18-R2)
 * - Returns 404 when survey not found
 * - Happy path: returns paginated responses
 * - BR-40: Anonymous surveys strip responderId to zeros UUID
 * - Non-anonymous surveys preserve responderId
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { listSurveyResponses } from './listSurveyResponses';

// ─── Fixtures ───────────────────────────────────────────

const ANONYMOUS_UUID = '00000000-0000-0000-0000-000000000000';

const identifiedSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Identified Survey',
  status: 'active',
  surveyType: 'general',
  questions: [],
  settings: {},
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const anonymousSurvey = {
  ...identifiedSurvey,
  id: 'survey-2',
  title: 'Anonymous Survey',
  settings: { anonymous: true },
};

const responseList = [
  {
    id: 'resp-1',
    surveyId: 'survey-1',
    organizationId: 'tenant-1',
    responderId: 'member-1',
    createdBy: 'member-1',
    updatedBy: 'member-1',
    answers: [{ questionId: 'q1', value: 'Great' }],
    status: 'completed',
    createdAt: new Date(),
  },
  {
    id: 'resp-2',
    surveyId: 'survey-1',
    organizationId: 'tenant-1',
    responderId: 'member-2',
    createdBy: 'member-2',
    updatedBy: 'member-2',
    answers: [{ questionId: 'q1', value: 'Good' }],
    status: 'completed',
    createdAt: new Date(),
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('listSurveyResponses', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
      _query: {},
    });
    await expect(listSurveyResponses(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin (M18-R2)', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
      _query: {},
    });
    await expect(listSurveyResponses(ctx)).rejects.toThrow('Only officers or admins can view survey responses');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
      _query: {},
    });
    await expect(listSurveyResponses(ctx)).rejects.toThrow('Survey not found');
  });

  test('returns paginated responses for identified survey', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => identifiedSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({ data: responseList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
      _query: {},
    });

    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
    // Non-anonymous: responderId + audit columns preserved (officer-visible).
    expect((res as any).body.data[0].responderId).toBe('member-1');
    expect((res as any).body.data[1].responderId).toBe('member-2');
    expect((res as any).body.data[0].createdBy).toBe('member-1');
    expect((res as any).body.data[0].updatedBy).toBe('member-1');
  });

  test('BR-40 / FIX-007: anonymous surveys return null responderId (not a sentinel UUID)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => anonymousSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({ data: responseList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-2' },
      _query: {},
    });

    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);
    // FIX-007: anonymity is represented as null (matches TypeSpec `responderId?`),
    // not the all-zeros sentinel a client might mistake for a real person id.
    expect((res as any).body.data[0].responderId).toBe(null);
    expect((res as any).body.data[1].responderId).toBe(null);
    expect((res as any).body.data[0].responderId).not.toBe(ANONYMOUS_UUID);
    // BR-40 defense-in-depth: the created_by/updated_by audit columns must ALSO
    // be nulled on read, so a legacy/abnormal row can't deanonymize via them.
    expect((res as any).body.data[0].createdBy).toBe(null);
    expect((res as any).body.data[0].updatedBy).toBe(null);
    expect((res as any).body.data[1].createdBy).toBe(null);
  });

  test('returns empty data when no responses', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => identifiedSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({ data: [], totalCount: 0 }),
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
      _query: {},
    });

    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(0);
  });

  test('officer can view responses', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SurveyRepository, {
      findById: async () => identifiedSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findManyWithPagination: async () => ({ data: responseList, totalCount: 2 }),
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _params: { survey: 'survey-1' },
      _query: {},
    });

    const res = await listSurveyResponses(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.data.length).toBe(2);
  });
});
