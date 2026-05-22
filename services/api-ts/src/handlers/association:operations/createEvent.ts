import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CreateEventBody } from '@/generated/openapi/validators';
import { EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

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

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

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

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'event',
    resourceId: event.id,
    description: 'Event created',
    eventSubType: 'association.event-created',
  });

  return ctx.json(event, 201);
}
