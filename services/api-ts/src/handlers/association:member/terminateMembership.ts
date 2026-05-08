import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { TerminateMembershipBody, TerminateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * terminateMembership
 *
 * Path: POST /association/member/memberships/{membershipId}/terminate
 * OperationId: terminateMembership
 */
export async function terminateMembership(
  ctx: ValidatedContext<TerminateMembershipBody, never, TerminateMembershipParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const membership = await repo.findOneById(membershipId);
  if (!membership) throw new NotFoundError('Membership');

  const updated = await repo.updateOneById(membershipId, {
    status: 'terminated',
    terminatedAt: new Date(),
    terminationReason: body.terminationReason ?? null,
  } as any);

  await auditAction(ctx, {
    action: 'terminate',
    resourceType: 'membership',
    resourceId: membershipId,
    description: 'Membership terminated',
  });

  // P1-4: Invalidate terminated member's sessions so they can't access org resources
  try {
    const auth = ctx.get('auth');
    if (auth && membership.personId) {
      await (auth.api as any).revokeUserSessions({
        body: { userId: membership.personId },
        headers: ctx.req.raw.headers,
      });
    }
  } catch (err) {
    const logger = ctx.get('logger');
    logger?.warn({ error: err, personId: membership.personId }, 'Failed to revoke sessions after membership termination');
  }

  return ctx.json(updated, 200);
}
