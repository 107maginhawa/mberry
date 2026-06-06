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
import { hasRole } from '@/utils/auth';

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
  if (!hasRole(session.user, 'admin')) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can view survey analytics');
    }
  }

  const surveyId = ctx.req.param('survey')!;

  const surveyRepo = new SurveyRepository(db, logger);
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  // Analytics responses are scoped to a survey; callers identify the
  // result by surveyId. Both the cached-snapshot and on-the-fly paths
  // return the bare analytics shape from computeAnalytics, so attach
  // surveyId here.
  if (survey.analyticsSnapshot) {
    return ctx.json({ surveyId, ...survey.analyticsSnapshot }, 200);
  }

  const responseRepo = new SurveyResponseRepository(db, logger);
  const analytics = await computeAnalytics(survey, responseRepo);

  return ctx.json({ surveyId, ...analytics }, 200);
}
