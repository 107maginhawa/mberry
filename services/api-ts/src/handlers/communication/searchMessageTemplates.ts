import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SearchMessageTemplatesQuery } from '@/generated/openapi/validators';
import { MessageTemplateRepository } from './repos/communication.repo';

/**
 * searchMessageTemplates
 *
 * Path: GET /association/message-templates
 * OperationId: searchMessageTemplates
 */
export async function searchMessageTemplates(
  ctx: ValidatedContext<never, SearchMessageTemplatesQuery, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MessageTemplateRepository(db, logger);

  const limit = query.limit ?? query.pageSize ?? 20;
  const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);

  const items = await repo.search(orgId, {
    q: query.q,
    channel: query.channel,
    category: query.category,
    status: query.status,
    isTransactional: query.isTransactional,
    limit,
    offset,
  });

  return ctx.json({ items, total: items.length, offset, limit }, 200);
}
