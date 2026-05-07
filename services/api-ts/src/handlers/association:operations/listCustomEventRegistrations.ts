import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ListCustomEventRegistrationsQuery, ListCustomEventRegistrationsParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';

/**
 * listCustomEventRegistrations
 *
 * Path: GET /association/event-lifecycle/{eventId}/registrations
 * OperationId: listCustomEventRegistrations
 */
export async function listCustomEventRegistrations(
  ctx: ValidatedContext<never, ListCustomEventRegistrationsQuery, ListCustomEventRegistrationsParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const eventRepo = new EventRepository(db, logger);
  const regRepo = new EventRegistrationRepository(db, logger);

  const event = await eventRepo.findOneById(params.eventId);
  if (!event) throw new NotFoundError('Event not found');

  const filters: { eventId: string; status?: string } = { eventId: params.eventId };
  if ((query as any)?.status) {
    filters.status = (query as any).status;
  }

  const registrations = await regRepo.findMany(filters);

  return ctx.json({ data: registrations, total: registrations.length }, 200);
}
