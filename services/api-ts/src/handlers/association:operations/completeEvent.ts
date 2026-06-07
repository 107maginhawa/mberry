import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { domainEvents } from '@/core/domain-events';

/**
 * completeEvent
 *
 * Path: POST /association/events/{eventId}/complete
 * Transitions an active/published event to "completed" status.
 * Only officers (Society Officer or President) may complete events.
 */
export async function completeEvent(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const { eventId } = ctx.req.valid('param') as { eventId: string };
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById(eventId);
  if (!existing) throw new NotFoundError('Event not found');

  if (existing.status !== 'published') {
    throw new BusinessLogicError('Only published events can be completed', 'INVALID_STATUS');
  }

  const completed = await repo.complete(eventId);

  domainEvents.emit('event.completed', {
    eventId: completed.id,
    organizationId: completed.organizationId,
    completedBy: user.id,
  }).catch(() => {});

  ctx.set('auditResourceId', completed.id);
  ctx.set('auditDescription', 'Event completed');

  return ctx.json(completed, 200);
}
