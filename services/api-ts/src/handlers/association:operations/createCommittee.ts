import type { Context } from 'hono';
import { CommitteeRepository } from './repos/committee.repo';
import type { Session } from '@/types/auth';

export async function createCommittee(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const body = await ctx.req.json();

  if (!body.name) {
    return ctx.json({ error: 'name is required' }, 400);
  }

  const repo = new CommitteeRepository(db);

  const committee = await repo.create({
    organizationId: orgId,
    name: body.name,
    description: body.description ?? null,
    status: body.status ?? 'active',
    createdBy: session.user.id,
    updatedBy: session.user.id,
  });

  ctx.set('auditResourceId', committee.id);
  ctx.set('auditDescription', `Created committee: ${committee.name}`);

  return ctx.json({ data: committee }, 201);
}
