import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SetFeatureFlagBody } from '@/generated/openapi/validators';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { auditAction } from '@/utils/audit';

/**
 * setFeatureFlag
 *
 * Path: POST /admin/feature-flags
 * OperationId: setFeatureFlag
 */
export async function setFeatureFlag(
  ctx: ValidatedContext<SetFeatureFlagBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) return ctx.json({ error: 'Unauthorized' }, 401);

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new FeatureFlagRepository(db, logger);

  const flag = await repo.upsert({
    targetType: body.targetType,
    targetId: body.targetId,
    moduleName: body.moduleName,
    enabled: body.enabled,
  });

  await auditAction(ctx, {
    action: 'update',
    resourceType: 'feature-flag',
    resourceId: flag.id,
    description: `Feature flag "${body.moduleName}" ${body.enabled ? 'enabled' : 'disabled'} for ${body.targetType}:${body.targetId}`,
  });

  // AC-M03-002: Include warning when disabling a feature flag
  const response: Record<string, unknown> = { ...flag };
  if (!body.enabled) {
    response['warning'] = `Disabling "${body.moduleName}" will remove access for ${body.targetType}:${body.targetId}. This takes effect immediately.`;
  }

  return ctx.json(response, 200);
}