import type { ValidatedContext, AuditEventEntry } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { MembershipRepository } from '../membership/repos/membership.repo';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';
import { hashToken, isExpired } from './utils/token';
import { domainEvents } from '@/core/domain-events';
import { getInviteTokenSecret } from '@/core/config';

/**
 * claimInvite
 *
 * Claims an invitation token, activating the user's membership.
 * The user must already be authenticated (account created via registration).
 * Automatically creates a membership record in the organization.
 */
export async function claimInvite(
  ctx: ValidatedContext<any, never, { token: string }>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const token = ctx.req.param('token');
  if (!token) {
    return ctx.json({ error: 'Token is required' }, 400);
  }

  const secret = getInviteTokenSecret();
  const tokenHash = hashToken(token, secret);

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const inviteRepo = new InviteRepository(db, logger);

  const invite = await inviteRepo.findByTokenHash(tokenHash);
  if (!invite) {
    throw new NotFoundError('Invitation');
  }

  if (invite.status === 'claimed') {
    throw new ConflictError('This invitation has already been claimed');
  }

  if (invite.status === 'revoked') {
    throw new BusinessLogicError('This invitation has been revoked', 'INVITE_REVOKED');
  }

  if (isExpired(invite.expiresAt)) {
    throw new BusinessLogicError('This invitation has expired', 'INVITE_EXPIRED');
  }

  // Audit trail: array reference shared with per-route audit middleware so
  // pre-throw entries persist if a later step throws.
  const auditEvents: AuditEventEntry[] = [];
  ctx.set('auditEvents', auditEvents);

  // Guard against an existing membership BEFORE any write (read-only).
  const membershipRepo = new MembershipRepository(db);
  const existingMembership = await membershipRepo.getMember(invite.organizationId, user.id);

  if (existingMembership) {
    throw new ConflictError('Already a member of this organization');
  }

  const metadata = invite.metadata as {
    membershipTierId?: string;
    membershipCategoryId?: string;
    licenseNumber?: string;
  } | null;

  // BUG-2 fix (part 1): tier_id is NOT NULL at the DB level. Previously a missing
  // tier was null-cast straight into the column, deferring an opaque DB failure
  // to mid-claim. Validate up front so a null never reaches the write and the
  // failure surfaces as a clean 4xx before the invite is touched.
  const tierId = metadata?.membershipTierId;
  if (!tierId) {
    throw new ValidationError('Invitation is missing a membership tier and cannot be claimed');
  }

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  // BUG-2 fix (part 2): markClaimed + addMember in ONE transaction. Previously
  // they ran unwrapped, so an addMember failure after a successful markClaimed
  // burned the invite while creating no membership — locking the invitee out
  // permanently. Any failure now rolls the whole claim back.
  const membership = await db.transaction(async (tx: DatabaseInstance) => {
    const txInviteRepo = new InviteRepository(tx, logger);
    const txMembershipRepo = new MembershipRepository(tx);

    await txInviteRepo.markClaimed(invite.id);

    return txMembershipRepo.addMember({
      organizationId: invite.organizationId,
      personId: user.id,
      tierId,
      categoryId: metadata?.membershipCategoryId ?? null,
      memberNumber: metadata?.licenseNumber ?? null,
      startDate: now.toISOString().split('T')[0]!,
      duesExpiryDate: oneYearFromNow.toISOString().split('T')[0]!,
      gracePeriodDays: 30,
      status: 'active',
      joinedAt: now,
      createdBy: user.id,
      updatedBy: user.id,
    });
  });

  auditEvents.push({
    action: 'complete',
    resourceType: 'invitation',
    resource: invite.id,
    description: `Invitation claimed by user ${user.id} for org ${invite.organizationId}`,
  });

  auditEvents.push({
    action: 'create',
    resourceType: 'membership',
    resource: membership.id,
    description: `Membership created for user ${user.id} in org ${invite.organizationId} via invite claim`,
  });

  // Emit domain events for invite claim + membership creation
  domainEvents.emit('invite.claimed', {
    inviteId: invite.id,
    personId: user.id,
    organizationId: invite.organizationId,
    membershipId: membership.id,
  }).catch(() => {});

  domainEvents.emit('membership.created', {
    membershipId: membership.id,
    personId: user.id,
    organizationId: invite.organizationId,
    source: 'invite',
  }).catch(() => {});

  // Look up org slug for frontend redirect (non-critical — don't fail claim if lookup fails)
  let organizationSlug: string | null = null;
  try {
    const orgRepo = new OrganizationRepository(db, logger);
    const org = await orgRepo.findById(invite.organizationId);
    organizationSlug = org?.slug ?? null;
  } catch {
    // Slug lookup is best-effort; frontend falls back to /my/organizations
  }

  return ctx.json({
    claimed: true,
    organizationId: invite.organizationId,
    organizationSlug,
    metadata: invite.metadata,
    membershipStatus: 'joined',
    membershipId: membership.id,
  });
}
