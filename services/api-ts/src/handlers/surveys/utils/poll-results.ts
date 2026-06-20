import type { Survey, SurveyResponseRecord, QuestionAnswer, SurveyQuestion } from '../repos/survey.schema';

/**
 * [AC-M18-006] Aggregate inline poll results. Counts each selected value
 * (scalar or array) per question across responses. Keyed by option-label
 * string; zero-vote options are omitted.
 */
export function aggregatePollResults(
  survey: Survey,
  responses: SurveyResponseRecord[],
): Array<{ questionId: string; counts: Record<string, number>; total: number }> {
  const questions = (survey.questions ?? []) as SurveyQuestion[];
  return questions.map((q) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const resp of responses) {
      const answers = (resp.answers ?? []) as QuestionAnswer[];
      const ans = answers.find((a) => a.questionId === q.id);
      if (!ans) continue;
      const values = Array.isArray(ans.value) ? ans.value : [ans.value];
      for (const v of values) {
        const key = String(v);
        counts[key] = (counts[key] ?? 0) + 1;
        total += 1;
      }
    }
    return { questionId: q.id, counts, total };
  });
}
