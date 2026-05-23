import type { ValidatedContext } from '@/types/app';
import type { GetSurveyAnalyticsParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { computeAnalytics } from './utils/computeAnalytics';

/**
 * getSurveyAnalytics
 *
 * Path: GET /surveys/:survey/analytics
 * OperationId: getSurveyAnalytics
 *
 * Returns analytics for a survey. Officer/admin only.
 * Returns cached snapshot if available, else computes on-the-fly.
 */
export async function getSurveyAnalytics(
  ctx: ValidatedContext<never, never, GetSurveyAnalyticsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  // Officer/admin gate
  if (session.user.role !== 'admin') {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can view survey analytics');
    }
  }

  const surveyId = ctx.req.param('survey');

  const surveyRepo = new SurveyRepository(db, logger);
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  // Return cached snapshot if available
  if (survey.analyticsSnapshot) {
    return ctx.json(survey.analyticsSnapshot, 200);
  }

  // Compute on-the-fly
  const responseRepo = new SurveyResponseRepository(db, logger);
  const analytics = await computeAnalytics(survey, responseRepo);

  return ctx.json(analytics, 200);
}
