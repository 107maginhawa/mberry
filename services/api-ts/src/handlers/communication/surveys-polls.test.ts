// Business Rules: [BR-40]
// Slice: 039-surveys-polls — M18 Surveys & Polls stabilization
/**
 * Comprehensive survey/poll CRUD, response collection, results aggregation,
 * duplicate prevention, and lifecycle tests.
 *
 * Covers: Survey CRUD, Poll CRUD, response submission (anonymous + identified),
 * duplicate response prevention, results aggregation (multiple choice, rating
 * scale, free text, ranking), deadline enforcement, distribution targeting,
 * and poll real-time results.
 *
 * BR-40 anonymity tests live in br-40.survey-anonymity.test.ts (15 tests).
 * This file covers the remaining M18 surface area.
 */

import { describe, test, expect } from 'bun:test';
// Factory N/A: handler test with inline primitives — no domain entity construction needed

// ─── Types ───────────────────────────────────────────────────

type SurveyType = 'anonymous' | 'identified';
type SurveyStatus = 'draft' | 'active' | 'closed';
type QuestionType = 'multiple_choice' | 'rating_scale' | 'free_text' | 'ranking';
type DistributionTarget = 'all_members' | 'active_members' | 'specific_categories';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  options?: string[];       // multiple_choice
  scaleMin?: number;        // rating_scale
  scaleMax?: number;        // rating_scale
  maxLength?: number;       // free_text
  items?: string[];         // ranking
  multiSelect?: boolean;    // multiple_choice
}

interface Survey {
  id: string;
  organizationId: string;
  title: string;
  type: SurveyType;
  status: SurveyStatus;
  isPoll: boolean;
  questions: Question[];
  distribution: DistributionTarget;
  categoryFilter?: string[];
  deadline?: string;        // ISO date, null = open-ended (polls)
  allowEditBeforeDeadline: boolean;
  showResultsImmediately: boolean; // polls: show after vote
  reminderSchedule: number[];      // days before deadline
  createdBy: string;
  createdAt: string;
  responseCount: number;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentId?: string;   // only for identified surveys
  answers: Record<string, unknown>;
  submittedAt: string;
}

interface AggregatedResult {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  responseCount: number;
  // multiple_choice
  optionCounts?: Record<string, number>;
  optionPercentages?: Record<string, number>;
  // rating_scale
  mean?: number;
  distribution?: Record<number, number>;
  // free_text
  textResponses?: string[];
  // ranking
  averageRanks?: Record<string, number>;
}

// ─── Pure domain functions ───────────────────────────────────

function createSurvey(params: {
  organizationId: string;
  title: string;
  type?: SurveyType;
  isPoll?: boolean;
  questions: Question[];
  distribution?: DistributionTarget;
  categoryFilter?: string[];
  deadline?: string;
  allowEditBeforeDeadline?: boolean;
  showResultsImmediately?: boolean;
  reminderSchedule?: number[];
  createdBy: string;
}): Survey {
  if (!params.title || params.title.trim().length === 0) {
    throw new Error('Survey title is required');
  }
  if (!params.questions || params.questions.length === 0) {
    throw new Error('Survey must have at least one question');
  }
  if (params.isPoll && params.questions.length > 1) {
    throw new Error('Poll must have exactly one question');
  }
  if (params.isPoll && params.questions[0]?.type !== 'multiple_choice') {
    throw new Error('Poll question must be multiple choice');
  }

  return {
    id: `survey-${Date.now()}`,
    organizationId: params.organizationId,
    title: params.title.trim(),
    type: params.type ?? 'anonymous',
    status: 'draft',
    isPoll: params.isPoll ?? false,
    questions: params.questions,
    distribution: params.distribution ?? 'active_members',
    categoryFilter: params.categoryFilter,
    deadline: params.deadline,
    allowEditBeforeDeadline: params.allowEditBeforeDeadline ?? true,
    showResultsImmediately: params.showResultsImmediately ?? false,
    reminderSchedule: params.reminderSchedule ?? [],
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    responseCount: 0,
  };
}

