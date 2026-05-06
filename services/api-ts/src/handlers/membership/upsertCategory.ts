import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

export async function upsertCategory(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('orgId');
  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);
  const category = await repo.upsertCategory({
    organizationId: orgId,
    name: body.name,
    description: body.description,
    applicableTiers: body.applicableTiers ?? [],
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: category }, 200);
}
