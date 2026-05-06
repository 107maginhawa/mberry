import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SendMessageParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * sendMessage
 *
 * Path: POST /association/messages/{messageId}/send
 * OperationId: sendMessage
 *
 * Transitions message to 'sending', sets sentAt, then marks as 'sent'.
 */
export async function sendMessage(
  ctx: ValidatedContext<never, never, SendMessageParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const existing = await repo.findById(params.messageId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message not found');
  }

  if (existing.status !== 'draft' && existing.status !== 'scheduled') {
    throw new BusinessLogicError(
      `Cannot send a message with status "${existing.status}". Only draft or scheduled messages can be sent.`,
      'MESSAGE_CANNOT_SEND'
    );
  }

  // Transition to 'sending'
  await repo.update(params.messageId, {
    status: 'sending',
    updatedBy: user.id,
  });

  // Mark as 'sent' with sentAt timestamp
  const updated = await repo.update(params.messageId, {
    status: 'sent',
    sentAt: new Date(),
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'message',
    resourceId: params.messageId,
    description: 'Message sent',
  });

  return ctx.json(updated, 200);
}
