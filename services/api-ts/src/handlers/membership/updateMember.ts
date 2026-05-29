import type { Context } from 'hono';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '@/core/errors';
import { domainEvents } from '@/core/domain-events';
import { MembershipRepository } from './repos/membership.repo';
import { persistWithComputedStatus } from '../association:member/utils/membership-status-middleware';
import type { DatabaseInstance } from '@/core/database';
import type { Session } from '@/types/auth';
import { auditAction } from '@/utils/audit';

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
  const db = ctx.get('database') as DatabaseInstance;
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

  // [BR-01] Map requested status to flag fields — never write status directly.
  const flagUpdates: { suspendedAt?: Date | null; removedAt?: Date | null } = {};
  if (status !== currentStatus) {
    if (status === 'suspended') {
      flagUpdates.suspendedAt = new Date();
    } else if (status === 'removed') {
      flagUpdates.removedAt = new Date();
    } else if (status === 'active') {
      // Reinstate: clear suspension and removal flags
      flagUpdates.suspendedAt = null;
      flagUpdates.removedAt = null;
    }
  }

  // Write status-affecting flag fields via persistWithComputedStatus (BR-01).
  let computedStatus: string | undefined;
  if (Object.keys(flagUpdates).length > 0) {
    const persisted = await persistWithComputedStatus(db, existing.membership.id, existing.membership, flagUpdates);
    computedStatus = persisted.status;
  }

  // Write non-status fields separately.
  const updatedNonStatus = await repo.updateMember(existing.membership.id, {
    categoryId: body.categoryId ?? existing.membership.categoryId,
    tierId: body.tierId ?? existing.membership.tierId,
    memberNumber: body.memberNumber ?? body.licenseNumber ?? existing.membership.memberNumber,
    note: body.note ?? existing.membership.note,
    removalReason: body.removalReason ?? existing.membership.removalReason,
    updatedBy: session.user.id,
  });

  // Merge computed status into response so callers see the actual current status.
  const updated = computedStatus
    ? { ...updatedNonStatus, status: computedStatus }
    : updatedNonStatus;

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

  if (status !== currentStatus) {
    const subTypeMap: Record<string, string> = {
      suspended: 'membership.member-suspended',
      removed: 'membership.member-terminated',
      active: 'membership.member-reinstated',
    };
    await auditAction(ctx, {
      action: status === 'suspended' ? 'terminate' : status === 'removed' ? 'terminate' : 'reinstate',
      resourceType: 'membership',
      resourceId: existing.membership.id,
      description: `Membership status changed: ${currentStatus} → ${status}`,
      eventSubType: subTypeMap[status] ?? 'membership.member-suspended',
      details: { personId: existing.membership.personId, oldStatus: currentStatus, newStatus: status },
    });
  }

  return ctx.json({ data: updated }, 200);
}
