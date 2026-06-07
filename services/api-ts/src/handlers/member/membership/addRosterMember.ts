import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import type { JobScheduler } from '@/core/jobs';
import type { AddRosterMemberBody } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import type { NewMembership } from '@/handlers/association:member/repos/membership.schema';
import { requirePosition } from '@/core/auth/officer-checks';
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
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
  const repo = new MembershipRepository(db, logger);

  const member = await repo.createOne({ ...body, organizationId: orgId } as NewMembership);

  ctx.set('auditResourceId', member.id);
  ctx.set('auditDescription', 'Roster member added');

  // Trigger directory profile auto-populate (Wave 3a)
  try {
    const jobs = ctx.get('jobs') as JobScheduler | undefined;
    if (jobs) {
      await jobs.trigger('directory.autoPopulate', { personId: body.personId, organizationId: orgId });
    }
  } catch (error) {
    logger?.warn({ action: 'addRosterMember.1', error, personId: body.personId }, 'Failed to trigger directory auto-populate');
  }

  return ctx.json(member, 201);
}