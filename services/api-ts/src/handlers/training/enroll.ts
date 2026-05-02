import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';
import type { Session } from '@/types/auth';

export async function enroll(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const trainingId = ctx.req.param('id');
  const repo = new TrainingRepository(db);

  const training = await repo.get(trainingId);
  if (!training) throw new NotFoundError('Training not found');

  const count = await repo.getEnrollmentCount(trainingId);
  const isWaitlisted = training.capacity ? count >= training.capacity : false;

  const enrollment = await repo.enroll({
    tenantId: training.tenantId,
    trainingId,
    personId: session.user.id,
    status: isWaitlisted ? 'cancelled' : 'enrolled',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: enrollment }, 201);
}
