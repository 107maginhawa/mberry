import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { MembershipRepository } from '../membership/repos/membership.repo';
import { OrganizationRepository } from '../platformadmin/repos/platform-admin.repo';
import { hashToken, isExpired } from './utils/token';
import { auditAction } from '@/utils/audit';

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

  const secret = process.env['INVITE_TOKEN_SECRET'] || 'dev-secret-change-in-production';
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

  // Mark as claimed
  const claimed = await inviteRepo.markClaimed(invite.id);

  await auditAction(ctx, {
    action: 'complete',
    resourceType: 'invitation',
    resourceId: invite.id,
    description: `Invitation claimed by user ${user.id} for org ${invite.organizationId}`,
  });

  // Create membership record for the user in the org
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

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const membership = await membershipRepo.addMember({
    organizationId: invite.organizationId,
    personId: user.id,
    tierId: metadata?.membershipTierId ?? null as any,
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

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'membership',
    resourceId: membership.id,
    description: `Membership created for user ${user.id} in org ${invite.organizationId} via invite claim`,
  });

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
