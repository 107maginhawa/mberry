/**
 * cloneSurvey
 *
 * Path: POST /surveys/:survey/clone
 * Hand-wired (not in TypeSpec) — convenience endpoint.
 *
 * Creates a draft copy of an existing survey. Officer/admin only.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';

export async function cloneSurvey(
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
  if (!hasRole(session.user, 'admin')) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can clone surveys');
    }
  }

  const surveyId = ctx.req.param('survey')!;

  const repo = new SurveyRepository(db, logger);
  const survey = await repo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  const cloned = await repo.cloneSurvey(surveyId, userId);

  logger?.info({ surveyId, clonedId: cloned.id, action: 'clone_survey' }, 'Survey cloned');

  return ctx.json(cloned, 201);
}
