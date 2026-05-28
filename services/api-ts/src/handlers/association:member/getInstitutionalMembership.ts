import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import type { GetInstitutionalMembershipParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository } from './repos/institutional-membership.repo';

/**
 * getInstitutionalMembership
 *
 * Path: GET /association/member/institutional-memberships/{institutionalMembershipId}
 * OperationId: getInstitutionalMembership
 */
export async function getInstitutionalMembership(
  ctx: ValidatedContext<never, never, GetInstitutionalMembershipParams>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const params = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new InstitutionalMembershipRepository(db, logger);

  const membership = await repo.findOneById(params.institutionalMembershipId);
  if (!membership) throw new NotFoundError('Institutional membership');

  return ctx.json(membership, 200);
}
