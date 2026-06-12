import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError } from '@/core/errors';
import type { UpdateMembershipBody, UpdateMembershipParams } from '@/generated/openapi/validators';
import { MembershipRepository } from '@/handlers/association:member/repos/membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';
import {
  persistWithComputedStatus,
  withComputedStatus,
  type MembershipStatusFields,
} from './utils/membership-status-middleware';
import { assertRecordInCallerOrg } from './utils/assert-record-org';

/**
 * updateMembership
 *
 * Path: PATCH /association/member/memberships/{membershipId}
 * OperationId: updateMembership
 */
export async function updateMembership(
  ctx: ValidatedContext<UpdateMembershipBody, never, UpdateMembershipParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { membershipId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const existing = await repo.findOneById(membershipId);
  if (!existing) throw new NotFoundError('Membership');
  // FIX-003 (G-02): the record must belong to the caller's org.
  assertRecordInCallerOrg(ctx, existing.organizationId, 'this membership');

  // FIX-002 (G-10): updating duesExpiryDate / gracePeriodDays previously left
  // the stored `status` cache stale (it called updateOneById without recompute).
  // Route the write through persistWithComputedStatus so the cached status is
  // recomputed from the merged (current + updates) state in the same UPDATE.
  const updated = await persistWithComputedStatus(
    db,
    membershipId,
    existing as unknown as MembershipStatusFields,
    body as Partial<MembershipStatusFields>,
    (body as { gracePeriodDays?: number }).gracePeriodDays,
  );

  ctx.set('auditResourceId', membershipId);
  ctx.set('auditDescription', 'Membership updated');

  // Respond with the on-read computed status for consistency with get/list.
  return ctx.json(withComputedStatus(updated), 200);
}
