import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { JobScheduler } from '@/core/jobs';
import { NotFoundError, UnauthorizedError, ConflictError, BusinessLogicError } from '@/core/errors';
import type { CreateMembershipBody } from '@/generated/openapi/validators';
import { MembershipTierRepository, MembershipRepository } from './repos/membership.repo';
import { requirePosition } from '@/core/auth/officer-checks';
import { POSITION_TITLES } from '@/utils/position-titles';

/**
 * createMembership
 *
 * Path: POST /association/member/memberships
 * OperationId: createMembership
 */
export async function createMembership(
  ctx: ValidatedContext<CreateMembershipBody, never, never>
): Promise<Response> {
  const denied = await requirePosition(ctx, [POSITION_TITLES.SECRETARY, POSITION_TITLES.PRESIDENT]);
  if (denied) return denied;

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const baseLogger = ctx.get('logger');
  const traceId = ctx.get('requestId');
  const logger = baseLogger?.child?.({ traceId, module: 'association:member' }) ?? baseLogger;
  const tierRepo = new MembershipTierRepository(db, logger);
  const membershipRepo = new MembershipRepository(db, logger);

  // Validate tier exists and belongs to this org
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier) throw new NotFoundError('Membership tier');
  if (tier.organizationId !== orgId) throw new BusinessLogicError('Tier does not belong to this organization', 'TIER_ORG_MISMATCH');

  // Check no existing active membership for this person+org
  const existing = await membershipRepo.findByPersonAndOrg(body.personId, orgId);
  if (existing && !['removed', 'expired'].includes(existing.status)) {
    throw new ConflictError('An active membership already exists for this person in this organization');
  }

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const membership = await membershipRepo.createOne({
    organizationId: orgId,
    personId: body.personId,
    tierId: body.tierId,
    categoryId: body.categoryId ?? null,
    memberNumber: body.memberNumber ?? null,
    startDate: (body.startDate || today) as string,
    duesExpiryDate: body.duesExpiryDate ?? null,
    gracePeriodDays: body.gracePeriodDays ?? 30,
    status: 'pendingPayment',
    joinedAt: now,
    note: body.note ?? null,
  });

  ctx.set('auditResourceId', membership.id);
  ctx.set('auditDescription', 'Membership created');

  // Trigger directory profile auto-populate (Wave 3a)
  try {
    const jobs = ctx.get('jobs') as JobScheduler | undefined;
    if (jobs) {
      await jobs.trigger('directory.autoPopulate', { personId: body.personId, organizationId: orgId });
    }
  } catch (error) {
    const logger = ctx.get('logger');
    logger?.warn({ action: 'createMembership.1', error, personId: body.personId }, 'Failed to trigger directory auto-populate');
  }

  return ctx.json(membership, 201);
}
