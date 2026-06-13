import type { ValidatedContext } from '@/types/app';
import type { GetSurveyParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';

/**
 * getSurvey
 *
 * Path: GET /surveys/:survey
 * OperationId: getSurvey
 *
 * Returns a single survey by ID, scoped to the current organization.
 *
 * Officer/admin only (M18 read-auth, FIX-001): survey detail exposes draft
 * questions and internal settings (incl. targetAudience). Members must not
 * read the officer-facing survey detail; their access is the scoped
 * respond/assigned view. Matches the "any active officer term" gate used by
 * sibling handlers (publishSurvey, listSurveyResponses).
 */
export async function getSurvey(
  ctx: ValidatedContext<never, never, GetSurveyParams>
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
      throw new ForbiddenError('Only officers or admins can view survey details');
    }
  }

  const surveyId = ctx.req.param('survey')!;

  const repo = new SurveyRepository(db, logger);
  const survey = await repo.findById(surveyId);

  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  return ctx.json(survey, 200);
}
