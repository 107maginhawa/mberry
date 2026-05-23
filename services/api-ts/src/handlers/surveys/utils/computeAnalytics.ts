/**
 * Pure analytics computation for surveys.
 * Computes per-question breakdown from completed responses.
 */

import type { Survey } from '../repos/survey.schema';
import type { SurveyResponseRepository } from '../repos/survey.repo';
import type {
  SurveyQuestion,
  SurveyAnalyticsSnapshot,
  QuestionBreakdown,
  QuestionAnswer,
} from '../repos/survey.schema';

/**
 * Compute analytics for a survey from all completed responses.
 */
export async function computeAnalytics(
  survey: Survey,
  responseRepo: SurveyResponseRepository
): Promise<SurveyAnalyticsSnapshot> {
  const responses = await responseRepo.findAllBySurveyId(survey.id);
  const questions = (survey.questions ?? []) as SurveyQuestion[];
  const totalResponses = responses.length;

  // Completion rate: completed responses / total (completed + pending + skipped)
  // Since findAllBySurveyId only returns completed, we use totalResponses as numerator
  const completionRate = totalResponses > 0 ? 1 : 0;

  const questionBreakdown: QuestionBreakdown[] = questions.map((q) => {
    const answersForQuestion = responses
      .map((r) => {
        const answers = (r.answers ?? []) as QuestionAnswer[];
        return answers.find((a) => a.questionId === q.id);
      })
      .filter(Boolean) as QuestionAnswer[];

    return computeQuestionBreakdown(q, answersForQuestion);
  });

  // Extract overall NPS score if there's an NPS question
  const npsBreakdown = questionBreakdown.find((b) => b.questionType === 'nps');

  return {
    totalResponses,
    completionRate,
    npsScore: npsBreakdown?.npsScore,
    questionBreakdown,
  };
}

function computeQuestionBreakdown(
  question: SurveyQuestion,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  const base: QuestionBreakdown = {
    questionId: question.id,
    questionType: question.type,
  };

  if (answers.length === 0) {
    return base;
  }

  switch (question.type) {
    case 'nps':
      return computeNps(base, answers);
    case 'rating':
      return computeRating(base, answers);
    case 'single_choice':
      return computeSingleChoice(base, answers);
    case 'multi_choice':
      return computeMultiChoice(base, answers);
    case 'text':
      return { ...base, count: answers.length };
    case 'yes_no':
      return computeYesNo(base, answers);
    default:
      return { ...base, count: answers.length };
  }
}

function computeNps(
  base: QuestionBreakdown,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  const distribution: Record<string, number> = {};
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const a of answers) {
    const score = Number(a.value);
    if (isNaN(score)) continue;

    const key = String(score);
    distribution[key] = (distribution[key] ?? 0) + 1;

    if (score >= 9) promoters++;
    else if (score >= 7) passives++;
    else detractors++;
  }

  const total = promoters + passives + detractors;
  const npsScore = total > 0
    ? Math.round(((promoters - detractors) / total) * 100)
    : 0;

  return {
    ...base,
    promoters,
    passives,
    detractors,
    npsScore,
    distribution,
  };
}

function computeRating(
  base: QuestionBreakdown,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  const distribution: Record<string, number> = {};
  let sum = 0;
  let count = 0;

  for (const a of answers) {
    const val = Number(a.value);
    if (isNaN(val)) continue;

    const key = String(val);
    distribution[key] = (distribution[key] ?? 0) + 1;
    sum += val;
    count++;
  }

  return {
    ...base,
    average: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
    distribution,
  };
}

function computeSingleChoice(
  base: QuestionBreakdown,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  const counts: Record<string, number> = {};

  for (const a of answers) {
    const val = String(a.value);
    counts[val] = (counts[val] ?? 0) + 1;
  }

  return { ...base, counts };
}

function computeMultiChoice(
  base: QuestionBreakdown,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  const counts: Record<string, number> = {};

  for (const a of answers) {
    const values = Array.isArray(a.value) ? a.value : [String(a.value)];
    for (const v of values) {
      counts[String(v)] = (counts[String(v)] ?? 0) + 1;
    }
  }

  return { ...base, counts };
}

function computeYesNo(
  base: QuestionBreakdown,
  answers: QuestionAnswer[]
): QuestionBreakdown {
  let yesCount = 0;
  let noCount = 0;

  for (const a of answers) {
    const val = typeof a.value === 'boolean' ? a.value : String(a.value).toLowerCase() === 'true';
    if (val) yesCount++;
    else noCount++;
  }

  return { ...base, yesCount, noCount };
}
