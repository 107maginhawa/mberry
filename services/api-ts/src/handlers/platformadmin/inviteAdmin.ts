import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { InviteAdminBody } from '@/generated/openapi/validators';
import { ConflictError } from '@/core/errors';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

/**
 * inviteAdmin
 *
 * Path: POST /admin/admins
 * OperationId: inviteAdmin
 */
export async function inviteAdmin(
  ctx: ValidatedContext<InviteAdminBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  // FIX-008 (G1) / Q1: inviting a new admin is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PlatformAdminRepository(db, logger);

  // Check duplicate email
  const existing = await repo.findByEmail(body.email);
  if (existing) {
    throw new ConflictError('Admin with this email already exists');
  }

  const user = ctx.get('user');
  const admin = await repo.create({
    userId: crypto.randomUUID(),
    email: body.email.toLowerCase(),
    name: body.name,
    role: body.role,
  });

  ctx.set('auditResourceId', admin.id);
  ctx.set('auditDescription', `Platform admin "${admin.name}" (${admin.role}) invited`);

  // [EM-M03-d1e2f3a4] Emit spec-declared AdminInvited event so the invite
  // email can be delivered by a downstream consumer (WF-022 step 2).
  domainEvents
    .emit('admin.invited', { adminId: admin.id, email: admin.email, role: admin.role })
    .catch(() => {});

  return ctx.json(admin, 201);
}