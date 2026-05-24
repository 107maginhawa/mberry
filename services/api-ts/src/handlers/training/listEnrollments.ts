import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function listEnrollments(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const trainingId = ctx.req.param('id')!;
  const orgId = ctx.req.param('organizationId')!;
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(trainingId, orgId);
  if (!training) throw new NotFoundError('Training not found');

  const enrollments = await repo.listEnrollments(trainingId);
  const stats = await repo.getAttendanceStats(trainingId);

  return ctx.json({ data: enrollments, stats }, 200);
}
