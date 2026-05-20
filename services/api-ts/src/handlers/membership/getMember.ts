import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';
import { computeMembershipStatus } from '@/handlers/association:member/utils/compute-membership-status';

export async function getMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const orgId = ctx.req.param('organizationId');
  const memberId = ctx.req.param('memberId');

  const repo = new MembershipRepository(db);
  // Try by personId first, then by membership ID
  let row = await repo.getMember(orgId, memberId);
  if (!row) {
    // memberId might be the membership record ID, not personId
    row = await repo.getMemberById(memberId);
  }
  if (!row) throw new NotFoundError('Member not found');

  // Flatten nested { membership, person, category } for frontend
  const m = (row as any).membership || row;
  const p = (row as any).person || {};
  const c = (row as any).category || {};

  // [BR-01] Status is always computed on read from dues_expiry_date + grace_period_days
  const computedStatus = computeMembershipStatus({
    duesExpiryDate: m.duesExpiryDate ?? null,
    gracePeriodDays: m.gracePeriodDays ?? 30,
    suspendedAt: m.suspendedAt ?? null,
    removedAt: m.removedAt ?? null,
    isPendingPayment: m.status === 'pendingPayment',
  });

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
      status: computedStatus,
      duesExpiryDate: m.duesExpiryDate || null,
      gracePeriodDays: m.gracePeriodDays || 30,
      joinedAt: m.joinedAt || m.createdAt || null,
      startDate: m.startDate || null,
      organizationId: m.organizationId || null,
    },
  }, 200);
}
