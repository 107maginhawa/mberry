import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListAssociationsQuery } from '@/generated/openapi/validators';
import { AssociationRepository } from './repos/platform-admin.repo';

/**
 * listAssociations
 *
 * Path: GET /admin/associations
 * OperationId: listAssociations
 */
export async function listAssociations(
  ctx: ValidatedContext<never, ListAssociationsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new AssociationRepository(db, logger);

  const all = await repo.findAll();
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  const page = all.slice(offset, offset + limit);

  return ctx.json({
    data: page,
    pagination: { offset, limit, total: all.length },
  }, 200);
}