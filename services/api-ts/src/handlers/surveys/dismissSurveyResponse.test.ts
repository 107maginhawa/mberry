/**
 * Tests for dismissSurveyResponse handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 404 when survey not found
 * - Marks existing pending response as dismissed
 * - Creates dismissed response when none exists
 * - No-op when already completed/dismissed
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { dismissSurveyResponse } from './dismissSurveyResponse';

// ─── Fixtures ───────────────────────────────────────────

const activeSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'NPS Survey',
  status: 'active',
  surveyType: 'nps',
  questions: [],
  settings: {},
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const pendingResponse = {
  id: 'response-1',
  organizationId: 'tenant-1',
  surveyId: 'survey-1',
  responderId: 'user-1',
  answers: [],
  status: 'pending',
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const completedResponse = {
  ...pendingResponse,
  status: 'completed',
  completedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('dismissSurveyResponse', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
    });
    await expect(dismissSurveyResponse(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'missing' },
    });
    await expect(dismissSurveyResponse(ctx)).rejects.toThrow('Survey not found');
  });

  test('marks existing pending response as dismissed', async () => {
    let dismissedId: string | null = null;
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => pendingResponse,
      markAsDismissed: async (id: string) => {
        dismissedId = id;
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
    });

    const res = await dismissSurveyResponse(ctx);
    expect(res.status).toBe(204);
    expect(dismissedId).toBe('response-1');
  });

  test('creates dismissed response when none exists', async () => {
    let createdData: any = null;
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      createDismissedResponse: async (data: any) => {
        createdData = data;
        return { ...pendingResponse, status: 'dismissed' };
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
    });

    const res = await dismissSurveyResponse(ctx);
    expect(res.status).toBe(204);
    expect(createdData.surveyId).toBe('survey-1');
    expect(createdData.responderId).toBe('user-1');
  });

  test('no-op when already completed', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => completedResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
    });

    const res = await dismissSurveyResponse(ctx);
    expect(res.status).toBe(204);
  });
});
