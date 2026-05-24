import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

/**
 * getNpsTrends
 *
 * Path: GET /surveys/analytics/nps-trends
 * Hand-wired route
 *
 * Returns NPS scores across surveys for trend visualization.
 * Officer/admin only.
 */
export async function getNpsTrends(
  ctx: ValidatedContext<never, never, never>
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
      throw new ForbiddenError('Only officers or admins can view NPS trends');
    }
  }

  const surveyRepo = new SurveyRepository(db, logger);
  const { data: allSurveys } = await surveyRepo.findManyWithPagination(
    { organizationId },
    { pagination: { limit: 100, offset: 0 } }
  );

  // Filter to surveys with NPS analytics
  const trends = allSurveys
    .filter((s) => s.analyticsSnapshot?.npsScore != null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((s) => ({
      date: s.createdAt,
      score: s.analyticsSnapshot!.npsScore!,
      surveyTitle: s.title,
      responseCount: s.analyticsSnapshot!.totalResponses,
    }));

  return ctx.json(trends, 200);
}
