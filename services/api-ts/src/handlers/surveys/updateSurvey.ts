import type { ValidatedContext } from '@/types/app';
import type { UpdateSurveyBody, UpdateSurveyParams } from '@/generated/openapi/validators';
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
 * updateSurvey
 *
 * Path: PATCH /surveys/:survey
 * OperationId: updateSurvey
 *
 * Updates a draft survey. Officer/admin only. Draft-only guard.
 */
export async function updateSurvey(
  ctx: ValidatedContext<UpdateSurveyBody, never, UpdateSurveyParams>
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
      throw new ForbiddenError('Only officers or admins can update surveys');
    }
  }

  const surveyId = ctx.req.param('survey')!;
  const body = ctx.req.valid('json');
  const repo = new SurveyRepository(db, logger);

  // Verify survey exists and belongs to org
  const existing = await repo.findById(surveyId);
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft surveys can be updated');
  }

  const updateData: any = { ...body, updatedBy: userId };
  if (body.settings?.deadline) {
    updateData.settings = { ...body.settings, deadline: body.settings.deadline.toISOString() };
  }
  const updated = await repo.updateDraftSurvey(surveyId, updateData);

  if (!updated) {
    throw new BusinessLogicError('Failed to update survey — status may have changed');
  }

  logger?.info({ surveyId, action: 'update_survey' }, 'Survey updated');

  return ctx.json(updated, 200);
}
