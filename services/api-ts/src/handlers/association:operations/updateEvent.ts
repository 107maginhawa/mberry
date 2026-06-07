import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateEventBody, UpdateEventParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';

/**
 * updateEvent
 *
 * Path: PATCH /association/events/{eventId}
 * OperationId: updateEvent
 */
export async function updateEvent(
  ctx: ValidatedContext<UpdateEventBody, never, UpdateEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById(params.eventId);
  if (!existing) throw new NotFoundError('Event not found');

  const updates: Record<string, unknown> = { ...body };

  const updated = await repo.updateOneById(params.eventId, updates);

  ctx.set('auditResourceId', updated.id);
  ctx.set('auditDescription', 'Event updated');

  return ctx.json(updated, 200);
}
