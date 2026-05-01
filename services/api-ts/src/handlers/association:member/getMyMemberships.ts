import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { MembershipRepository } from './repos/membership.repo';

/**
 * getMyMemberships
 *
 * Returns all memberships for the authenticated user across all organizations.
 * Derives personId from the authenticated session — no path param needed.
 */
export async function getMyMemberships(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new MembershipRepository(db, ctx.get('logger'));

  const memberships = await repo.findAllByPerson(user.id);

  return ctx.json({ data: memberships }, 200);
}
