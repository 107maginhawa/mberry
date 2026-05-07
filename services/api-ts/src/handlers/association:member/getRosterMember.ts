import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { GetRosterMemberQuery, GetRosterMemberParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/membership/repos/membership.repo';

/**
 * getRosterMember
 *
 * Path: GET /association/member/roster/{memberId}
 * OperationId: getRosterMember
 */
export async function getRosterMember(
  ctx: ValidatedContext<never, GetRosterMemberQuery, GetRosterMemberParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { memberId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db);

  const row = await repo.getMemberById(memberId);
  if (!row) throw new NotFoundError('Roster member');

  const m = row.membership || row;
  const p = (row as any).person || {};
  const c = (row as any).category || {};

  return ctx.json({
    id: m.id,
    personId: m.personId || p.id,
    firstName: p.firstName || null,
    lastName: p.lastName || null,
    name: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
    memberNumber: m.memberNumber || null,
    categoryId: m.categoryId || null,
    categoryName: c.name || null,
    status: m.status || 'pending',
    duesExpiryDate: m.duesExpiryDate || null,
    joinedAt: m.joinedAt || m.createdAt || null,
    organizationId: m.organizationId || null,
  }, 200);
}
