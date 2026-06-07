import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListElectionsQuery } from '@/generated/openapi/validators';
import { ElectionsRepository } from '@/handlers/elections/repos/elections.repo';

/**
 * listElections
 *
 * Path: GET /association/member/elections
 * OperationId: listElections
 */
export async function listElections(
  ctx: ValidatedContext<never, ListElectionsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new ElectionsRepository(db);

  const filters: { status?: string; type?: string } = {};
  if (query.status) filters.status = query.status;
  const { type } = query as { type?: string };
  if (type) filters.type = type;

  const items = await repo.list(orgId, filters);

  return ctx.json({ data: items }, 200);
}
