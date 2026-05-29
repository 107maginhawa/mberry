import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ScheduleMessageBody, ScheduleMessageParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';
import { domainEvents } from '@/core/domain-events';

/**
 * scheduleMessage
 *
 * Path: POST /association/messages/{messageId}/schedule
 * OperationId: scheduleMessage
 *
 * Sets scheduledAt from body and transitions status to 'scheduled'.
 */
export async function scheduleMessage(
  ctx: ValidatedContext<ScheduleMessageBody, never, ScheduleMessageParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const existing = await repo.findById(params.messageId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message not found');
  }

  if (existing.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot schedule a message with status "${existing.status}". Only draft messages can be scheduled.`,
      'MESSAGE_CANNOT_SCHEDULE'
    );
  }

  const scheduledAt = new Date(body.scheduledAt as unknown as string);

  if (scheduledAt.getTime() <= Date.now()) {
    throw new BusinessLogicError(
      'Scheduled time must be in the future',
      'MESSAGE_SCHEDULE_PAST'
    );
  }

  const updated = await repo.update(params.messageId, {
    scheduledAt,
    status: 'scheduled',
    updatedBy: user.id,
  });

  await domainEvents.emit('message.scheduled', {
    messageId: params.messageId,
    organizationId: orgId,
    scheduledBy: user.id,
    scheduledAt: scheduledAt.toISOString(),
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'message',
    resourceId: params.messageId,
    description: `Message scheduled for ${scheduledAt.toISOString()}`,
  });

  return ctx.json(updated, 200);
}
