import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import type { ListRosterMembersQuery } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

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
  const repo = new MembershipRepository(db);

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const result = await repo.listMembers({
    organizationId: query.organizationId,
    status: query.status,
    categoryId: query.categoryId,
    search: query.q ?? query.search,
    limit: pageSize,
    offset,
  });

  // Flatten nested { membership, person, category } for frontend
  const data = result.data.map((row: any) => {
    const m = row.membership || row;
    const p = row.person || {};
    const c = row.category || {};
    return {
      id: m.id,
      personId: m.personId || p.id,
      firstName: p.firstName || null,
      lastName: p.lastName || null,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
      email: p.email || null,
      avatar: p.avatar || null,
      memberNumber: m.memberNumber || null,
      categoryId: m.categoryId || null,
      categoryName: c.name || null,
      status: m.status || 'pending',
      duesExpiryDate: m.duesExpiryDate || null,
      gracePeriodDays: m.gracePeriodDays || 30,
      joinedAt: m.joinedAt || m.createdAt || null,
      startDate: m.startDate || null,
      organizationId: m.organizationId || null,
    };
  });

  return ctx.json({ data, totalCount: result.total }, 200);
}
