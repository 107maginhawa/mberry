import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function updateMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const memberId = ctx.req.param('memberId');
  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);
  const existing = await repo.getMember(orgId, memberId);
  if (!existing) throw new NotFoundError('Member not found');

  const status = body.status ?? existing.membership.status;

  const updated = await repo.updateMember(existing.membership.id, {
    categoryId: body.categoryId ?? existing.membership.categoryId,
    tierId: body.tierId ?? existing.membership.tierId,
    status,
    memberNumber: body.memberNumber ?? body.licenseNumber ?? existing.membership.memberNumber,
    note: body.note ?? existing.membership.note,
    terminatedAt: status === 'terminated' ? new Date() : existing.membership.terminatedAt,
    terminationReason: body.terminationReason ?? existing.membership.terminationReason,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
