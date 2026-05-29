import type { Context } from 'hono';
import { ConflictError, ForbiddenError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';
import { OfficerTermRepository } from '../association:member/repos/governance.repo';
import { auditAction } from '@/utils/audit';
import type { Session } from '@/types/auth';

export async function addMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;

  // P0: Verify caller is an officer in this org
  const officerRepo = new OfficerTermRepository(db);
  const terms = await officerRepo.findActiveByPersonAndOrg(session.user.id, orgId);
  if (terms.length === 0) {
    throw new ForbiddenError('Officer access required to add members');
  }

  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);

  // P0: Check for duplicate membership before insert
  try {
    const member = await repo.addMember({
      organizationId: orgId,
      personId: body.personId,
      tierId: body.tierId,
      categoryId: body.categoryId,
      memberNumber: body.memberNumber ?? body.licenseNumber,
      startDate: body.startDate ?? new Date().toISOString().split('T')[0],
      duesExpiryDate: body.duesExpiryDate ?? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      gracePeriodDays: body.gracePeriodDays ?? 30,
      status: 'active',
      joinedAt: new Date(),
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    await auditAction(ctx, {
      action: 'create',
      resourceType: 'membership',
      resourceId: member.id,
      description: `Member added to organization ${orgId}`,
      eventSubType: 'membership.member-added',
      details: { personId: body.personId, organizationId: orgId, status: 'active' },
    });

    return ctx.json({ data: member }, 201);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as any).code === '23505') {
      throw new ConflictError('Member already exists in this organization');
    }
    throw err;
  }
}
