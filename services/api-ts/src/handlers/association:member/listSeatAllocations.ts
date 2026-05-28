import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { ListSeatAllocationsQuery, ListSeatAllocationsParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';

/**
 * listSeatAllocations
 *
 * Path: GET /association/member/institutional-memberships/{institutionalMembershipId}/seats
 * OperationId: listSeatAllocations
 */
export async function listSeatAllocations(
  ctx: ValidatedContext<never, ListSeatAllocationsQuery, ListSeatAllocationsParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const params = ctx.req.valid('param');
  const query = ctx.req.valid('query');

  const instRepo = new InstitutionalMembershipRepository(db, logger);
  const seatRepo = new SeatAllocationRepository(db, logger);

  // Verify institutional membership exists
  const instMembership = await instRepo.findOneById(params.institutionalMembershipId);
  if (!instMembership) throw new NotFoundError('Institutional membership');

  const offset = query.offset ?? (query.page != null && query.pageSize != null
    ? (query.page - 1) * query.pageSize
    : 0);
  const limit = query.limit ?? query.pageSize ?? 20;

  const filters = {
    institutionalMembershipId: params.institutionalMembershipId,
    ...(query.status ? { status: query.status } : {}),
  };

  const { data, totalCount } = await seatRepo.findManyWithPagination(filters, {
    pagination: { offset, limit },
  });

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return ctx.json({
    data,
    pagination: {
      offset,
      limit,
      count: data.length,
      totalCount,
      totalPages,
      currentPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  }, 200);
}
