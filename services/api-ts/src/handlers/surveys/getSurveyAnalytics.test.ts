/**
 * Tests for getSurveyAnalytics handler
 *
 * Acceptance Criteria: [AC-M18-005] (Aggregated results display — per question type: counts/average/text list)
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - Returns 404 when survey not found
 * - Returns cached analyticsSnapshot when available
 * - Computes analytics on-the-fly when no snapshot
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { getSurveyAnalytics } from './getSurveyAnalytics';

// ─── Fixtures ───────────────────────────────────────────

const cachedSnapshot = {
  totalResponses: 50,
  completionRate: 1,
  npsScore: 72,
  questionBreakdown: [
    { questionId: 'q1', questionType: 'nps', promoters: 40, passives: 5, detractors: 5, npsScore: 70 },
  ],
};

const surveyWithSnapshot = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Cached Survey',
  status: 'closed',
  surveyType: 'nps',
  questions: [{ id: 'q1', type: 'nps', text: 'How likely?', required: true, order: 1 }],
  settings: {},
  analyticsSnapshot: cachedSnapshot,
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const surveyWithoutSnapshot = {
  ...surveyWithSnapshot,
  id: 'survey-2',
  analyticsSnapshot: null,
};

const completedResponses = [
  {
    id: 'resp-1',
    surveyId: 'survey-2',
    responderId: 'member-1',
    answers: [{ questionId: 'q1', value: 9 }],
    status: 'completed',
  },
  {
    id: 'resp-2',
    surveyId: 'survey-2',
    responderId: 'member-2',
    answers: [{ questionId: 'q1', value: 3 }],
    status: 'completed',
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('getSurveyAnalytics', () => {
  afterEach(() => {
    restoreRepo(SurveyRepository);
    restoreRepo(SurveyResponseRepository);
    restoreRepo(OfficerTermRepository);
  });

  test('throws UnauthorizedError without session', async () => {
    const ctx = makeCtx({
      user: null,
      session: null,
      _params: { survey: 'survey-1' },
    });
    await expect(getSurveyAnalytics(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(getSurveyAnalytics(ctx)).rejects.toThrow('Only officers or admins can view survey analytics');
  });

  test('throws NotFoundError when survey not found', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => undefined,
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'missing' },
    });
    await expect(getSurveyAnalytics(ctx)).rejects.toThrow('Survey not found');
  });

  test('returns cached analyticsSnapshot when available', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => surveyWithSnapshot,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await getSurveyAnalytics(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.totalResponses).toBe(50);
    expect((res as any).body.npsScore).toBe(72);
  });

  test('computes analytics on-the-fly when no snapshot', async () => {
    stubRepo(SurveyRepository, {
      findById: async () => surveyWithoutSnapshot,
    });
    stubRepo(SurveyResponseRepository, {
      findAllBySurveyId: async () => completedResponses,
    });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-2' },
    });

    const res = await getSurveyAnalytics(ctx);
    expect(res.status).toBe(200);
    expect((res as any).body.totalResponses).toBe(2);
    expect((res as any).body.questionBreakdown).toBeDefined();
    expect((res as any).body.questionBreakdown.length).toBe(1);
    // 1 promoter (9), 1 detractor (3) => NPS = (1-1)/2 * 100 = 0
    expect((res as any).body.questionBreakdown[0].npsScore).toBe(0);
  });
});