function updateSurvey(
  survey: Survey,
  updates: Partial<Pick<Survey, 'title' | 'questions' | 'distribution' | 'categoryFilter' | 'deadline' | 'reminderSchedule' | 'type' | 'allowEditBeforeDeadline' | 'showResultsImmediately'>>,
): Survey {
  if (survey.status !== 'draft') {
    throw new Error('Cannot edit a survey that is not in draft status');
  }
  return { ...survey, ...updates };
}

function publishSurvey(survey: Survey): Survey {
  if (survey.status !== 'draft') {
    throw new Error('Only draft surveys can be published');
  }
  if (survey.questions.length === 0) {
    throw new Error('Cannot publish a survey with no questions');
  }
  return { ...survey, status: 'active' };
}

function closeSurvey(survey: Survey): Survey {
  if (survey.status !== 'active') {
    throw new Error('Only active surveys can be closed');
  }
  return { ...survey, status: 'closed' };
}

function deleteSurvey(survey: Survey): void {
  if (survey.status === 'active') {
    throw new Error('Cannot delete an active survey — close it first');
  }
}

function isDeadlinePassed(survey: Survey): boolean {
  if (!survey.deadline) return false;
  return new Date(survey.deadline) < new Date();
}

function canSubmitResponse(survey: Survey, hasExistingResponse: boolean): { allowed: boolean; reason?: string } {
  if (survey.status !== 'active') {
    return { allowed: false, reason: 'Survey is not active' };
  }
  if (isDeadlinePassed(survey)) {
    return { allowed: false, reason: 'Survey deadline has passed' };
  }
  if (hasExistingResponse && !survey.allowEditBeforeDeadline) {
    return { allowed: false, reason: 'You have already submitted a response' };
  }
  return { allowed: true };
}

function submitResponse(
  survey: Survey,
  respondentId: string,
  answers: Record<string, unknown>,
  existingResponses: SurveyResponse[],
): SurveyResponse {
  const hasExisting = existingResponses.some(r =>
    r.surveyId === survey.id && r.respondentId === respondentId,
  );

  const check = canSubmitResponse(survey, hasExisting);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  // Validate required questions answered
  for (const q of survey.questions) {
    if (q.required && (answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === '')) {
      throw new Error(`Required question "${q.text}" must be answered`);
    }
  }

  const response: SurveyResponse = {
    id: `resp-${Date.now()}`,
    surveyId: survey.id,
    answers,
    submittedAt: new Date().toISOString(),
  };

  // Only attach respondentId for identified surveys
  if (survey.type === 'identified') {
    response.respondentId = respondentId;
  }

  return response;
}

function aggregateMultipleChoice(
  questionId: string,
  questionText: string,
  options: string[],
  responses: SurveyResponse[],
  multiSelect: boolean,
): AggregatedResult {
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;

  for (const r of responses) {
    const answer = r.answers[questionId];
    if (multiSelect && Array.isArray(answer)) {
      for (const a of answer) {
        if (typeof a === 'string' && a in counts) counts[a]++;
      }
    } else if (typeof answer === 'string' && answer in counts) {
      counts[answer]++;
    }
  }

  const total = responses.length;
  const percentages: Record<string, number> = {};
  for (const [opt, count] of Object.entries(counts)) {
    percentages[opt] = total > 0 ? Math.round((count / total) * 100) : 0;
  }

  return {
    questionId,
    questionText,
    questionType: 'multiple_choice',
    responseCount: total,
    optionCounts: counts,
    optionPercentages: percentages,
  };
}

function aggregateRatingScale(
  questionId: string,
  questionText: string,
  responses: SurveyResponse[],
  scaleMin: number,
  scaleMax: number,
): AggregatedResult {
  const distribution: Record<number, number> = {};
  for (let i = scaleMin; i <= scaleMax; i++) distribution[i] = 0;

  let sum = 0;
  let count = 0;
  for (const r of responses) {
    const val = r.answers[questionId];
    if (typeof val === 'number' && val >= scaleMin && val <= scaleMax) {
      distribution[val]++;
      sum += val;
      count++;
    }
  }

  return {
    questionId,
    questionText,
    questionType: 'rating_scale',
    responseCount: count,
    mean: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
  };
}

