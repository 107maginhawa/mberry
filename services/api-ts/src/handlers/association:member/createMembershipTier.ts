import type { ValidatedContext } from '@/types/app';
import type { CreateMembershipTierBody } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError } from '@/core/errors';
import { MembershipTierRepository } from './repos/membership.repo';
import type { MembershipTier } from './repos/membership.schema';
import { auditAction } from '@/utils/audit';

/**
 * createMembershipTier
 *
 * Path: POST /association/member/tiers
 * OperationId: createMembershipTier
 */
export async function createMembershipTier(
  ctx: ValidatedContext<CreateMembershipTierBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new MembershipTierRepository(db, logger);

  // Check for duplicate code within tenant
  const existing = await repo.findByCode(orgId, body.code);
  if (existing) {
    throw new ConflictError('A tier with this code already exists in this organization');
  }

  const tier = await repo.createOne({
    organizationId: orgId,
    name: body.name,
    code: body.code,
    description: body.description || null,
    annualFee: body.annualFee,
    currency: body.currency,
    benefits: body.benefits || null,
    maxMembers: body.maxMembers ?? null,
    status: body.status as MembershipTier['status'],
    createdBy: user.id,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership-tier',
    resourceId: tier.id,
    description: 'Membership tier created',
  });

  return ctx.json(tier, 201);
}
