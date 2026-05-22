import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteFeatureFlagParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * deleteFeatureFlag
 *
 * Path: DELETE /admin/feature-flags/{flagId}
 * OperationId: deleteFeatureFlag
 */
export async function deleteFeatureFlag(
  ctx: ValidatedContext<never, never, DeleteFeatureFlagParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const { flagId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new FeatureFlagRepository(db, logger);

  const existing = await repo.findById(flagId);
  if (!existing) {
    throw new NotFoundError('Feature flag not found');
  }

  await repo.delete(flagId);

  await auditAction(ctx, {
    action: 'delete',
    resourceType: 'feature-flag',
    resourceId: flagId,
    description: `Feature flag "${existing.moduleName}" deleted for ${existing.targetType}:${existing.targetId}`,
  });

  return ctx.body(null, 204);
}