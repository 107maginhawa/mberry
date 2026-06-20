import type { ValidatedContext } from '@/types/app';
import type { ListSurveysQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
} from '@/core/errors';
import { SurveyRepository, type SurveyFilters } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';
import { buildPaginationMeta } from '@/utils/query';

/**
 * listSurveys
 *
 * Path: GET /surveys
 * OperationId: listSurveys
 *
 * Lists surveys for the organization.
 * mine=true filters to surveys the current user has responded to (member view).
 *
 * The non-`mine` path lists ALL org surveys (incl. drafts + internal settings)
 * and is officer/admin only (M18 read-auth, FIX-002). Members must use
 * mine=true for their assigned view. Matches the "any active officer term"
 * gate used by sibling handlers (publishSurvey, listSurveyResponses).
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

  const repo = new SurveyRepository(db, logger);

  if (query.mine) {
    if (query.available) {
      const availResult = await repo.findAvailableForMember(organizationId, userId, {
        surveyType: query.surveyType as string | undefined,
        pagination: { limit, offset },
      });
      return ctx.json({
        data: availResult.data,
        pagination: buildPaginationMeta(availResult.data, availResult.totalCount, limit, offset),
      }, 200);
    }
    const mineResult = await repo.findMineWithPagination(organizationId, userId, {
      pagination: { limit, offset },
    });
    return ctx.json({
      data: mineResult.data,
      pagination: buildPaginationMeta(mineResult.data, mineResult.totalCount, limit, offset),
    }, 200);
  }

  // Officer/admin gate on the non-`mine` (all-org) listing path
  if (!hasRole(session.user, 'admin')) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    if (terms.length === 0) {
      throw new ForbiddenError('Only officers or admins can list organization surveys');
    }
  }

  const filters: SurveyFilters = {
    organizationId,
    status: query.status as string | undefined,
    surveyType: query.surveyType as string | undefined,
  };

  const result = await repo.findManyWithPagination(filters, {
    pagination: { limit, offset },
  });

  return ctx.json({
    data: result.data,
    pagination: buildPaginationMeta(result.data, result.totalCount, limit, offset),
  }, 200);
}
