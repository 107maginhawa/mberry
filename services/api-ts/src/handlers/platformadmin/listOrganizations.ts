import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListOrganizationsQuery } from '@/generated/openapi/validators';
import { OrganizationRepository } from './repos/platform-admin.repo';

/**
 * listOrganizations
 *
 * Path: GET /admin/organizations
 * OperationId: listOrganizations
 */
export async function listOrganizations(
  ctx: ValidatedContext<never, ListOrganizationsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OrganizationRepository(db, logger);

  const all = await repo.findAll(query.status);
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 20;
  const page = all.slice(offset, offset + limit);

  return ctx.json({
    data: page,
    pagination: { offset, limit, total: all.length },
  }, 200);
}