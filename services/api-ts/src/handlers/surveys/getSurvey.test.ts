/**
 * Tests for getSurvey handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 404 when survey not found
 * - Returns 404 when survey belongs to different org
 * - FIX-001 (M18 read-auth): non-officer member cannot read survey detail
 *   (drafts + internal targetAudience/settings are officer-only)
 * - Officer/admin can read survey detail
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
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

const draftSurvey = {
  ...fakeSurvey,
  id: 'survey-draft',
  title: 'Confidential Draft',
  status: 'draft',
  settings: { anonymous: false, targetAudience: { tiers: ['gold'] } },
};

// ─── Tests ──────────────────────────────────────────────

describe('getSurvey', () => {
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
    await expect(getSurvey(ctx)).rejects.toThrow();
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  test('throws NotFoundError when survey belongs to different org', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => ({ ...fakeSurvey, organizationId: 'other-org' }),
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Survey not found');
  });

  // FIX-001 — RBAC read-auth gate (RED before fix)
  test('FIX-001: throws ForbiddenError for non-officer member reading a draft', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      _params: { survey: 'survey-draft' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Only officers or admins can view survey details');
  });

  test('FIX-001: throws ForbiddenError for non-officer member reading any survey', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'member-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(getSurvey(ctx)).rejects.toThrow('Only officers or admins can view survey details');
  });

  test('FIX-001: officer (active term) can read survey detail — 200', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [{ positionTitle: 'Secretary' }],
    });
    stubRepo(SurveyRepository, {
      findById: async () => draftSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'officer-1', role: 'user' },
      _params: { survey: 'survey-draft' },
    });

    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-draft');
  });

  test('returns survey by ID for admin — 200', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => fakeSurvey,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await getSurvey(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.id).toBe('survey-1');
    expect((res as any).body.title).toBe('Member Satisfaction');
    expect((res as any).body.status).toBe('active');
  });
});
