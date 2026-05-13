import type { Context } from 'hono';
import { MembershipRepository } from './repos/membership.repo';

export async function listMembers(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const status = ctx.req.query('status');
  const categoryId = ctx.req.query('categoryId');
  const search = ctx.req.query('search');
  const limit = parseInt(ctx.req.query('limit') ?? '50', 10);
  const offset = parseInt(ctx.req.query('offset') ?? '0', 10);

  const repo = new MembershipRepository(db);
  const result = await repo.listMembers({ organizationId: orgId, status, categoryId, search, limit, offset });

  // Flatten nested { membership, person, category } into flat objects for frontend
  const flattened = result.data.map((row: any) => {
    const m = row.membership || row;
    const p = row.person || {};
    const c = row.category || {};
    return {
      id: m.id,
      personId: m.personId || p.id,
      firstName: p.firstName || null,
      lastName: p.lastName || null,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ') || null,
      email: p.email || null,
      avatar: p.avatar || null,
      licenseNumber: p.licenseNumber || m.licenseNumber || null,
      memberNumber: m.memberNumber || null,
      categoryId: m.categoryId || null,
      categoryName: c.name || null,
      status: m.status || 'pending',
      duesExpiryDate: m.duesExpiryDate || null,
      gracePeriodDays: m.gracePeriodDays || 30,
      joinedAt: m.joinedAt || m.createdAt || null,
      startDate: m.startDate || null,
      organizationId: m.organizationId || null,
    };
  });

  return ctx.json({ data: flattened, meta: { total: result.total, limit, offset } }, 200);
}
