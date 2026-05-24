/**
 * Tests for exportSurveyResponses handler
 *
 * Covers:
 * - Returns 401 without session
 * - Returns 403 for non-officer/non-admin
 * - CSV with various question types
 * - Anonymous survey hides respondent column
 * - Empty responses returns header-only CSV
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { exportSurveyResponses } from './exportSurveyResponses';

// ─── Fixtures ───────────────────────────────────────────

const questions = [
  { id: 'q1', type: 'nps', text: 'How likely to recommend?', required: true, order: 1 },
  { id: 'q2', type: 'text', text: 'Any comments?', required: false, order: 2 },
  { id: 'q3', type: 'multi_choice', text: 'Favorite topics', required: false, order: 3, options: ['A', 'B'] },
];

const baseSurvey = {
  id: 'survey-1',
  organizationId: 'tenant-1',
  title: 'Member Satisfaction',
  description: 'Annual survey',
  status: 'closed',
  surveyType: 'general',
  questions,
  settings: { anonymous: false },
  analyticsSnapshot: null,
  createdBy: 'officer-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const anonymousSurvey = {
  ...baseSurvey,
  id: 'survey-anon',
  settings: { anonymous: true },
};

const responses = [
  {
    id: 'resp-1',
    surveyId: 'survey-1',
    organizationId: 'tenant-1',
    responderId: 'member-1',
    answers: [
      { questionId: 'q1', value: 9 },
      { questionId: 'q2', value: 'Great service' },
      { questionId: 'q3', value: ['A', 'B'] },
    ],
    status: 'completed',
    completedAt: new Date('2026-05-20T10:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'resp-2',
    surveyId: 'survey-1',
    organizationId: 'tenant-1',
    responderId: 'member-2',
    answers: [
      { questionId: 'q1', value: 5 },
    ],
    status: 'completed',
    completedAt: new Date('2026-05-21T12:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// ─── Tests ──────────────────────────────────────────────

describe('exportSurveyResponses', () => {
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
    await expect(exportSurveyResponses(ctx)).rejects.toThrow();
  });

  test('throws ForbiddenError for non-officer non-admin', async () => {
    stubRepo(OfficerTermRepository, {
      findActiveByPersonAndOrg: async () => [],
    });
    const ctx = makeCtx({
      user: { id: 'user-1', role: 'user' },
      _params: { survey: 'survey-1' },
    });
    await expect(exportSurveyResponses(ctx)).rejects.toThrow('Only officers or admins can export survey responses');
  });

  test('generates CSV with various question types', async () => {
    stubRepo(SurveyRepository, { findById: async () => baseSurvey });
    stubRepo(SurveyResponseRepository, { findAllBySurveyId: async () => responses });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await exportSurveyResponses(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('survey-Member_Satisfaction.csv');

    const csv = await res.text();
    const lines = csv.split('\n');
    // Header: Respondent ID, Completed At, 3 questions
    expect(lines[0]).toBe('Respondent ID,Completed At,How likely to recommend?,Any comments?,Favorite topics');
    // Row 1: member-1 answered all 3
    expect(lines[1]).toContain('member-1');
    expect(lines[1]).toContain('9');
    expect(lines[1]).toContain('Great service');
    expect(lines[1]).toContain('A; B');
    // Row 2: member-2 answered only q1, rest empty
    expect(lines[2]).toContain('member-2');
    expect(lines[2]).toContain('5');
  });

  test('anonymous survey hides respondent column', async () => {
    stubRepo(SurveyRepository, { findById: async () => anonymousSurvey });
    stubRepo(SurveyResponseRepository, { findAllBySurveyId: async () => responses });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-anon' },
    });

    const res = await exportSurveyResponses(ctx);
    const csv = await res.text();
    const header = csv.split('\n')[0]!;
    expect(header).not.toContain('Respondent ID');
    expect(header).toStartWith('Completed At');
  });

  test('empty responses returns header-only CSV', async () => {
    stubRepo(SurveyRepository, { findById: async () => baseSurvey });
    stubRepo(SurveyResponseRepository, { findAllBySurveyId: async () => [] });

    const ctx = makeCtx({
      user: { id: 'user-1', role: 'admin' },
      _params: { survey: 'survey-1' },
    });

    const res = await exportSurveyResponses(ctx);
    const csv = await res.text();
    const lines = csv.split('\n');
    expect(lines.length).toBe(1); // header only
    expect(lines[0]).toContain('How likely to recommend?');
  });
});
