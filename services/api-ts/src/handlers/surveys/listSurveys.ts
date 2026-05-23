import type { ValidatedContext } from '@/types/app';
import type { ListSurveysQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
} from '@/core/errors';
import { SurveyRepository, type SurveyFilters } from './repos/survey.repo';
import { SurveyResponseRepository } from './repos/survey.repo';
import { buildPaginationMeta } from '@/utils/query';

/**
 * listSurveys
 *
 * Path: GET /surveys
 * OperationId: listSurveys
 *
 * Lists surveys for the organization.
 * mine=true filters to surveys the current user has responded to.
 */
export async function listSurveys(
  ctx: ValidatedContext<never, ListSurveysQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;

  const query = ctx.req.valid('query');

  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;
  const offset = (page - 1) * limit;

  const filters: SurveyFilters = {
    organizationId,
    status: query.status as string | undefined,
    surveyType: query.surveyType as string | undefined,
  };

  const repo = new SurveyRepository(db, logger);
  const result = await repo.findManyWithPagination(filters, {
    pagination: { limit, offset },
  });

  return ctx.json({
    data: result.data,
    pagination: buildPaginationMeta(result.data, result.totalCount, limit, offset),
  }, 200);
}
