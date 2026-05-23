import type { ValidatedContext } from '@/types/app';
import type { PublishSurveyParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessLogicError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';

/**
 * publishSurvey
 *
 * Path: POST /surveys/:survey/publish
 * OperationId: publishSurvey
 *
 * Publishes a draft survey. Requires at least one question. Officer/admin only.
 */
export async function publishSurvey(
  ctx: ValidatedContext<never, never, PublishSurveyParams>
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
      throw new ForbiddenError('Only officers or admins can publish surveys');
    }
  }

  const surveyId = ctx.req.param('survey');
  const repo = new SurveyRepository(db, logger);

  const existing = await repo.findById(surveyId);
  if (!existing || existing.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft surveys can be published');
  }

  const questions = existing.questions as any[] | null;
  if (!questions || questions.length === 0) {
    throw new BusinessLogicError('Survey must have at least one question before publishing');
  }

  const published = await repo.publish(surveyId, userId);
  if (!published) {
    throw new BusinessLogicError('Failed to publish survey');
  }

  logger?.info({ surveyId, action: 'publish_survey' }, 'Survey published');

  return ctx.json(published, 200);
}
