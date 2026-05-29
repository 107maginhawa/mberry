import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { OnboardingStateRepository } from './repos/onboarding.repo';
import type { GetOnboardingStateQuery } from '@/generated/openapi/validators';

/**
 * getOnboardingState
 *
 * Path: GET /onboarding/state
 *
 * Returns the resumable onboarding wizard state for an organization.
 * Requires an authenticated user with an active officer term in the
 * requested org. 404 when the wizard has not been started.
 */
export async function getOnboardingState(
  ctx: ValidatedContext<never, GetOnboardingStateQuery, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { orgId } = ctx.req.valid('query');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Officer access against the *requested* org (org context middleware sets
  // role='member' for all users, so the term must be checked explicitly).
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required for this organization');
  }

  const repo = new OnboardingStateRepository(db, logger);
  const state = await repo.findByOrg(orgId);
  if (!state) {
    throw new NotFoundError('OnboardingState');
  }

  return ctx.json({
    id: state.id,
    organizationId: state.organizationId,
    currentStep: state.currentStep,
    stepsCompleted: state.stepsCompleted ?? [],
    completedAt: state.completedAt ? state.completedAt.toISOString() : null,
  });
}
