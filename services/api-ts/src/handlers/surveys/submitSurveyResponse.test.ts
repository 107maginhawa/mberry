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

  // ─── [AC-M18-004] Response Re-Edit (M18-R3) ─────────────

  test('[AC-M18-004] re-edit allowed: updates existing response and returns 200', async () => {
    // Acceptance Criteria: [AC-M18-004]
    const reeditSurvey = {
      ...activeSurvey,
      settings: { allowReedit: true, deadline: new Date(Date.now() + 86400000).toISOString() },
    };
    let updateCalled = false;
    let updatedAnswers: any;
    stubRepo(SurveyRepository, {
      findById: async () => reeditSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => fakeResponse,
      updateResponseAnswers: async (id: string, answers: any) => {
        updateCalled = true;
        updatedAnswers = answers;
        return { ...fakeResponse, id, answers, updatedAt: new Date() };
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Updated feedback' }] },
    });

    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(true);
    expect(updatedAnswers[0].value).toBe('Updated feedback');
    expect((res as any).body.id).toBe('response-1');
  });

  test('[AC-M18-004] re-edit disabled (default): rejects duplicate with 409', async () => {
    // Acceptance Criteria: [AC-M18-004] — negative path
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey, // settings: {} — allowReedit undefined
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

  test('[AC-M18-004] re-edit enabled but deadline passed: still rejects via M18-R1', async () => {
    // Acceptance Criteria: [AC-M18-004] — re-edit gated by deadline
    const expiredReedit = {
      ...activeSurvey,
      settings: { allowReedit: true, deadline: new Date(Date.now() - 86400000).toISOString() },
    };
    stubRepo(SurveyRepository, {
      findById: async () => expiredReedit,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Too late' }] },
    });
    await expect(submitSurveyResponse(ctx)).rejects.toThrow('Survey deadline has passed');
  });

  test('[AC-M18-004] re-edit allowed but no existing response: creates new (returns 201)', async () => {
    // Acceptance Criteria: [AC-M18-004] — allowReedit does not preclude first submission
    const reeditSurvey = {
      ...activeSurvey,
      settings: { allowReedit: true },
    };
    stubRepo(SurveyRepository, {
      findById: async () => reeditSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'First take' }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
  });

  // ─── [AC-M18-006] Instant Poll Inline Results (M18-R4 / WF-103) ───

  test('[AC-M18-006] poll: returns aggregated counts inline in response body', async () => {
    // Acceptance Criteria: [AC-M18-006]
    const pollSurvey = {
      ...activeSurvey,
      surveyType: 'poll',
      questions: [
        { id: 'q1', type: 'single_choice', text: 'Best lunch?', required: true, order: 1, options: ['Pizza', 'Sushi', 'Salad'] },
      ],
      settings: {},
    };
    const priorResponses = [
      { ...fakeResponse, id: 'r-a', answers: [{ questionId: 'q1', value: 'Pizza' }] },
      { ...fakeResponse, id: 'r-b', answers: [{ questionId: 'q1', value: 'Sushi' }] },
      { ...fakeResponse, id: 'r-c', answers: [{ questionId: 'q1', value: 'Pizza' }] },
      { ...fakeResponse, id: 'r-new', answers: [{ questionId: 'q1', value: 'Pizza' }] },
    ];
    stubRepo(SurveyRepository, {
      findById: async () => pollSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => ({ ...fakeResponse, id: 'r-new', answers: [{ questionId: 'q1', value: 'Pizza' }] }),
      findAllBySurveyId: async () => priorResponses,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Pizza' }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    const body = (res as any).body;
    expect(body.pollResults).toBeDefined();
    expect(Array.isArray(body.pollResults)).toBe(true);
    expect(body.pollResults.length).toBe(1);
    expect(body.pollResults[0].questionId).toBe('q1');
    expect(body.pollResults[0].counts.Pizza).toBe(3);
    expect(body.pollResults[0].counts.Sushi).toBe(1);
    expect(body.pollResults[0].total).toBe(4);
  });

  test('[AC-M18-006] non-poll survey: response body has no pollResults field', async () => {
    // Acceptance Criteria: [AC-M18-006] — negative path, no leak into general surveys
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey, // surveyType: 'general'
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => fakeResponse,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Some text' }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.pollResults).toBeUndefined();
  });

  test('[AC-M18-006] poll re-edit: returns refreshed aggregated counts inline', async () => {
    // Acceptance Criteria: [AC-M18-006] + [AC-M18-004] interaction
    const pollReedit = {
      ...activeSurvey,
      surveyType: 'poll',
      questions: [
        { id: 'q1', type: 'single_choice', text: 'Pick one', required: true, order: 1, options: ['A', 'B'] },
      ],
      settings: { allowReedit: true },
    };
    const all = [
      { ...fakeResponse, id: 'r-1', answers: [{ questionId: 'q1', value: 'A' }] },
      { ...fakeResponse, id: 'r-2', answers: [{ questionId: 'q1', value: 'B' }] },
    ];
    stubRepo(SurveyRepository, {
      findById: async () => pollReedit,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => ({ ...fakeResponse, id: 'r-2', answers: [{ questionId: 'q1', value: 'B' }] }),
      updateResponseAnswers: async (id: string, answers: any) => ({ ...fakeResponse, id, answers }),
      findAllBySurveyId: async () => all,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'A' }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(body.pollResults).toBeDefined();
    expect(body.pollResults[0].questionId).toBe('q1');
  });

  test('[AC-M18-006] poll with multi-choice: counts each selected option', async () => {
    // Acceptance Criteria: [AC-M18-006] — array answers
    const pollSurvey = {
      ...activeSurvey,
      surveyType: 'poll',
      questions: [
        { id: 'q1', type: 'multi_choice', text: 'Pick all', required: true, order: 1, options: ['X', 'Y', 'Z'] },
      ],
      settings: {},
    };
    const responses = [
      { ...fakeResponse, id: 'r-1', answers: [{ questionId: 'q1', value: ['X', 'Y'] }] },
      { ...fakeResponse, id: 'r-2', answers: [{ questionId: 'q1', value: ['X', 'Z'] }] },
    ];
    stubRepo(SurveyRepository, {
      findById: async () => pollSurvey,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => undefined,
      submitResponse: async () => ({ ...fakeResponse, answers: [{ questionId: 'q1', value: ['X'] }] }),
      findAllBySurveyId: async () => responses,
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: ['X'] }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(201);
    const counts = (res as any).body.pollResults[0].counts;
    expect(counts.X).toBe(2);
    expect(counts.Y).toBe(1);
    expect(counts.Z).toBe(1);
  });

  test('[AC-M18-004] re-edit on anonymous survey: still works without responderId leak', async () => {
    // Acceptance Criteria: [AC-M18-004] — anonymity preserved on update
    const reeditAnon = {
      ...activeSurvey,
      settings: { allowReedit: true, anonymous: true },
    };
    let updateCalled = false;
    stubRepo(SurveyRepository, {
      findById: async () => reeditAnon,
    });
    stubRepo(SurveyResponseRepository, {
      findByResponderAndSurvey: async () => ({ ...fakeResponse, responderId: null }),
      updateResponseAnswers: async (id: string, answers: any) => {
        updateCalled = true;
        return { ...fakeResponse, id, answers, responderId: null };
      },
    });

    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
      _body: { answers: [{ questionId: 'q1', value: 'Updated anon feedback' }] },
    });
    const res = await submitSurveyResponse(ctx);
    expect(res.status).toBe(200);
    expect(updateCalled).toBe(true);
  });
});
