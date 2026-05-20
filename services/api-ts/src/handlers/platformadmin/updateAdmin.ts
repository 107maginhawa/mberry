import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { UpdateAdminBody, UpdateAdminParams } from '@/generated/openapi/validators';
import { NotFoundError, BusinessLogicError } from '@/core/errors';
import { PlatformAdminRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * updateAdmin
 *
 * Path: PATCH /admin/admins/{adminId}
 * OperationId: updateAdmin
 */
export async function updateAdmin(
  ctx: ValidatedContext<UpdateAdminBody, never, UpdateAdminParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { adminId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new PlatformAdminRepository(db, logger);

  const existing = await repo.findById(adminId);
  if (!existing) {
    throw new NotFoundError('Admin not found');
  }

  // AC-M03-004: Cannot demote the last super admin
  if (
    existing.role === 'super' &&
    body.role &&
    body.role !== 'super'
  ) {
    const superCount = await repo.countByRole('super');
    if (superCount <= 1) {
      throw new BusinessLogicError(
        'Cannot demote the last super admin',
        'LAST_SUPER_ADMIN',
      );
    }
  }

  const updated = await repo.update(adminId, body);

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'platform-admin',
    resourceId: adminId,
    description: `Platform admin "${existing.name}" updated`,
  });

  return ctx.json(updated, 200);
}