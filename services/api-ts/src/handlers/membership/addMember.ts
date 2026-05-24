import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function addMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);
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

  return ctx.json({ data: member }, 201);
}
