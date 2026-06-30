import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { GetEventRegistrationsSummaryParams } from '@/generated/openapi/validators';
import { EventRepository, EventRegistrationRepository } from './repos/events.repo';

/**
 * getEventRegistrationsSummary
 *
 * Path: GET /association/event-lifecycle/{eventId}/registrations/summary
 * OperationId: getEventRegistrationsSummary
 *
 * Server-side attendee counts (total attending / paid / checked-in / no-show) for the door screen,
 * computed in one aggregate query so the numbers are accurate beyond the 100-row registration page
 * and use the real DB status enum (the client tally miscounted no-shows via the SDK's 'no_show').
 */
export async function getEventRegistrationsSummary(
  ctx: ValidatedContext<never, never, GetEventRegistrationsSummaryParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // The event must exist AND belong to this org — a cross-org / missing event is 404 (no leak).
  const event = await new EventRepository(db, logger).findOneById(params.eventId);
  if (!event || event.organizationId !== orgId) throw new NotFoundError('Event not found');

  const summary = await new EventRegistrationRepository(db, logger).summaryByEvent(params.eventId, orgId);
  return ctx.json(summary, 200);
}
