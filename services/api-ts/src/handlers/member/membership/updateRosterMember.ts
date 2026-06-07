import type { ValidatedContext } from '@/types/app';
import type { Membership } from '@/handlers/association:member/repos/membership.schema';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateRosterMemberBody, UpdateRosterMemberParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * updateRosterMember
 *
 * Path: PUT /association/member/roster/{memberId}
 * OperationId: updateRosterMember
 */
export async function updateRosterMember(
  ctx: ValidatedContext<UpdateRosterMemberBody, never, UpdateRosterMemberParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipRepository(db, logger);

  const existing = await repo.findOneById(params.memberId);
  if (!existing) throw new NotFoundError('Roster member');

  const updated = await repo.updateOneById(params.memberId, body as Partial<Membership>);

  ctx.set('auditResourceId', params.memberId);
  ctx.set('auditDescription', 'Roster member updated');

  return ctx.json(updated, 200);
}