import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError, UnauthorizedError, ConflictError } from '@/core/errors';
import type { CreateMembershipApplicationBody } from '@/generated/openapi/validators';
import { MembershipTierRepository, MembershipApplicationRepository } from './repos/membership.repo';
import { auditAction } from '@/utils/audit';

/**
 * createMembershipApplication
 *
 * Path: POST /association/member/applications
 * OperationId: createMembershipApplication
 */
export async function createMembershipApplication(
  ctx: ValidatedContext<CreateMembershipApplicationBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const tenantId = ctx.get('tenantId');
  if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const tierRepo = new MembershipTierRepository(db, logger);
  const appRepo = new MembershipApplicationRepository(db, logger);

  const orgId = body.organizationId;

  // Validate tier exists
  const tier = await tierRepo.findOneById(body.tierId);
  if (!tier) throw new NotFoundError('Membership tier');

  // Check no existing pending application for this person+org
  const existing = await appRepo.findOne({
    tenantId,
    personId: body.personId,
    orgId,
    status: 'submitted',
  });
  if (existing) {
    throw new ConflictError('A pending application already exists for this person in this organization');
  }

  const application = await appRepo.createOne({
    tenantId,
    personId: body.personId,
    orgId,
    tierId: body.tierId,
    applicationDate: (body.applicationDate || new Date().toISOString().split('T')[0]) as string,
    status: 'submitted',
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership-application',
    resourceId: application.id,
    description: 'Membership application created',
  });

  return ctx.json(application, 201);
}
