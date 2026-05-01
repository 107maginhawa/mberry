import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { ListFeatureFlagsQuery } from '@/generated/openapi/validators';
import { FeatureFlagRepository } from './repos/platform-admin.repo';

/**
 * listFeatureFlags
 *
 * Path: GET /admin/feature-flags
 * OperationId: listFeatureFlags
 */
export async function listFeatureFlags(
  ctx: ValidatedContext<never, ListFeatureFlagsQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new FeatureFlagRepository(db, logger);

  const flags = await repo.findByTarget(query.targetType, query.targetId);

  return ctx.json(flags, 200);
}