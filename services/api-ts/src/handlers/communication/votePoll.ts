import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';
import type { Session } from '@/types/auth';
import type { SurveyQuestion } from './repos/survey.schema';
import type { SurveyResponse } from './repos/survey.schema';

function aggregatePollResults(question: SurveyQuestion, responses: SurveyResponse[]) {
  const options = question.options ?? [];
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;

  for (const r of responses) {
    const answer = (r.answers as Record<string, unknown>)[question.id];
    if (typeof answer === 'string' && answer in counts) {
      counts[answer]!++;
    } else if (Array.isArray(answer)) {
      for (const a of answer) {
        if (typeof a === 'string' && a in counts) counts[a]!++;
      }
    }
  }

  const total = responses.length;
  const percentages: Record<string, number> = {};
  for (const [opt, count] of Object.entries(counts)) {
    percentages[opt] = total > 0 ? Math.round((count / total) * 100) : 0;
  }

  return { counts, percentages, totalVotes: total };
}

export async function votePoll(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const surveyId = ctx.req.param('surveyId') ?? ctx.req.param('id');
  const body = await ctx.req.json();

  const repo = new SurveyRepository(db);

  const survey = await repo.get(surveyId!);
  if (!survey) {
    return ctx.json({ error: 'Poll not found' }, 404);
  }

  if (!survey.isPoll) {
    return ctx.json({ error: 'This is not a poll' }, 400);
  }

  if (survey.status !== 'active') {
    return ctx.json({ error: 'Poll is not active' }, 400);
  }

  if (survey.deadline && new Date(survey.deadline) < new Date()) {
    return ctx.json({ error: 'Poll deadline has passed' }, 400);
  }

  // Determine respondentId — BR-40: null for anonymous polls
  const respondentId =
    survey.type === 'identified' ? session.user.id : null;

  // Check duplicate
  if (!survey.allowEditBeforeDeadline && respondentId) {
    const existing = await repo.getResponseBySurveyAndRespondent(surveyId!, respondentId);
    if (existing) {
      return ctx.json({ error: 'You have already voted in this poll' }, 409);
    }
  }

  const answers: Record<string, unknown> = body.answers ?? {};

  await repo.submitResponse({
    surveyId: surveyId!,
    respondentId, // NULL for anonymous (BR-40)
    answers,
    submittedAt: new Date(),
    createdBy: respondentId,
    updatedBy: respondentId,
  });

  // Return current results immediately (showResultsImmediately is always true for polls)
  const allResponses = await repo.listResponses(surveyId!);
  const questions = survey.questions as SurveyQuestion[];
  const question = questions[0];

  if (!question) {
    return ctx.json({ error: 'Poll has no question' }, 500);
  }

  const results = aggregatePollResults(question, allResponses);

  return ctx.json({
    data: {
      voted: true,
      results: {
        questionId: question.id,
        questionText: question.text,
        ...results,
      },
    },
  }, 201);
}
