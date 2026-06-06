import type { ValidatedContext } from '@/types/app';
import type { CreateSurveyBody } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';
import type { SurveySettings } from './repos/survey.schema';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';

/**
 * createSurvey
 *
 * Path: POST /surveys
 * OperationId: createSurvey
 *
 * Creates a new survey in draft status. Officer/admin only.
 */
export async function createSurvey(
  ctx: ValidatedContext<CreateSurveyBody, never, never>
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
      throw new ForbiddenError('Only officers or admins can create surveys');
    }
  }

  const body = ctx.req.valid('json');
  const repo = new SurveyRepository(db, logger);

  const survey = await repo.createSurvey({
    organizationId,
    title: body.title,
    description: body.description ?? null,
    surveyType: body.surveyType,
    questions: body.questions ?? [],
    settings: body.settings ? ({
      ...body.settings,
      deadline: body.settings.deadline ? body.settings.deadline.toISOString() : undefined,
    } satisfies SurveySettings) : {},
    status: 'draft',
    createdBy: userId,
    updatedBy: userId,
  });

  logger?.info({ surveyId: survey.id, action: 'create_survey' }, 'Survey created');

  return ctx.json(survey, 201);
}
