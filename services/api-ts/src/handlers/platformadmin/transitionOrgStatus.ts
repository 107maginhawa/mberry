import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { TransitionOrgStatusBody, TransitionOrgStatusParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { OrganizationRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';

// [EM-M03-c7d8e9f0] trial -> cancelled (trial expired, no conversion) is a
// spec-declared transition (M3-R10) — was missing, blocking the trial-expiry flow.
const VALID_TRANSITIONS: Record<string, string[]> = {
  trial: ['active', 'cancelled'],
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

  // FIX-001 (G1) / Matrix §3.7: transitioning org status is a super-only
  // platform mutation. analyst/support must be rejected. Mirrors
  // createAssociation.ts:20-24.
  const callerAdmin = ctx.get('platformAdmin') as { role: string } | undefined;
  if (!callerAdmin || callerAdmin.role !== 'super') {
    return ctx.json({ error: 'Super admin access required' }, 403);
  }

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

  ctx.set('auditResourceId', organizationId);
  ctx.set('auditDescription', `Organization status transitioned from "${currentStatus}" to "${targetStatus}"`);

  // [EM-M03-d1e2f3a4] Emit the spec-declared OrgStatusTransitioned event so
  // cross-module consumers (M04/M05) can react to lifecycle changes.
  domainEvents
    .emit('org.status.transitioned', {
      organizationId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
    })
    .catch(() => {});

  return ctx.json(updated, 200);
}