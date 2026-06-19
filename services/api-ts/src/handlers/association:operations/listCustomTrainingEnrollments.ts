import { inArray } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ListCustomTrainingEnrollmentsQuery, ListCustomTrainingEnrollmentsParams } from '@/generated/openapi/validators';
import { clampPageSize } from '@/core/pagination';
import { persons } from '@/handlers/person/repos/person.schema';
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

  const limit = clampPageSize(q['limit'] === undefined ? undefined : Number(q['limit']));
  const offset = Math.max(0, Number(q['offset']) || 0);

  const enrollments = await enrollRepo.findMany(filters, { pagination: { limit, offset } });

  // ISSUE-031: join person so the roster renders names, not raw UUIDs.
  const personIds = [...new Set(enrollments.map((e) => e.personId).filter(Boolean))];
  const people = personIds.length
    ? await db.select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
        .from(persons).where(inArray(persons.id, personIds))
    : [];
  const nameById = new Map(
    people.map((p) => [p.id, p.firstName ? `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}` : null]),
  );
  const enriched = enrollments.map((e) => ({ ...e, personName: nameById.get(e.personId) ?? null }));

  return ctx.json({ data: enriched, total: enriched.length }, 200);
}