function aggregateFreeText(
  questionId: string,
  questionText: string,
  responses: SurveyResponse[],
): AggregatedResult {
  const texts: string[] = [];
  for (const r of responses) {
    const val = r.answers[questionId];
    if (typeof val === 'string' && val.trim().length > 0) {
      texts.push(val.trim());
    }
  }

  return {
    questionId,
    questionText,
    questionType: 'free_text',
    responseCount: texts.length,
    textResponses: texts,
  };
}

function aggregateRanking(
  questionId: string,
  questionText: string,
  items: string[],
  responses: SurveyResponse[],
): AggregatedResult {
  const rankSums: Record<string, number> = {};
  const rankCounts: Record<string, number> = {};
  for (const item of items) {
    rankSums[item] = 0;
    rankCounts[item] = 0;
  }

  for (const r of responses) {
    const ranking = r.answers[questionId];
    if (Array.isArray(ranking)) {
      for (let i = 0; i < ranking.length; i++) {
        const item = ranking[i] as string;
        if (item in rankSums) {
          rankSums[item] += i + 1; // 1-indexed rank
          rankCounts[item]++;
        }
      }
    }
  }

  const averageRanks: Record<string, number> = {};
  for (const item of items) {
    averageRanks[item] = rankCounts[item] > 0
      ? Math.round((rankSums[item] / rankCounts[item]) * 10) / 10
      : 0;
  }

  return {
    questionId,
    questionText,
    questionType: 'ranking',
    responseCount: responses.length,
    averageRanks,
  };
}

function calculateResponseRate(responseCount: number, targetCount: number): number {
  if (targetCount === 0) return 0;
  return Math.round((responseCount / targetCount) * 100);
}

// ─── Fixtures ────────────────────────────────────────────────

const ORG_ID = 'org-1';
const OFFICER_ID = 'officer-1';

function makeQuestion(overrides: Partial<Question> & { id: string; type: QuestionType; text: string }): Question {
  return { required: true, ...overrides };
}

const MC_QUESTION = makeQuestion({
  id: 'q1',
  type: 'multiple_choice',
  text: 'How satisfied are you?',
  options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'],
  multiSelect: false,
});

const MULTI_SELECT_QUESTION = makeQuestion({
  id: 'q1ms',
  type: 'multiple_choice',
  text: 'Select all that apply',
  options: ['A', 'B', 'C', 'D'],
  multiSelect: true,
});

const RATING_QUESTION = makeQuestion({
  id: 'q2',
  type: 'rating_scale',
  text: 'Rate our service',
  scaleMin: 1,
  scaleMax: 5,
});

const FREE_TEXT_QUESTION = makeQuestion({
  id: 'q3',
  type: 'free_text',
  text: 'Any additional feedback?',
  maxLength: 500,
  required: false,
});

const RANKING_QUESTION = makeQuestion({
  id: 'q4',
  type: 'ranking',
  text: 'Rank these priorities',
  items: ['Safety', 'Cost', 'Quality', 'Speed'],
});

// ─── Tests ───────────────────────────────────────────────────

