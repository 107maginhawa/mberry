import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { personBelongsToOrg } from './utils/membership-check';

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
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'surveys' }) ?? baseLogger;
  // organizationId may be undefined on /my/* routes (no x-org-id header).
  const organizationId = ctx.get('organizationId') as string | undefined;

  const surveyId = ctx.req.param('survey')!;

  const surveyRepo = new SurveyRepository(db, logger);
  const responseRepo = new SurveyResponseRepository(db, logger);

  // Verify survey exists.
  // Enforce x-org-id equality only when the header was actually present.
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || (organizationId && survey.organizationId !== organizationId)) {
    throw new NotFoundError('Survey not found');
  }

  // Tenant-boundary check: member must belong to the survey's org.
  // Prevents dismissing prompts in orgs the user has no membership in.
  const isMember = await personBelongsToOrg(db, logger, userId, survey.organizationId);
  if (!isMember) {
    throw new NotFoundError('Survey not found');
  }

  // Find existing pending response for this user
  const existing = await responseRepo.findByResponderAndSurvey(userId, surveyId);

  if (existing && existing.status === 'pending') {
    // Mark existing pending response as dismissed
    await responseRepo.markAsDismissed(existing.id);
  } else if (!existing) {
    // Create a dismissed response record.
    // Persist the survey's org (the request header may be undefined on /my/* routes).
    await responseRepo.createDismissedResponse({
      organizationId: survey.organizationId,
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
