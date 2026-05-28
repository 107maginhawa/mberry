import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, ConflictError, BusinessLogicError } from '@/core/errors';
import type { AllocateSeatBody, AllocateSeatParams } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository, SeatAllocationRepository } from './repos/institutional-membership.repo';
import { auditAction } from '@/utils/audit';
import { requirePosition } from '@/utils/officer-check';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * allocateSeat
 *
 * Path: POST /association/member/institutional-memberships/{institutionalMembershipId}/seats
 * OperationId: allocateSeat
 */
export async function allocateSeat(
  ctx: ValidatedContext<AllocateSeatBody, never, AllocateSeatParams>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const params = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const instRepo = new InstitutionalMembershipRepository(db, logger);
  const seatRepo = new SeatAllocationRepository(db, logger);

  // Verify institutional membership exists
  const instMembership = await instRepo.findOneById(params.institutionalMembershipId);
  if (!instMembership) throw new NotFoundError('Institutional membership');

  // Check for duplicate active allocation
  const existing = await seatRepo.findActiveByMembershipAndPerson(
    params.institutionalMembershipId,
    body.personId,
  );
  if (existing) {
    throw new ConflictError('This person already has an active seat in this membership');
  }

  // Atomically increment seats — throws BusinessLogicError('SEATS_FULL') if at capacity
  await instRepo.incrementUsedSeats(params.institutionalMembershipId);

  // Create seat allocation record
  const seat = await seatRepo.createOne({
    institutionalMembershipId: params.institutionalMembershipId,
    personId: body.personId,
    allocatedBy: user.id,
    allocatedAt: new Date(),
    status: 'active',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'seat_allocation',
    resourceId: seat.id,
    description: `Seat allocated to person ${body.personId}`,
  });

  return ctx.json(seat, 201);
}
