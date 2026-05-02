import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';

export async function getMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const memberId = ctx.req.param('memberId');

  const repo = new MembershipRepository(db);
  const member = await repo.getMember(orgId, memberId);
  if (!member) throw new NotFoundError('Member not found');

  return ctx.json({ data: member }, 200);
}