describe('M18: Survey CRUD', () => {
  test('create survey with valid params returns draft survey', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Member Satisfaction 2026',
      questions: [MC_QUESTION, RATING_QUESTION],
      createdBy: OFFICER_ID,
    });

    expect(survey.status).toBe('draft');
    expect(survey.type).toBe('anonymous'); // default
    expect(survey.isPoll).toBe(false);
    expect(survey.questions).toHaveLength(2);
    expect(survey.organizationId).toBe(ORG_ID);
    expect(survey.responseCount).toBe(0);
  });

  test('create survey requires title', () => {
    expect(() => createSurvey({
      organizationId: ORG_ID,
      title: '',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    })).toThrow('Survey title is required');
  });

  test('create survey requires at least one question', () => {
    expect(() => createSurvey({
      organizationId: ORG_ID,
      title: 'Empty Survey',
      questions: [],
      createdBy: OFFICER_ID,
    })).toThrow('Survey must have at least one question');
  });

  test('create survey trims title whitespace', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: '  Padded Title  ',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(survey.title).toBe('Padded Title');
  });

  test('create identified survey sets type correctly', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Identified Survey',
      type: 'identified',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(survey.type).toBe('identified');
  });

  test('update draft survey succeeds', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Original',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });

    const updated = updateSurvey(survey, { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');
  });

  test('update active survey throws', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Active',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    const active = publishSurvey(survey);

    expect(() => updateSurvey(active, { title: 'Nope' }))
      .toThrow('Cannot edit a survey that is not in draft status');
  });

  test('publish draft survey transitions to active', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Ready',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });

    const active = publishSurvey(survey);
    expect(active.status).toBe('active');
  });

  test('publish already-active survey throws', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Active',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    const active = publishSurvey(survey);

    expect(() => publishSurvey(active)).toThrow('Only draft surveys can be published');
  });

  test('close active survey transitions to closed', () => {
    const survey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'To Close',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    }));

    const closed = closeSurvey(survey);
    expect(closed.status).toBe('closed');
  });

  test('close draft survey throws', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Draft',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });

    expect(() => closeSurvey(survey)).toThrow('Only active surveys can be closed');
  });

  test('delete draft survey succeeds', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Delete me',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });

    expect(() => deleteSurvey(survey)).not.toThrow();
  });

  test('delete active survey throws', () => {
    const survey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Active',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    }));

    expect(() => deleteSurvey(survey))
      .toThrow('Cannot delete an active survey');
  });

  test('delete closed survey succeeds', () => {
    const active = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Closed',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    }));
    const closed = closeSurvey(active);

    expect(() => deleteSurvey(closed)).not.toThrow();
  });

  test('distribution defaults to active_members', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Default Distribution',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(survey.distribution).toBe('active_members');
  });

  test('survey with specific category distribution', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Category Survey',
      questions: [MC_QUESTION],
      distribution: 'specific_categories',
      categoryFilter: ['specialty-cardio', 'chapter-west'],
      createdBy: OFFICER_ID,
    });
    expect(survey.distribution).toBe('specific_categories');
    expect(survey.categoryFilter).toEqual(['specialty-cardio', 'chapter-west']);
  });
});

