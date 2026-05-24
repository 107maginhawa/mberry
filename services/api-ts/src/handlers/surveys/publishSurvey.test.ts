/**
 * Tests for publishSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - BusinessLogicError when survey is not draft (lifecycle: draft->active)
 * - BusinessLogicError when survey has no questions
 * - Happy path: publishes draft survey with questions
 * - Race condition: publish returns undefined
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { publishSurvey } from './publishSurvey';

// ─── Fixtures ───────────────────────────────────────────

const draftWithQuestions = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Survey',
  status: 'draft',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const draftNoQuestions = {
  ...draftWithQuestions,
  id: 'survey-2',
  questions: [],
};

const draftNullQuestions = {
  ...draftWithQuestions,
  id: 'survey-3',
  questions: null,
};

// ─── Tests ──────────────────────────────────────────────

describe('publishSurvey', () => {
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
    await expect(publishSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Only officers or admins can publish surveys');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws BusinessLogicError when survey is already active', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...draftWithQuestions, status: 'active' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Only draft surveys can be published');
  });

  test('throws BusinessLogicError when survey is closed', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...draftWithQuestions, status: 'closed' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Only draft surveys can be published');
  });

  test('throws BusinessLogicError when survey has no questions (empty array)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftNoQuestions,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-2' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Survey must have at least one question');
  });

  test('throws BusinessLogicError when survey has null questions', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftNullQuestions,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-3' },
    });
    await expect(publishSurvey(ctx)).rejects.toThrow('Survey must have at least one question');
  });

  test('publishes draft survey with questions — returns 200', async () => {
    const published = { ...draftWithQuestions, status: 'active' };
    stubRepo(SurveyRepository, {
      findById: async () => draftWithQuestions,
      publish: async () => published,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await publishSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.status).toBe('active');
  });

  test('throws BusinessLogicError when publish returns undefined (race)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftWithQuestions,
      publish: async () => undefined,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    await expect(publishSurvey(ctx)).rejects.toThrow('Failed to publish survey');
  });
});
