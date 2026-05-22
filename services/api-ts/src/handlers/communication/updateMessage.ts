import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateMessageBody, UpdateMessageParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateMessage
 *
 * Path: PATCH /association/messages/{messageId}
 * OperationId: updateMessage
 */
export async function updateMessage(
  ctx: ValidatedContext<UpdateMessageBody, never, UpdateMessageParams>
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

  if (existing.status === 'sent' || existing.status === 'sending') {
    throw new BusinessLogicError('Cannot update a message that has already been sent', 'MESSAGE_ALREADY_SENT');
  }

  const updated = await repo.update(params.messageId, {
    ...body,
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'message',
    resourceId: params.messageId,
    description: 'Message updated',
  });

  return ctx.json(updated, 200);
}
