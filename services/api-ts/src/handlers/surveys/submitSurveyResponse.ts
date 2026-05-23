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
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const surveyId = ctx.req.param('survey');
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

  // Check deadline
  const settings = survey.settings as { deadline?: string } | null;
  if (settings?.deadline) {
    const deadline = new Date(settings.deadline);
    if (new Date() > deadline) {
      throw new BusinessLogicError('Survey deadline has passed');
    }
  }

  // Check for duplicate response
  const existing = await responseRepo.findByResponderAndSurvey(userId, surveyId);
  if (existing) {
    throw new ConflictError('You have already responded to this survey');
  }

  const response = await responseRepo.submitResponse({
    organizationId,
    surveyId,
    responderId: userId,
    answers: (body.answers ?? []) as any,
    contextId: body.contextId ?? null,
    createdBy: userId,
    updatedBy: userId,
  });

  // Trigger analytics aggregation job
  const jobs = ctx.get('jobs') as JobScheduler | undefined;
  if (jobs) {
    await jobs.trigger('survey.aggregateAnalytics', {
      surveyId,
      organizationId,
    });
  }

  logger?.info({
    surveyId,
    responseId: response.id,
    action: 'submit_survey_response',
  }, 'Survey response submitted');

  return ctx.json(response, 201);
}
