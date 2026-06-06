import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { RevokeSeatParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * revokeSeat
 *
 * Path: POST /association/member/institutional-memberships/{institutionalMembershipId}/seats/{seatAllocationId}/revoke
 * OperationId: revokeSeat
 */
export async function revokeSeat(
  ctx: ValidatedContext<never, never, RevokeSeatParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const params = ctx.req.valid('param');

  const instRepo = new InstitutionalMembershipRepository(db, logger);
  const seatRepo = new SeatAllocationRepository(db, logger);

  // Find the seat allocation
  const seat = await seatRepo.findOneById(params.seatAllocationId);
  if (!seat) throw new NotFoundError('Seat allocation');

  // Verify seat belongs to this institutional membership
  if (seat.institutionalMembershipId !== params.institutionalMembershipId) {
    throw new NotFoundError('Seat allocation');
  }

  // Guard: already revoked
  if (seat.status !== 'active') {
    throw new BusinessLogicError('Seat already revoked', 'ALREADY_REVOKED');
  }

  // Revoke the seat
  const revoked = await seatRepo.updateOneById(params.seatAllocationId, {
    status: 'revoked',
    revokedAt: new Date(),
  });

  // Decrement used seats on the institutional membership
  await instRepo.decrementUsedSeats(params.institutionalMembershipId);

  ctx.set('auditResourceId', params.seatAllocationId);
  ctx.set('auditDescription', `Seat revoked by ${user.id}`);

  return ctx.json(revoked, 200);
}
