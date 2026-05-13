import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function getTraining(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const id = ctx.req.param('id');
  const orgId = ctx.req.param('organizationId');
  const repo = new TrainingRepository(db);

  const training = await repo.getByOrg(id, orgId);
  if (!training) throw new NotFoundError('Training not found');

  const enrollCount = await repo.getEnrollmentCount(id);
  const attStats = await repo.getAttendanceStats(id);
  return ctx.json({ data: { ...training, enrollmentCount: enrollCount, attendance: attStats } }, 200);
}
