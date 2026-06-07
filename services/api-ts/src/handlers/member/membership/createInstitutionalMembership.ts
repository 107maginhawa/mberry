import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import type { CreateInstitutionalMembershipBody } from '@/generated/openapi/validators';
import { InstitutionalMembershipRepository } from '@/handlers/association:member/repos/institutional-membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createInstitutionalMembership
 *
 * Path: POST /association/member/institutional-memberships
 * OperationId: createInstitutionalMembership
 */
export async function createInstitutionalMembership(
  ctx: ValidatedContext<CreateInstitutionalMembershipBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new InstitutionalMembershipRepository(db, logger);

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const membership = await repo.createOne({
    organizationId: orgId,
    parentOrganizationId: body.parentOrganizationId,
    tierId: body.tierId,
    totalSeats: body.totalSeats,
    usedSeats: 0,
    primaryContactId: body.primaryContactId,
    billingContactId: body.billingContactId ?? null,
    startDate: (body.startDate || today) as string,
    duesExpiryDate: body.duesExpiryDate ?? null,
    status: 'pendingPayment',
  });

  ctx.set('auditResourceId', membership.id);
  ctx.set('auditDescription', 'Institutional membership created');

  return ctx.json(membership, 201);
}
