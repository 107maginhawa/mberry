import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteEventParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * deleteEvent
 *
 * Path: DELETE /association/events/{eventId}
 * OperationId: deleteEvent
 */
export async function deleteEvent(
  ctx: ValidatedContext<never, never, DeleteEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const denied = await requirePosition(ctx, [POSITION_TITLES.SOCIETY_OFFICER, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById(params.eventId);
  if (!existing) throw new NotFoundError('Event not found');

  await repo.deleteOneById(params.eventId, user.id);

  ctx.set('auditResourceId', params.eventId);
  ctx.set('auditDescription', 'Event deleted');

  return ctx.json({ success: true }, 200);
}
