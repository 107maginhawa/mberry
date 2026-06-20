import type { ValidatedContext } from '@/types/app';
import type { GetSurveyParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import {
  UnauthorizedError,
  NotFoundError,
} from '@/core/errors';
import { SurveyRepository, SurveyResponseRepository } from './repos/survey.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { hasRole } from '@/utils/auth';
import { aggregatePollResults } from './utils/poll-results';

/**
 * getSurvey
 *
 * Path: GET /surveys/:survey
 * OperationId: getSurvey
 *
 * Officers/admins: full survey detail (any status).
 * Members: active surveys only, sanitized (no targetAudience / internal fields).
 *   - Draft → NotFoundError (no existence leak).
 *   - Poll type → includes aggregated pollResults.
 */
export async function getSurvey(
  ctx: ValidatedContext<never, never, GetSurveyParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }

  const userId = session.user.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const organizationId = ctx.get('organizationId') as string;
  const surveyId = ctx.req.param('survey')!;

  const repo = new SurveyRepository(db, logger);
  const survey = await repo.findById(surveyId);
  if (!survey || survey.organizationId !== organizationId) {
    throw new NotFoundError('Survey not found');
  }

  // Officers/admins get the full officer-facing detail (any status).
  let isPrivileged = hasRole(session.user, 'admin');
  if (!isPrivileged) {
    const officerRepo = new OfficerTermRepository(db, logger);
    const terms = await officerRepo.findActiveByPersonAndOrg(userId, organizationId);
    isPrivileged = terms.length > 0;
  }
  if (isPrivileged) {
    return ctx.json(survey, 200);
  }

  // Member read: only active surveys, sanitized (no drafts, no targetAudience/internals).
  if (survey.status !== 'active') {
    throw new NotFoundError('Survey not found');
  }
  const s = (survey.settings ?? {}) as { deadline?: string; anonymous?: boolean; allowReedit?: boolean };
  const sanitized = {
    id: survey.id,
    organizationId: survey.organizationId,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    surveyType: survey.surveyType,
    questions: survey.questions,
    settings: { deadline: s.deadline, anonymous: s.anonymous, allowReedit: s.allowReedit },
  };

  if (survey.surveyType === 'poll') {
    const responseRepo = new SurveyResponseRepository(db, logger);
    const all = await responseRepo.findAllBySurveyId(surveyId);
    return ctx.json({ ...sanitized, pollResults: aggregatePollResults(survey, all) }, 200);
  }

  return ctx.json(sanitized, 200);
}
