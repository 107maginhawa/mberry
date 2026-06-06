import type { ValidatedContext } from '@/types/app';
import type { DeleteSurveyParams } from '@/generated/openapi/validators';
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
 * deleteSurvey
 *
 * Path: DELETE /surveys/:survey
 * OperationId: deleteSurvey
 *
 * Deletes a draft survey. Officer/admin only. Draft-only guard.
 */
export async function deleteSurvey(
  ctx: ValidatedContext<never, never, DeleteSurveyParams>
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
      throw new ForbiddenError('Only officers or admins can delete surveys');
    }
  }

  const surveyId = ctx.req.param('survey')!;
  const repo = new SurveyRepository(db, logger);

  // Verify survey exists and belongs to org
  const existing = await repo.findById(surveyId);
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft surveys can be deleted');
  }

  const deleted = await repo.deleteDraft(surveyId);
  if (!deleted) {
    throw new BusinessLogicError('Failed to delete survey — status may have changed');
  }

  logger?.info({ surveyId, action: 'delete_survey' }, 'Survey deleted');

  return new Response(null, { status: 204 });
}
