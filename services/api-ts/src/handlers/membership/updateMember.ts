import type { Context } from 'hono';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';
import { MembershipRepository } from './repos/membership.repo';
import type { Session } from '@/types/auth';

// [V-20] Zod schema for updateMember request body
const VALID_STATUSES = ['active', 'suspended', 'removed', 'grace', 'lapsed'] as const;

// [BR-03] Officer-initiated membership transitions (subset of full state machine).
// The full transition map lives in association:member/utils/status-transitions.ts.
// This restricted map only covers what officers can do via updateMember:
// - PENDING → ACTIVE/REMOVED is handled by reviewApplication, not here.
// - ACTIVE → GRACE and GRACE → LAPSED are automatic (computed from dues_expiry_date).
// - LAPSED → ACTIVE happens via payment recording (BR-07).
const OFFICER_TRANSITIONS: Record<string, string[]> = {
  active: ['suspended', 'removed'],
  grace: ['suspended'],
  gracePeriod: ['suspended'],
  lapsed: ['suspended', 'active'],
  suspended: ['active'],
};

function isValidOfficerTransition(from: string, to: string): boolean {
  if (from === to) return true; // no-op is always valid
  return OFFICER_TRANSITIONS[from]?.includes(to) ?? false;
}

const updateMemberSchema = z.object({
  status: z.enum(VALID_STATUSES).optional(),
  categoryId: z.string().optional(),
  tierId: z.string().optional(),
  memberNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  note: z.string().nullable().optional(),
  removalReason: z.string().nullable().optional(),
}).passthrough();

export async function updateMember(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId')!;
  const memberId = ctx.req.param('memberId')!;
  const rawBody = await ctx.req.json();
  const parseResult = updateMemberSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const messages = parseResult.error?.issues?.map(e => e.message).join(', ') ?? 'Invalid input';
    throw new ValidationError(messages);
  }
  const body = parseResult.data;

  const repo = new MembershipRepository(db);
  let existing = await repo.getMember(orgId, memberId);
  if (!existing) {
    existing = await repo.getMemberById(memberId);
  }
  if (!existing) throw new NotFoundError('Member not found');

  const currentStatus = existing.membership.status;
  // Map 'grace' input alias to the DB enum value 'gracePeriod'
  const rawRequestedStatus = body.status ?? currentStatus;
  const requestedDbStatus = rawRequestedStatus === 'grace' ? 'gracePeriod' : rawRequestedStatus;

  // [BR-03] Silently reject invalid officer-initiated transitions — no error, no state change.
  // Full state machine defined in association:member/utils/status-transitions.ts;
  // this handler only allows the officer-initiated subset.
  const status = isValidOfficerTransition(currentStatus, requestedDbStatus)
    ? requestedDbStatus
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

  // Emit domain event when status actually changed
  if (status !== currentStatus) {
    await domainEvents.emit('membership.status.changed', {
      membershipId: existing.membership.id,
      personId: existing.membership.personId ?? '',
      organizationId: orgId,
      oldStatus: currentStatus,
      newStatus: status,
    });
  }

  return ctx.json({ data: updated }, 200);
}
