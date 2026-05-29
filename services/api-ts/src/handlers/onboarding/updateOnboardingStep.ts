import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
import { OnboardingStateRepository } from './repos/onboarding.repo';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';
import type { UpdateOnboardingStepBody } from '@/generated/openapi/validators';

const TOTAL_STEPS = 5;

/**
 * updateOnboardingStep
 *
 * Path: PUT /onboarding/step
 *
 * Saves progress for an onboarding wizard step. Steps must be completed in
 * order — saving a step beyond the current one is rejected (M01-004, 422).
 * Saving the final step marks onboarding complete and emits
 * `onboarding.completed`.
 */
export async function updateOnboardingStep(
  ctx: ValidatedContext<UpdateOnboardingStepBody, never, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { orgId, step } = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required for this organization');
  }

  const repo = new OnboardingStateRepository(db, logger);
  let state = await repo.findByOrg(orgId);

  // Bootstrap: a fresh wizard must begin at step 1.
  if (!state) {
    if (step !== 1) {
      throw new BusinessLogicError(
        `Onboarding step ${step} cannot be saved before earlier steps are completed`,
        'M01-004',
      );
    }
    state = await repo.create({
      organizationId: orgId,
      currentStep: 1,
      stepsCompleted: [],
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  // No skipping ahead — the requested step may not exceed the current step.
  if (step > state.currentStep) {
    throw new BusinessLogicError(
      `Onboarding step ${step} is out of order (current step is ${state.currentStep})`,
      'M01-004',
    );
  }

  const wasComplete = state.completedAt != null;

  const stepsCompleted = Array.from(
    new Set([...(state.stepsCompleted ?? []), step]),
  ).sort((a, b) => a - b);

  let currentStep = state.currentStep;
  let completedAt = state.completedAt ?? null;

  // Advancing the wizard only happens when saving the current step.
  if (step === state.currentStep) {
    if (step < TOTAL_STEPS) {
      currentStep = step + 1;
    } else {
      currentStep = TOTAL_STEPS;
      completedAt = completedAt ?? new Date();
    }
  }

  const updated = await repo.update(orgId, { currentStep, stepsCompleted, completedAt });

  const nowComplete = completedAt != null;

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'onboarding_state',
    resourceId: state.id,
    description: `Onboarding step ${step} saved for organization ${orgId}`,
  });

  // Fire completion event once, on the transition into completed.
  if (nowComplete && !wasComplete) {
    await domainEvents.emit('onboarding.completed', {
      organizationId: orgId,
      officerId: user.id,
    });
  }

  return ctx.json({
    saved: true,
    currentStep: updated?.currentStep ?? currentStep,
    stepsCompleted: updated?.stepsCompleted ?? stepsCompleted,
  });
}
