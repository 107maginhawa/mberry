import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateEventBody, UpdateEventParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { EventRepository } from './repos/events.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

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

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new EventRepository(db, logger);

  const existing = await repo.findOneById((params as any).eventId);
  if (!existing) throw new NotFoundError('Event not found');

  const updates: any = { ...body };
  if (updates.startDate) updates.startDate = new Date(updates.startDate);
  if (updates.endDate) updates.endDate = new Date(updates.endDate);

  const updated = await repo.updateOneById((params as any).eventId, updates);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'event',
    resourceId: updated.id,
    description: 'Event updated',
  });

  return ctx.json(updated, 200);
}
