import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { InviteAdminBody } from '@/generated/openapi/validators';
import { ConflictError } from '@/core/errors';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

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

  // P0: Only super admins can invite new admins
  const callerAdmin = ctx.get('platformAdmin') as { role: string } | undefined;
  if (!callerAdmin || callerAdmin.role !== 'super') {
    return ctx.json({ error: 'Super admin access required' }, 403);
  }

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

  await auditAction(ctx, {
    action: 'create',
    resourceType: 'platform-admin',
    resourceId: admin.id,
    description: `Platform admin "${admin.name}" (${admin.role}) invited`,
  });

  return ctx.json(admin, 201);
}