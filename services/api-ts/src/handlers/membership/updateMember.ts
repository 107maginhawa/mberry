import type { Context } from 'hono';
import { NotFoundError } from '@/core/errors';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

// [BR-03] Valid membership state transitions.
// PENDING → ACTIVE/REMOVED handled by reviewApplication, not here.
// ACTIVE → GRACE and GRACE → LAPSED are automatic (computed from dues_expiry_date).
// LAPSED → ACTIVE happens via payment recording (BR-07).
// This map covers officer-initiated transitions through updateMember.
const VALID_TRANSITIONS: Record<string, string[]> = {
  active: ['suspended', 'removed'],
  grace: ['suspended'],
  lapsed: ['suspended', 'active'],
  suspended: ['active'],
};

function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true; // no-op is always valid
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const memberId = ctx.req.param('memberId');
  const body = await ctx.req.json();

  const repo = new MembershipRepository(db);
  let existing = await repo.getMember(orgId, memberId);
  if (!existing) {
    existing = await repo.getMemberById(memberId);
  }
  if (!existing) throw new NotFoundError('Member not found');

  const currentStatus = existing.membership.status;
  const requestedStatus = body.status ?? currentStatus;

  // [BR-03] Silently reject invalid transitions — no error, no state change
  const status = isValidTransition(currentStatus, requestedStatus)
    ? requestedStatus
    : currentStatus;

  const updated = await repo.updateMember(existing.membership.id, {
    categoryId: body.categoryId ?? existing.membership.categoryId,
    tierId: body.tierId ?? existing.membership.tierId,
    status,
    memberNumber: body.memberNumber ?? body.licenseNumber ?? existing.membership.memberNumber,
    note: body.note ?? existing.membership.note,
    removedAt: status === 'removed' ? new Date() : existing.membership.removedAt,
    removalReason: body.removalReason ?? existing.membership.removalReason,
    updatedBy: session.user.id,
  });

  return ctx.json({ data: updated }, 200);
}
