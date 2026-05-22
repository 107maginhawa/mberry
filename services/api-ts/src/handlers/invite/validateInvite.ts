import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { NotFoundError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { hashToken, isExpired } from './utils/token';

/**
 * validateInvite
 *
 * Public endpoint — validates an invite token without claiming it.
 * Used by the frontend to show pre-populated data on the claim page.
 */
export async function validateInvite(
  ctx: ValidatedContext<never, never, { token: string }>
): Promise<Response> {
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
    return ctx.json({ error: 'Invalid invitation link' }, 404);
  }

  if (invite.status === 'claimed') {
    return ctx.json({
      error: 'This account has already been activated',
      code: 'ALREADY_CLAIMED',
    }, 410);
  }

  if (invite.status === 'revoked') {
    return ctx.json({
      error: 'This invitation has been revoked',
      code: 'REVOKED',
    }, 410);
  }

  if (isExpired(invite.expiresAt)) {
    return ctx.json({
      error: 'This invitation has expired',
      code: 'EXPIRED',
      orgId: invite.organizationId,
    }, 410);
  }

  // Return pre-populated data for the claim form
  return ctx.json({
    valid: true,
    email: invite.email,
    orgId: invite.organizationId,
    type: invite.type,
    metadata: invite.metadata,
    expiresAt: invite.expiresAt,
  });
}
