import type { ValidatedContext } from '@/types/app';
import type { GetSurveyParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository } from './repos/survey.repo';

/**
 * getSurvey
 *
 * Path: GET /surveys/:survey
 * OperationId: getSurvey
 *
 * Returns a single survey by ID, scoped to the current organization.
 */
export async function getSurvey(
  ctx: ValidatedContext<never, never, GetSurveyParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const surveyId = ctx.req.param('survey')!;

  const repo = new SurveyRepository(db, logger);
  const survey = await repo.findById(surveyId);

  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  return ctx.json(survey, 200);
}
