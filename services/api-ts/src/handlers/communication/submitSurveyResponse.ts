import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';
import type { Session } from '@/types/auth';
import type { SurveyQuestion } from './repos/survey.schema';

const SMALL_POOL_THRESHOLD = 10;

export async function submitSurveyResponse(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const surveyId = ctx.req.param('surveyId') ?? ctx.req.param('id');
  const body = await ctx.req.json();

  const repo = new SurveyRepository(db);

  // Load survey
  const survey = await repo.get(surveyId!);
  if (!survey) {
    return ctx.json({ error: 'Survey not found' }, 404);
  }

  // Check survey is active
  if (survey.status !== 'active') {
    return ctx.json({ error: 'Survey is not active' }, 400);
  }

  // Check deadline
  if (survey.deadline && new Date(survey.deadline) < new Date()) {
    return ctx.json({ error: 'Survey deadline has passed' }, 400);
  }

  // Determine respondentId — BR-40 architectural guarantee
  // For anonymous surveys: store NULL (never store and then mask)
  const respondentId =
    survey.type === 'identified' ? session.user.id : null;

  // Check duplicate response (only relevant for identified surveys or if allowEdit=false)
  if (!survey.allowEditBeforeDeadline && respondentId) {
    const existing = await repo.getResponseBySurveyAndRespondent(surveyId!, respondentId);
    if (existing) {
      return ctx.json({ error: 'You have already submitted a response' }, 409);
    }
  }

  // Validate required questions answered
  const answers: Record<string, unknown> = body.answers ?? {};
  const questions = survey.questions as SurveyQuestion[];
  for (const q of questions) {
    if (q.required) {
      const answer = answers[q.id];
      if (answer === undefined || answer === null || answer === '') {
        return ctx.json(
          { error: `Required question "${q.text}" must be answered` },
          400,
        );
      }
    }
  }

  const response = await repo.submitResponse({
    surveyId: surveyId!,
    respondentId, // NULL for anonymous (BR-40)
    answers,
    submittedAt: new Date(),
    createdBy: respondentId, // may also be null for anonymous
    updatedBy: respondentId,
  });

  // Build warnings for BR-40 small pool / free text
  const warnings: string[] = [];
  const updatedSurvey = await repo.get(surveyId!);
  if (
    survey.type === 'anonymous' &&
    (updatedSurvey?.responseCount ?? 0) < SMALL_POOL_THRESHOLD
  ) {
    warnings.push(
      'Anonymity may be compromised through inference as fewer than 10 responses have been collected.',
    );
  }
  const hasFreeText = questions.some(q => q.type === 'free_text');
  if (survey.type === 'anonymous' && hasFreeText) {
    warnings.push(
      'Avoid including personal details in open-ended answers to preserve your anonymity.',
    );
  }

  return ctx.json({ data: response, warnings }, 201);
}
