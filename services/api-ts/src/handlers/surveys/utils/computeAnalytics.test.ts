/**
 * Tests for computeAnalytics utility
 *
 * Covers:
 * - NPS score calculation (promoters, passives, detractors)
 * - Rating average calculation
 * - Single choice counting
 * - Multi choice counting
 * - Text question counting
 * - Yes/No question counting
 * - Empty responses
 * - Mixed question types
 * - NaN score handling
 */

import { describe, test, expect } from 'bun:test';
import { computeAnalytics } from './computeAnalytics';
import type { SurveyResponseRepository } from '../repos/survey.repo';

// ─── Mock Response Repo Factory ─────────────────────────

function mockResponseRepo(responses: any[]): SurveyResponseRepository {
  return {
    findAllBySurveyId: async () => responses,
  } as any;
}

// ─── Survey Factory ─────────────────────────────────────

function makeSurvey(questions: any[]) {
  return {
    id: 'survey-1',
    organizationId: 'org-1',
    title: 'Test Survey',
    status: 'active',
    surveyType: 'general',
    questions,
    settings: {},
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

// ─── Tests ──────────────────────────────────────────────

describe('computeAnalytics', () => {

  // ── Empty ─────────────────────────────────────────────

  test('returns zero counts with no responses', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'text', text: 'Feedback?', required: true, order: 1 },
    ]);
    const repo = mockResponseRepo([]);

    const result = await computeAnalytics(survey, repo);

    expect(result.totalResponses).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.questionBreakdown.length).toBe(1);
    expect(result.questionBreakdown[0].questionId).toBe('q1');
    expect(result.questionBreakdown[0].questionType).toBe('text');
  });

  // ── NPS ───────────────────────────────────────────────

  test('computes NPS score correctly', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'nps', text: 'How likely to recommend?', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 10 }] }, // promoter
      { answers: [{ questionId: 'q1', value: 9 }] },  // promoter
      { answers: [{ questionId: 'q1', value: 8 }] },  // passive
      { answers: [{ questionId: 'q1', value: 7 }] },  // passive
      { answers: [{ questionId: 'q1', value: 5 }] },  // detractor
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    expect(result.totalResponses).toBe(5);
    expect(result.completionRate).toBe(1);

    const nps = result.questionBreakdown[0];
    expect(nps.promoters).toBe(2);
    expect(nps.passives).toBe(2);
    expect(nps.detractors).toBe(1);
    // NPS = ((2 - 1) / 5) * 100 = 20
    expect(nps.npsScore).toBe(20);
    expect(nps.distribution?.['10']).toBe(1);
    expect(nps.distribution?.['9']).toBe(1);

    // Overall npsScore on snapshot should match
    expect(result.npsScore).toBe(20);
  });

  test('NPS score is 0 when all detractors and promoters cancel out', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'nps', text: 'NPS', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 10 }] }, // promoter
      { answers: [{ questionId: 'q1', value: 1 }] },  // detractor
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);
    expect(result.questionBreakdown[0].npsScore).toBe(0);
  });

  test('NPS handles NaN values gracefully', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'nps', text: 'NPS', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'invalid' }] },
      { answers: [{ questionId: 'q1', value: 10 }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);
    // Only valid score counted
    expect(result.questionBreakdown[0].promoters).toBe(1);
    expect(result.questionBreakdown[0].npsScore).toBe(100);
  });

  // ── Rating ────────────────────────────────────────────

  test('computes rating average correctly', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'rating', text: 'Rate us', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 5 }] },
      { answers: [{ questionId: 'q1', value: 3 }] },
      { answers: [{ questionId: 'q1', value: 4 }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    const rating = result.questionBreakdown[0];
    expect(rating.average).toBe(4); // (5+3+4)/3 = 4
    expect(rating.distribution?.['5']).toBe(1);
    expect(rating.distribution?.['3']).toBe(1);
    expect(rating.distribution?.['4']).toBe(1);
  });

  test('rating average is 0 when all values are NaN', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'rating', text: 'Rate us', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'bad' }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);
    expect(result.questionBreakdown[0].average).toBe(0);
  });

  // ── Single Choice ─────────────────────────────────────

  test('counts single choice answers', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'single_choice', text: 'Favorite?', required: true, order: 1, options: ['A', 'B', 'C'] },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'A' }] },
      { answers: [{ questionId: 'q1', value: 'A' }] },
      { answers: [{ questionId: 'q1', value: 'B' }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    const choice = result.questionBreakdown[0];
    expect(choice.counts?.['A']).toBe(2);
    expect(choice.counts?.['B']).toBe(1);
    expect(choice.counts?.['C']).toBeUndefined();
  });

  // ── Multi Choice ──────────────────────────────────────

  test('counts multi choice answers', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'multi_choice', text: 'Select all', required: true, order: 1, options: ['X', 'Y', 'Z'] },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: ['X', 'Y'] }] },
      { answers: [{ questionId: 'q1', value: ['Y', 'Z'] }] },
      { answers: [{ questionId: 'q1', value: ['X'] }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    const mc = result.questionBreakdown[0];
    expect(mc.counts?.['X']).toBe(2);
    expect(mc.counts?.['Y']).toBe(2);
    expect(mc.counts?.['Z']).toBe(1);
  });

  test('multi choice handles non-array value', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'multi_choice', text: 'Select all', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'single-val' }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);
    expect(result.questionBreakdown[0].counts?.['single-val']).toBe(1);
  });

  // ── Text ──────────────────────────────────────────────

  test('counts text responses', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'text', text: 'Comments', required: false, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'Great' }] },
      { answers: [{ questionId: 'q1', value: 'Could be better' }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);
    expect(result.questionBreakdown[0].count).toBe(2);
  });

  // ── Yes/No ────────────────────────────────────────────

  test('counts yes/no responses with boolean values', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'yes_no', text: 'Satisfied?', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: true }] },
      { answers: [{ questionId: 'q1', value: true }] },
      { answers: [{ questionId: 'q1', value: false }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    const yn = result.questionBreakdown[0];
    expect(yn.yesCount).toBe(2);
    expect(yn.noCount).toBe(1);
  });

  test('counts yes/no responses with string values', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'yes_no', text: 'Satisfied?', required: true, order: 1 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'true' }] },
      { answers: [{ questionId: 'q1', value: 'false' }] },
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    const yn = result.questionBreakdown[0];
    expect(yn.yesCount).toBe(1);
    expect(yn.noCount).toBe(1);
  });

  // ── Mixed Questions ───────────────────────────────────

  test('handles survey with multiple question types', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'nps', text: 'NPS', required: true, order: 1 },
      { id: 'q2', type: 'text', text: 'Why?', required: false, order: 2 },
      { id: 'q3', type: 'yes_no', text: 'Again?', required: true, order: 3 },
    ]);

    const responses = [
      { answers: [
        { questionId: 'q1', value: 10 },
        { questionId: 'q2', value: 'Excellent' },
        { questionId: 'q3', value: true },
      ]},
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    expect(result.totalResponses).toBe(1);
    expect(result.questionBreakdown.length).toBe(3);
    expect(result.questionBreakdown[0].questionType).toBe('nps');
    expect(result.questionBreakdown[1].questionType).toBe('text');
    expect(result.questionBreakdown[2].questionType).toBe('yes_no');
    expect(result.npsScore).toBe(100); // 1 promoter, 0 detractors
  });

  // ── Missing answers for question ──────────────────────

  test('handles response missing answer for a question', async () => {
    const survey = makeSurvey([
      { id: 'q1', type: 'text', text: 'Q1', required: true, order: 1 },
      { id: 'q2', type: 'text', text: 'Q2', required: false, order: 2 },
    ]);

    const responses = [
      { answers: [{ questionId: 'q1', value: 'Only Q1' }] }, // no q2 answer
    ];
    const repo = mockResponseRepo(responses);

    const result = await computeAnalytics(survey, repo);

    expect(result.questionBreakdown[0].count).toBe(1);
    // q2 has no answers — should return base breakdown only
    expect(result.questionBreakdown[1].questionId).toBe('q2');
    expect(result.questionBreakdown[1].count).toBeUndefined();
  });

  // ── Null questions ────────────────────────────────────

  test('handles survey with null questions', async () => {
    const survey = makeSurvey(null);
    const repo = mockResponseRepo([]);

    const result = await computeAnalytics(survey, repo);
    expect(result.totalResponses).toBe(0);
    expect(result.questionBreakdown.length).toBe(0);
  });
});