describe('M18: Poll CRUD', () => {
  test('create poll with single MC question succeeds', () => {
    const poll = createSurvey({
      organizationId: ORG_ID,
      title: 'Quick Poll',
      isPoll: true,
      questions: [MC_QUESTION],
      showResultsImmediately: true,
      createdBy: OFFICER_ID,
    });

    expect(poll.isPoll).toBe(true);
    expect(poll.showResultsImmediately).toBe(true);
    expect(poll.questions).toHaveLength(1);
  });

  test('poll with multiple questions throws', () => {
    expect(() => createSurvey({
      organizationId: ORG_ID,
      title: 'Bad Poll',
      isPoll: true,
      questions: [MC_QUESTION, RATING_QUESTION],
      createdBy: OFFICER_ID,
    })).toThrow('Poll must have exactly one question');
  });

  test('poll with non-MC question throws', () => {
    expect(() => createSurvey({
      organizationId: ORG_ID,
      title: 'Bad Poll',
      isPoll: true,
      questions: [FREE_TEXT_QUESTION],
      createdBy: OFFICER_ID,
    })).toThrow('Poll question must be multiple choice');
  });

  test('poll can be open-ended (no deadline)', () => {
    const poll = createSurvey({
      organizationId: ORG_ID,
      title: 'Open Poll',
      isPoll: true,
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(poll.deadline).toBeUndefined();
    expect(isDeadlinePassed(poll)).toBe(false);
  });
});

describe('M18: Response Submission', () => {
  const activeSurvey = (() => {
    const s = createSurvey({
      organizationId: ORG_ID,
      title: 'Active Survey',
      questions: [MC_QUESTION, RATING_QUESTION, FREE_TEXT_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      createdBy: OFFICER_ID,
    });
    return publishSurvey(s);
  })();

  test('submit response to active survey succeeds', () => {
    const response = submitResponse(
      activeSurvey,
      'member-1',
      { q1: 'Satisfied', q2: 4, q3: 'Good job' },
      [],
    );

    expect(response.surveyId).toBe(activeSurvey.id);
    expect(response.answers.q1).toBe('Satisfied');
    expect(response.answers.q2).toBe(4);
  });

  test('anonymous survey response has no respondentId', () => {
    const response = submitResponse(
      activeSurvey, // default anonymous
      'member-1',
      { q1: 'Neutral', q2: 3 },
      [],
    );

    expect(response.respondentId).toBeUndefined();
  });

  test('identified survey response stores respondentId', () => {
    const identifiedSurvey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Identified',
      type: 'identified',
      questions: [MC_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      createdBy: OFFICER_ID,
    }));

    const response = submitResponse(
      identifiedSurvey,
      'member-1',
      { q1: 'Very satisfied' },
      [],
    );

    expect(response.respondentId).toBe('member-1');
  });

  test('submit to closed survey throws', () => {
    const closed = closeSurvey(activeSurvey);

    expect(() => submitResponse(closed, 'member-1', { q1: 'Yes' }, []))
      .toThrow('Survey is not active');
  });

  test('submit to draft survey throws', () => {
    const draft = createSurvey({
      organizationId: ORG_ID,
      title: 'Draft',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });

    expect(() => submitResponse(draft, 'member-1', { q1: 'Yes' }, []))
      .toThrow('Survey is not active');
  });

  test('submit after deadline throws', () => {
    const expiredSurvey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Expired',
      questions: [MC_QUESTION],
      deadline: '2020-01-01T00:00:00Z', // past
      createdBy: OFFICER_ID,
    }));

    expect(() => submitResponse(expiredSurvey, 'member-1', { q1: 'Yes' }, []))
      .toThrow('Survey deadline has passed');
  });

  test('required question not answered throws', () => {
    expect(() => submitResponse(
      activeSurvey,
      'member-1',
      { q2: 4 }, // missing required q1
      [],
    )).toThrow('Required question');
  });

  test('optional question can be omitted', () => {
    const response = submitResponse(
      activeSurvey,
      'member-1',
      { q1: 'Satisfied', q2: 4 }, // q3 (free text) is optional
      [],
    );

    expect(response.answers.q3).toBeUndefined();
  });
});

describe('M18: Duplicate Response Prevention', () => {
  test('duplicate submission when editing not allowed throws', () => {
    const survey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'No Edit',
      questions: [MC_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      allowEditBeforeDeadline: false,
      createdBy: OFFICER_ID,
    }));

    const existingResponse: SurveyResponse = {
      id: 'resp-1',
      surveyId: survey.id,
      respondentId: 'member-1',
      answers: { q1: 'Satisfied' },
      submittedAt: new Date().toISOString(),
    };

    expect(() => submitResponse(
      survey,
      'member-1',
      { q1: 'Very satisfied' },
      [existingResponse],
    )).toThrow('You have already submitted a response');
  });

  test('edit allowed before deadline permits resubmission', () => {
    const survey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Edit OK',
      questions: [MC_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      allowEditBeforeDeadline: true,
      createdBy: OFFICER_ID,
    }));

    const existingResponse: SurveyResponse = {
      id: 'resp-1',
      surveyId: survey.id,
      respondentId: 'member-1',
      answers: { q1: 'Satisfied' },
      submittedAt: new Date().toISOString(),
    };

    const updated = submitResponse(
      survey,
      'member-1',
      { q1: 'Very satisfied' },
      [existingResponse],
    );

    expect(updated.answers.q1).toBe('Very satisfied');
  });

  test('different member can submit even when another already has', () => {
    const survey = publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Multi Member',
      questions: [MC_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      allowEditBeforeDeadline: false,
      createdBy: OFFICER_ID,
    }));

    const member1Response: SurveyResponse = {
      id: 'resp-1',
      surveyId: survey.id,
      respondentId: 'member-1',
      answers: { q1: 'Satisfied' },
      submittedAt: new Date().toISOString(),
    };

    // member-2 should be able to submit even though member-1 already did
    const response = submitResponse(
      survey,
      'member-2',
      { q1: 'Neutral' },
      [member1Response],
    );

    expect(response.answers.q1).toBe('Neutral');
  });
});

