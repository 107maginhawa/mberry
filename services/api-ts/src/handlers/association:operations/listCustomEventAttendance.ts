import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ListCustomEventAttendanceQuery, ListCustomEventAttendanceParams } from '@/generated/openapi/validators';
import { clampPageSize } from '@/core/pagination';
import { EventRepository, CheckInRepository } from './repos/events.repo';

/**
 * listCustomEventAttendance
 *
 * Path: GET /association/event-lifecycle/{eventId}/attendance
 * OperationId: listCustomEventAttendance
 */
export async function listCustomEventAttendance(
  ctx: ValidatedContext<never, ListCustomEventAttendanceQuery, ListCustomEventAttendanceParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query') as Record<string, unknown>;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const checkInRepo = new CheckInRepository(db, logger);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  const limit = clampPageSize(query['limit'] === undefined ? undefined : Number(query['limit']));
  const offset = Math.max(0, Number(query['offset']) || 0);

  const checkIns = await checkInRepo.findMany({ eventId: params.eventId }, { pagination: { limit, offset } });

  return ctx.json({ data: checkIns, total: checkIns.length }, 200);
}
