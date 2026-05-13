import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, ConflictError, ValidationError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { generateInviteToken, defaultExpiryDate } from './utils/token';
import { auditAction } from '@/utils/audit';

/**
 * createInvite
 *
 * Creates an invitation token for a prospective member.
 * Called by officers to invite individuals or during bulk import.
 */
export async function createInvite(
  ctx: ValidatedContext<any, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const orgId = ctx.get('orgId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const inviteRepo = new InviteRepository(db, logger);

  const email = body.email?.toLowerCase()?.trim();
  if (!email) {
    throw new ValidationError('Email is required');
  }

  // Check for existing pending invite to same email+org
  const existing = await inviteRepo.findPendingByEmail(email, orgId);
  if (existing) {
    throw new ConflictError('An active invitation already exists for this email');
  }

  // Generate HMAC-signed token
  const secret = process.env['INVITE_TOKEN_SECRET'] || 'dev-secret-change-in-production';
  const { raw, hash } = generateInviteToken(secret);

  const invite = await inviteRepo.create({
    organizationId: orgId,
    personId: body.personId || null,
    tokenHash: hash,
    type: body.type || 'invite',
    expiresAt: defaultExpiryDate(),
    createdByOfficer: user.id,
    email,
    message: body.message || null,
    metadata: body.metadata || null,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'invitation',
    resourceId: invite.id,
    description: `Invitation created for ${email}`,
  });

  // Return the raw token (only time it's visible — not stored)
  return ctx.json({
    id: invite.id,
    token: raw,
    email: invite.email,
    type: invite.type,
    expiresAt: invite.expiresAt,
    status: invite.status,
  }, 201);
}
