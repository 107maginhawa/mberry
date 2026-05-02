import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function reviewApplication(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const appId = ctx.req.param('appId');
  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);
  const updated = await repo.reviewApplication(appId, body.status, session.user.id, body.reason);

  // If approved, create membership
  if (body.status === 'approved') {
    await repo.addMember({
      organizationId: updated.organizationId,
      personId: updated.personId,
      categoryId: updated.categoryId ?? undefined,
      status: 'active',
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
  }

  return ctx.json({ data: updated }, 200);
}
