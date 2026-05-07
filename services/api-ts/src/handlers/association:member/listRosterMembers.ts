import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { ListRosterMembersQuery } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';

/**
 * listRosterMembers
 *
 * Path: GET /association/member/roster
 * OperationId: listRosterMembers
 */
export async function listRosterMembers(
  ctx: ValidatedContext<never, ListRosterMembersQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipRepository(db, logger);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const result = await repo.findManyWithPagination(
    {
      organizationId: query.organizationId,
      status: query.status,
      tierId: query.categoryId,
      q: query.q ?? query.search,
    },
    { pagination: { offset, limit: pageSize } },
  );

  return ctx.json(result, 200);
}