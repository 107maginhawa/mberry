import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, ConflictError, ValidationError } from '@/core/errors';
import { InviteRepository } from './repos/invite.repo';
import { generateInviteToken, defaultExpiryDate } from './utils/token';
import { requireOfficerTerm } from '@/core/auth/officer-checks';
import { getInviteTokenSecret } from '@/core/config';

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

  const orgId = ctx.get('organizationId');
  if (!orgId) return ctx.json({ error: 'Organization context required' }, 403);

  // FIX-003 (G4) / m01 §6: only officers may issue invitations. A plain
  // active member must be rejected. requireOfficerTerm verifies an active
  // officer term for this org (and enforces 2FA for privileged titles in
  // production — see FIX-002).
  const officerDenied = await requireOfficerTerm(ctx);
  if (officerDenied) return officerDenied;

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
  const secret = getInviteTokenSecret();
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

  ctx.set('auditResourceId', invite.id);
  ctx.set('auditDescription', `Invitation created for ${email}`);

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
