import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchMessagesQuery } from '@/generated/openapi/validators';
import { MessageRepository } from './repos/communication.repo';

/**
 * searchMessages
 *
 * Path: GET /association/messages
 * OperationId: searchMessages
 */
export async function searchMessages(
  ctx: ValidatedContext<never, SearchMessagesQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageRepository(db, logger);

  const limit = query.limit ?? query.pageSize ?? 20;
  const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);

  const items = await repo.search(tenantId, {
    channel: query.channel,
    senderId: query.senderId,
    status: query.status,
    scheduledAfter: query.scheduledAfter ? new Date(query.scheduledAfter as unknown as string) : undefined,
    limit,
    offset,
  });

  return ctx.json({ items, total: items.length, offset, limit }, 200);
}
