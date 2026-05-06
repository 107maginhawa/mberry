import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { CancelMessageParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * cancelMessage
 *
 * Path: POST /association/messages/{messageId}/cancel
 * OperationId: cancelMessage
 *
 * Only messages with status 'draft' or 'scheduled' can be cancelled.
 */
export async function cancelMessage(
  ctx: ValidatedContext<never, never, CancelMessageParams>
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
      `Cannot cancel a message with status "${existing.status}". Only draft or scheduled messages can be cancelled.`,
      'MESSAGE_CANNOT_CANCEL'
    );
  }

  const updated = await repo.update(params.messageId, {
    status: 'cancelled',
    updatedBy: user.id,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'message',
    resourceId: params.messageId,
    description: `Message cancelled (was ${existing.status})`,
  });

  return ctx.json(updated, 200);
}
