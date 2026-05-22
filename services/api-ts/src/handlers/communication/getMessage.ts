import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { GetMessageParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { MessageRepository } from './repos/communication.repo';

/**
 * getMessage
 *
 * Path: GET /association/messages/{messageId}
 * OperationId: getMessage
 */
export async function getMessage(
  ctx: ValidatedContext<never, never, GetMessageParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const message = await repo.findById(params.messageId);
  if (!message || message.organizationId !== orgId) {
    throw new NotFoundError('Message not found');
  }

  return ctx.json(message, 200);
}
