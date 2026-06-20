import type { ValidatedContext } from '@/types/app';
import type { SubmitSurveyResponseBody, SubmitSurveyResponseParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { JobScheduler } from '@/core/jobs';
import {
  UnauthorizedError,
  NotFoundError,
  BusinessLogicError,
  ConflictError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import type { QuestionAnswer } from './repos/survey.schema';
import { aggregatePollResults } from './utils/poll-results';

/**
 * submitSurveyResponse
 *
 * Path: POST /surveys/:survey/responses
 * OperationId: submitSurveyResponse
 *
 * Submits a response to an active survey. Any authenticated member.
 * Checks: survey active, deadline not passed, no duplicate response.
 * Triggers analytics aggregation job.
 */
export async function submitSurveyResponse(
  ctx: ValidatedContext<SubmitSurveyResponseBody, never, SubmitSurveyResponseParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'surveys' }) ?? baseLogger;
  const organizationId = ctx.get('organizationId') as string;

  const surveyId = ctx.req.param('survey')!;
  const body = ctx.req.valid('json');

  const surveyRepo = new SurveyRepository(db, logger);
  const responseRepo = new SurveyResponseRepository(db, logger);

  // Verify survey exists and is active
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  if (survey.status !== 'active') {
    throw new BusinessLogicError('Survey is not accepting responses');
  }

  // Check deadline (M18-R1) — gates both first-submit and re-edit (AC-M18-004)
  const settings = survey.settings as { anonymous?: boolean; deadline?: string; allowReedit?: boolean } | null;
  if (settings?.deadline) {
    const deadline = new Date(settings.deadline);
    if (new Date() > deadline) {
      throw new BusinessLogicError('Survey deadline has passed');
    }
  }

  // Check for existing response
  // [AC-M18-004] M18-R3: if allowReedit is enabled, update the existing response;
  // otherwise reject duplicate submissions with 409.
  const existing = await responseRepo.findByResponderAndSurvey(userId, surveyId);
  if (existing) {
    if (!settings?.allowReedit) {
      throw new ConflictError('You have already responded to this survey');
    }

    const updated = await responseRepo.updateResponseAnswers(
      existing.id,
      (body.answers ?? []) as QuestionAnswer[],
      userId,
    );

    // Best-effort analytics aggregation. The `survey.aggregateAnalytics`
    // job is not registered (see handlers/surveys/jobs/index.ts) — analytics
    // are currently computed on-demand by getSurveyAnalytics. Until the
    // job lands, swallow the trigger error so a re-edit doesn't fail the
    // primary write.
    const jobsScheduler = ctx.get('jobs') as JobScheduler | undefined;
    if (jobsScheduler) {
      try {
        await jobsScheduler.trigger('survey.aggregateAnalytics', {
          surveyId,
          organizationId,
        });
      } catch (err) {
        logger?.warn(
          { action: 'submitSurveyResponse.1', err, surveyId },
          'survey.aggregateAnalytics trigger failed; analytics will be computed on demand',
        );
      }
    }

    logger?.info({
      surveyId,
      responseId: updated?.id,
      action: 'update_survey_response',
    }, 'Survey response updated (re-edit)');

    // [AC-M18-006] Polls: include inline aggregated counts in the response body.
    if (survey.surveyType === 'poll') {
      const all = await responseRepo.findAllBySurveyId(surveyId);
      const pollResults = aggregatePollResults(survey, all);
      return ctx.json({ ...updated, pollResults }, 200);
    }

    return ctx.json(updated, 200);
  }

  const isAnonymous = settings?.anonymous === true;

  const response = await responseRepo.submitResponse({
    organizationId,
    surveyId,
    // P0 privacy fix: strip responderId for anonymous surveys.
    // Polls are always attributed so vote dedup + already-voted detection work.
    responderId: isAnonymous && survey.surveyType !== 'poll' ? null : userId,
    answers: (body.answers ?? []) as QuestionAnswer[],
    contextId: body.contextId ?? null,
    createdBy: userId,
    updatedBy: userId,
  });

  // Best-effort analytics aggregation. See update path above for context —
  // `survey.aggregateAnalytics` is not currently registered, so swallow
  // trigger errors and let getSurveyAnalytics compute on demand.
  const jobs = ctx.get('jobs') as JobScheduler | undefined;
  if (jobs) {
    try {
      await jobs.trigger('survey.aggregateAnalytics', {
        surveyId,
        organizationId,
      });
    } catch (err) {
      logger?.warn(
        { action: 'submitSurveyResponse.3', err, surveyId },
        'survey.aggregateAnalytics trigger failed; analytics will be computed on demand',
      );
    }
  }

  logger?.info({
    surveyId,
    responseId: response.id,
    action: 'submit_survey_response',
  }, 'Survey response submitted');

  // [AC-M18-006] Polls: include inline aggregated counts in the response body.
  if (survey.surveyType === 'poll') {
    const all = await responseRepo.findAllBySurveyId(surveyId);
    const pollResults = aggregatePollResults(survey, all);
    return ctx.json({ ...response, pollResults }, 201);
  }

  return ctx.json(response, 201);
}
