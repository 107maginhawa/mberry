/**
 * Tests for getSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 404 when survey not found
 * - Returns 404 when survey belongs to different org
 * - Happy path: returns survey by ID
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { getSurvey } from './getSurvey';

// ─── Fixtures ───────────────────────────────────────────

const fakeSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Member Satisfaction',
  description: 'Annual survey',
  status: 'active',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('getSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      _params: { survey: 'missing' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('returns survey by ID — 200', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    const ctx = makeCtx({
      _params: { survey: 'survey-1' },
    });

    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.title).toBe('Member Satisfaction');
    expect((res as any).body.status).toBe('active');
  });
});
