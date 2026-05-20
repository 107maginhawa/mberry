import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ListCustomTrainingEnrollmentsQuery, ListCustomTrainingEnrollmentsParams } from '@/generated/openapi/validators';
import { TrainingRepository, TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * listCustomTrainingEnrollments
 *
 * Path: GET /association/training-lifecycle/{trainingId}/enrollments
 * OperationId: listCustomTrainingEnrollments
 */
export async function listCustomTrainingEnrollments(
  ctx: ValidatedContext<never, ListCustomTrainingEnrollmentsQuery, ListCustomTrainingEnrollmentsParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const trainingRepo = new TrainingRepository(db, logger);
  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const training = await trainingRepo.findOneById(params.trainingId);
  if (!training) throw new NotFoundError('Training not found');

  const filters: { trainingId: string; status?: string } = { trainingId: params.trainingId };
  const q = query as Record<string, unknown>;
  if (q['status']) {
    filters.status = q['status'] as string;
  }

  const enrollments = await enrollRepo.findMany(filters);

  return ctx.json({ data: enrollments, total: enrollments.length }, 200);
}
