import type { Context } from 'hono';
import { NotFoundError, ConflictError } from '@/core/errors';
import { TrainingRepository } from './repos/training.repo';

export async function markComplete(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const trainingId = ctx.req.param('id');
  const body = await ctx.req.json();
  const repo = new TrainingRepository(db);

  const training = await repo.get(trainingId);
  if (!training) throw new NotFoundError('Training not found');

  // Check enrollment before marking complete
  const enrollmentCount = await repo.getEnrollmentCount(trainingId);
  if (enrollmentCount === 0) throw new ConflictError('No active enrollment found');

  // Update enrollment status to completed
  const enrollments = await repo.listEnrollments(trainingId);
  const personEnrollment = enrollments.find((e) => e.personId === body.personId);
  if (!personEnrollment) throw new NotFoundError('Enrollment not found');
  if (personEnrollment.completedAt) throw new ConflictError('Already marked as completed');

  const updated = await repo.updateEnrollmentStatus(personEnrollment.id, 'completed');

  return ctx.json({ data: updated }, 201);
}
