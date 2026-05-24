/**
 * Tests for createSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Happy path: admin creates survey in draft status
 * - Happy path: officer creates survey
 * - Passes body fields through to repo
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { createSurvey } from './createSurvey';

// ─── Fixtures ───────────────────────────────────────────

const fakeSurveyResult = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Member Satisfaction',
  description: 'Annual survey',
  status: 'draft',
  surveyType: 'general',
  questions: [],
  settings: {},
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('createSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
  });

  // ── Auth ───────────────────────────────────────────────

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _body: { title: 'Test', surveyType: 'general' },
    });

    await expect(createSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _body: { title: 'Test', surveyType: 'general' },
    });

    await expect(createSurvey(ctx)).rejects.toThrow('Only officers or admins can create surveys');
  });

  // ── Happy Path ─────────────────────────────────────────

  test('admin creates survey — returns 201', async () => {
    stubRepo(SurveyRepository, {
      createSurvey: async () => fakeSurveyResult,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _body: {
        title: 'Member Satisfaction',
        description: 'Annual survey',
        surveyType: 'general',
        questions: [],
        settings: {},
      },
    });

    const res = await createSurvey(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.status).toBe('draft');
  });

  test('officer creates survey — returns 201', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'President' }],
    });
    stubRepo(SurveyRepository, {
      createSurvey: async () => fakeSurveyResult,
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _body: {
        title: 'Member Satisfaction',
        surveyType: 'general',
      },
    });

    const res = await createSurvey(ctx);
    expect(res.status).toBe(201);
  });

  test('passes settings with deadline through to repo', async () => {
    let capturedData: any;
    stubRepo(SurveyRepository, {
      createSurvey: async (data: any) => {
        capturedData = data;
        return { ...fakeSurveyResult, settings: data.settings };
      },
    });

    const deadline = new Date('2026-12-31T23:59:59.000Z');
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _body: {
        title: 'Deadline Test',
        surveyType: 'general',
        settings: { deadline, anonymous: true },
      },
    });

    const res = await createSurvey(ctx);
    expect(res.status).toBe(201);
    expect(capturedData.settings.deadline).toBe('2026-12-31T23:59:59.000Z');
    expect(capturedData.settings.anonymous).toBe(true);
  });
});
