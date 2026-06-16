import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListMyCustomTrainingsQuery } from '@/generated/openapi/validators';
import { clampPageSize } from '@/core/pagination';
import { TrainingEnrollmentRepository } from './repos/training.repo';

/**
 * listMyCustomTrainings
 *
 * Path: GET /association/training-lifecycle/my
 * OperationId: listMyCustomTrainings
 */
export async function listMyCustomTrainings(
  ctx: ValidatedContext<never, ListMyCustomTrainingsQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const enrollRepo = new TrainingEnrollmentRepository(db, logger);

  const filters: { personId: string; status?: string } = { personId: user.id };
  const q = query as Record<string, unknown>;
  if (q['status']) {
    filters.status = q['status'] as string;
  }

  const limit = clampPageSize(q['limit'] === undefined ? undefined : Number(q['limit']));
  const offset = Math.max(0, Number(q['offset']) || 0);

  const enrollments = await enrollRepo.findMany(filters, { pagination: { limit, offset } });

  return ctx.json({ data: enrollments, total: enrollments.length }, 200);
}
