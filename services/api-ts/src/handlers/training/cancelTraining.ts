import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import type { Session } from '@/types/auth';

export async function cancelTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const id = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;

  // [P0-AUTH] Officer role check — only officers can cancel training
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to cancel training');
  }

  const repo = new TrainingRepository(db);

  const existing = await repo.getByOrg(id, orgId);
  if (!existing) throw new NotFoundError('Training not found');

  if (existing.status === 'cancelled') {
    throw new BusinessLogicError('Training is already cancelled', 'TRAINING_ALREADY_CANCELLED');
  }
  if (existing.status === 'completed') {
    throw new BusinessLogicError('Cannot cancel a completed training', 'TRAINING_COMPLETED');
  }

  const updated = await repo.update(id, { status: 'cancelled' });
  return ctx.json({ data: updated }, 200);
}
