import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';

/**
 * Training status state machine.
 * Enforces valid transitions — handlers use this instead of ad-hoc checks.
 */
export const TRAINING_VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'cancelled'],
  published: ['completed', 'cancelled'],
  completed: [],  // terminal
  cancelled: [],  // terminal
};

export function isValidTrainingTransition(from: string, to: string): boolean {
  return TRAINING_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * completeTraining
 *
 * Transitions a published training to "completed" status.
 * Different from markComplete which completes an individual enrollment.
 */
export async function completeTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;

  // Officer role check
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to complete training');
  }

  const repo = new TrainingRepository(db);
  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  if (!isValidTrainingTransition(existing.status, 'completed')) {
    throw new BusinessLogicError(
      `Cannot complete training in '${existing.status}' status. Only published trainings can be completed.`,
      'INVALID_TRAINING_TRANSITION'
    );
  }

  const updated = await repo.update(id, { status: 'completed' });

  domainEvents.emit('training.completed', {
    trainingId: id,
    organizationId: orgId,
    completedBy: session.user.id,
  }).catch(() => {});

  return ctx.json({ data: updated }, 200);
}