describe('M18: Results Aggregation — Multiple Choice', () => {
  const responses: SurveyResponse[] = [
    { id: 'r1', surveyId: 's1', answers: { q1: 'Very satisfied' }, submittedAt: '2026-01-01T00:00:00Z' },
    { id: 'r2', surveyId: 's1', answers: { q1: 'Satisfied' }, submittedAt: '2026-01-02T00:00:00Z' },
    { id: 'r3', surveyId: 's1', answers: { q1: 'Satisfied' }, submittedAt: '2026-01-03T00:00:00Z' },
    { id: 'r4', surveyId: 's1', answers: { q1: 'Neutral' }, submittedAt: '2026-01-04T00:00:00Z' },
    { id: 'r5', surveyId: 's1', answers: { q1: 'Very satisfied' }, submittedAt: '2026-01-05T00:00:00Z' },
  ];

  test('counts each option correctly', () => {
    const result = aggregateMultipleChoice('q1', MC_QUESTION.text, MC_QUESTION.options!, responses, false);

    expect(result.optionCounts!['Very satisfied']).toBe(2);
    expect(result.optionCounts!['Satisfied']).toBe(2);
    expect(result.optionCounts!['Neutral']).toBe(1);
    expect(result.optionCounts!['Dissatisfied']).toBe(0);
  });

  test('percentages sum to ~100 for single-select', () => {
    const result = aggregateMultipleChoice('q1', MC_QUESTION.text, MC_QUESTION.options!, responses, false);
    const totalPct = Object.values(result.optionPercentages!).reduce((a, b) => a + b, 0);

    // Rounding may cause slight deviation
    expect(totalPct).toBeGreaterThanOrEqual(98);
    expect(totalPct).toBeLessThanOrEqual(102);
  });

  test('multi-select counts all selected options', () => {
    const multiResponses: SurveyResponse[] = [
      { id: 'r1', surveyId: 's1', answers: { q1ms: ['A', 'B'] }, submittedAt: '2026-01-01T00:00:00Z' },
      { id: 'r2', surveyId: 's1', answers: { q1ms: ['B', 'C'] }, submittedAt: '2026-01-02T00:00:00Z' },
      { id: 'r3', surveyId: 's1', answers: { q1ms: ['A', 'B', 'C'] }, submittedAt: '2026-01-03T00:00:00Z' },
    ];

    const result = aggregateMultipleChoice('q1ms', MULTI_SELECT_QUESTION.text, MULTI_SELECT_QUESTION.options!, multiResponses, true);

    expect(result.optionCounts!['A']).toBe(2);
    expect(result.optionCounts!['B']).toBe(3);
    expect(result.optionCounts!['C']).toBe(2);
    expect(result.optionCounts!['D']).toBe(0);
  });

  test('multi-select percentages can exceed 100%', () => {
    const multiResponses: SurveyResponse[] = [
      { id: 'r1', surveyId: 's1', answers: { q1ms: ['A', 'B', 'C'] }, submittedAt: '2026-01-01T00:00:00Z' },
      { id: 'r2', surveyId: 's1', answers: { q1ms: ['A', 'B', 'C', 'D'] }, submittedAt: '2026-01-02T00:00:00Z' },
    ];

    const result = aggregateMultipleChoice('q1ms', MULTI_SELECT_QUESTION.text, MULTI_SELECT_QUESTION.options!, multiResponses, true);
    const totalPct = Object.values(result.optionPercentages!).reduce((a, b) => a + b, 0);

    expect(totalPct).toBeGreaterThan(100);
  });

  test('zero responses produce zero counts', () => {
    const result = aggregateMultipleChoice('q1', MC_QUESTION.text, MC_QUESTION.options!, [], false);

    for (const count of Object.values(result.optionCounts!)) {
      expect(count).toBe(0);
    }
    expect(result.responseCount).toBe(0);
  });
});

