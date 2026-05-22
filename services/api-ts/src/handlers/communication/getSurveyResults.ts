import type { Context } from 'hono';
import { SurveyRepository } from './repos/survey.repo';
import type { Session } from '@/types/auth';
import type { SurveyQuestion } from './repos/survey.schema';
import type { SurveyResponse } from './repos/survey.schema';

// ─── Aggregation helpers ──────────────────────────────────────────────────

function aggregateMultipleChoice(
  q: SurveyQuestion,
  responses: SurveyResponse[],
) {
  const options = q.options ?? [];
  const counts: Record<string, number> = {};
  for (const opt of options) counts[opt] = 0;

  for (const r of responses) {
    const answer = (r.answers as Record<string, unknown>)[q.id];
    if (q.multiSelect && Array.isArray(answer)) {
      for (const a of answer) {
        if (typeof a === 'string' && a in counts) counts[a]!++;
      }
    } else if (typeof answer === 'string' && answer in counts) {
      counts[answer]!++;
    }
  }

  const total = responses.length;
  const percentages: Record<string, number> = {};
  for (const [opt, count] of Object.entries(counts)) {
    percentages[opt] = total > 0 ? Math.round((count / total) * 100) : 0;
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: q.type,
    responseCount: total,
    optionCounts: counts,
    optionPercentages: percentages,
  };
}

function aggregateRatingScale(
  q: SurveyQuestion,
  responses: SurveyResponse[],
) {
  const scaleMin = q.scaleMin ?? 1;
  const scaleMax = q.scaleMax ?? 5;
  const distribution: Record<number, number> = {};
  for (let i = scaleMin; i <= scaleMax; i++) distribution[i] = 0;

  let sum = 0;
  let count = 0;
  for (const r of responses) {
    const val = (r.answers as Record<string, unknown>)[q.id];
    if (typeof val === 'number' && val >= scaleMin && val <= scaleMax) {
      distribution[val]!++;
      sum += val;
      count++;
    }
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: q.type,
    responseCount: count,
    mean: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    distribution,
  };
}

function aggregateFreeText(q: SurveyQuestion, responses: SurveyResponse[]) {
  const texts: string[] = [];
  for (const r of responses) {
    const val = (r.answers as Record<string, unknown>)[q.id];
    if (typeof val === 'string' && val.trim().length > 0) {
      texts.push(val.trim());
    }
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: q.type,
    responseCount: texts.length,
    textResponses: texts,
  };
}

function aggregateRanking(q: SurveyQuestion, responses: SurveyResponse[]) {
  const items = q.items ?? [];
  const rankSums: Record<string, number> = {};
  const rankCounts: Record<string, number> = {};
  for (const item of items) {
    rankSums[item] = 0;
    rankCounts[item] = 0;
  }

  for (const r of responses) {
    const ranking = (r.answers as Record<string, unknown>)[q.id];
    if (Array.isArray(ranking)) {
      for (let i = 0; i < ranking.length; i++) {
        const item = ranking[i] as string;
        if (item in rankSums) {
          rankSums[item]! += i + 1;
          rankCounts[item]!++;
        }
      }
    }
  }

  const averageRanks: Record<string, number> = {};
  for (const item of items) {
    averageRanks[item] =
      rankCounts[item]! > 0
        ? Math.round((rankSums[item]! / rankCounts[item]!) * 10) / 10
        : 0;
  }

  return {
    questionId: q.id,
    questionText: q.text,
    questionType: q.type,
    responseCount: responses.length,
    averageRanks,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────

export async function getSurveyResults(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const surveyId = ctx.req.param('surveyId') ?? ctx.req.param('id');

  // Officer-only access check
  const role = session?.user?.role ?? '';
  if (!['admin', 'officer', 'host'].includes(role)) {
    return ctx.json({ error: 'Officer access required to view results' }, 403);
  }

  const repo = new SurveyRepository(db);

  const survey = await repo.get(surveyId!);
  if (!survey) {
    return ctx.json({ error: 'Survey not found' }, 404);
  }

  const responses = await repo.listResponses(surveyId!);
  const questions = survey.questions as SurveyQuestion[];

  const aggregated = questions.map(q => {
    switch (q.type) {
      case 'multiple_choice':
        return aggregateMultipleChoice(q, responses);
      case 'rating_scale':
        return aggregateRatingScale(q, responses);
      case 'free_text':
        return aggregateFreeText(q, responses);
      case 'ranking':
        return aggregateRanking(q, responses);
      default:
        return { questionId: q.id, questionText: q.text, questionType: q.type, responseCount: 0 };
    }
  });

  return ctx.json({
    data: {
      survey: {
        id: survey.id,
        title: survey.title,
        type: survey.type,
        status: survey.status,
        responseCount: survey.responseCount,
      },
      results: aggregated,
    },
  });
}
