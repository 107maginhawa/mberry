import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { domainEvents } from '@/core/domain-events';
import type { Session } from '@/types/auth';
import { isValidTrainingTransition } from './completeTraining';

/**
 * publishTraining
 *
 * Transitions a draft training to "published" status.
 * Only officers (any position) may publish. Only draft trainings may be published.
 */
export async function publishTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;

  // Officer role check — only officers can publish training
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to publish training');
  }

  const repo = new TrainingRepository(db);
  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  if (!isValidTrainingTransition(existing.status, 'published')) {
    throw new BusinessLogicError(
      `Cannot publish training in '${existing.status}' status. Only draft trainings can be published.`,
      'INVALID_TRAINING_TRANSITION'
    );
  }

  const updated = await repo.update(id, { status: 'published' });

  domainEvents.emit('training.published', {
    trainingId: id,
    organizationId: orgId,
    publishedBy: session.user.id,
  }).catch(() => {});

  return ctx.json({ data: updated }, 200);
}
