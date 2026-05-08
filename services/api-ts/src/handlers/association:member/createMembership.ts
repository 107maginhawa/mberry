import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/core/errors';
import type { CreateMembershipBody } from '@/generated/openapi/validators';
import { MembershipTierRepository, MembershipRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';
import { requireOfficerTerm } from '@/utils/officer-check';

/**
 * createMembership
 *
 * Path: POST /association/member/memberships
 * OperationId: createMembership
 */
export async function createMembership(
  ctx: ValidatedContext<CreateMembershipBody, never, never>
): Promise<Response> {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const tierRepo = new MembershipTierRepository(db, logger);
  const membershipRepo = new MembershipRepository(db, logger);

  // Validate tier exists
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier) throw new NotFoundError('Membership tier');

  // Check no existing active membership for this person+org
  const existing = await membershipRepo.findByPersonAndOrg(body.personId, orgId);
  if (existing && !['terminated', 'expired'].includes(existing.status)) {
    throw new ConflictError('An active membership already exists for this person in this organization');
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  const expiryDate = oneYearLater.toISOString().split('T')[0];

  const membership = await membershipRepo.createOne({
    organizationId: orgId,
    personId: body.personId,
    tierId: body.tierId,
    categoryId: body.categoryId ?? null,
    memberNumber: body.memberNumber ?? null,
    startDate: (body.startDate || today) as string,
    duesExpiryDate: (body.duesExpiryDate || expiryDate) as string,
    gracePeriodDays: body.gracePeriodDays ?? 30,
    status: 'pendingPayment',
    joinedAt: now,
    note: body.note ?? null,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership',
    resourceId: membership.id,
    description: 'Membership created',
  });

  return ctx.json(membership, 201);
}
