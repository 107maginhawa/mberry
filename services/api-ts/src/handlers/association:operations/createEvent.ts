import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateEventBody } from '@/generated/openapi/validators';
import { EventRepository } from './repos/events.repo';

/**
 * createEvent
 *
 * Path: POST /association/events
 * OperationId: createEvent
 */
export async function createEvent(
  ctx: ValidatedContext<CreateEventBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const event = await repo.createOne({
    organizationId: body.organizationId || orgId,
    title: body.title,
    description: body.description,
    location: body.location,
    startDate: body.startDate,
    endDate: body.endDate!,
    capacity: body.capacity,
    registrationFee: body.registrationFee,
    status: 'draft',
  });

  ctx.set('auditResourceId', event.id);
  ctx.set('auditDescription', 'Event created');

  return ctx.json(event, 201);
}