describe('M18: Results Aggregation — Rating Scale', () => {
  const responses: SurveyResponse[] = [
    { id: 'r1', surveyId: 's1', answers: { q2: 5 }, submittedAt: '2026-01-01T00:00:00Z' },
    { id: 'r2', surveyId: 's1', answers: { q2: 4 }, submittedAt: '2026-01-02T00:00:00Z' },
    { id: 'r3', surveyId: 's1', answers: { q2: 3 }, submittedAt: '2026-01-03T00:00:00Z' },
    { id: 'r4', surveyId: 's1', answers: { q2: 5 }, submittedAt: '2026-01-04T00:00:00Z' },
    { id: 'r5', surveyId: 's1', answers: { q2: 4 }, submittedAt: '2026-01-05T00:00:00Z' },
  ];

  test('calculates mean rating correctly', () => {
    const result = aggregateRatingScale('q2', RATING_QUESTION.text, responses, 1, 5);
    // (5+4+3+5+4) / 5 = 4.2
    expect(result.mean).toBe(4.2);
  });

  test('builds distribution histogram', () => {
    const result = aggregateRatingScale('q2', RATING_QUESTION.text, responses, 1, 5);

    expect(result.distribution![1]).toBe(0);
    expect(result.distribution![2]).toBe(0);
    expect(result.distribution![3]).toBe(1);
    expect(result.distribution![4]).toBe(2);
    expect(result.distribution![5]).toBe(2);
  });

  test('zero responses produce mean of 0', () => {
    const result = aggregateRatingScale('q2', RATING_QUESTION.text, [], 1, 5);
    expect(result.mean).toBe(0);
    expect(result.responseCount).toBe(0);
  });

  test('ignores out-of-range values', () => {
    const badResponses: SurveyResponse[] = [
      { id: 'r1', surveyId: 's1', answers: { q2: 99 }, submittedAt: '2026-01-01T00:00:00Z' },
      { id: 'r2', surveyId: 's1', answers: { q2: 4 }, submittedAt: '2026-01-02T00:00:00Z' },
    ];
    const result = aggregateRatingScale('q2', RATING_QUESTION.text, badResponses, 1, 5);
    expect(result.mean).toBe(4);
    expect(result.responseCount).toBe(1);
  });
});

describe('M18: Results Aggregation — Free Text', () => {
  test('collects non-empty text responses', () => {
    const responses: SurveyResponse[] = [
      { id: 'r1', surveyId: 's1', answers: { q3: 'Great service' }, submittedAt: '2026-01-01T00:00:00Z' },
      { id: 'r2', surveyId: 's1', answers: { q3: '' }, submittedAt: '2026-01-02T00:00:00Z' },
      { id: 'r3', surveyId: 's1', answers: { q3: '  ' }, submittedAt: '2026-01-03T00:00:00Z' },
      { id: 'r4', surveyId: 's1', answers: { q3: 'Needs improvement' }, submittedAt: '2026-01-04T00:00:00Z' },
    ];

    const result = aggregateFreeText('q3', FREE_TEXT_QUESTION.text, responses);
    expect(result.textResponses).toHaveLength(2);
    expect(result.textResponses).toContain('Great service');
    expect(result.textResponses).toContain('Needs improvement');
  });

  test('trims whitespace from responses', () => {
    const responses: SurveyResponse[] = [
      { id: 'r1', surveyId: 's1', answers: { q3: '  padded  ' }, submittedAt: '2026-01-01T00:00:00Z' },
    ];

    const result = aggregateFreeText('q3', FREE_TEXT_QUESTION.text, responses);
    expect(result.textResponses![0]).toBe('padded');
  });
});

