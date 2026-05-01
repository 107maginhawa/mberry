import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CancelEventParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * cancelEvent
 *
 * Path: POST /association/events/{eventId}/cancel
 * OperationId: cancelEvent
 */
export async function cancelEvent(
  ctx: ValidatedContext<never, never, CancelEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById((params as any).eventId);
  if (!existing) throw new NotFoundError('Event not found');

  if (existing.status !== 'draft' && existing.status !== 'published') {
    throw new BusinessLogicError('Only draft or published events can be cancelled', 'INVALID_STATUS');
  }

  const cancelled = await repo.cancel((params as any).eventId);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event',
    resourceId: cancelled.id,
    description: 'Event cancelled',
  });

  return ctx.json(cancelled, 200);
}
