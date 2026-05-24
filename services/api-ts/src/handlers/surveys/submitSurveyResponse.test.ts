/**
 * Tests for submitSurveyResponse handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 404 when survey not found
 * - BusinessLogicError when survey is not active (M18-R5)
 * - BusinessLogicError when deadline has passed (M18-R1)
 * - ConflictError on duplicate response
 * - Happy path: submits response — returns 201
 * - Triggers analytics aggregation job
 * - Works without deadline set
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { submitSurveyResponse } from './submitSurveyResponse';

// ─── Fixtures ───────────────────────────────────────────

const activeSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Active Survey',
  status: 'active',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const futureDeadlineSurvey = {
  ...activeSurvey,
  settings: { deadline: new Date(Date.now() + 86400000).toISOString() },
};

const pastDeadlineSurvey = {
  ...activeSurvey,
  settings: { deadline: new Date(Date.now() - 86400000).toISOString() },
};

const fakeResponse = {
  id: 'response-1',
  organizationId: 'tenant-1',
  surveyId: 'survey-1',
  responderId: 'user-1',
  answers: [{ questionId: 'q1', value: 'Great service' }],
  status: 'completed',
  completedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('submitSurveyResponse', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'missing' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, organizationId: 'other-org' }),
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws BusinessLogicError when survey is not active (M18-R5)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, status: 'draft' }),
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey is not accepting responses');
  });

  test('throws BusinessLogicError when survey is closed', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...activeSurvey, status: 'closed' }),
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey is not accepting responses');
  });

  test('throws BusinessLogicError when deadline has passed (M18-R1)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => pastDeadlineSurvey,
    });
    stubRepo(SurveyResponseRepository, {});

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey deadline has passed');
  });

  test('throws ConflictError on duplicate response', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Duplicate' }] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('You have already responded');
  });

  test('submits response — returns 201', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Great service' }] },
    });

    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.id).toBe('response-1');
    expect((res as any).body.status).toBe('completed');
  });

  test('allows response when deadline is in the future', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => futureDeadlineSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Good' }] },
    });

    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
  });

  test('strips responderId for anonymous surveys (BR-40 privacy)', async () => {
    const anonymousSurvey = {
      ...activeSurvey,
      settings: { anonymous: true },
    };
    let capturedData: any;
    stubRepo(SurveyRepository, {
      findById: async () => anonymousSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async (data: any) => {
        capturedData = data;
        return { ...fakeResponse, responderId: null };
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Anonymous feedback' }] },
    });

    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    expect(capturedData.responderId).toBeNull();
  });

  test('preserves responderId for non-anonymous surveys', async () => {
    let capturedData: any;
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async (data: any) => {
        capturedData = data;
        return fakeResponse;
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Identified feedback' }] },
    });

    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    expect(capturedData.responderId).toBe('user-1');
  });

  test('still checks dedup before stripping responderId on anonymous survey', async () => {
    const anonymousSurvey = {
      ...activeSurvey,
      settings: { anonymous: true },
    };
    stubRepo(SurveyRepository, {
      findById: async () => anonymousSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Duplicate' }] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('You have already responded');
  });

  test('triggers analytics aggregation job when jobs scheduler available', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => fakeResponse,
    });

    let jobTriggered = false;
    let jobPayload: any;
    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Good' }] },
      jobs: {
        trigger: async (name: string, payload: any) => {
          jobTriggered = true;
          jobPayload = payload;
        },
      },
    });

    await submitSurveyResponse(ctx);
    expect(jobTriggered).toBe(true);
    expect(jobPayload.surveyId).toBe('survey-1');
    expect(jobPayload.organizationId).toBe('tenant-1');
  });
});
