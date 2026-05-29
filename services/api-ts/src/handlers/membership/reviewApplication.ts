import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import { DuesConfigRepository } from '../association:member/repos/dues.repo';
import type { Session } from '@/types/auth';
import { domainEvents } from '@/core/domain-events';
import { auditAction } from '@/utils/audit';

export async function reviewApplication(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const appId = ctx.req.param('appId')!;
  const body = await ctx.req.json();

  // Map old status values to new schema enums
  let status = body.status;
  if (status === 'pending') status = 'submitted';
  if (status === 'rejected') status = 'denied';

  const repo = new MembershipRepository(db);
  const updated = await repo.reviewApplication(appId, status, session.user.id, body.reason);

  // If approved, create membership
  if (status === 'approved') {
    // [BR-02] Read grace period from org dues config
    const duesRepo = new DuesConfigRepository(db);
    const duesConfigs = await duesRepo.findMany({ organizationId: updated.organizationId, tierId: updated.tierId, status: 'active' });
    const gracePeriodDays = duesConfigs[0]?.gracePeriodDays ?? 30;

    const membership = await repo.addMember({
      organizationId: updated.organizationId,
      personId: updated.personId!,
      tierId: updated.tierId,
      startDate: new Date().toISOString().split('T')[0]!,
      duesExpiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]!,
      gracePeriodDays,
      status: 'active',
      joinedAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    domainEvents.emit('membership.created', {
      membershipId: membership.id,
      personId: updated.personId!,
      organizationId: updated.organizationId,
      source: 'application',
    }).catch(() => {});
  }

  const auditSubType = status === 'approved' ? 'membership.member-approved'
    : status === 'denied' ? 'membership.member-denied'
    : 'membership.application-submitted';

  await auditAction(ctx, {
    action: status === 'approved' ? 'approve' : status === 'denied' ? 'deny' : 'update',
    resourceType: 'application',
    resourceId: appId,
    description: `Application ${status}: ${body.reason ?? 'no reason provided'}`,
    eventSubType: auditSubType,
    details: { personId: updated.personId, status },
  });

  return ctx.json({ data: updated }, 200);
}
