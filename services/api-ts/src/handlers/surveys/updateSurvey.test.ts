/**
 * Tests for updateSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - Returns 404 when survey belongs to different org
 * - BusinessLogicError when survey is not draft
 * - Happy path: updates draft survey
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { updateSurvey } from './updateSurvey';

// ─── Fixtures ───────────────────────────────────────────

const draftSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Draft Survey',
  status: 'draft',
  surveyType: 'general',
  questions: [{ id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 }],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activeSurvey = { ...draftSurvey, id: 'survey-2', status: 'active' };

// ─── Tests ──────────────────────────────────────────────

describe('updateSurvey', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
      _body: { title: 'Updated' },
    });
    await expect(updateSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
      _body: { title: 'Updated' },
    });
    await expect(updateSurvey(ctx)).rejects.toThrow('Only officers or admins can update surveys');
  });

  test('throws NotFoundError when survey does not exist', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
      _body: { title: 'Updated' },
    });
    await expect(updateSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...draftSurvey, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
      _body: { title: 'Updated' },
    });
    await expect(updateSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws BusinessLogicError when survey is not draft', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => activeSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-2' },
      _body: { title: 'Updated' },
    });
    await expect(updateSurvey(ctx)).rejects.toThrow('Only draft surveys can be updated');
  });

  test('updates draft survey — returns 200', async () => {
    const updatedSurvey = { ...draftSurvey, title: 'Updated Title' };
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
      updateDraftSurvey: async () => updatedSurvey,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
      _body: { title: 'Updated Title' },
    });

    const res = await updateSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.title).toBe('Updated Title');
  });

  test('handles updateDraftSurvey returning undefined (race condition)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
      updateDraftSurvey: async () => undefined,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
      _body: { title: 'Updated' },
    });

    await expect(updateSurvey(ctx)).rejects.toThrow('Failed to update survey');
  });
});
