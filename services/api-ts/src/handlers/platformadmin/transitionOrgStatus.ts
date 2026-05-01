import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { TransitionOrgStatusBody, TransitionOrgStatusParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/** Valid status transitions. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  trial: ['active'],
  active: ['suspended', 'cancelled'],
  suspended: ['active', 'cancelled'],
  cancelled: ['active'],
};

/**
 * transitionOrgStatus
 *
 * Path: POST /admin/organizations/{organizationId}/transition
 * OperationId: transitionOrgStatus
 */
export async function transitionOrgStatus(
  ctx: ValidatedContext<TransitionOrgStatusBody, never, TransitionOrgStatusParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { organizationId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new OrganizationRepository(db, logger);

  const org = await repo.findById(organizationId);
  if (!org) {
    throw new NotFoundError('Organization not found');
  }

  const currentStatus = org.status;
  const targetStatus = body.status;

  // Check valid transition
  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new BusinessLogicError(
      `Invalid status transition from "${currentStatus}" to "${targetStatus}"`,
      'INVALID_TRANSITION',
    );
  }

  // cancelled -> active: only within 90 days of cancellation
  if (currentStatus === 'cancelled' && targetStatus === 'active') {
    const updatedAt = org.updatedAt ? new Date(org.updatedAt) : new Date();
    const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 90) {
      throw new BusinessLogicError(
        'Cannot reactivate organization more than 90 days after cancellation',
        'REACTIVATION_WINDOW_EXPIRED',
      );
    }
  }

  const updated = await repo.update(organizationId, { status: targetStatus });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'organization',
    resourceId: organizationId,
    description: `Organization status transitioned from "${currentStatus}" to "${targetStatus}"`,
  });

  return ctx.json(updated, 200);
}