import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { DeleteFeatureFlagParams } from '@/generated/openapi/validators';
import { NotFoundError } from '@/core/errors';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { requireAdminTier, SUPER_ONLY } from '@/core/auth/admin-tier';

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

  // FIX-008 (G1) / Q1: deleting a feature flag is a super-only mutation.
  const denied = requireAdminTier(ctx, SUPER_ONLY);
  if (denied) return denied;

  const { flagId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new FeatureFlagRepository(db, logger);

  const existing = await repo.findById(flagId);
  if (!existing) {
    throw new NotFoundError('Feature flag not found');
  }

  await repo.delete(flagId);

  ctx.set('auditResourceId', flagId);
  ctx.set('auditDescription', `Feature flag "${existing.moduleName}" deleted for ${existing.targetType}:${existing.targetId}`);

  return ctx.body(null, 204);
}