import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';

/**
 * getMyMemberships
 *
 * Path: GET /memberships
 * OperationId: getMyMemberships
 */
export async function getMyMemberships(ctx: BaseContext): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const personId = session.user.id;

  const repo = new MembershipRepository(db, logger);
  const memberships = await repo.findAllByPerson(personId);

  return ctx.json({ data: memberships, total: memberships.length }, 200);
}
