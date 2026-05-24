import type { Context } from 'hono';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function cancelTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;
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
