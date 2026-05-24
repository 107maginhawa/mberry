/**
 * Tests for cloneSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - Clone creates draft copy with "(Copy)" suffix
 * - Clone copies questions and settings
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { cloneSurvey } from './cloneSurvey';

// ─── Fixtures ───────────────────────────────────────────

const originalSurvey = {
  id: 'survey-orig',
  organizationId: 'tenant-1',
  title: 'Q1 Feedback',
  description: 'Quarterly feedback survey',
  status: 'closed',
  surveyType: 'general',
  questions: [
    { id: 'q1', type: 'nps', text: 'How likely?', required: true, order: 1 },
    { id: 'q2', type: 'text', text: 'Comments', required: false, order: 2 },
  ],
  settings: { anonymous: true, deadline: '2026-06-30T23:59:59.000Z' },
  analyticsSnapshot: null,
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const clonedSurvey = {
  id: 'survey-clone',
  organizationId: 'tenant-1',
  title: 'Q1 Feedback (Copy)',
  description: 'Quarterly feedback survey',
  status: 'draft',
  surveyType: 'general',
  questions: originalSurvey.questions,
  settings: originalSurvey.settings,
  analyticsSnapshot: null,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('cloneSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-orig' },
    });
    await expect(cloneSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-orig' },
    });
    await expect(cloneSurvey(ctx)).rejects.toThrow('Only officers or admins can clone surveys');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(cloneSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('clone creates draft copy with "(Copy)" suffix', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => originalSurvey,
      cloneSurvey: async () => clonedSurvey,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-orig' },
    });

    const res = await cloneSurvey(ctx);
    expect(res.status).toBe(201);
    expect((res as any).body.title).toBe('Q1 Feedback (Copy)');
    expect((res as any).body.status).toBe('draft');
  });

  test('clone copies questions and settings', async () => {
    let capturedId: string | undefined;
    let capturedCreatedBy: string | undefined;

    stubRepo(SurveyRepository, {
      findById: async () => originalSurvey,
      cloneSurvey: async (id: string, createdBy: string) => {
        capturedId = id;
        capturedCreatedBy = createdBy;
        return clonedSurvey;
      },
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-orig' },
    });

    const res = await cloneSurvey(ctx);
    expect(res.status).toBe(201);
    expect(capturedId).toBe('survey-orig');
    expect(capturedCreatedBy).toBe('user-1');
    expect((res as any).body.questions).toEqual(originalSurvey.questions);
    expect((res as any).body.settings).toEqual(originalSurvey.settings);
  });

  test('officer can clone survey', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SurveyRepository, {
      findById: async () => originalSurvey,
      cloneSurvey: async () => clonedSurvey,
    });

    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _params: { survey: 'survey-orig' },
    });

    const res = await cloneSurvey(ctx);
    expect(res.status).toBe(201);
  });
});
