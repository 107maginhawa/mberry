/**
 * Tests for closeSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - BusinessLogicError when survey is not active (lifecycle: active->closed)
 * - Happy path: closes active survey
 * - Race condition: close returns undefined
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { closeSurvey } from './closeSurvey';

// ─── Fixtures ───────────────────────────────────────────

const activeSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Active Survey',
  status: 'active',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('closeSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
    });
    await expect(closeSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(closeSurvey(ctx)).rejects.toThrow('Only officers or admins can close surveys');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(closeSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws BusinessLogicError when survey is draft', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, status: 'draft' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(closeSurvey(ctx)).rejects.toThrow('Only active surveys can be closed');
  });

  test('throws BusinessLogicError when survey is already closed', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, status: 'closed' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(closeSurvey(ctx)).rejects.toThrow('Only active surveys can be closed');
  });

  test('closes active survey — returns 200', async () => {
    const closed = { ...activeSurvey, status: 'closed' };
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
      close: async () => closed,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await closeSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('closed');
  });

  test('throws BusinessLogicError when close returns undefined (race)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
      close: async () => undefined,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    await expect(closeSurvey(ctx)).rejects.toThrow('Failed to close survey');
  });
});
