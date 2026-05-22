/**
 * AC-M18: Surveys & Polls Module — Pure Domain Logic Tests
 *
 * Covers:
 *   AC-M18-001: Anonymous survey — no respondentId stored
 *   AC-M18-002: Deadline enforcement — reject submissions after deadline
 *   AC-M18-003: Duplicate prevention — reject when !allowEditBeforeDeadline
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type SurveyType = 'anonymous' | 'identified';
type SurveyStatus = 'draft' | 'active' | 'closed';

interface Survey {
  id: string;
  organizationId: string;
  type: SurveyType;
  status: SurveyStatus;
  deadline: Date;
  allowReEdit: boolean;
}

interface SubmitResponseInput {
  surveyId: string;
  respondentId: string; // caller's identity
  answers: Record<string, unknown>;
  submittedAt: Date;
}

interface SurveyResponse {
  surveyId: string;
  respondentId: string | null; // null for anonymous
  answers: Record<string, unknown>;
  submittedAt: Date;
}

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M18-001: Strip respondentId for anonymous surveys (BR-40).
 */
function buildSurveyResponse(
  survey: Survey,
  input: SubmitResponseInput,
): SurveyResponse {
  return {
    surveyId: input.surveyId,
    // BR-40: anonymous survey stores null — no mapping possible
    respondentId: survey.type === 'anonymous' ? null : input.respondentId,
    answers: input.answers,
    submittedAt: input.submittedAt,
  };
}

/**
 * AC-M18-002: Reject submissions after the survey deadline.
 */
function assertSubmissionDeadline(
  survey: Survey,
  submittedAt: Date,
): { ok: true } | { ok: false; error: string } {
  if (submittedAt > survey.deadline) {
    return { ok: false, error: 'Survey has closed.' };
  }
  return { ok: true };
}

/**
 * AC-M18-003: Reject duplicate submissions when re-edit is disabled.
 */
function assertNoDuplicateResponse(
  survey: Survey,
  hasExistingResponse: boolean,
  submittedAt: Date,
): { ok: true } | { ok: false; error: string } {
  if (!hasExistingResponse) {
    return { ok: true };
  }

  if (survey.allowReEdit && submittedAt <= survey.deadline) {
    // Re-edit enabled and before deadline — allow update
    return { ok: true };
  }

  return {
    ok: false,
    error: 'You have already responded to this survey.',
  };
}

// ─── Helpers ──────────────────────────────────────────────

const DEADLINE = new Date('2026-06-01T00:00:00Z');

function makeSurvey(overrides: Partial<Survey> = {}): Survey {
  return {
    id: 'survey-1',
    organizationId: 'org-1',
    type: 'identified',
    status: 'active',
    deadline: DEADLINE,
    allowReEdit: true,
    ...overrides,
  };
}

function makeSubmitInput(overrides: Partial<SubmitResponseInput> = {}): SubmitResponseInput {
  return {
    surveyId: 'survey-1',
    respondentId: 'member-1',
    answers: { q1: 'answer' },
    submittedAt: new Date('2026-05-31T23:59:59Z'),
    ...overrides,
  };
}

// ─── AC-M18-001: Anonymous Survey ─────────────────────────

describe('[AC-M18-001] Anonymous survey — no respondentId stored', () => {
  test('anonymous survey response has null respondentId', () => {
    const survey = makeSurvey({ type: 'anonymous' });
    const input = makeSubmitInput();
    const response = buildSurveyResponse(survey, input);
    // BR-40: no respondent mapping
    expect(response.respondentId).toBeNull();
  });

  test('identified survey response stores respondentId', () => {
    const survey = makeSurvey({ type: 'identified' });
    const input = makeSubmitInput({ respondentId: 'member-42' });
    const response = buildSurveyResponse(survey, input);
    expect(response.respondentId).toBe('member-42');
  });

  test('anonymous survey response still stores answers', () => {
    const survey = makeSurvey({ type: 'anonymous' });
    const input = makeSubmitInput({ answers: { q1: 'yes', q2: 3 } });
    const response = buildSurveyResponse(survey, input);
    // Answers preserved even though respondentId is null
    expect(response.answers).toEqual({ q1: 'yes', q2: 3 });
    expect(response.respondentId).toBeNull();
  });

  test('platform admin also gets null respondentId — no exception to anonymity', () => {
    // BR-40: even platform admin cannot link — the data is simply not stored
    const survey = makeSurvey({ type: 'anonymous' });
    const input = makeSubmitInput({ respondentId: 'platform-admin-1' });
    const response = buildSurveyResponse(survey, input);
    expect(response.respondentId).toBeNull();
  });
});

// ─── AC-M18-002: Deadline Enforcement ────────────────────

describe('[AC-M18-002] Deadline enforcement', () => {
  test('submission before deadline is accepted', () => {
    const survey = makeSurvey({ deadline: DEADLINE });
    const submittedAt = new Date('2026-05-31T23:59:59Z');
    const result = assertSubmissionDeadline(survey, submittedAt);
    expect(result.ok).toBe(true);
  });

  test('submission exactly at deadline is accepted', () => {
    const survey = makeSurvey({ deadline: DEADLINE });
    const result = assertSubmissionDeadline(survey, DEADLINE);
    expect(result.ok).toBe(true);
  });

  test('submission one second after deadline is rejected', () => {
    const survey = makeSurvey({ deadline: DEADLINE });
    const submittedAt = new Date('2026-06-01T00:00:01Z');
    const result = assertSubmissionDeadline(survey, submittedAt);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Survey has closed.');
    }
  });

  test('submission well past deadline is rejected', () => {
    const survey = makeSurvey({ deadline: DEADLINE });
    const submittedAt = new Date('2026-07-01T00:00:00Z');
    const result = assertSubmissionDeadline(survey, submittedAt);
    expect(result.ok).toBe(false);
  });
});

// ─── AC-M18-003: Duplicate Prevention ────────────────────

describe('[AC-M18-003] Duplicate prevention', () => {
  test('first submission always allowed', () => {
    const survey = makeSurvey({ allowReEdit: false });
    const submittedAt = new Date('2026-05-30T10:00:00Z');
    const result = assertNoDuplicateResponse(survey, false, submittedAt);
    expect(result.ok).toBe(true);
  });

  test('second submission rejected when allowReEdit is false', () => {
    const survey = makeSurvey({ allowReEdit: false });
    const submittedAt = new Date('2026-05-30T11:00:00Z');
    const result = assertNoDuplicateResponse(survey, true, submittedAt);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('already responded');
    }
  });

  test('second submission allowed when allowReEdit is true and before deadline', () => {
    const survey = makeSurvey({ allowReEdit: true, deadline: DEADLINE });
    const submittedAt = new Date('2026-05-31T12:00:00Z');
    const result = assertNoDuplicateResponse(survey, true, submittedAt);
    expect(result.ok).toBe(true);
  });

  test('edit rejected when allowReEdit is true but past deadline', () => {
    const survey = makeSurvey({ allowReEdit: true, deadline: DEADLINE });
    const submittedAt = new Date('2026-06-02T00:00:00Z'); // past deadline
    const result = assertNoDuplicateResponse(survey, true, submittedAt);
    expect(result.ok).toBe(false);
  });
});
