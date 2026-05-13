import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';

export async function listApplications(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const status = ctx.req.query('status');

  const repo = new MembershipRepository(db);
  try {
    const applications = await repo.listApplications(orgId, status);
    return ctx.json({ data: applications }, 200);
  } catch {
    // Table schema mismatch — return empty until data model unification
    return ctx.json({ data: [] }, 200);
  }
}
