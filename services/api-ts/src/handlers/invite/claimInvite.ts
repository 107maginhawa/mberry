import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ConflictError, NotFoundError, ValidationError, BusinessLogicError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { hashToken, isExpired } from './utils/token';
import { auditAction } from '@/utils/audit';

/**
 * claimInvite
 *
 * Claims an invitation token, activating the user's membership.
 * The user must already be authenticated (account created via registration).
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

  // DEFERRED(M05): Create membership record for the user in the org.
  // Blocked on M05 Membership module — will wire createMembership() here.

  return ctx.json({
    claimed: true,
    organizationId: invite.organizationId,
    metadata: invite.metadata,
  });
}
