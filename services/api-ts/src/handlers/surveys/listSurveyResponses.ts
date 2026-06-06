import type { ValidatedContext } from '@/types/app';
import type { ListSurveyResponsesQuery, ListSurveyResponsesParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository, type SurveyResponseFilters } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { buildPaginationMeta } from '@/utils/query';
import { hasRole } from '@/utils/auth';

const ANONYMOUS_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * listSurveyResponses
 *
 * Path: GET /surveys/:survey/responses
 * OperationId: listSurveyResponses
 *
 * Lists responses for a survey. Officer/admin only.
 * Anonymous surveys strip responderId to zeros UUID.
 */
export async function listSurveyResponses(
  ctx: ValidatedContext<never, ListSurveyResponsesQuery, ListSurveyResponsesParams>
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
      throw new ForbiddenError('Only officers or admins can view survey responses');
    }
  }

  const surveyId = ctx.req.param('survey')!;
  const query = ctx.req.valid('query');

  // Verify survey exists and belongs to org
  const surveyRepo = new SurveyRepository(db, logger);
  const survey = await surveyRepo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  const page = query.page ? Number(query.page) : 1;
  const limit = query.limit ? Number(query.limit) : 20;
  const offset = (page - 1) * limit;

  const filters: SurveyResponseFilters = {
    surveyId,
    organizationId,
    status: 'completed',
  };

  const responseRepo = new SurveyResponseRepository(db, logger);
  const result = await responseRepo.findManyWithPagination(filters, {
    pagination: { limit, offset },
  });

  // Strip responderId for anonymous surveys
  const settings = survey.settings as { anonymous?: boolean } | null;
  const isAnonymous = settings?.anonymous === true;

  const data = isAnonymous
    ? result.data.map((r) => ({ ...r, responderId: ANONYMOUS_UUID }))
    : result.data;

  return ctx.json({
    data,
    pagination: buildPaginationMeta(data, result.totalCount, limit, offset),
  }, 200);
}
