import crypto from 'node:crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { StartImpersonationBody } from '@/generated/openapi/validators';
import { ForbiddenError } from '@/core/errors';
import { PlatformAdminRepository, ImpersonationSessionRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/** Only super and support roles may impersonate. */
const IMPERSONATION_ALLOWED_ROLES = ['super', 'support'];

/**
 * startImpersonation
 *
 * Path: POST /admin/impersonate
 * OperationId: startImpersonation
 */
export async function startImpersonation(
  ctx: ValidatedContext<StartImpersonationBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const user = ctx.get('user');
  if (!user) return ctx.json({ error: 'Unauthorized' }, 401);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const adminRepo = new PlatformAdminRepository(db, logger);
  const impRepo = new ImpersonationSessionRepository(db, logger);

  // Look up the calling admin to verify their role
  const admin = await adminRepo.findById(user.id);
  if (!admin || !IMPERSONATION_ALLOWED_ROLES.includes(admin.role)) {
    throw new ForbiddenError('Only super and support admins can impersonate users');
  }

  // Create a 30-minute scoped token
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
  const sessionToken = crypto.randomBytes(32).toString('hex');

  const impSession = await impRepo.create({
    adminId: user.id,
    targetUserId: body.targetUserId,
    targetOrgId: body.targetOrgId ?? null,
    sessionToken,
    startedAt: now,
    expiresAt,
  });

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'impersonation-session',
    resourceId: impSession.id,
    description: `Admin ${admin.name} started impersonating user ${body.targetUserId}`,
    details: { adminId: user.id, targetUserId: body.targetUserId },
  });

  return ctx.json(impSession, 201);
}