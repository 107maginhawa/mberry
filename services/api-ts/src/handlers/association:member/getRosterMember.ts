import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { GetRosterMemberQuery, GetRosterMemberParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';

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

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipRepository(db, logger);

  const member = await repo.findOneById(params.memberId);
  if (!member) throw new NotFoundError('Roster member');

  return ctx.json(member, 200);
}