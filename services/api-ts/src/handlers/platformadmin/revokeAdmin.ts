import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { RevokeAdminParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * revokeAdmin
 *
 * Path: DELETE /admin/admins/{adminId}
 * OperationId: revokeAdmin
 */
export async function revokeAdmin(
  ctx: ValidatedContext<never, never, RevokeAdminParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { adminId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PlatformAdminRepository(db, logger);

  const admin = await repo.findById(adminId);
  if (!admin) {
    throw new NotFoundError('Admin not found');
  }

  // Cannot remove last super admin
  if (admin.role === 'super') {
    const superCount = await repo.countByRole('super');
    if (superCount <= 1) {
      throw new BusinessLogicError(
        'Cannot remove the last super admin',
        'LAST_SUPER_ADMIN',
      );
    }
  }

  await repo.delete(adminId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'platform-admin',
    resourceId: adminId,
    description: `Platform admin "${admin.name}" (${admin.role}) revoked`,
  });

  return ctx.body(null, 204);
}