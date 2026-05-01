import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteEventParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

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

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById((params as any).eventId);
  if (!existing) throw new NotFoundError('Event not found');

  await repo.deleteOneById((params as any).eventId, user.id);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'event',
    resourceId: (params as any).eventId,
    description: 'Event deleted',
  });

  return ctx.json({ success: true }, 200);
}
