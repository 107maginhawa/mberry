import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';

export async function getMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('orgId');
  const memberId = ctx.req.param('memberId');

  const repo = new MembershipRepository(db);
  const row = await repo.getMember(orgId, memberId);
  if (!row) throw new NotFoundError('Member not found');

  // Flatten nested { membership, person, category } for frontend
  const m = (row as any).membership || row;
  const p = (row as any).person || {};
  const c = (row as any).category || {};

  return ctx.json({
    data: {
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
      orgId: m.orgId || m.organizationId || null,
    },
  }, 200);
}
