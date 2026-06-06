import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import type { SetFeatureFlagBody } from '@/generated/openapi/validators';
import { FeatureFlagRepository } from './repos/platform-admin.repo';
import { domainEvents } from '@/core/domain-events';
import { BusinessLogicError } from '@/core/errors';

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

  // WF-018: the authentication module must be always-on — disabling it would lock
  // every user out, so the toggle is refused regardless of target scope.
  if (body.moduleName === 'authentication' && !body.enabled) {
    throw new BusinessLogicError('Cannot disable the authentication module', 'AUTH_MODULE_PROTECTED');
  }

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const repo = new FeatureFlagRepository(db, logger);

  const flag = await repo.upsert({
    targetType: body.targetType,
    targetId: body.targetId,
    moduleName: body.moduleName,
    enabled: body.enabled,
  });

  ctx.set('auditResourceId', flag.id);
  ctx.set('auditDescription', `Feature flag "${body.moduleName}" ${body.enabled ? 'enabled' : 'disabled'} for ${body.targetType}:${body.targetId}`);

  // [EM-M03-d1e2f3a4] Emit spec-declared FeatureFlagChanged event.
  domainEvents
    .emit('feature_flag.changed', {
      targetType: body.targetType,
      targetId: body.targetId,
      moduleName: body.moduleName,
      enabled: body.enabled,
    })
    .catch(() => {});

  // AC-M03-002: Include warning when disabling a feature flag
  const response: Record<string, unknown> = { ...flag };
  if (!body.enabled) {
    response['warning'] = `Disabling "${body.moduleName}" will remove access for ${body.targetType}:${body.targetId}. This takes effect immediately.`;
  }

  return ctx.json(response, 200);
}