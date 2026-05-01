import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { PublishEventParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';

/**
 * publishEvent
 *
 * Path: POST /association/events/{eventId}/publish
 * OperationId: publishEvent
 */
export async function publishEvent(
  ctx: ValidatedContext<never, never, PublishEventParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById((params as any).eventId);
  if (!existing) throw new NotFoundError('Event not found');

  if (existing.status !== 'draft') {
    throw new BusinessLogicError('Only draft events can be published', 'INVALID_STATUS');
  }

  const published = await repo.publish((params as any).eventId);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event',
    resourceId: published.id,
    description: 'Event published',
  });

  return ctx.json(published, 200);
}
