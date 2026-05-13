import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { AddRosterMemberBody } from '@/generated/openapi/validators';
import { MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * addRosterMember
 *
 * Path: POST /association/member/roster
 * OperationId: addRosterMember
 */
export async function addRosterMember(
  ctx: ValidatedContext<AddRosterMemberBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const orgId = ctx.get('organizationId') as string;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipRepository(db, logger);

  const member = await repo.createOne({ ...body, organizationId: orgId } as any);

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'roster-member',
    resourceId: member.id,
    description: 'Roster member added',
  });

  return ctx.json(member, 201);
}