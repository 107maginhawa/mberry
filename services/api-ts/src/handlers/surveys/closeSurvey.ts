import type { ValidatedContext } from '@/types/app';
import type { CloseSurveyParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';

/**
 * closeSurvey
 *
 * Path: POST /surveys/:survey/close
 * OperationId: closeSurvey
 *
 * Closes an active survey. Officer/admin only.
 */
export async function closeSurvey(
  ctx: ValidatedContext<never, never, CloseSurveyParams>
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

  // Officer/admin gate
  if (!hasRole(session.user, 'admin')) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can close surveys');
    }
  }

  const surveyId = ctx.req.param('survey')!;
  const repo = new SurveyRepository(db, logger);

  const existing = await repo.findById(surveyId);
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  if (existing.status !== 'active') {
    throw new BusinessLogicError('Only active surveys can be closed');
  }

  const closed = await repo.close(surveyId, userId);
  if (!closed) {
    throw new BusinessLogicError('Failed to close survey');
  }

  logger?.info({ surveyId, action: 'close_survey' }, 'Survey closed');

  return ctx.json(closed, 200);
}
