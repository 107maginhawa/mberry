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

  const updated = await repo.updateMember(existing.membership.id, {
    categoryId: body.categoryId ?? existing.membership.categoryId,
    status: body.status ?? existing.membership.status,
    suspendedAt: body.status === 'suspended' ? new Date() : existing.membership.suspendedAt,
    suspendedReason: body.suspendedReason ?? existing.membership.suspendedReason,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
