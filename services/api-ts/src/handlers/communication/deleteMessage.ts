import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteMessageParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteMessage
 *
 * Path: DELETE /association/messages/{messageId}
 * OperationId: deleteMessage
 */
export async function deleteMessage(
  ctx: ValidatedContext<never, never, DeleteMessageParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const existing = await repo.findById(params.messageId);
  if (!existing || existing.organizationId !== orgId) {
    throw new NotFoundError('Message not found');
  }

  await repo.delete(params.messageId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'message',
    resourceId: params.messageId,
    description: 'Message deleted',
  });

  return ctx.body(null, 204);
}