describe('M18: Results Aggregation — Ranking', () => {
  test('calculates average rank positions', () => {
    const responses: SurveyResponse[] = [
      // member 1: Safety(1), Cost(2), Quality(3), Speed(4)
      { id: 'r1', surveyId: 's1', answers: { q4: ['Safety', 'Cost', 'Quality', 'Speed'] }, submittedAt: '2026-01-01T00:00:00Z' },
      // member 2: Quality(1), Safety(2), Speed(3), Cost(4)
      { id: 'r2', surveyId: 's1', answers: { q4: ['Quality', 'Safety', 'Speed', 'Cost'] }, submittedAt: '2026-01-02T00:00:00Z' },
      // member 3: Safety(1), Quality(2), Cost(3), Speed(4)
      { id: 'r3', surveyId: 's1', answers: { q4: ['Safety', 'Quality', 'Cost', 'Speed'] }, submittedAt: '2026-01-03T00:00:00Z' },
    ];

    const result = aggregateRanking('q4', RANKING_QUESTION.text, RANKING_QUESTION.items!, responses);

    // Safety: (1+2+1)/3 = 1.3
    expect(result.averageRanks!['Safety']).toBe(1.3);
    // Cost: (2+4+3)/3 = 3.0
    expect(result.averageRanks!['Cost']).toBe(3);
    // Quality: (3+1+2)/3 = 2.0
    expect(result.averageRanks!['Quality']).toBe(2);
    // Speed: (4+3+4)/3 = 3.7
    expect(result.averageRanks!['Speed']).toBe(3.7);
  });
});

describe('M18: Response Rate Calculation', () => {
  test('calculates percentage correctly', () => {
    expect(calculateResponseRate(60, 120)).toBe(50);
  });

  test('handles 100% response rate', () => {
    expect(calculateResponseRate(120, 120)).toBe(100);
  });

  test('handles zero target count', () => {
    expect(calculateResponseRate(5, 0)).toBe(0);
  });

  test('handles zero responses', () => {
    expect(calculateResponseRate(0, 100)).toBe(0);
  });

  test('rounds to nearest integer', () => {
    expect(calculateResponseRate(1, 3)).toBe(33); // 33.33...
  });
});

describe('M18: Deadline Enforcement', () => {
  test('survey with future deadline is not expired', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Future',
      questions: [MC_QUESTION],
      deadline: '2099-12-31T23:59:59Z',
      createdBy: OFFICER_ID,
    });
    expect(isDeadlinePassed(survey)).toBe(false);
  });

  test('survey with past deadline is expired', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'Past',
      questions: [MC_QUESTION],
      deadline: '2020-01-01T00:00:00Z',
      createdBy: OFFICER_ID,
    });
    expect(isDeadlinePassed(survey)).toBe(true);
  });

  test('survey with no deadline never expires', () => {
    const survey = createSurvey({
      organizationId: ORG_ID,
      title: 'No Deadline',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(isDeadlinePassed(survey)).toBe(false);
  });
});

describe('M18: Lifecycle Transitions', () => {
  test('full lifecycle: draft → active → closed', () => {
    const draft = createSurvey({
      organizationId: ORG_ID,
      title: 'Lifecycle',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    });
    expect(draft.status).toBe('draft');

    const active = publishSurvey(draft);
    expect(active.status).toBe('active');

    const closed = closeSurvey(active);
    expect(closed.status).toBe('closed');
  });

  test('cannot go from closed back to active', () => {
    const closed = closeSurvey(publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Closed',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    })));

    expect(() => publishSurvey(closed)).toThrow('Only draft surveys');
  });

  test('cannot close a closed survey', () => {
    const closed = closeSurvey(publishSurvey(createSurvey({
      organizationId: ORG_ID,
      title: 'Already Closed',
      questions: [MC_QUESTION],
      createdBy: OFFICER_ID,
    })));

    expect(() => closeSurvey(closed)).toThrow('Only active surveys');
  });
});
