/**
 * Tests for deleteSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - BusinessLogicError when survey is not draft
 * - Happy path: deletes draft survey — returns 204
 * - Race condition: deleteDraft returns false
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { deleteSurvey } from './deleteSurvey';

// ─── Fixtures ───────────────────────────────────────────

const draftSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Draft Survey',
  status: 'draft',
  surveyType: 'general',
  questions: [],
  settings: {},
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────

describe('deleteSurvey', () => {
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
    await expect(deleteSurvey(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(deleteSurvey(ctx)).rejects.toThrow('Only officers or admins can delete surveys');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(deleteSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...draftSurvey, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(deleteSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws BusinessLogicError when survey is not draft', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...draftSurvey, status: 'active' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(deleteSurvey(ctx)).rejects.toThrow('Only draft surveys can be deleted');
  });

  test('deletes draft survey — returns 204', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
      deleteDraft: async () => true,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await deleteSurvey(ctx);
    expect(res.status).toBe(204);
  });

  test('throws BusinessLogicError when deleteDraft fails (race condition)', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
      deleteDraft: async () => false,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    await expect(deleteSurvey(ctx)).rejects.toThrow('Failed to delete survey');
  });
});
