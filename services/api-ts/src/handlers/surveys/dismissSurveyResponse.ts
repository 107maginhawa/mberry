import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';

/**
 * dismissSurveyResponse
 *
 * Path: POST /surveys/:survey/responses/dismiss
 * OperationId: dismissSurveyResponse
 *
 * Records a server-side dismiss for an NPS/survey prompt so it
 * persists across devices (not just localStorage).
 */
export async function dismissSurveyResponse(
  ctx: ValidatedContext<never, never, { survey: string }>
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

  const surveyRepo = new SurveyRepository(db, logger);
  const responseRepo = new SurveyResponseRepository(db, logger);

  // Verify survey exists
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  // Find existing pending response for this user
  const existing = await responseRepo.findByResponderAndSurvey(userId, surveyId);

  if (existing && existing.status === 'pending') {
    // Mark existing pending response as dismissed
    await responseRepo.markAsDismissed(existing.id);
  } else if (!existing) {
    // Create a dismissed response record
    await responseRepo.createDismissedResponse({
      organizationId,
      surveyId,
      responderId: userId,
      answers: [],
      createdBy: userId,
      updatedBy: userId,
    });
  }
  // If already completed/skipped/dismissed, no-op

  logger?.info({
    surveyId,
    userId,
    action: 'dismiss_survey_response',
  }, 'Survey response dismissed');

  return new Response(null, { status: 204 });
}
